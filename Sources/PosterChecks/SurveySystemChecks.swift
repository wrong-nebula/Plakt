import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkSurveySystems()throws {
        func tryValue(_ r:PosterShapeRecipe,_ key:String)->Double{r.parameters.first{$0.id==key}?.value ?? -1}
        func bytes(_ scene:StyleGenome,_ stage:ConstructionStage = .finished)throws->[UInt8]{try rgba(LibrarySceneRenderer.render(scene,width:320,stage:stage))}
        for id in ["survey-portal-type","survey-module-substitution","survey-scalloped-frame"] {
            var scene=try PosterShapeLibrary.scene(PosterShapePreset(recipe:PosterShapeLibrary.recipe(id)!,seed:817))
            try require(scene.elements[0].kind=="text" && !(scene.elements[0].text ?? "").isEmpty,"Semantic shape text lost")
            scene.posterCopy=PosterCopy(title:"SHAPE LOGIC");PosterShapeLibrary.resolveSurveyContent(in:&scene)
            try require(scene.elements[0].text=="SHAPE LOGIC","Source placeholder survived actual brief resolution")
            let first=try bytes(scene)
            let saved=try JSONDecoder().decode(StyleGenome.self,from:JSONEncoder().encode(scene))
            let replay=try bytes(saved)
            try require(replay==first,"Spatial type scene replay changed")
            scene.elements[0].text="MOTION SIGNAL"
            let changedText=try bytes(scene)
            try require(changedText != first,"Spatial type ignores editable text")
            scene.elements[0].text="SHAPE LOGIC";scene.elements[0].fontName="Georgia-Bold";scene.elements[0].fontProfileID=nil;scene.elements[0].fontAssetID=nil;scene.elements[0].fontAssetSHA256=nil;scene.elements[0].fontVariations=nil
            let changedFont=try bytes(scene)
            try require(changedFont != first,"Spatial type ignores selected font")
        }
        let sliced=try PosterShapeLibrary.scene(PosterShapePreset(recipe:PosterShapeLibrary.recipe("survey-sliced-orb")!,seed:817))
        let orbRecipe=PosterShapeLibrary.recipe("survey-sliced-orb")!
        try require(tryValue(orbRecipe,"displacement")==0 && tryValue(orbRecipe,"gap")==0,"Orb variations leaked into source defaults")
        let scalloped=try PosterShapeLibrary.scene(PosterShapePreset(recipe:PosterShapeLibrary.recipe("survey-scalloped-frame")!,seed:817))
        try require(scalloped.elements[0].text=="FUBU" && scalloped.elements[0].kind=="text","Scalloped letter field lost FUBU semantics")
        let blockout=try bytes(sliced,.blockout),finished=try bytes(sliced)
        try require(blockout != finished,"Tonal construction is not staged")
        let crossRecipe=PosterShapeLibrary.recipe("survey-bilateral-soft-cross")!
        let flat=try bytes(PosterShapeLibrary.scene(PosterShapePreset(recipe:crossRecipe,seed:817,parameters:["glow":0])))
        let lit=try bytes(PosterShapeLibrary.scene(PosterShapePreset(recipe:crossRecipe,seed:817,parameters:["glow":1])))
        // Any channel: two-tone material glows shift hue (red core to pink tips) as much as value.
        let materialPixels=stride(from:0,to:flat.count,by:4).filter{i in (0..<3).contains{abs(Int(flat[i+$0])-Int(lit[i+$0]))>16}}.count
        try require(materialPixels>500,"Surface glow changes metadata but has no visible material effect")
        var module=try PosterShapeLibrary.scene(PosterShapePreset(recipe:PosterShapeLibrary.recipe("survey-module-substitution")!,seed:817))
        let plain=try bytes(module)
        let url=FileManager.default.temporaryDirectory.appending(path:"poster-survey-module-fixture.png")
        let context=CGContext(data:nil,width:64,height:64,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.setFillColor(CGColor(red:1,green:0,blue:0,alpha:1));context.fill(CGRect(x:0,y:0,width:64,height:64))
        context.setFillColor(CGColor(red:0,green:0.3,blue:1,alpha:1));context.fill(CGRect(x:0,y:32,width:64,height:32))
        try PosterRenderer.png(context.makeImage()!,to:url)
        module.elements[0].rasterAsset=SceneRasterAsset(url:url,sha256:LibraryRaster.hash(try Data(contentsOf:url)),crop:.full)
        let imageModules=try bytes(module)
        try require(imageModules != plain,"Image module substitution ignored saved image")
        module.elements[0].rasterAsset?.sha256="wrong"
        try require(rejected{_ = try bytes(module)},"Image modules bypassed source checksum validation")
        for recipe in PosterShapeLibrary.surveyRecipes where !["survey-portal-type","survey-module-substitution","survey-scalloped-frame"].contains(recipe.id) {
            try require(DominantShapeSystem.recipeIDs.contains(recipe.id),"New geometry unavailable for whole-poster placement")
        }
        try checkSurveyMaterials()
        print("PASS: spatial text/brief/font replay, staged orb material, image-module substitution/checksums, 11 whole-poster shape families")
    }
    static func checkSurveyMaterials()throws {
        // Saved genomes predate the material keys: without them, each system must render exactly as its legacy settings.
        let legacy:[String:[String:Double]]=["survey-faceted-spire":["tipFan":0,"sheen":0,"direction":0,"spires":1,"curve":0,"finType":0],"survey-sliced-orb":["bleed":1,"mirror":0,"invert":0,"primitive":0,"axis":0,"twist":0,"surfaceType":0],"survey-bilateral-soft-cross":["twoTone":0,"centre":0,"lobes":4,"lobeShape":0,"spin":0,"centreRound":0.3,"outlineType":0],"survey-portal-type":["tiling":0,"sides":4,"flow":0,"shading":0,"fade":0],"survey-module-substitution":["fuse":0,"direction":0,"mask":0,"sizeField":0]]
        for (id,values) in legacy {
            let recipe=PosterShapeLibrary.recipe(id)!
            try require(Set(values.keys).isSubset(of:Set(recipe.parameters.map(\.id))),"\(id) lost a material control")
            var stored=try PosterShapeLibrary.scene(PosterShapePreset(recipe:recipe,seed:817,parameters:values),pairing:true),saved=stored
            saved.elements[0].geometry=saved.elements[0].geometry?.filter{!values.keys.contains($0.key)};saved.elements[0].inks=nil;stored.elements[0].inks=nil
            let a=try rgba(LibrarySceneRenderer.render(stored,width:320)),b=try rgba(LibrarySceneRenderer.render(saved,width:320))
            try require(a==b,"\(id): genomes without material keys no longer render as before")
        }
        // Type as material: resolving a brief puts its title into the system, which then draws those words.
        for (id,key) in [("survey-gravity-drips","letters"),("survey-sliced-orb","surfaceType"),("survey-bilateral-soft-cross","outlineType"),("survey-faceted-spire","finType")] {
            let recipe=PosterShapeLibrary.recipe(id)!
            var scene=try PosterShapeLibrary.scene(PosterShapePreset(recipe:recipe,seed:817,parameters:[key:1]),pairing:true)
            let specimen=try rgba(LibrarySceneRenderer.render(scene,width:320))
            scene.posterCopy=PosterCopy(title:"NEW WORDS");PosterShapeLibrary.resolveSurveyContent(in:&scene)
            try require(scene.elements[0].text=="NEW WORDS" && scene.elements[0].kind=="shape","\(id): type mode did not take the brief's title")
            let titled=try rgba(LibrarySceneRenderer.render(scene,width:320))
            try require(titled != specimen,"\(id): type mode ignores the title it carries")
            var plain=try PosterShapeLibrary.scene(PosterShapePreset(recipe:recipe,seed:817,parameters:[key:0]),pairing:true)
            plain.posterCopy=PosterCopy(title:"NEW WORDS");PosterShapeLibrary.resolveSurveyContent(in:&plain)
            try require(plain.elements[0].text==nil,"\(id): title attached although the type mode is off")
        }
        let drips=PosterShapeLibrary.recipe("survey-gravity-drips")!,cross=PosterShapeLibrary.recipe("survey-bilateral-soft-cross")!,orb=PosterShapeLibrary.recipe("survey-sliced-orb")!
        try require(drips.inks?.count==5 && cross.inks?.count==3 && orb.inks?.count==2,"Canonical source inks missing")
        // Chromatic shape colours steer the palette; neutral ones keep the source hues.
        let turned=ShapeMaterials.palette(cross,primary:"#3a7bd5",background:"#f2eee4",seed:3)!,neutral=ShapeMaterials.palette(drips,primary:"#202322",background:"#141414",seed:3)!
        try require(turned.count==3 && turned[0] != cross.inks![0] && Set(turned).count==3,"Palette ignores the poster's shape colour")
        try require(neutral.count==5 && Set(neutral).count==5 && neutral.allSatisfy{ShapeTypePlacement.contrastRatio($0,"#141414")>=1.3},"Neutral palettes lost source hues or contrast with the paper")
        try require(ShapeMaterials.palette(orb,primary:"#1d1f22",background:"#f2eee4",seed:1)==["#1d1f22","#f2eee4"],"Inverted volumes need the paper as their light ink")
        try require(ShapeMaterials.palette(PosterShapeLibrary.recipe("survey-portal-type")!,primary:"#111111",background:nil,seed:1)==nil,"Single-ink systems gained inks")
        var explicit=PosterShapePreset(recipe:cross,seed:817);explicit.inks=["#112233","#445566","#778899"]
        let scene=try PosterShapeLibrary.scene(explicit)
        try require(scene.elements[0].color=="#112233" && scene.elements[0].inks==["#445566","#778899"],"Preset inks were not used as given")
        explicit.inks=["red"];try require(rejected{_ = try PosterShapeLibrary.scene(explicit)},"Invalid inks accepted")
        print("PASS: legacy material and variation fallbacks for 5 systems, type-as-material titles for 4, canonical and steered palettes, explicit preset inks")
    }
}
