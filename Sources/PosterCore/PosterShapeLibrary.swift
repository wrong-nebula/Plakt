import Foundation
import CoreGraphics

public struct PosterShapeParameter:Codable,Identifiable,Sendable {
    public var id:String;public var label:String;public var value:Double;public var min:Double;public var max:Double;public var step:Double
    public var activeWhen:[String:Double]?=nil
    /// Active only while each named control takes one of the listed values (for controls shared by several modes).
    public var activeIn:[String:[Double]]?=nil
    public func isActive(in values:[String:Double])->Bool{
        let when=activeWhen?.allSatisfy{abs((values[$0.key] ?? $0.value)-$0.value)<0.000001} ?? true
        return when && (activeIn?.allSatisfy{key,options in options.contains{abs((values[key] ?? options[0])-$0)<0.000001}} ?? true)
    }
}
public struct PosterShapeLook:Codable,Identifiable,Sendable {
    public var name:String;public var parameters:[String:Double];public var inks:[String]?
    /// Suggested specimen paper, e.g. near-black for neon looks.
    public var paper:String?=nil
    public var id:String{name}
}
public struct PosterShapeReference:Codable,Sendable {
    public var queryID:String;public var posterID:String;public var similarity:Double?
    public var sourceBounds:UnitBox?;public var sourceImageSHA256:String?;public var evidenceURL:URL?
}
public struct PosterShapeRecipe:Codable,Identifiable,Sendable {
    public var id:String;public var name:String;public var group:String;public var renderer:String
    public var parameters:[PosterShapeParameter];public var traits:[String:Double];public var styles:[String];public var fontTarget:[String:Double]
    public var idealAspect:Double;public var tags:[String];public var logic:String;public var references:[PosterShapeReference];public var basis:String
    /// Canonical source inks, shape color first. Generated posters keep their relationships, not their hues.
    public var inks:[String]?=nil
    /// Named starting points: a full parameter set and inks. The first look matches the source.
    public var looks:[PosterShapeLook]?=nil
    public func look(_ name:String)->PosterShapeLook?{looks?.first{$0.name.caseInsensitiveCompare(name) == .orderedSame}}
    public func values(_ overrides:[String:Double]=[:])throws->[String:Double] {
        guard parameters.allSatisfy({$0.min.isFinite && $0.max.isFinite && $0.value.isFinite && $0.step.isFinite && $0.min <= $0.max && $0.step > 0}),Set(parameters.map(\.id)).count==parameters.count else{throw PosterError.invalid("Invalid shape parameter schema.")}
        guard overrides.keys.allSatisfy({key in parameters.contains{$0.id==key}}),overrides.values.allSatisfy(\.isFinite) else{throw PosterError.invalid("Unknown shape parameter or non-finite value.")}
        var result:[String:Double]=[:]
        for p in parameters{let v=overrides[p.id] ?? p.value;guard (p.min...p.max).contains(v) else{throw PosterError.invalid("\(p.label) must be \(p.min)–\(p.max).")};result[p.id]=p.step>=1 ? v.rounded():v}
        return result
    }
}
public struct PosterShapeCatalog:Codable,Sendable {public var version:String;public var discoverySnapshotSHA256:String;public var discoverySource:String;public var note:String;public var recipes:[PosterShapeRecipe]}
public struct PosterShapePreset:Codable,Sendable {
    public var dominant:DominantShapeSettings?=nil
    public var contour:ContourCustomization?=nil
    public var relief:PaperReliefCustomization?=nil
    public var physics:GravityTypeCustomization?=nil
    public var placement:TypePlacementSettings?=nil
    /// Explicit inks (shape color first) instead of a palette derived from the poster.
    public var inks:[String]?=nil
    /// Circles, letters and voids placed by hand in the circle-packing system; the rest repacks around them.
    public var circlePack:CirclePackEdits?=nil
    /// Paper for the library specimen only (a look's suggestion); posters keep their layout's paper.
    public var paper:String?=nil
    public var version="poster-shape-preset-v1";public var recipe:PosterShapeRecipe;public var seed:UInt64;public var parameters:[String:Double];public var fontProfileID:String?
    public init(recipe:PosterShapeRecipe,seed:UInt64,parameters:[String:Double]=[:],fontProfileID:String?=nil){self.recipe=recipe;self.seed=seed;self.parameters=parameters;self.fontProfileID=fontProfileID}
}
public struct PosterShapeCompatibility:Codable,Sendable {
    public var score:Double;public var components:[String:Double];public var reasons:[String]
}
public struct PosterShapeChoice:Sendable {
    public var recipe:PosterShapeRecipe;public var parameters:[String:Double];public var compatibility:PosterShapeCompatibility
    public var contour:ContourCustomization?=nil
    public var relief:PaperReliefCustomization?=nil
    public var inks:[String]?=nil
    public var physics:GravityTypeCustomization?=nil
    public var circlePack:CirclePackEdits?=nil
}
public struct PosterShapeEmbedding:Codable,Sendable {
    public var recipeID:String;public var seed:UInt64;public var parameters:[String:Double];public var descriptor:[Double];public var vision:VisualEmbedding;public var imageURL:URL
}

