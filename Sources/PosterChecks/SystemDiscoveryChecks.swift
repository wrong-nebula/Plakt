import Foundation
import PosterCore

extension PosterChecks {
    static func checkSystemDiscovery()throws {
        let bank=TypeSystemLibrary.shared
        guard let suffix=bank.systems.first(where:{$0.operation=="suffix-cycle"}),let arc=bank.systems.first(where:{$0.operation=="glyph-arc"}),let grid=bank.systems.first(where:{$0.operation=="glyph-grid"}) else{throw CheckFailure("Missing reviewed type discoveries")}
        let observed=try TypeSystemEngine.steps(suffix,input:"Vi|ti|ni|ci")
        let adapted=try TypeSystemEngine.steps(suffix,input:"in|put|side|finite")
        try require(observed.map(\.text)==["Viti","Vini","Vici"] && adapted.map(\.text)==["input","inside","infinite"],"Suffix cycle lost its protected prefix or explicit suffix sequence")
        let plainPrefix=try TypeSystemEngine.steps(suffix,input:"FORM")
        try require(plainPrefix.allSatisfy{$0.text.hasPrefix("FORM")},"Plain prefix input lost an original grapheme")
        let input="A👩🏽‍🎨e\u{301}Z",steps=try TypeSystemEngine.steps(arc,input:input)
        try require(steps.count==input.count && steps.map(\.text).joined()==input.precomposedStringWithCanonicalMapping,"Glyph arc split or reordered input graphemes")
        try require(steps.allSatisfy{$0.rotation.isFinite && $0.bounds.valid},"Arc tangent or bounds are invalid")
        let tiles=try TypeSystemEngine.steps(grid,input:"KUNSTKAMMER")
        try require(tiles.map(\.text).joined()=="KUNSTKAMMER" && tiles.prefix(6).map{$0.variables["column"] ?? -1}==[1,2,0,1,2,0],"Stepped tiles lost their observed reading sequence")
        try require(tiles.allSatisfy{($0.typeTransform?["shear"] ?? 0)>0},"Shared tile shear is missing")
        for copy in ["OPENFORMS","POSSIBILITIES","A👩🏽‍🎨e\u{301}Z"] {
            let transferred=try TypeSystemEngine.steps(grid,input:copy)
            try require(transferred.map(\.text).joined()==copy.precomposedStringWithCanonicalMapping && transferred.count==copy.count,"Stepped tiles repeated or truncated new copy")
        }
        guard let curation=bank.curation else{throw CheckFailure("Missing type-system consolidation")}
        try require(bank.distinctSystems.count==bank.systems.count-curation.aliases.count,"Consolidation count is inconsistent")
        for (alias,canonical) in curation.aliases {
            guard let a=bank.system(alias),let b=bank.system(canonical) else{throw CheckFailure("Consolidation discarded an original stable ID")}
            try require(a.operation==b.operation && a.sourcePosterID==b.sourcePosterID,"Consolidation crossed a source or operation boundary")
        }
        try require(bank.semanticIndex?.profiles.count ?? 0 >= 456,"Missing SigLIP system profiles")
        print("PASS: reviewed suffix/arc/tile rules, grapheme order and provenance-preserving near-duplicate consolidation")
        try require(ShapeSystemLibrary.systems.count>=8,"Missing shape-system interpretations")
        for system in ShapeSystemLibrary.systems {
            let original=try ShapeSystemEngine.scene(system)
            let key=system.parameters["count"] != nil ? "count":(system.parameters["rows"] != nil ? "rows":"opening")
            let value=PosterShapeLibrary.recipe(system.operation)?.parameters.first(where:{$0.id==key}).map { $0.max == system.parameters[key] ? $0.min:$0.max } ?? ((system.parameters[key] ?? 4)+2)
            let variant=try ShapeSystemEngine.scene(system,overrides:[key:value])
            try require(original.elements.allSatisfy{$0.kind=="shape" && $0.text==nil},"Shape rule contains type geometry")
            let a=try rgba(LibrarySceneRenderer.render(original,width:360)),b=try rgba(LibrarySceneRenderer.render(variant,width:360)),again=try rgba(LibrarySceneRenderer.render(original,width:360))
            try require(a==again && a != b,"Shape rule is not repeatable or its count control has no pixel effect: \(system.id)")
            try require(rejected{_ = try ShapeSystemEngine.scene(system,overrides:[key:.nan])},"Shape rule accepted a nonfinite parameter")
            try require(rejected{_ = try ShapeSystemEngine.scene(system,overrides:["unknown-control":1])},"Unknown shape control was silently ignored")
        }
        print("PASS: \(ShapeSystemLibrary.systems.count) pure-vector shape systems, A/B/A replay, visible control changes and invalid-control rejection")
    }
}
