import Foundation
import PosterCore

struct ImagePosterCommand {
    static func run(_ args:[String])async throws {
        if args.isEmpty || args==["--help"]{print("poster from-image --image path --out new-folder [--library library] [--seed 20261108] [--rounds 10] [--count 15] [--title 'OPEN CIRCUIT'] [--subtitle 'Print, sound and moving images'] [--institution 'Museum für Gestaltung Zürich'] [--footer 'Concept programme · 18–21 June 2027'] [--placement mixed|full-bleed|framed|split] [--palette 0.85] [--layout 0.85] [--shapes 0.65] [--shape-frequency 0...1; default follows jury]");return}
        let allowed:Set<String>=["--image","--out","--library","--seed","--rounds","--count","--title","--subtitle","--institution","--footer","--placement","--palette","--layout","--shapes","--shape-frequency","--generated-type-judging","--diverse-finalists","--composition-directions","--font","--taste"]
        var options:[String:String]=[:],i=0
        while i<args.count{guard allowed.contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown option or missing value: \(args[i])")};options[args[i]]=args[i+1];i+=2}
        guard let input=options["--image"],let output=options["--out"] else{throw PosterError.invalid("from-image needs --image and --out.")}
        func number(_ key:String,_ value:Double)throws->Double{guard let raw=options[key] else{return value};guard let n=Double(raw),n.isFinite else{throw PosterError.invalid("Invalid number for \(key).")};return n}
        func integer(_ key:String,_ value:Int)throws->Int{guard let raw=options[key] else{return value};guard let n=Int(raw) else{throw PosterError.invalid("Invalid integer for \(key).")};return n}
        let seed:UInt64
        if let raw=options["--seed"]{guard let n=UInt64(raw) else{throw PosterError.invalid("Invalid seed.")};seed=n}else{seed=20261108}
        var settings=ImageInfluenceSettings();settings.palette=try number("--palette",0.85);settings.layout=try number("--layout",0.85);settings.shapes=try number("--shapes",0.65);settings.shapeFrequency=try options["--shape-frequency"].map{_ in try number("--shape-frequency",0.25)};settings.placement=options["--placement"] ?? "mixed"
        func flag(_ key:String)throws->Bool {guard let value=options[key] else{return false};guard value=="true" || value=="false" else{throw PosterError.invalid("\(key) must be true or false.")};return value=="true"}
        settings.generatedTypeJudging=try flag("--generated-type-judging");settings.diverseFinalists=try flag("--diverse-finalists");settings.compositionDirections=try flag("--composition-directions")
        var copy=PosterCopy(title:options["--title"] ?? "OPEN CIRCUIT",subtitle:options["--subtitle"] ?? "Print, sound and moving images",institution:options["--institution"] ?? "Museum für Gestaltung Zürich",footer:options["--footer"] ?? "Concept programme · 18–21 June 2027")
        copy.displayPhrases=[copy.title]+copy.words
        let result=try await ImagePosterStudy().run(image:URL(fileURLWithPath:input),library:options["--library"].map{URL(fileURLWithPath:$0)},output:URL(fileURLWithPath:output),settings:settings,copy:copy,seed:seed,rounds:try integer("--rounds",10),count:try integer("--count",15),fontProfileID:options["--font"],tasteDirectory:options["--taste"].map{URL(fileURLWithPath:$0)},progress:{print($0)})
        print("Winner \(result.winner.id) → \(output)/winner.png")
    }
}