public enum PosterShapeLibrary {
    public static let catalog:PosterShapeCatalog?={guard let url=PosterResources.bundle.url(forResource:"catalog",withExtension:"json",subdirectory:"Resources/ShapeLibrary"),let data=try? Data(contentsOf:url) else{return nil};return try? JSONDecoder().decode(PosterShapeCatalog.self,from:data)}()
    public static var recipes:[PosterShapeRecipe]{
        let base = catalog?.recipes ?? []
        let known = Set(base.map(\.id))
        return base + (surveyRecipes+contourRecipes+paperReliefRecipes+gravityTypeRecipes).filter { !known.contains($0.id) }
    }
    public static func recipe(_ id:String)->PosterShapeRecipe?{recipes.first{$0.id==id}}
    public static func fontCompatibility(_ recipe:PosterShapeRecipe,profile:FontStyleProfile?)->PosterShapeCompatibility {
        guard let profile else{return PosterShapeCompatibility(score:0.55,components:["font":0.55],reasons:["Automatic font selection; no face is pinned."])}
        let actual:[String:Double]=["weight":(profile.weight-100)/800,"width":profile.width/100,"serif":profile.category=="serif" ? 1:0,"mono":profile.category=="monospace" ? 1:0,"italic":profile.italic ? 1:0]
        let weights:[String:Double]=["weight":0.35,"width":0.2,"serif":0.25,"mono":0.1,"italic":0.1]
        let distance=actual.reduce(0.0){sum,item in sum+abs(item.value-(recipe.fontTarget[item.key] ?? 0))*(weights[item.key] ?? 0)}
        let score=max(0,min(1,1-distance))
        let texture=(recipe.traits["detail"] ?? 0)>0.65 ? "Fine or repeated geometry uses the font’s weight and width to balance visual texture.":"The silhouette is paired with the font’s mass and width."
        return PosterShapeCompatibility(score:score,components:["font":score],reasons:["\(profile.family), weight \(Int(profile.weight)), width \(Int(profile.width)); \(profile.category).",texture])
    }
    public static func compatibility(_ recipe:PosterShapeRecipe,profile:FontStyleProfile?,field:UnitBox,posterAspect:Double,category:String,textDensity:Double,sourcePosterID:String?=nil)->PosterShapeCompatibility {
        let font=fontCompatibility(recipe,profile:profile),aspect=field.width/max(0.001,field.height*posterAspect)
        let fit=exp(-abs(log(max(0.05,aspect)/recipe.idealAspect))*0.65)
        let style=recipe.styles.contains(category) ? 1.0:0.35
        let density=max(0,min(1,textDensity)),detail=recipe.traits["detail"] ?? 0.5
        let quiet=1-max(0,density-0.18)*detail*1.4
        let reference=sourcePosterID.map{id in recipe.references.contains{$0.posterID==id} ? 1.0:0.0} ?? 0
        let score=fit*0.30+font.score*0.28+style*0.23+max(0,quiet)*0.14+reference*0.05
        return PosterShapeCompatibility(score:score,components:["fieldAspect":fit,"font":font.score,"style":style,"typeDensity":max(0,quiet),"sourceReference":reference],reasons:["Physical image-area aspect \(String(format:"%.2f",aspect)); preferred \(String(format:"%.2f",recipe.idealAspect)).",recipe.styles.contains(category) ? "Fits the \(category) vocabulary.":"A contrasting shape vocabulary for \(category).","Type occupancy \(Int(density*100))%; detailed forms get less weight in dense type layouts."]+font.reasons)
    }
    public static func suggestedFonts(_ recipe:PosterShapeRecipe,limit:Int=6)->[(FontStyleProfile,Double)] {
        let sorted=FontLibrary.shared.profiles.sorted{a,b in let x=fontCompatibility(recipe,profile:a).score,y=fontCompatibility(recipe,profile:b).score;return x==y ? a.id<b.id:x>y}
        var seen:Set<String>=[];return Array(sorted.filter{seen.insert($0.familyID).inserted}.prefix(limit)).map{($0,fontCompatibility(recipe,profile:$0).score)}
    }
    public static func choose(seed:UInt64,profile:FontStyleProfile?,field:UnitBox,posterAspect:Double,category:String,textDensity:Double,sourcePosterID:String?=nil,preset:PosterShapePreset?=nil)->PosterShapeChoice? {
        if let preset,let values=try? preset.recipe.values(preset.parameters){return PosterShapeChoice(recipe:preset.recipe,parameters:values,compatibility:compatibility(preset.recipe,profile:profile,field:field,posterAspect:posterAspect,category:category,textDensity:textDensity,sourcePosterID:sourcePosterID),contour:preset.contour,relief:preset.relief,inks:preset.inks,physics:preset.physics,circlePack:preset.circlePack)}
        let scored: [(PosterShapeRecipe, PosterShapeCompatibility)] = recipes.map { recipe in
            let score = compatibility(recipe, profile: profile, field: field, posterAspect: posterAspect, category: category, textDensity: textDensity, sourcePosterID: sourcePosterID)
            return (recipe, score)
        }
        let ranked = scored.sorted { a, b in
            if a.1.score == b.1.score { return a.0.id < b.0.id }
            return a.1.score > b.1.score
        }
        guard let first=ranked.first else{return nil}
        // A separate seeded stream keeps changes to typography from consuming shape randomness.
        var rng=SeededRandom(seed:seed ^ 0x53484150454c4942)
        let pool=Array(ranked.prefix(16)),weights=pool.map{exp(($0.1.score-first.1.score)/0.14)},total=weights.reduce(0,+)
        var pick=rng.unit()*total,index=0
        for i in pool.indices{pick-=weights[i];if pick<=0{index=i;break}}
        let chosen=pool[index];var values=(try? chosen.0.values()) ?? [:]
        for p in chosen.0.parameters {
            if p.id=="phase"{values[p.id]=rng.value(p.min,p.max)}
            else if p.id != "grid"{let radius=(p.max-p.min)*0.16;let v=min(p.max,max(p.min,p.value+rng.value(-radius,radius)));values[p.id]=p.step>=1 ? v.rounded():v}
        }
        return PosterShapeChoice(recipe:chosen.0,parameters:values,compatibility:chosen.1)
    }
    public static func element(_ choice:PosterShapeChoice,field:UnitBox,color:String,seed:UInt64,sourceID:String="specimen",sourcePosterID:String?=nil,background:String?=nil)->SceneElement {
        var values=choice.parameters;values["shapeSeed"]=Double(seed%9_000_000)
        let inks=choice.inks ?? ShapeMaterials.palette(choice.recipe,primary:color,background:background,seed:seed)
        var e=SceneElement(sourceElementID:"art:shape-library:"+choice.recipe.id+":"+sourceID,kind:"shape",bounds:field,rotation:0,text:nil,color:inks?.first ?? color,shape:choice.recipe.renderer,outline:false,shadow:false,offsetX:0,offsetY:0,copies:1)
        if let inks,inks.count>1{e.inks=Array(inks.dropFirst())}
        if let edits=choice.circlePack{edits.encode(into:&values)}
        e.geometry=values;e.zIndex=0;e.clipBounds=field;e.sourcePosterID=sourcePosterID;e.sourceAnchor=field
        e.contour=choice.contour
        if e.shape==PaperReliefSystems.shape{e.paperRelief=PaperReliefSystems.make(seed:seed,parameters:values,custom:choice.relief)}
        if e.shape==GravityTypeSystems.shape{GravityTypeSystems.prepare(&e,title:choice.physics?.title,parameters:values,seed:seed)}
        if e.shape==ContourSystems.typeShape{e.kind="text";e.text=choice.contour?.text ?? "RKC"}
        if SurveyTypeGeometry.shapes.contains(e.shape){e.kind="text";e.text=choice.recipe.id=="survey-portal-type" ? "FORM SPACE":choice.recipe.id=="survey-scalloped-frame" ? "FUBU":"MO"}
        return e
    }
    public static func recipeID(_ element:SceneElement)->String? {let parts=element.sourceElementID.split(separator:":");guard parts.count>=4,parts[1]=="shape-library" else{return nil};return String(parts[2])}
    public static func scene(_ preset:PosterShapePreset,pairing:Bool=false)throws->StyleGenome {
        if preset.dominant != nil{return try DominantShapeSystem.scene(preset)}
        guard preset.version=="poster-shape-preset-v1",let known=recipe(preset.recipe.id),known.renderer==preset.recipe.renderer else{throw PosterError.invalid("Unsupported shape preset or renderer.")}
        if let id=preset.fontProfileID,FontLibrary.shared.profile(id)==nil{throw PosterError.invalid("Unknown font profile in shape preset.")}
        if preset.recipe.renderer==PaperReliefSystems.shape{return try PaperReliefSystems.scene(preset)}
        if preset.recipe.renderer==GravityTypeSystems.shape{return try GravityTypeSystems.scene(preset)}
        let values=try preset.recipe.values(preset.parameters)
        try ContourSystems.validate(preset.contour);try ShapeMaterials.validate(preset.inks);try preset.circlePack?.validate()
        if let paper=preset.paper{try ShapeMaterials.validate([paper])}
        let paper=preset.paper ?? "#eeeae1",dark=LibrarySceneRenderer.luminance(paper)<90
        let choice=PosterShapeChoice(recipe:preset.recipe,parameters:values,compatibility:fontCompatibility(preset.recipe,profile:preset.fontProfileID.flatMap{FontLibrary.shared.profile($0)}),contour:preset.contour,relief:preset.relief,inks:preset.inks,circlePack:preset.circlePack)
        let field=pairing ? UnitBox(x:0.07,y:0.22,width:0.86,height:0.61):UnitBox(x:0.07,y:0.07,width:0.86,height:0.86)
        var elements=[element(choice,field:field,color:preset.recipe.inks?.first ?? "#202322",seed:preset.seed,background:paper)]
        let profile=preset.fontProfileID.flatMap{FontLibrary.shared.profile($0)} ?? suggestedFonts(preset.recipe,limit:1).first?.0
        if SurveyTypeGeometry.shapes.contains(elements[0].shape) || elements[0].shape==ContourSystems.typeShape{elements[0].fontName=profile?.postscriptName;elements[0].fontVariations=profile?.variations;elements[0].fontProfileID=profile?.id;elements[0].fontAssetID=profile?.assetID;elements[0].fontAssetSHA256=profile?.assetSHA256}
        if pairing {
            for (i,text) in ["FORM & SPACE","Aa 0123 / "+(profile?.family ?? "Automatic")].enumerated(){
                var e=SceneElement(sourceElementID:"shape-pairing:\(i)",kind:"text",bounds:UnitBox(x:0.07,y:i==0 ? 0.05:0.90,width:0.86,height:i==0 ? 0.12:0.035),rotation:0,text:text,color:dark ? "#f2efe8":"#202322",shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:true,fontName:profile?.postscriptName ?? "HelveticaNeue-Bold",textAlignment:"left")
                e.fontVariations=profile?.variations;e.fontProfileID=profile?.id;e.fontAssetID=profile?.assetID;e.fontAssetSHA256=profile?.assetSHA256;e.zIndex=10;elements.append(e)
            }
        }
        let sourceAspect=min(2.2,max(0.6,1/preset.recipe.idealAspect))
        let specimenAspect=(preset.recipe.id.hasPrefix("survey-") || ContourSystems.isContour(preset.recipe.renderer)) ? sourceAspect*(pairing ? 0.86/0.61:1):(pairing ? 1.25:1)
        var scene=StyleGenome(version:"poster-shape-specimen-v1",posterID:preset.recipe.id,aspect:specimenAspect,background:paper,font:profile?.postscriptName ?? "HelveticaNeue",textScale:1,tracking:0,elements:elements,score:nil,fittingStatus:preset.recipe.basis,sourceEmbeddingModel:"shape-library-v1")
        if let placement=preset.placement{try ShapeTypePlacement.apply(to:&scene,settings:placement)}
        scene.composition=CompositionPlan.scene(scene,origin:"poster-shape-library")
        scene.composition?.description=preset.recipe.name+". "+preset.recipe.logic
        scene.composition?.constraints.append(LayoutConstraint(type:"shape-font-compatibility",targets:[elements[0].sourceElementID],values:choice.compatibility.components,reason:choice.compatibility.reasons.joined(separator:" ")))
        return scene
    }
    public static func index(to directory:URL,recipeIDs:Set<String>?=nil)throws->[PosterShapeEmbedding] {
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        var index:[PosterShapeEmbedding]=[]
        for recipe in recipes where recipeIDs==nil || recipeIDs!.contains(recipe.id) {
            try autoreleasepool {
                let preset=PosterShapePreset(recipe:recipe,seed:817),scene=try scene(preset),image=try LibrarySceneRenderer.render(scene,width:480),url=directory.appending(path:recipe.id+".png")
                try PosterRenderer.png(image,to:url)
                var descriptor=["angularity","curvature","detail","mass","regularity","counterform","directionality","volume"].map{recipe.traits[$0] ?? 0}
                descriptor += [min(1,recipe.idealAspect/2),Double(recipe.parameters.count)/8]
                let norm=sqrt(descriptor.reduce(0){$0+$1*$1});descriptor=descriptor.map{$0/max(0.0001,norm)}
                let embedding=try LibraryRaster.embedding(image)
                index.append(PosterShapeEmbedding(recipeID:recipe.id,seed:817,parameters:try recipe.values(),descriptor:descriptor,vision:embedding,imageURL:url))
                try LibraryRaster.write(preset,to:directory.appending(path:recipe.id+"-preset.json"))
                try LibraryRaster.write(scene,to:directory.appending(path:recipe.id+"-scene.json"))
                try LibrarySceneRenderer.pdf(scene,to:directory.appending(path:recipe.id+".pdf"))
            }
        }
        try LibraryRaster.write(index,to:directory.appending(path:"embeddings.json"));return index
    }
}

public extension PosterShapeLibrary {
    static func upgradeLegacy(_ genome:inout StyleGenome,seed:UInt64) {
        let profile=genome.elements.compactMap(\.fontProfileID).first.flatMap{FontLibrary.shared.profile($0)}
        for i in genome.elements.indices where genome.elements[i].kind=="shape" && ["organic-blob","halftone-torus","halftone-sphere","guilloche","ribbon"].contains(genome.elements[i].shape) {
            let old=genome.elements[i]
            guard let choice=choose(seed:seed &+ UInt64(i*97),profile:profile,field:old.bounds,posterAspect:genome.aspect,category:genome.styleCategory ?? "abstract",textDensity:0.25) else{continue}
            var new=element(choice,field:old.bounds,color:old.color,seed:seed &+ UInt64(i*97),sourceID:String(i))
            new.rotation=old.rotation;new.blendMode=old.blendMode;new.minimumStage=old.minimumStage;genome.elements[i]=new
        }
        genome.composition=CompositionPlan.scene(genome,origin:"shape-library-runtime-recipe")
    }
}
