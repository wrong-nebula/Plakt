import Foundation
import PosterCore

struct DesignerCommand {
    static func run(_ args:[String])throws {
        guard args.first=="train" else{print("poster designers train --dataset output/designer-references/dataset.json --out models/designers");return}
        var options:[String:String]=[:];var i=1
        while i<args.count {guard ["--dataset","--out"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown designer option.")};options[args[i]]=args[i+1];i+=2}
        guard let source=options["--dataset"],let out=options["--out"] else{throw PosterError.invalid("Designer training requires --dataset and --out.")}
        let result=try DesignerJudgeTrainer.train(datasetURL:URL(fileURLWithPath:source),directory:URL(fileURLWithPath:out),progress:{print($0)})
        print("Trained \(result.profiles.filter{$0.modelFile != nil}.count) real-work heads; \(result.profiles.filter{$0.modelFile==nil}.count) reference-only profiles.")
        print(result.note)
    }
}
