import Foundation
import PosterCore

struct FontCommand {
    static func run(_ args:[String])throws {
        if args.isEmpty || args.contains("--help") {
            print("""
            poster fonts index --out output/font-library-v1
            poster fonts list [--family archivo]
            poster fonts nearest --profile PROFILE-ID [--limit 8]
            Fonts are local Google Fonts assets; indexing stores axis/shape and Vision specimen embeddings.
            """);return
        }
        var options:[String:String]=[:],i=1
        while i<args.count {guard ["--out","--family","--profile","--limit"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown font option.")};options[args[i]]=args[i+1];i+=2}
        let library=FontLibrary.shared
        switch args[0] {
        case "index":
            guard let out=options["--out"] else{throw PosterError.invalid("fonts index requires --out.")}
            let index=try FontLibrary.index(to:URL(fileURLWithPath:out),progress:{print($0)})
            print("Embedded \(index.profiles.count) font styles / axis instances in \(index.dimensions) descriptive dimensions, plus native Vision specimen vectors.")
        case "list":
            print("\(library.manifest.families.count) Google Fonts families · \(library.profiles.count) style/axis profiles")
            for profile in library.profiles where options["--family"]==nil || profile.familyID==options["--family"]{print("\(profile.id) · \(profile.label)")}
        case "nearest":
            guard let id=options["--profile"],let profile=library.profile(id),let limit=Int(options["--limit"] ?? "8"),(1...50).contains(limit) else{throw PosterError.invalid("nearest requires a known --profile and --limit 1–50.")}
            for (other,distance) in library.nearest(to:profile,limit:limit,otherFamilies:true){print("\(String(format:"%.4f",distance)) · \(other.id) · \(other.label)")}
        default:throw PosterError.invalid("Unknown fonts command.")
        }
    }
}
