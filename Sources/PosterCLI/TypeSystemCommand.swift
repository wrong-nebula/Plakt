import Foundation
import PosterCore

struct TypeSystemCommand {
    static func run(_ args:[String])async throws {
        guard let command=args.first,!args.contains("--help") else{print("poster systems semantic-index --out directory [--catalog catalog.json] [--models models/siglip]\nposter systems embed --catalog draft.json --out directory\nposter systems tag --catalog catalog.json --library library\nposter systems list [--catalog catalog.json]\nposter systems render --id ID --text WORD --out directory [--catalog catalog.json] [--font-profile ID]\nposter systems showcase --catalog catalog.json --out directory");return}
        var options:[String:String]=[:],i=1
        while i<args.count {guard ["--catalog","--out","--library","--id","--text","--font-profile","--width","--models"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown type-system option.")};options[args[i]]=args[i+1];i+=2}
        let catalog:TypeSystemCatalog
        if let file=options["--catalog"]{catalog=try JSONDecoder().decode(TypeSystemCatalog.self,from:Data(contentsOf:URL(fileURLWithPath:file)))}
        else if let bundled=TypeSystemLibrary.shared.catalog{catalog=bundled}
        else{throw PosterError.invalid("No type systems indexed. Scan the library and embed its catalog first.")}
        switch command {
        case "semantic-index":
            guard let output=options["--out"] else{throw PosterError.invalid("systems semantic-index requires --out.")}
            let result=try TypeSystemSemanticAnalysis.build(catalog,output:URL(fileURLWithPath:output),models:options["--models"].map{URL(fileURLWithPath:$0)},progress:{print($0)})
            print("Encoded \(result.profiles.count) source systems and two probes each; \(result.failures.count) failures.")
        case "embed":
            guard let output=options["--out"] else{throw PosterError.invalid("systems embed requires --out.")}
            let result=try TypeSystemLibrary.embed(catalog,to:URL(fileURLWithPath:output),progress:{print($0)})
            print("Embedded \(result.systems.count) type-system source elements from \(result.summary.scannedPosters) scanned posters.")
        case "tag":
            guard let library=options["--library"] else{throw PosterError.invalid("systems tag requires --library.")}
            try await PosterLibraryEngine(directory:URL(fileURLWithPath:library)).applyTypeSystems(catalog,progress:{print($0)})
        case "list":for system in catalog.systems{print("\(system.id) · \(system.name) · \(system.status) / \(system.confidence)")}
        case "render":
            guard let id=options["--id"],let system=catalog.systems.first(where:{$0.id==id}),let output=options["--out"],let width=Int(options["--width"] ?? "900") else{throw PosterError.invalid("systems render requires --id, --out and a valid width.")}
            try render(system,text:options["--text"] ?? system.textParameters["sourceInput"] ?? "COMMON GROUND",directory:URL(fileURLWithPath:output),profile:options["--font-profile"],width:width)
        case "showcase":
            guard let output=options["--out"] else{throw PosterError.invalid("systems showcase requires --out.")}
            let root=URL(fileURLWithPath:output);try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
            let examples=["grapheme-migration":"horizons","compensated-erosion":"around|the|sound","repeat-field":"COMMON GROUND","paired-columns":"COMMON | GROUND","staircase":"BETWEEN","scale-ramp":"VOICE","rotation-field":"OPEN FORMS","word-reflow":"A FIELD OF POSSIBILITIES","tittle-substitution":"Infinite","reflection":"COMMON | GROUND","alternating-ink":"FORM","permutation-sequence":"MATERIAL","radial-fan":"VOICES","curved-baseline":"CITY OF VOICES"]
            var rows:[[String:String]]=[]
            for operation in Set(catalog.systems.map(\.operation)).sorted() {
                let candidates=catalog.systems.filter{$0.operation==operation && $0.sourceBounds.area>0.02}.sorted{a,b in a.representativeScore==b.representativeScore ? a.id<b.id:a.representativeScore>b.representativeScore}
                guard let system=candidates.first else{continue}
                let text=examples[operation] ?? "COMMON GROUND",folder=root.appending(path:operation)
                try render(system,text:text,directory:folder,profile:nil,width:700)
                rows.append(["operation":operation,"genomeID":system.id,"sourcePosterID":system.sourcePosterID,"input":text,"image":folder.appending(path:"poster.png").path,"sourceCrop":system.cropURL?.path ?? ""])
            }
            try LibraryRaster.write(rows,to:root.appending(path:"manifest.json"));print("Rendered \(rows.count) reusable method families with new text.")
        default:throw PosterError.invalid("Unknown type-system command.")
        }
    }
    static func render(_ system:TypeSystemGenome,text:String,directory:URL,profile:String?,width:Int)throws {
        guard !FileManager.default.fileExists(atPath:directory.appending(path:"poster.png").path) else{throw PosterError.invalid("Type-system proof exists; choose a new folder.")}
        let scene=try TypeSystemEngine.scene(system,input:text,profileID:profile)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        try PosterRenderer.png(LibrarySceneRenderer.render(scene,width:width),to:directory.appending(path:"poster.png"))
        try LibrarySceneRenderer.pdf(scene,to:directory.appending(path:"poster.pdf"))
        try LibraryRaster.write(scene,to:directory.appending(path:"genome.json"))
        try LibraryRaster.write(scene.appliedTypeSystems ?? [],to:directory.appending(path:"trace.json"))
        try scene.composition?.write(to:directory)
        print("\(system.operation): \(text) → \(scene.elements.count) vector type elements")
    }
}
