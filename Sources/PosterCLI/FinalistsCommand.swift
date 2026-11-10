import Foundation
import PosterCore

struct FinalistsCommand {
    static func run(_ args:[String])throws {
        guard !args.isEmpty,!args.contains("--help") else{print("poster finalists --study output/source-compositions-v13 [--direction optical] [--pick CANDIDATE-ID | --clear-pick]\n  Lists each direction's distinct round winners with the committee's order of them. --pick records your choice in that direction's final.json.");return}
        var options:[String:String]=[:],flags:Set<String>=[],i=0
        while i<args.count{if args[i]=="--clear-pick"{flags.insert(args[i]);i+=1}else{guard ["--study","--direction","--pick"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown finalists option.")};options[args[i]]=args[i+1];i+=2}}
        guard let study=options["--study"] else{throw PosterError.invalid("finalists needs --study.")}
        let root=URL(fileURLWithPath:study)
        let manifest=try JSONDecoder().decode([[String:String]].self,from:Data(contentsOf:root.appending(path:"manifest.json")))
        let categories=manifest.compactMap{$0["category"]}.filter{options["--direction"]==nil || $0==options["--direction"]}
        guard !categories.isEmpty else{throw PosterError.invalid("No such direction in this study.")}
        if options["--pick"] != nil || flags.contains("--clear-pick") {
            guard categories.count==1 else{throw PosterError.invalid("Choose one --direction to pick in.")}
            let final=try SourceFinals.pick(options["--pick"],directionFolder:root.appending(path:categories[0]))
            print(final.pickedID.map{"\(final.direction): picked \($0)"} ?? "\(final.direction): pick cleared")
            return
        }
        for category in categories {
            let final=try SourceFinals.make(directionFolder:root.appending(path:category))
            print("\(final.direction) · \(final.finalists.count) finalists")
            for f in final.finalists.sorted(by:{$0.committeeRank<$1.committeeRank}) {
                var tags:[String]=[]
                if f.id==final.lastRoundWinnerID{tags.append("last-round winner")}
                if f.id==final.pickedID{tags.append("your pick")}
                print(String(format:"  committee #%ld  %5.1f  ",f.committeeRank,f.consensus)+f.id+"  won round "+f.rounds.map{String($0+1)}.joined(separator:", ")+(tags.isEmpty ? "":"  · "+tags.joined(separator:", ")))
            }
        }
    }
}
