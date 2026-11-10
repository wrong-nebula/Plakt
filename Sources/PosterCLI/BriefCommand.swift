import Foundation
import PosterCore

struct BriefCommand {
    static func run(_ args:[String])throws {
        if args.isEmpty || args[0]=="list" {
            for brief in ContentBriefLibrary.briefs {print("\(brief.id) · \(brief.name) · \(brief.kind) · \(brief.dateLabel) · \(brief.status())\(brief.sourcePosterID==nil ? "":" · inspired concept")")}
            return
        }
        guard args[0]=="inspect",args.count==2,let brief=ContentBriefLibrary.brief(args[1]) else{throw PosterError.invalid("poster briefs list | poster briefs inspect ID")}
        let encoder=JSONEncoder();encoder.outputFormatting=[.prettyPrinted,.sortedKeys]
        print(String(data:try encoder.encode(brief),encoding:.utf8)!)
    }
}
