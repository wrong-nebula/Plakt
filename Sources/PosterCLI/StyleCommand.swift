import Foundation
import PosterCore

struct StyleCommand {
    static func run(_ args:[String]) async throws {
        if args.first=="render" {
            var options:[String:String]=[:];var i=1
            while i<args.count {guard ["--out","--style","--seed","--width"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown style render option.")};options[args[i]]=args[i+1];i+=2}
            guard let out=options["--out"],let style=options["--style"],let seed=UInt64(options["--seed"] ?? "55"),let width=Int(options["--width"] ?? "1400") else{throw PosterError.invalid("Style render requires --style and --out.")}
            let root=URL(fileURLWithPath:out);try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
            let scene=try StylePosterRenderer.genome(style:style,seed:seed)
            try PosterRenderer.png(LibrarySceneRenderer.render(scene,width:width,seed:seed),to:root.appending(path:"poster.png"))
            try LibrarySceneRenderer.pdf(scene,to:root.appending(path:"poster.pdf"),seed:seed)
            try LibraryRaster.write(scene,to:root.appending(path:"genome.json"));try scene.composition?.write(to:root)
            print("\(style) · seed \(seed) · variant \(scene.layoutVariant ?? 0) · preflight \(CompositionJudges.preflight(scene,copy:PosterCopy()))");return
        }
        guard args.first=="train" else {print("poster styles train --out models/styles [--seeds 32] [--library library]\nposter styles render --style editorial --seed 55 --out output/proof");return}
        var options:[String:String]=[:];var i=1
        while i<args.count {guard ["--out","--seeds","--library"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown style training option.")};options[args[i]]=args[i+1];i+=2}
        guard let out=options["--out"],let seeds=Int(options["--seeds"] ?? "32") else{throw PosterError.invalid("Style training requires --out and valid --seeds.")}
        var records:[PosterRecord]=[]
        if let library=options["--library"]{records=try await PosterLibraryEngine(directory:URL(fileURLWithPath:library)).records()}
        let result=try StyleJudgeTrainer.train(directory:URL(fileURLWithPath:out),seeds:seeds,records:records,progress:{print($0)})
        for head in result.heads {print("\(head.name): \(head.accuracy) recipe+review holdout agreement; \(head.reviewedTrainingRows) reviewed training examples")}
        print(result.note)
    }
}
