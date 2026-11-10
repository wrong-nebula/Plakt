import Foundation
import PosterCore

struct SystemDiscoveryCommand {
    struct Prompt: Codable { let id:String; let description:String }
    struct RankedPrompt: Codable { let prompt:Prompt; let ranking:SemanticSearchResults; let previouslyUncovered:[SemanticSearchHit] }
    struct Run: Codable {
        let version:String;let scope:String;let posterCount:Int;let priorSystemCount:Int
        let prompts:[RankedPrompt];let note:String
    }
    static let typePrompts:[Prompt]=[
        .init(id:"curved-baseline",description:"letters arranged along a curved line"),
        .init(id:"circular-text",description:"words arranged around a circle"),
        .init(id:"radial-type",description:"letters radiating outward in a fan"),
        .init(id:"outline-echo",description:"repeated outlined letters forming concentric contours"),
        .init(id:"strip-displacement",description:"horizontal slices of lettering shifted sideways"),
        .init(id:"reflection",description:"words reflected upside down as a mirror image"),
        .init(id:"modular-letterforms",description:"letters assembled from repeating geometric modules"),
        .init(id:"wave-type",description:"text distorted into a wave"),
        .init(id:"progressive-repetition",description:"one word repeated with a gradual transformation"),
        .init(id:"offset-type",description:"overlapping offset copies of the same lettering"),
        .init(id:"rotating-letters",description:"individual letters rotated progressively in a sequence"),
        .init(id:"type-silhouette",description:"text repeated to fill the silhouette of a shape"),
        .init(id:"figure-ground-type",description:"alternating positive and negative letterforms"),
        .init(id:"width-ramp",description:"letters stretched progressively wider"),
        .init(id:"permutation",description:"the same letters rearranged in a sequence of words"),
        .init(id:"nested-type",description:"a large letter containing smaller repeated letters")
    ]
    static let shapePrompts:[Prompt]=[
        .init(id:"concentric-rings",description:"concentric circles and repeating rings"),
        .init(id:"radial-repeat",description:"repeated geometric shapes arranged in radial symmetry"),
        .init(id:"tile-rotation",description:"a grid of geometric tiles with alternating rotations"),
        .init(id:"scale-sequence",description:"a sequence of abstract shapes growing progressively larger"),
        .init(id:"transparent-overlap",description:"several overlapping transparent colored shapes"),
        .init(id:"organic-repeat",description:"organic blobs repeated as a pattern"),
        .init(id:"moire-lines",description:"parallel curved lines creating optical interference"),
        .init(id:"halftone-field",description:"halftone dots defining a shaded geometric shape"),
        .init(id:"interlocking-counterforms",description:"interlocking geometric shapes and negative cutouts"),
        .init(id:"offset-trail",description:"repeated shapes shifted into an offset trail"),
        .init(id:"triangle-fan",description:"triangles rotated around a central point"),
        .init(id:"wave-stripes",description:"repeated stripes bent into waves"),
        .init(id:"tessellation",description:"a tessellation of repeating abstract shapes"),
        .init(id:"shape-reflection",description:"abstract shapes reflected in a line of symmetry")
    ]
    static func run(options:[String:String],directory:URL)async throws {
        let scope=options["--scope"] ?? "type"
        guard ["type","shape"].contains(scope),let output=options["--out"] else{throw PosterError.invalid("discover-systems requires --scope type|shape and --out directory.")}
        let out=URL(fileURLWithPath:output);try FileManager.default.createDirectory(at:out,withIntermediateDirectories:true)
        let bank=TypeSystemLibrary.shared,covered=Set(bank.systems.map(\.sourcePosterID))
        let search=SemanticLibrarySearch(directory:directory,models:options["--models"].map{URL(fileURLWithPath:$0)})
        let prompts=scope=="type" ? typePrompts:shapePrompts
        var results:[RankedPrompt]=[]
        for (i,prompt) in prompts.enumerated() {
            let ranking=try await search.search(query:"a graphic design poster with "+prompt.description,limit:40)
            results.append(RankedPrompt(prompt:prompt,ranking:ranking,previouslyUncovered:ranking.hits.filter{!covered.contains($0.posterID)}))
            print("\(scope) discovery \(i+1)/\(prompts.count): \(prompt.id) · \(ranking.indexed)/\(ranking.eligible) posters scored")
        }
        let run=Run(version:"siglip-system-discovery-v1",scope:scope,posterCount:results.first?.ranking.indexed ?? 0,
            priorSystemCount:bank.systems.count,prompts:results,
            note:"Zero-shot retrieval proposes sources for inspection. Scores are cosine affinities, not confirmed detections. Previously uncovered means no current type-system source record and is limited to the top 40 results for each prompt. Whole photographed surfaces can retain street context; verify poster bounds and rule geometry before adding a system.")
        try LibraryRaster.write(run,to:out.appending(path:"discovery.json"))
    }
}
