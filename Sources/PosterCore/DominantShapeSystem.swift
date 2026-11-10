import Foundation
import CoreGraphics

public struct DominantShapeSettings:Codable,Sendable {
    public var version="dominant-shapes-v1"
    public var count:Int=1
    public var depth:String="weave"
    public var framing:String="span"
    public var scale:Double=1
    public var offsetX:Double=0
    public var offsetY:Double=0
    public var crossing:Double=0.16
    public var displacement:Double=0
    public var secondRecipeID:String?=nil
    public var reveal:Double?=nil
    public init(){}
    public func validate()throws {
        guard version=="dominant-shapes-v1",(1...2).contains(count),["behind","front","weave"].contains(depth),DominantShapeSystem.framings.contains(framing),[scale,offsetX,offsetY,crossing,displacement].allSatisfy(\.isFinite),(0.65...3).contains(scale),(-2...2).contains(offsetX),(-2...2).contains(offsetY),(0.04...0.5).contains(crossing),(0...1).contains(displacement) else{throw PosterError.invalid("Invalid dominant-shape settings.")}
        if let reveal,(!reveal.isFinite || !(0.002...0.35).contains(reveal)){throw PosterError.invalid("Visible shape amount must be 0.002–0.35.")}
        if let secondRecipeID,!DominantShapeSystem.recipeIDs.contains(secondRecipeID){throw PosterError.invalid("Choose a supported second dominant shape.")}
    }
}

