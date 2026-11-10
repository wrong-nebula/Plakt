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
    /// One named group of checks. `poster-checks --list` prints them.
    struct Group: Sendable {
        let name: String
        let about: String
        /// Why the group is left out of a plain run (a model pack or saved study it needs).
        /// Such groups run when named, or with --all.
        let needs: String?
        let body: @Sendable () async throws -> Void
        init(_ name: String, _ about: String, needs: String? = nil, _ body: @escaping @Sendable () async throws -> Void) {
            self.name = name; self.about = about; self.needs = needs; self.body = body
        }
    }

    /// Every check group, in the order a plain run uses. To add one, write `static func checkX()`
    /// in its own file and add a line here; it also answers to `--<name>-only`.
    static let groups: [Group] = [
        Group("text-wrapping", "text wrapped along and inside shapes") { try await checkTextWrapping() },
        Group("core", "seeds, repeatable renders, voting, Core ML and Vision judging, resume, PNG and PDF export") { try await run() },
        Group("library", "poster library import, records, source layouts and review") { try await checkLibrary() },
        Group("surrogate", "jury surrogate: model loads, repeatable scores, pinned scores") { try checkJurySurrogate() },
        Group("finalists","source-study finalists: distinct round winners, committee order, saved pick") { try checkSourceFinals() },
        Group("colors", "perceptual colour fixtures and ink rules") { try checkColors(); try checkInkRules() },
        Group("judges", "judge mix weights and jury calibration") { try checkJudgeMix(); try checkJuryCalibration() },
        Group("composition", "codified layouts for every style") { try checkComposition() },
        Group("kerning", "kerning: metrics, optical and none, pairs and gaps, saved scenes replay unchanged") { try checkKerning() },
        Group("fonts", "font library and profiles") { try checkFonts() },
        Group("content", "real content briefs and poster copy") { try checkContent() },
        Group("systems", "type systems") { try checkTypeSystems() },
        Group("taste", "personal taste jury: votes, training, undo") { try await checkUserTaste() },
        Group("shape-library", "shape recipes, presets, parameters and survey systems") { try checkShapeLibrary() },
        Group("dominant", "dominant shapes") { try checkDominantShapes() },
        Group("type-regressions", "type system regressions") { try checkTypeSystemRegressions() },
        Group("image-start", "start from image") { try checkImageStartingPoint() },
        Group("image-search", "image search") { try checkImageSearch() },
        Group("placement", "type placement modes and anchors") { try checkTypePlacement() },
        Group("orbit", "orbit wrap shape system") { try checkOrbitWrap() },
        Group("sawtooth", "sawtooth spring shape system") { try checkSawtoothSpring() },
        Group("circle-pack", "circle pack shape system") { try checkCirclePack() },
        Group("jobs", "studio job lifecycle (STATE-MACHINES.md)") { try checkJobLifecycle() },
        Group("physics", "physics engine and arrangements (PHYSICS.md)") { try checkPhysics() },
        Group("paper-relief", "paper relief construction") { try checkPaperRelief() },
        Group("contours", "contour systems (CONTOUR-SYSTEMS.md)") { try checkContourSystems() },
        Group("reviewed-shapes", "the six reviewed shape families") { try checkReviewedShapes() },
        Group("discovery", "discovered type systems") { try checkSystemDiscovery() },
        Group("glass", "glass objects: Metal refraction renders, shadows, studios, projects, vector conversion") { try await checkGlass() },
        Group("effectors", "effectors: poster PDFs read back as outlines, colours, strokes, gradients, editor page") { try checkEffectors() },
        Group("rule-field", "rule-field editor page: bundled, bridge present, nothing loaded from outside") { try checkRuleField() },
        Group("agent","agent tools: registry, repeatable results, revisions, text edits, error hints, output paths") { try await checkAgent() },
        Group("segmentation", "SAM 2.1 masks against saved references", needs: "the SAM 2.1 pack and output/sam2-integration-v1/reference.json") { try await checkSegmentation() },
        Group("semantic", "SigLIP visual-meaning search", needs: "the SigLIP pack, about 400 MB (LIBRARY.md)") { try await checkSemanticSearch() },
    ]
    /// Groups an older flag ran together with its own.
    static let companions = ["discovery": ["systems"]]

    static let usage = """
    poster-checks                    every group that needs no extra files
    poster-checks --all              those, and the groups that need a model pack
    poster-checks --only jobs,fonts  just these groups (same as --jobs-only --fonts-only)
    poster-checks --skip taste       leave groups out
    poster-checks --list             the groups and what each covers
    poster-checks --fail-fast        stop at the first failing group

    Every group runs even when an earlier one fails; a summary follows, and the exit code is 1
    when any group failed, 2 for a wrong argument.
    """

    static func main() async {
        func stop(_ message: String) -> Never {
            FileHandle.standardError.write(Data("\(message)\nGroups: \(groups.map(\.name).joined(separator: ", "))\n".utf8)); exit(2)
        }
        func names(_ value: String?, after flag: String) -> [String] {
            guard let value, !value.hasPrefix("--") else { stop("\(flag) needs group names, separated by commas.") }
            let list = value.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            if let unknown = list.first(where: { name in !groups.contains { $0.name == name } }) { stop("No check group '\(unknown)'.") }
            return list
        }
        var only: [String] = [], skip: Set<String> = [], all = false, failFast = false
        var arguments = CommandLine.arguments.dropFirst().makeIterator()
        while let argument = arguments.next() {
            switch argument {
            case "--help", "-h": print(usage); return
            case "--list":
                let width = groups.map(\.name.count).max() ?? 0
                for group in groups {
                    print(group.name.padding(toLength: width + 2, withPad: " ", startingAt: 0) + group.about + (group.needs.map { " · needs \($0)" } ?? ""))
                }
                return
            case "--all": all = true
            case "--fail-fast": failFast = true
            case "--only": only += names(arguments.next(), after: argument)
            case "--skip": skip.formUnion(names(arguments.next(), after: argument))
            default:
                guard argument.hasPrefix("--"), argument.hasSuffix("-only") else { stop("Unknown argument '\(argument)'. Try --help.") }
                let name = String(argument.dropFirst(2).dropLast(5))
                only += names(name, after: argument) + (companions[name] ?? [])
            }
        }
        let selected = groups.filter { only.isEmpty ? (all || $0.needs == nil) : only.contains($0.name) }.filter { !skip.contains($0.name) }
        guard !selected.isEmpty else { stop("No check group left to run.") }

        let clock = ContinuousClock(), started = clock.now
        func seconds(_ duration: Duration) -> String { String(format: "%.1f s", Double(duration.components.seconds) + Double(duration.components.attoseconds) / 1e18) }
        var failures: [(name: String, message: String)] = [], ran = 0
        for group in selected {
            if selected.count > 1 { print("── \(group.name)") }
            let begun = clock.now
            ran += 1
            do {
                try await group.body()
                if selected.count > 1 { print("   ok · \(seconds(clock.now - begun))") }
            } catch {
                failures.append((group.name, error.localizedDescription))
                fflush(nil)
                FileHandle.standardError.write(Data("FAIL: \(selected.count > 1 ? "\(group.name): " : "")\(error.localizedDescription)\n".utf8))
                if failFast { break }
            }
            fflush(nil)
        }
        guard selected.count > 1 else { exit(failures.isEmpty ? 0 : 1) }
        let left = selected.count - ran
        print("")
        if failures.isEmpty {
            print("PASS: all \(ran) check groups · \(seconds(clock.now - started))")
        } else {
            print("FAILED: \(failures.count) of \(ran) check groups · \(seconds(clock.now - started))" + (left > 0 ? " · \(left) not run (--fail-fast)" : ""))
            for failure in failures { print("  \(failure.name): \(failure.message)") }
            print("Run one again with: poster-checks --only \(failures.map(\.name).joined(separator: ","))")
        }
        let optional = groups.filter { $0.needs != nil && !selected.map(\.name).contains($0.name) }
        if only.isEmpty, !all, !optional.isEmpty { print("Not run: \(optional.map(\.name).joined(separator: ", ")) (need a model pack; --all includes them)") }
        exit(failures.isEmpty ? 0 : 1)
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
