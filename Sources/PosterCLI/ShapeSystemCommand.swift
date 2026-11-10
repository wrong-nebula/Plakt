import Foundation
import PosterCore

struct ShapeSystemCommand {
    static func run(_ args:[String])throws {
        guard let command=args.first,!args.contains("--help") else{
            print("poster shapes list\nposter shapes render --id ID --out directory [--set count=12,lineWidth=0.01] [--width 1200]\nposter shapes showcase --out directory [--catalog catalog.json]");return
        }
        var options:[String:String]=[:],i=1
        while i<args.count {
            guard ["--id","--out","--set","--width","--catalog"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown shape-system option or missing value.")}
            options[args[i]]=args[i+1];i+=2
        }
        let catalog:ShapeSystemCatalog
        if let file=options["--catalog"]{catalog=try JSONDecoder().decode(ShapeSystemCatalog.self,from:Data(contentsOf:URL(fileURLWithPath:file)))}
        else if let bundled=ShapeSystemLibrary.catalog{catalog=bundled}
        else{throw PosterError.invalid("No shape-system catalog is available.")}
        var overrides:[String:Double]=[:]
        if let values=options["--set"] {
            for value in values.split(separator:",") {
                let pair=value.split(separator:"=",maxSplits:1)
                guard pair.count==2,let number=Double(pair[1]),number.isFinite else{throw PosterError.invalid("Use --set parameter=value,parameter=value.")}
                overrides[String(pair[0])]=number
            }
        }
        guard let width=Int(options["--width"] ?? "1000"),(200...8000).contains(width) else{throw PosterError.invalid("Shape preview width must be 200–8000 pixels.")}
        if command=="list"{for system in catalog.systems{print("\(system.id) · \(system.name) · \(system.status)")};return}
        guard let output=options["--out"] else{throw PosterError.invalid("Shape rendering requires --out.")}
        let root=URL(fileURLWithPath:output)
        func render(_ system:ShapeSystemGenome,_ overrides:[String:Double],_ folder:URL)throws {
            guard !FileManager.default.fileExists(atPath:folder.appending(path:"poster.png").path) else{throw PosterError.invalid("Shape proof exists; choose another output folder.")}
            let scene=try ShapeSystemEngine.scene(system,overrides:overrides)
            try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
            try PosterRenderer.png(LibrarySceneRenderer.render(scene,width:width),to:folder.appending(path:"poster.png"))
            try LibrarySceneRenderer.pdf(scene,to:folder.appending(path:"poster.pdf"))
            try LibraryRaster.write(system,to:folder.appending(path:"system.json"))
            try LibraryRaster.write(scene,to:folder.appending(path:"genome.json"))
            try scene.composition?.write(to:folder)
        }
        if command=="render" {
            guard let id=options["--id"],let system=catalog.systems.first(where:{$0.id==id}) else{throw PosterError.invalid("Choose a shape system with --id; see shapes list.")}
            try render(system,overrides,root)
        }else if command=="showcase" {
            for system in catalog.systems {
                try render(system,[:],root.appending(path:system.id+"/default"))
                let key=system.parameters["count"] != nil ? "count":(system.parameters["rows"] != nil ? "rows":"opening")
                let value=PosterShapeLibrary.recipe(system.operation)?.parameters.first(where:{$0.id==key}).map { $0.max == system.parameters[key] ? $0.min:$0.max } ?? ((system.parameters[key] ?? 4)+2)
                try render(system,[key:value],root.appending(path:system.id+"/variation"))
                print("Rendered \(system.id): default and changed \(key).")
            }
        }else{throw PosterError.invalid("Unknown shape command. Use poster shapes --help.")}
    }
}
