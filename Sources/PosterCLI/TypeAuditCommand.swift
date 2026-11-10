import Foundation
import PosterCore

struct TypeAuditCommand {
    static func run(_ args:[String])throws {
        guard args.count==2,args[0]=="--out" else{throw PosterError.invalid("poster system-audit --out new-output-directory")}
        try TypeSystemAudit.run(output:URL(fileURLWithPath:args[1]),progress:{print($0)})
    }
}
