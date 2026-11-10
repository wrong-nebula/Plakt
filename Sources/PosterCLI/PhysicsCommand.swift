import Foundation
import ImageIO
import UniformTypeIdentifiers
import PosterCore

struct PhysicsCommand {
    static func run(_ args:[String])throws {
        guard let command=args.first,["loosen","restore","animate"].contains(command),!args.contains("--help") else {
            print("poster physics loosen --scene genome.json --out directory [--targets element-id,element-id] [--set detach=0.5,time=3] [--seed 817] [--accent '#ff4a1c'] [--shapes] [--width 1400]\nposter physics restore --scene genome.json --out directory\nposter physics animate (--scene genome.json [--targets ids] [--shapes] | --id fallen-letters [--text 'TITLE'] [--font-profile ID] [--inks '#rrggbb,#rrggbb,#rrggbb']) --out directory [--set ...] [--seconds 4] [--fps 24] [--width 720] [--seed 817]\n\nParameters (--set): \(PosterShapeLibrary.recipe(GravityTypeSystems.recipeID)?.parameters.map(\.id).joined(separator:", ") ?? "")");return
        }
        var options:[String:String]=[:],i=1,shapes=false
        while i<args.count {
            // --shapes takes no value: shape and image elements become obstacles too.
            if args[i]=="--shapes"{shapes=true;i+=1;continue}
            guard ["--scene","--out","--targets","--set","--seed","--accent","--width","--id","--text","--font-profile","--inks","--seconds","--fps"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown physics option or missing value.")}
            options[args[i]]=args[i+1];i+=2
        }
        guard let path=options["--out"] else{throw PosterError.invalid("Choose an output directory with --out.")}
        let out=URL(fileURLWithPath:path)
        guard !FileManager.default.fileExists(atPath:out.path) else{throw PosterError.invalid("Output exists; choose a new directory.")}
        guard let seed=UInt64(options["--seed"] ?? "817"),let width=Int(options["--width"] ?? (command=="animate" ? "720":"1400")) else{throw PosterError.invalid("Seed and width must be whole numbers.")}
        var values:[String:Double]=[:]
        for item in (options["--set"] ?? "").split(separator:","){let pair=item.split(separator:"=",maxSplits:1);guard pair.count==2,let value=Double(pair[1]) else{throw PosterError.invalid("Use --set parameter=value.")};values[String(pair[0])]=value}
        let targets=options["--targets"].map{$0.split(separator:",").map(String.init)}
        let source=try options["--scene"].map{try JSONDecoder().decode(StyleGenome.self,from:Data(contentsOf:URL(fileURLWithPath:$0)))}
        try FileManager.default.createDirectory(at:out,withIntermediateDirectories:true)
        if command=="restore" {
            guard var scene=source else{throw PosterError.invalid("restore requires --scene.")}
            GravityTypeSystems.restore(&scene);try export(scene,width:width,to:out);print(out.path);return
        }
        if command=="loosen" {
            guard var scene=source else{throw PosterError.invalid("loosen requires --scene.")}
            try GravityTypeSystems.loosen(&scene,targetIDs:targets,parameters:values,seed:seed,accent:options["--accent"],shapesCollide:shapes)
            try export(scene,width:width,to:out)
            if let g=scene.elements.compactMap(\.physics).last {
                let moving=g.glyphs.filter{$0.state != "fixed"}
                print("Loosened \(moving.count) of \(g.glyphs.count) glyphs (\(moving.filter{$0.state=="hanging"}.count) hanging); \(String(format:"%.2f",g.time)) s simulated in \(g.steps) steps, \(g.settled ? "settled":"still moving").")
            }
            print(out.path);return
        }
        // animate: the simulation is deterministic, so frame t is the scene made with `time` = t.
        guard let fps=Double(options["--fps"] ?? "24"),let seconds=Double(options["--seconds"] ?? "4"),(1...60).contains(fps),(0.1...12).contains(seconds) else{throw PosterError.invalid("Use --fps 1–60 and --seconds 0.1–12.")}
        var preset:PosterShapePreset?
        if source==nil {
            guard let recipe=PosterShapeLibrary.recipe(options["--id"] ?? GravityTypeSystems.recipeID),recipe.renderer==GravityTypeSystems.shape else{throw PosterError.invalid("animate needs --scene or a physics recipe --id.")}
            var p=PosterShapePreset(recipe:recipe,seed:seed,parameters:values,fontProfileID:options["--font-profile"])
            if let text=options["--text"]{p.physics=GravityTypeCustomization(title:text.replacingOccurrences(of:"\\n",with:"\n"))}
            if let inks=options["--inks"]{p.inks=inks.split(separator:",").map(String.init)}
            preset=p
        }
        let count=Int((fps*seconds).rounded())
        guard let gif=CGImageDestinationCreateWithURL(out.appending(path:"animation.gif") as CFURL,UTType.gif.identifier as CFString,count+1,nil) else{throw PosterError.image("Cannot write the GIF.")}
        CGImageDestinationSetProperties(gif,[kCGImagePropertyGIFDictionary:[kCGImagePropertyGIFLoopCount:0]] as CFDictionary)
        var last:StyleGenome?
        for frame in 0...count {
            var settings=values;settings["time"]=Double(frame)/fps
            let scene:StyleGenome
            if var p=preset{p.parameters=settings;scene=try PosterShapeLibrary.scene(p)}
            else{var s=source!;try GravityTypeSystems.loosen(&s,targetIDs:targets,parameters:settings,seed:seed,accent:options["--accent"],shapesCollide:shapes);scene=s}
            let image=try LibrarySceneRenderer.render(scene,width:width)
            try PosterRenderer.png(image,to:out.appending(path:String(format:"frame-%04d.png",frame)))
            CGImageDestinationAddImage(gif,image,[kCGImagePropertyGIFDictionary:[kCGImagePropertyGIFDelayTime:frame==count ? 1.5:1/fps]] as CFDictionary)
            last=scene
        }
        guard CGImageDestinationFinalize(gif) else{throw PosterError.image("GIF export failed.")}
        if let last{try LibrarySceneRenderer.pdf(last,to:out.appending(path:"final.pdf"));try LibraryRaster.write(last,to:out.appending(path:"final-genome.json"))}
        print("\(count+1) frames at \(Int(fps)) fps: \(out.appending(path:"animation.gif").path)")
    }
    static func export(_ scene:StyleGenome,width:Int,to folder:URL)throws {
        try PosterRenderer.png(LibrarySceneRenderer.render(scene,width:width),to:folder.appending(path:"poster.png"))
        try LibrarySceneRenderer.pdf(scene,to:folder.appending(path:"poster.pdf"))
        try LibraryRaster.write(scene,to:folder.appending(path:"genome.json"))
    }
}
