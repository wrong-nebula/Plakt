import Foundation
import PosterCore

struct PosterShapeLibraryCommand {
    static func run(_ args:[String]) async throws {
        guard let command=args.first,!args.contains("--help") else {
            print("poster shape-library dominant-study --out directory [--rounds 5] [--count 12] [--framings span,zoom,offset,edge,corner]\nposter shape-library list\nposter shape-library index --out directory\nposter shape-library render --id ID --seed 817 [--set count=8] [--font-profile ID] [--placement anchored|mixed|free] [--contrast off|auto|interlock] [--inks '#rrggbb,#rrggbb'] [--look NAME] --out directory\nposter shape-library showcase --out directory\nposter shape-library study --out directory [--library library] [--rounds 5] [--count 4] [--directions abstract,color-field,halftone,guilloche] [--preset saved.json]\nposter shape-library survey-study --out directory [--placement anchored,mixed,free|none] [--contrast auto]\nposter shape-library placement-proof --out directory [--library library] [--id ID,ID] [--count 3] [--contrast auto] [--set letters=1,lobes=5]");return
        }
        var options:[String:String]=[:],i=1
        while i<args.count {
            guard ["--out","--id","--seed","--set","--font-profile","--preset","--library","--rounds","--count","--directions","--scene","--framings","--taste","--brief","--image-scenes","--text","--outline","--secondary-ink","--placement","--contrast","--inks","--look"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown shape-library option or missing value.")}
            options[args[i]]=args[i+1];i+=2
        }
        guard let seed=UInt64(options["--seed"] ?? "817") else{throw PosterError.invalid("Seed must be an unsigned integer.")}
        if command=="list"{for recipe in PosterShapeLibrary.recipes{print("\(recipe.id) · \(recipe.name) · \(recipe.group)")};return}
        guard let path=options["--out"] else{throw PosterError.invalid("Choose an output directory with --out.")}
        let out=URL(fileURLWithPath:path)
        guard !FileManager.default.fileExists(atPath:out.path) else{throw PosterError.invalid("Output exists; choose a new directory.")}
        if command=="survey-study" {
            guard let rounds=Int(options["--rounds"] ?? "8"),let count=Int(options["--count"] ?? "6") else{throw PosterError.invalid("Invalid survey rounds/count.")}
            let engine=PosterLibraryEngine(directory:URL(fileURLWithPath:options["--library"] ?? "library"))
            var images:[StyleGenome]=[]
            if let path=options["--image-scenes"] {
                let directory=URL(fileURLWithPath:path)
                let files=try FileManager.default.contentsOfDirectory(at:directory,includingPropertiesForKeys:nil).sorted{$0.path<$1.path}
                for folder in files {let file=folder.appending(path:"winner-genome.json");if FileManager.default.fileExists(atPath:file.path){images.append(try JSONDecoder().decode(StyleGenome.self,from:Data(contentsOf:file)))}}
            }
            let placements=options["--placement"]=="none" ? nil:(options["--placement"] ?? TypePlacementSettings.modes.joined(separator:",")).split(separator:",").map(String.init)
            try await SurveySystemStudy().run(records:engine.records(),imageScenes:images,output:out,seed:seed,rounds:rounds,count:count,tasteDirectory:URL(fileURLWithPath:options["--taste"] ?? "taste"),recipeIDs:options["--id"]?.split(separator:",").map(String.init),placements:placements,contrast:options["--contrast"] ?? "auto",progress:{print($0)})
            return
        }
        if command=="placement-proof" {
            guard let samples=Int(options["--count"] ?? "3") else{throw PosterError.invalid("Invalid proof sample count.")}
            let engine=PosterLibraryEngine(directory:URL(fileURLWithPath:options["--library"] ?? "library"))
            let records=try await engine.records()
            var overrides:[String:Double]=[:]
            for item in (options["--set"] ?? "").split(separator:","){let pair=item.split(separator:"=",maxSplits:1);guard pair.count==2,let value=Double(pair[1]) else{throw PosterError.invalid("Use --set parameter=value.")};overrides[String(pair[0])]=value}
            try TypePlacementProof.run(records:records,output:out,recipeIDs:options["--id"]?.split(separator:",").map(String.init) ?? TypePlacementProof.recipeIDs,samples:samples,seed:UInt64(options["--seed"] ?? "20261108") ?? 20261108,contrast:options["--contrast"] ?? "auto",parameters:overrides,progress:{print($0)})
            print(out.appending(path:"index.html").path);return
        }
        if command=="dominant-study" {
            guard let rounds=Int(options["--rounds"] ?? "5"),let count=Int(options["--count"] ?? "12") else{throw PosterError.invalid("Invalid round/count.")}
            let copy=options["--brief"].flatMap{ContentBriefLibrary.brief($0)?.posterCopy}
            let taste=URL(fileURLWithPath:options["--taste"] ?? "taste")
            try await DominantShapeStudy().run(output:out,seed:seed,rounds:rounds,count:count,framings:(options["--framings"] ?? "span,zoom,offset,edge,corner").split(separator:",").map(String.init),tasteDirectory:taste,copy:copy,progress:{print($0)})
            return
        }
        var preset:PosterShapePreset?
        if let file=options["--preset"]{preset=try JSONDecoder().decode(PosterShapePreset.self,from:Data(contentsOf:URL(fileURLWithPath:file)));_ = try PosterShapeLibrary.scene(preset!)}
        if command=="study" {
            guard let rounds=Int(options["--rounds"] ?? "5"),let count=Int(options["--count"] ?? "4") else{throw PosterError.invalid("Invalid study count or rounds.")}
            let engine=PosterLibraryEngine(directory:URL(fileURLWithPath:options["--library"] ?? "library"))
            let breeder=try await LibraryBreeder.make(records:engine.records(),output:out)
            try await breeder.run(rounds:rounds,count:count,seed:seed,useBriefLibrary:true,fontProfileID:options["--font-profile"],shapePreset:preset,directions:(options["--directions"] ?? "abstract,color-field,halftone,guilloche").split(separator:",").map(String.init),progress:{print($0)})
            return
        }
        if command=="index"{let ids=options["--id"].map{Set($0.split(separator:",").map(String.init))};if let ids{guard !ids.isEmpty,ids.allSatisfy({PosterShapeLibrary.recipe($0) != nil})else{throw PosterError.invalid("Unknown shape index IDs.")}};let result=try PosterShapeLibrary.index(to:out,recipeIDs:ids);print("Indexed \(result.count) shapes with authored descriptors and native Vision embeddings.");return}
        func render(_ p:PosterShapePreset,_ folder:URL)throws {
            try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
            var scene=try PosterShapeLibrary.scene(p,pairing:true)
            if let source=options["--scene"] {
                scene=try JSONDecoder().decode(StyleGenome.self,from:Data(contentsOf:URL(fileURLWithPath:source)))
                guard let i=scene.elements.firstIndex(where:{$0.kind=="shape" && $0.shape != "rectangle" && !$0.sourceElementID.contains("information-paper")}) else{throw PosterError.invalid("Source genome has no procedural image area.")}
                let old=scene.elements[i],profile=p.fontProfileID.flatMap{FontLibrary.shared.profile($0)}
                let match=PosterShapeLibrary.compatibility(p.recipe,profile:profile,field:old.bounds,posterAspect:scene.aspect,category:scene.styleCategory ?? "abstract",textDensity:0.25,sourcePosterID:old.sourcePosterID)
                let choice=PosterShapeLibrary.choose(seed:p.seed,profile:profile,field:old.bounds,posterAspect:scene.aspect,category:scene.styleCategory ?? "abstract",textDensity:0.25,preset:p)!
                var art=PosterShapeLibrary.element(choice,field:old.bounds,color:old.color,seed:p.seed,sourceID:old.sourceElementID,sourcePosterID:old.sourcePosterID)
                art.rotation=old.rotation;art.zIndex=old.zIndex;art.blendMode=old.blendMode;art.minimumStage=old.minimumStage;scene.elements[i]=art
                if let profile{FontLibrary.apply(profile,to:&scene)}
                scene.composition=CompositionPlan.scene(scene,origin:"shape-library-source-variation")
                scene.composition?.description=p.recipe.logic+" "+(scene.layoutInheritance?.operations.joined(separator:" ") ?? "")
                scene.composition?.constraints.append(LayoutConstraint(type:"shape-font-layout-compatibility",targets:[art.sourceElementID],values:match.components,reason:match.reasons.joined(separator:" ")))
            }
            PaperReliefSystems.resolve(in:&scene);GravityTypeSystems.resolve(in:&scene)
            if options["--scene"] != nil,let placement=p.placement{try ShapeTypePlacement.apply(to:&scene,settings:placement);scene.composition=CompositionPlan.scene(scene,origin:"shape-library-source-variation")}
            if scene.typeAnchors != nil{try PosterRenderer.png(ShapeTypePlacement.anchorOverlay(scene,width:600),to:folder.appending(path:"anchors.png"))}
            try PosterRenderer.png(LibrarySceneRenderer.render(scene,width:600),to:folder.appending(path:"poster.png"))
            try LibrarySceneRenderer.pdf(scene,to:folder.appending(path:"poster.pdf"))
            try LibraryRaster.write(scene,to:folder.appending(path:"genome.json"));try LibraryRaster.write(p,to:folder.appending(path:"preset.json"))
        }
        if command=="showcase" {
            for recipe in PosterShapeLibrary.recipes {
                let fonts=PosterShapeLibrary.suggestedFonts(recipe,limit:2)
                for variant in 0..<2 {
                    let choice=PosterShapeLibrary.choose(seed:seed+UInt64(variant),profile:fonts[variant].0,field:UnitBox(x:0,y:0,width:1,height:1),posterAspect:1,category:recipe.styles.first ?? "abstract",textDensity:0.2,preset:PosterShapePreset(recipe:recipe,seed:seed))!
                    var values=choice.parameters
                    if variant==1,let p=recipe.parameters.first{values[p.id]=p.min+(p.max-p.min)*0.7;if p.step>=1{values[p.id]=values[p.id]!.rounded()}}
                    try render(PosterShapePreset(recipe:recipe,seed:seed+UInt64(variant),parameters:values,fontProfileID:fonts[variant].0.id),out.appending(path:recipe.id+"/v\(variant)"))
                }
                print("Rendered \(recipe.id): two parameter/font combinations.")
            };return
        }
        guard command=="render" else{throw PosterError.invalid("Unknown shape-library command.")}
        if preset==nil {
            guard let id=options["--id"],let recipe=PosterShapeLibrary.recipe(id) else{throw PosterError.invalid("Choose --id from shape-library list.")}
            var values:[String:Double]=[:]
            // A named look sets every parameter and the inks; --set and --inks adjust it.
            if let name=options["--look"] {
                guard let look=recipe.look(name) else{throw PosterError.invalid("Unknown look. Looks: "+(recipe.looks ?? []).map(\.name).joined(separator:", "))}
                values=look.parameters
            }
            for item in (options["--set"] ?? "").split(separator:","){let pair=item.split(separator:"=",maxSplits:1);guard pair.count==2,let value=Double(pair[1]) else{throw PosterError.invalid("Use --set parameter=value.")};values[String(pair[0])]=value}
            preset=PosterShapePreset(recipe:recipe,seed:seed,parameters:values,fontProfileID:options["--font-profile"])
            if let name=options["--look"],let look=recipe.look(name){preset!.inks=look.inks;preset!.paper=look.paper}
        }
        if let inks=options["--inks"]{preset!.inks=inks.split(separator:",").map(String.init);try ShapeMaterials.validate(preset!.inks)}
        if options["--placement"] != nil || options["--contrast"] != nil {
            preset!.placement=TypePlacementSettings(mode:options["--placement"] ?? "anchored",contrast:options["--contrast"] ?? "auto");try preset!.placement?.validate()
        }
        if options["--text"] != nil || options["--outline"] != nil || options["--secondary-ink"] != nil {
            if preset!.recipe.renderer==PaperReliefSystems.shape{
                guard options["--outline"]==nil,options["--secondary-ink"]==nil else{throw PosterError.invalid("Paper relief uses surface geometry and inherited paper tint.")}
                preset!.relief=PaperReliefCustomization(title:options["--text"]);try preset!.relief?.validate()
            }else if preset!.recipe.renderer==GravityTypeSystems.shape{
                guard options["--outline"]==nil,options["--secondary-ink"]==nil else{throw PosterError.invalid("Fallen letters take a title; set inks with --inks.")}
                preset!.physics=GravityTypeCustomization(title:options["--text"]?.replacingOccurrences(of:"\\n",with:"\n"));try preset!.physics?.validate()
            }else{
            guard ContourSystems.isContour(preset!.recipe.renderer) else{throw PosterError.invalid("Text, outline and secondary ink require a contour recipe.")}
            var custom=preset!.contour ?? ContourCustomization()
            if let text=options["--text"]{custom.text=text.replacingOccurrences(of:"\\n",with:"\n")}
            if let ink=options["--secondary-ink"]{custom.secondaryInk=ink}
            if let path=options["--outline"]{custom.outline=try ContourOutline.load(from:URL(fileURLWithPath:path))}
            try custom.validate();preset!.contour=custom
            }
        }
        try render(preset!,out);print(out.path)
    }
}