public enum DominantShapeSystem {
    public static let sourceID="6f0afba09e88052dee70c023-p0"
    public static let framings=["span","zoom","offset","edge","corner"]
    public static let recipeIDs=["poster-helix","poster-loop","poster-ribbon","superellipse","ribbon-knot","lissajous","contour-islands","folded-fan","tone-sphere","tone-torus","tone-capsule","tone-cube","tone-cone","tone-ellipsoid","tone-link","tone-gyroid","organic-silhouette","guilloche-loop","disc-wreath","segmented-ring","polygon-contours","star-frame","notched-disc","cellular-disc"] + PosterShapeLibrary.surveyRecipes.filter{!["survey-portal-type","survey-module-substitution","survey-scalloped-frame"].contains($0.id)}.map(\.id) + [ContourSystems.profileID]
    public static func settings(_ preset:PosterShapePreset)throws->DominantShapeSettings {
        let s=preset.dominant ?? DominantShapeSettings();try s.validate()
        guard recipeIDs.contains(preset.recipe.id) else{throw PosterError.invalid("Select a silhouette, continuous curve, volume or unified shape field for this system.")}
        guard PosterShapeLibrary.recipe(preset.recipe.id)?.renderer==preset.recipe.renderer else{throw PosterError.invalid("Unknown dominant renderer.")}
        if let id=preset.fontProfileID,FontLibrary.shared.profile(id)==nil{throw PosterError.invalid("Unknown dominant font profile.")}
        _ = try preset.recipe.values(preset.parameters);try ContourSystems.validate(preset.contour);return s
    }
    public static func scene(_ preset:PosterShapePreset,copy supplied:PosterCopy?=nil)throws->StyleGenome {
        _ = try settings(preset)
        let copy=supplied ?? ContentBriefLibrary.brief("concept-luzern-theatre-2027")?.posterCopy ?? PosterCopy(title:"NEUE\nRÄUME",subtitle:"Klang, Körper und Perspektiven",institution:"Luzerner Theater · Luzern",footer:"18–21.06.2027 · Ab 19:30 · Konzeptprogramm")
        var rng=SeededRandom(seed:preset.seed)
        let palettes:[[String]]=[["#ed413e","#151818","#f4f0de"],["#3555b6","#f2eddc","#f0bfc2"],["#d6d0ed","#171c25","#ee6b38"],["#d9ed47","#182339","#f8f1e2"],["#e9e6dd","#141b24","#2759ca"],["#191e29","#eeeadc","#b7c7e2"]]
        let palette=palettes[rng.int(palettes.count)]
        let profile=preset.fontProfileID.flatMap{FontLibrary.shared.profile($0)} ?? PosterShapeLibrary.suggestedFonts(preset.recipe,limit:5).randomElement(using:&rng)?.0
        func text(_ id:String,_ string:String,_ box:UnitBox,_ display:Bool)->SceneElement {
            var e=SceneElement(sourceElementID:id,kind:"text",bounds:box,rotation:0,text:string,color:palette[1],shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:true,fontName:display ? profile?.postscriptName ?? "HelveticaNeue-Medium":"HelveticaNeue-Medium",textAlignment:"left")
            e.zIndex=display ? 100:300;e.sourcePosterID=sourceID;e.sourceAnchor=box
            if display{e.fontProfileID=profile?.id;e.fontAssetID=profile?.assetID;e.fontAssetSHA256=profile?.assetSHA256;e.fontVariations=profile?.variations}
            else{e.textTreatment="protected-info";e.minimumStage=2}
            return e
        }
        let words=copy.title.replacingOccurrences(of:"\n",with:" ")
        let titleLines=copy.title.split(separator:"\n").map(String.init)
        var items:[SceneElement]=[]
        // Header + large lower anchor are the reusable source relationship, not its original copy.
        if titleLines.count>1 {
            items.append(text("title:dominant:0",titleLines[0],UnitBox(x:0.045,y:0.025,width:0.91,height:0.14),true))
            items.append(text("title:dominant:1",titleLines.dropFirst().joined(separator:" "),UnitBox(x:0.045,y:0.77,width:0.91,height:0.16),true))
        }else{items.append(text("title:dominant:0",words,UnitBox(x:0.045,y:0.025,width:0.91,height:0.16),true))}
        let brief=ContentBriefLibrary.brief(copy.briefID)
        let date=brief?.dateLabel ?? "18—21 JUNI"
        items.append(text("title:dominant:date",date,UnitBox(x:0.045,y:0.63,width:0.84,height:0.105),true))
        for (i,string) in [copy.subtitle,copy.institution,copy.footer].enumerated(){items.append(text("meta:dominant:\(i)",string,UnitBox(x:0.045,y:0.945+Double(i)*0.015,width:0.91,height:0.012),false))}
        var scene=StyleGenome(version:"dominant-poster-v1",posterID:"dominant-\(preset.seed)",aspect:1.414,background:palette[0],font:profile?.postscriptName ?? "HelveticaNeue-Medium",textScale:1,tracking:0,elements:items,score:nil,fittingStatus:"Authored dominant-shape composition informed by the L Viscosi source relationship, not a source reconstruction.",sourceEmbeddingModel:"Apple-Vision-r2")
        scene.posterCopy=copy;scene.contentBrief=brief;scene.styleCategory="abstract"
        try apply(to:&scene,preset:preset,shapeColor:palette[2]);return scene
    }
    public static func apply(to scene:inout StyleGenome,preset:PosterShapePreset,shapeColor:String?=nil)throws {
        let s=try settings(preset)
        scene.elements.removeAll{$0.kind != "text"}
        for i in scene.elements.indices {
            let body=scene.elements[i].sourceElementID.hasPrefix("meta:") || scene.elements[i].sourceElementID.contains("source-info")
            scene.elements[i].zIndex=body ? 300:100
            if body{scene.elements[i].textTreatment="protected-info"}
        }
        let ink=shapeColor ?? (LibrarySceneRenderer.luminance(scene.background)>120 ? "#f5efdb":"#de6442")
        var objects:[SceneElement]=[]
        for object in 0..<s.count {
            let id=object==0 ? preset.recipe.id:(s.secondRecipeID ?? "poster-loop")
            guard let recipe=PosterShapeLibrary.recipe(id) else{throw PosterError.invalid("Missing dominant recipe.")}
            let values=try recipe.values(object==0 ? preset.parameters:[:])
            let profile=preset.fontProfileID.flatMap{FontLibrary.shared.profile($0)}
            var bounds=UnitBox(x:-0.055,y:-0.015,width:1.11,height:1.03)
            if !recipe.renderer.hasPrefix("poster-"){bounds=UnitBox(x:-0.42,y:-0.12,width:1.84,height:1.30)}
            if s.framing=="zoom"{bounds=zoom(bounds,by:2.05)}
            if s.framing=="offset"{bounds=zoom(bounds,by:1.5);bounds.x += 0.43;bounds.y -= 0.13}
            if s.framing=="edge"{bounds=zoom(bounds,by:1.8);bounds.x += 1.12;bounds.y += 0.06}
            if s.framing=="corner"{bounds=zoom(bounds,by:2.1);bounds.x += 1.07;bounds.y += 1.02}
            bounds=zoom(bounds,by:s.scale)
            if s.count==2 {bounds.x += object==0 ? -0.20:0.19;bounds.y += object==0 ? -0.05:0.13}
            var objectPreset=PosterShapePreset(recipe:recipe,seed:preset.seed,parameters:values)
            if object==0{objectPreset.contour=preset.contour}
            let choice=PosterShapeLibrary.choose(seed:preset.seed &+ UInt64(object*313),profile:profile,field:bounds,posterAspect:scene.aspect,category:"abstract",textDensity:0.2,preset:objectPreset)!
            var element=PosterShapeLibrary.element(choice,field:bounds,color:object==0 ? ink:(scene.elements.first?.color ?? ink),seed:preset.seed &+ UInt64(object*313),sourceID:"dominant-\(object)-back",sourcePosterID:sourceID,background:scene.background)
            element.geometry?["dominantObject"]=Double(object);element.geometry?["dominantDepth"]=0
            element.geometry?["dominantFraming"]=Double(framings.firstIndex(of:s.framing) ?? 0)
            element.geometry?["displacementStrength"]=s.displacement
            element.clipBounds=UnitBox(x:0,y:0,width:1,height:1);element.allowsBleed=true;element.rotation=object==0 ? -8:23;element.zIndex=20+object
            objects.append(element)
        }
        if s.framing=="corner" || s.framing=="edge"{try fitReveal(&objects,scene:scene,settings:s)}
        for i in objects.indices{objects[i].bounds.x += s.offsetX;objects[i].bounds.y += s.offsetY}
        // Anchored type is placed before the weave windows are cut, so the windows follow it.
        if let placement=preset.placement {
            var staged=scene;staged.elements=objects+scene.elements
            try ShapeTypePlacement.arrange(&staged,settings:placement)
            scene.elements=Array(staged.elements.dropFirst(objects.count));scene.typePlacement=staged.typePlacement;scene.typeAnchors=staged.typeAnchors
        }
        if s.displacement>0 && (preset.placement?.mode ?? "free")=="free" {try displace(&scene,objects:objects,strength:s.displacement)}
        var front:[SceneElement]=[]
        let displays=scene.elements.filter{$0.kind=="text" && ($0.zIndex ?? 100)<300}.sorted{$0.bounds.y<$1.bounds.y}
        if s.depth != "behind" {
            for object in objects {
                if s.depth=="front"{var e=object;e.sourceElementID += ":front";e.geometry?["dominantDepth"]=1;e.zIndex=200;front.append(e)}
                else {
                    // A repeated evaluation of the SAME object, clipped to saved canvas-space windows.
                    // Display bands alternate front/back; empty paper keeps the curve visually continuous.
                    var windows:[UnitBox]=[]
                    for (i,display) in displays.enumerated() where i%2==0 {
                        let y=max(0,display.bounds.y+display.bounds.height*(0.35-s.crossing))
                        let h=min(1-y,display.bounds.height*(0.35+s.crossing*2))
                        windows.append(UnitBox(x:0,y:y,width:1,height:h))
                    }
                    for (i,window) in windows.enumerated(){var e=object;e.sourceElementID += ":front-\(i)";e.geometry?["dominantDepth"]=1;e.clipBounds=window;e.zIndex=200;front.append(e)}
                }
            }
        }
        scene.elements=objects+scene.elements+front
        if let placement=preset.placement{try ShapeTypePlacement.declareContrast(&scene,settings:placement)}
        scene.composition=CompositionPlan.scene(scene,origin:"dominant-shape-system")
        if var plan=scene.composition{annotate(&plan,scene:scene);scene.composition=plan}
    }
    private static func fitReveal(_ objects:inout [SceneElement],scene:StyleGenome,settings:DominantShapeSettings)throws {
        let target=settings.reveal ?? (settings.framing=="corner" ? 0.025:0.07)
        let directionX:Double=settings.framing=="corner" ? 0.75:1
        let directionY:Double=settings.framing=="corner" ? 1:0
        let originals=objects
        func shifted(_ amount:Double)->[SceneElement]{originals.map{item in var e=item;e.bounds.x += amount*directionX;e.bounds.y += amount*directionY;return e}}
        func coverage(_ amount:Double)throws->Double{try DominantShapeMeasurements.mask(scene,only:shifted(amount),width:200).fraction}
        var best=0.0,bestError=Double.infinity,bestCoverage=0.0
        func probe(_ amount:Double)throws {
            let value=try coverage(amount)
            let error=abs(log((value+0.0001)/(target+0.0001)))
            if error<bestError{best=amount;bestError=error;bestCoverage=value}
        }
        for i in -8...8{try probe(Double(i)*0.15)}
        for step in [0.075,0.0375,0.01875]{let center=best;try probe(center-step);try probe(center+step)}
        objects=shifted(best)
        for i in objects.indices{objects[i].geometry?["cropShiftX"]=best*directionX;objects[i].geometry?["cropShiftY"]=best*directionY;objects[i].geometry?["cropRevealTarget"]=target;objects[i].geometry?["cropRevealObserved"]=bestCoverage}
    }
    private static func zoom(_ b:UnitBox,by scale:Double)->UnitBox{UnitBox(x:b.x+b.width*(1-scale)/2,y:b.y+b.height*(1-scale)/2,width:b.width*scale,height:b.height*scale)}
    public static func annotate(_ plan:inout CompositionPlan,scene:StyleGenome) {
        let backs=scene.elements.filter{$0.geometry?["dominantDepth"]==0}
        guard !backs.isEmpty else{return}
        let fronts=scene.elements.filter{$0.geometry?["dominantDepth"]==1}
        plan.constraints.removeAll{$0.type=="protect-title-and-metadata" || $0.type=="dominant-shape-system" || $0.type=="intentional-shape-type-crossing"}
        plan.description="One or two oversized logical objects occupy, cross or crop against the whole poster. Repeated front passes belong to the same object, not extra shapes. Text anchors and displacement vectors remain explicit."
        plan.constraints.append(LayoutConstraint(type:"dominant-shape-system",targets:backs.map(\.sourceElementID),values:["logicalObjectCount":Double(backs.count),"frontPassCount":Double(fronts.count)],reason:"L Viscosi source relationship. Envelope, zoom, offset and crop are saved in the logical object's bounds; bleed is intentional. Framing indices: span=0, zoom=1, offset=2, edge=3, corner=4."))
        plan.constraints.append(LayoutConstraint(type:"intentional-shape-type-crossing",targets:fronts.map(\.sourceElementID),values:["backgroundZ":20,"displayZ":100,"foregroundZ":200,"informationZ":300],reason:"Draw each object behind type, then repeat its exact geometry through declared canvas-space front windows. Supporting information has local paper clearance."))
    }
    private static func displace(_ scene:inout StyleGenome,objects:[SceneElement],strength:Double)throws {
        let mask=try DominantShapeMeasurements.mask(scene,only:objects)
        var placed:[UnitBox]=[]
        for i in scene.elements.indices {
            var e=scene.elements[i]
            guard e.kind=="text",(e.zIndex ?? 100)<300 else{continue}
            let original=e.bounds
            func cost(_ box:UnitBox)->Double {
                var score=mask.occupancy(box)*2.0
                score += hypot(box.x-original.x,box.y-original.y)*0.6/max(0.1,strength)
                for other in placed{score += box.overlap(other)*15}
                return score
            }
            var best=original,bestCost=cost(original)
            for step in 1...5 {for direction in 0..<12 {
                let angle=Double(direction)*Double.pi/6,amount=Double(step)*0.032*strength
                var box=original;box.x += cos(angle)*amount;box.y += sin(angle)*amount
                guard box.x>=0.018,box.x+box.width<=0.982,box.y>=0.018,box.y+box.height<=0.93 else{continue}
                let value=cost(box);if value<bestCost{best=box;bestCost=value}
            }}
            e.bounds=best
            var parameters=e.geometry ?? [:]
            parameters["anchorX"]=original.x;parameters["anchorY"]=original.y
            parameters["nudgeX"]=best.x-original.x;parameters["nudgeY"]=best.y-original.y
            e.geometry=parameters;scene.elements[i]=e;placed.append(best)
        }
    }
}
