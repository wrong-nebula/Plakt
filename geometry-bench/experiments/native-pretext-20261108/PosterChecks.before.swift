import Foundation
import CoreGraphics
import PosterCore

struct CheckFailure: LocalizedError {
    var errorDescription: String?
    init(_ text: String) { errorDescription = text }
}

@main struct PosterChecks {
    static func require(_ value: @autoclosure () -> Bool, _ message: String) throws {
        guard value() else { throw CheckFailure(message) }
    }
    static func rejected(_ block: () throws -> Void) -> Bool {
        do { try block(); return false } catch { return true }
    }
    static func rgba(_ image: CGImage) throws -> [UInt8] {
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        let ok = bytes.withUnsafeMutableBytes { storage -> Bool in
            guard let context = CGContext(data: storage.baseAddress, width: image.width, height: image.height,
                bitsPerComponent: 8, bytesPerRow: image.width * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
            return true
        }
        guard ok else { throw CheckFailure("Could not normalize image bytes") }
        return bytes
    }
    static func main() async {
        if CommandLine.arguments.contains("--shape-library-only") {do{try checkShapeLibrary()}catch{FileHandle.standardError.write(Data("FAIL: \(error.localizedDescription)\n".utf8));exit(1)};return}
        if CommandLine.arguments.contains("--discovery-only") {
            do { try checkSystemDiscovery(); try checkTypeSystems() }
            catch { FileHandle.standardError.write(Data("FAIL: \(error.localizedDescription)\n".utf8)); exit(1) }
            return
        }
        if CommandLine.arguments.contains("--semantic-only") {
            do { try await checkSemanticSearch() }
            catch { FileHandle.standardError.write(Data("FAIL: \(error.localizedDescription)\n".utf8)); exit(1) }
            return
        }
        do { if CommandLine.arguments.contains("--taste-only"){try await checkUserTaste();return}; if CommandLine.arguments.contains("--systems-only"){try checkTypeSystems();return}; if CommandLine.arguments.contains("--fonts-only"){try checkFonts();return}; if CommandLine.arguments.contains("--colors-only"){try checkColors();return}; if CommandLine.arguments.contains("--judges-only"){try checkJudgeMix();return}; try await run(); try await checkLibrary(); try checkColors(); try checkJudgeMix(); try checkComposition(); try checkFonts(); try checkContent(); try checkTypeSystems(); try await checkUserTaste(); try checkShapeLibrary(); print("PASS: all 26 check groups") }
        catch { FileHandle.standardError.write(Data("FAIL: \(error.localizedDescription)\n".utf8)); exit(1) }
    }
    static func run() async throws {
        let a = Genome.random(seed: 101), b = Genome.random(seed: 102)
        try require(a == Genome.random(seed: 101) && a != b, "Seed stability or variation failed")
        for seed: UInt64 in 0..<100 {
            let child = a.mutated(seed: seed, strength: 0.8)
            try require(child == a.mutated(seed: seed, strength: 0.8), "Mutation not repeatable")
            try require(child.fingerprint.allSatisfy { (0...1).contains($0) } && child.motifs.count == 24, "Mutation bounds failed")
        }
        let stagedCount = (0..<100).filter { Genome.random(seed: UInt64($0)).usesStagedConstruction }.count
        try require((30...70).contains(stagedCount), "Coin toss unexpectedly unbalanced over 100 seeds")
        for seed: UInt64 in 0..<100 {
            let g = Genome.random(seed: seed)
            let plan = BlockoutPlan.make(g)
            try require((0...1).contains(plan.scale) && (0...1).contains(plan.distortion), "Blockout plan out of bounds")
        }
        print("PASS: seeded genomes and mutation bounds (100 seeds)")
        let copy = PosterCopy()
        let first = try PosterRenderer.render(a, copy: copy, width: 300)
        let other = try PosterRenderer.render(b, copy: copy, width: 300)
        let again = try PosterRenderer.render(a, copy: copy, width: 300)
        try require(first.dataProvider?.data as Data? == again.dataProvider?.data as Data?, "A/B/A render was contaminated")
        try require(first.dataProvider?.data as Data? != other.dataProvider?.data as Data?, "Different seeds produced identical images")
        let blockout = try PosterRenderer.render(a, copy: copy, width: 300, stage: .blockout)
        let primary = try PosterRenderer.render(a, copy: copy, width: 300, stage: .primary)
        try require(blockout.dataProvider?.data as Data? != primary.dataProvider?.data as Data?, "Type pass did not change blockout")
        try require(primary.dataProvider?.data as Data? != first.dataProvider?.data as Data?, "Detail pass did not change primary type")
        print("PASS: same-machine A/B/A pixel repeatability and distinctness")
        let metrics = Measurements(coverage: 0, detail: 0, balance: 0, contrast: 0, readability: 0, reference: 0, hierarchy: 0, repetition: 0, recognizedWords: 0)
        var candidates: [Candidate] = []
        for i in 0..<3 {
            let scores: [String: Double] = ["A": Double(i), "B": i == 2 ? 1.0 : 0.0, "Missing": Double(i)]
            let candidate = Candidate(id: String(i), genome: Genome.random(seed: UInt64(i)), generation: 0,
                                      imageURL: URL(fileURLWithPath: "/tmp/poster.png"), measurements: metrics, scores: scores)
            candidates.append(candidate)
        }
        candidates[0].scores.removeValue(forKey: "Missing")
        let ranked = Voting.rank(candidates)
        try require(ranked[0].id == "2" && abs(ranked[0].consensus - 100) < 0.001, "Borda winner wrong")
        try require(ranked.first { $0.id == "0" }?.votes["B"] == 0.25, "Tied ranks not shared")
        try require(ranked[0].votes["Missing"] == nil && ranked.map(\.rank) == [1, 2, 3], "Incomplete ballot handling failed")
        print("PASS: voting, ties, missing ballot exclusion")
        var settings = EvolutionSettings(); settings.count = 0
        try require(rejected { try settings.validate() }, "Invalid count accepted")
        settings.count = 4; settings.mutation = .nan
        try require(rejected { try settings.validate() }, "NaN accepted")
        try require(rejected { _ = try PosterCopy(title: "   ").validated() }, "Blank title accepted")
        try require(rejected { _ = try PosterRenderer.render(a, copy: copy, width: 100000) }, "Oversized render accepted")
        print("PASS: invalid input validation")
        let root = URL(fileURLWithPath: NSTemporaryDirectory()).appending(path: "poster-checks-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        let engine = try await EvolutionEngine.make(cpuOnly: true)
        settings = EvolutionSettings(); settings.seed = 101; settings.count = 4; settings.width = 500
        let g0 = try await engine.generate(copy: copy, settings: settings, output: root)
        try require(g0.candidates.allSatisfy { c in c.scores.values.allSatisfy { $0.isFinite && (0...1).contains($0) } }, "Model scores out of range")
        try require(g0.candidates.contains { $0.measurements.recognizedWords > 0 && $0.measurements.featureDistance != nil }, "Vision did not measure text and reference")
        print("PASS: real Core ML inference, Vision OCR and feature distances")
        let loaded = try EvolutionEngine.load(g0.directory.appending(path: "generation.json"))
        try require(loaded.candidates.map(\.genome) == g0.candidates.map(\.genome), "Session serialization lost genomes")
        let parent = g0.candidates.last!
        let g1 = try await engine.generate(copy: copy, settings: settings, previous: loaded, selectedIDs: [parent.id], output: root)
        try require(g1.candidates.contains { $0.genome == parent.genome }, "Selected parent not retained")
        try require(g1.selectedParents == [parent.id], "Manual parent selection lost")
        try require(g1.candidates.filter { $0.parentID == nil }.count == 1, "Fresh immigrant missing")
        try require(Set(g1.candidates.map(\.id)).count == settings.count, "Candidate IDs collided")
        try require(Set(g1.candidates.map { $0.genome.seed }).count == settings.count, "Candidate seeds collided")
        for c in g1.candidates {
            let actual = try PosterRenderer.load(c.imageURL)
            let expected = try PosterRenderer.render(c.genome, copy: copy, width: settings.width)
            try require(actual.width == expected.width && actual.height == expected.height, "Saved dimensions wrong")
            let savedPixels = try rgba(actual), expectedPixels = try rgba(expected)
            try require(savedPixels == expectedPixels, "Saved image does not match its genome; possible path collision")
            if c.genome.usesStagedConstruction { try require(c.processURLs?.count == 4, "Construction stages missing") }
        }
        print("PASS: save/resume, selected-parent elitism, mutation and immigration")
        do {
            _ = try await engine.generate(copy: copy, settings: settings, output: root)
            throw CheckFailure("Existing generation overwritten")
        } catch is PosterError { }
        try Task.checkCancellation()
        let cancelled = Task {
            try await engine.generate(copy: copy, settings: settings, previous: g1, output: root)
        }
        cancelled.cancel()
        do { _ = try await cancelled.value; throw CheckFailure("Cancellation ignored") }
        catch is CancellationError { }
        print("PASS: overwrite protection and cancellation")
        let image = try PosterRenderer.render(parent.genome, copy: copy, width: 2000)
        let png = root.appending(path: "export.png"), pdf = root.appending(path: "export.pdf")
        try PosterRenderer.png(image, to: png); try PosterRenderer.pdf(parent.genome, copy: copy, to: pdf)
        let read = try PosterRenderer.load(png)
        try require(read.width == 2000 && read.height == 2828, "PNG dimensions incorrect")
        guard let doc = CGPDFDocument(pdf as CFURL), let page = doc.page(at: 1) else { throw CheckFailure("PDF unreadable") }
        try require(doc.numberOfPages == 1 && abs(page.getBoxRect(.mediaBox).width - 595.28) < 0.1, "PDF page size incorrect")
        print("PASS: large PNG and A4 PDF roundtrip")
    }
}
