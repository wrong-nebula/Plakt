import Foundation
import PosterCore

@main
struct PosterCommand {
    static func main() async {
        do { try await run() }
        catch { FileHandle.standardError.write(Data("poster: \(error.localizedDescription)\n".utf8)); exit(1) }
    }
    static func run() async throws {
        let args = Array(CommandLine.arguments.dropFirst())
        if args.first == "mcp" {try await AgentCommand.mcp(Array(args.dropFirst()));return}
        if args.first == "tool" {try await AgentCommand.tool(Array(args.dropFirst()));return}
        if args.first == "from-image" {try await ImagePosterCommand.run(Array(args.dropFirst()));return}
        if args.first == "system-audit" {try TypeAuditCommand.run(Array(args.dropFirst()));return}
        if args.first == "shapes" {try ShapeSystemCommand.run(Array(args.dropFirst()));return}
        if args.first == "taste" {try await TasteCommand.run(Array(args.dropFirst()));return}
        if args.first == "shape-library" {try await PosterShapeLibraryCommand.run(Array(args.dropFirst()));return}
        if args.first == "systems" {try await TypeSystemCommand.run(Array(args.dropFirst()));return}
        if args.first == "briefs" {try BriefCommand.run(Array(args.dropFirst()));return}
        if args.first == "fonts" {try FontCommand.run(Array(args.dropFirst()));return}
        if args.first == "scene" {try SceneCommand.run(Array(args.dropFirst()));return}
        if args.first == "physics" {try PhysicsCommand.run(Array(args.dropFirst()));return}
        if args.first == "designers" {try DesignerCommand.run(Array(args.dropFirst()));return}
        if args.first == "styles" {try await StyleCommand.run(Array(args.dropFirst()));return}
        if args.first == "library" { try await LibraryCommand.run(Array(args.dropFirst())); return }
        if args.first == "kerning" {try KerningCommand.run(Array(args.dropFirst()));return}
        if args.first == "finalists" {try FinalistsCommand.run(Array(args.dropFirst()));return}
        if args.isEmpty || args.contains("--help") {
            print("""
            PosterLab — procedural typography + Core ML + Vision

            poster generate [--seed 2026] [--count 12] [--rounds 3] [--width 900]
              [--out output/study] [--mutation 0.25] [--title 'VISUAL COMMUNICATION']
              [--subtitle 'Institute of Design'] [--reference image.jpg] [--crop-reference]
              [--apple-intelligence] [--cpu-only] [--mix 'Minimal=3,Composition=1,Reference=0'] [--style-models directory]
            poster evolve --resume path/generation.json [--pick candidate-id,candidate-id]
              [--rounds 1] [--out path] [--mutation 0.25]
            poster render --resume path/generation.json [--pick candidate-id]
              [--width 3508] [--out output/export] [--stage blockout|primary|secondary|finished]
            poster judge-images --input samples.json --out report.json [--reference image.jpg]
            poster styles train --out models/styles [--seeds 32] [--library library]
            poster styles render --style editorial --seed 55 --out output/proof
            poster scene render --genome candidate-genome.json --out output/selected [--width 3508]
            poster physics loosen --scene genome.json --out output/fallen [--set detach=0.5] [--accent '#ff4a1c']
            poster physics animate --id fallen-letters --text 'LET IT\\nFALL' --out output/fall-gif [--seconds 4]
            poster designers train --dataset output/designer-references/dataset.json --out models/designers
            poster library --help
            poster kerning proof --font HelveticaNeue-Bold --text 'AVATAR' --out output/kerning-proof
            poster kerning scene --genome scene.json --mode optical --out output/kerned [--pairs AV=-30]
            poster finalists --study output/source-study [--direction optical] [--pick candidate-id | --clear-pick]
            poster tool --help      PosterLab as JSON tools for agents (list, schema, call)
            poster mcp               the same tools as an MCP server over stdio
            poster status

            All rendering and judging are local. The Foundation Models text critic requires
            a macOS 26 SDK build, supported hardware, and Apple Intelligence enabled.
            Each round saves PNGs, judge ballots, ancestry, and a resumable generation.json.
            Winner exports: 3508px PNG + A4 vector PDF. Custom references use the full image;
            --crop-reference applies the supplied photo's crop proportions.
            """)
            return
        }
        if args[0] == "status" {
            print(AppleCritic.availability)
            print("Bundled Core ML model: \(Resources.modelURL?.path ?? "missing")")
            print("Apple silicon: \(ProcessInfo.processInfo.machineArchitecture)")
            return
        }
        let flags: Set<String> = ["--apple-intelligence", "--cpu-only", "--crop-reference"]
        let valueOptions: Set<String> = ["--seed", "--count", "--rounds", "--width", "--out", "--mutation", "--title", "--subtitle", "--reference", "--resume", "--pick", "--stage", "--input", "--mix", "--style-models", "--taste", "--brief", "--institution", "--footer"]
        var options: [String: String] = [:], enabled: Set<String> = []
        var i = 1
        while i < args.count {
            let key = args[i]
            if flags.contains(key) { enabled.insert(key); i += 1 }
            else if valueOptions.contains(key), i + 1 < args.count, !args[i + 1].hasPrefix("--") {
                options[key] = args[i + 1]; i += 2
            } else { throw PosterError.invalid("Unknown option or missing value: \(key). Use --help.") }
        }
        if args[0] == "judge-images" {
            guard let input = options["--input"], let output = options["--out"] else {
                throw PosterError.invalid("judge-images requires --input samples.json --out report.json.")
            }
            let samples = try JSONDecoder().decode([ExternalSample].self, from: Data(contentsOf: URL(fileURLWithPath: input)))
            let reference = options["--reference"].map { URL(fileURLWithPath: $0) } ?? Resources.referenceURL
            let crop = options["--reference"] == nil || enabled.contains("--crop-reference")
            let engine = try await EvolutionEngine.make(referenceURL: reference, cropReference: crop, cpuOnly: enabled.contains("--cpu-only"))
            let report = try await engine.judgeExternal(samples)
            let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(report).write(to: URL(fileURLWithPath: output), options: .atomic)
            print("Judged \(samples.count) images → \(output)")
            return
        }
        func integer(_ key: String, default fallback: Int) throws -> Int {
            guard let text = options[key] else { return fallback }
            guard let value = Int(text) else { throw PosterError.invalid("\(key) must be an integer.") }; return value
        }
        let previous = try options["--resume"].map { try EvolutionEngine.load(URL(fileURLWithPath: $0)) }
        let picks = Set((options["--pick"] ?? "").split(separator: ",").map(String.init))
        if args[0] == "render" {
            guard let previous else { throw PosterError.invalid("render requires --resume generation.json.") }
            let candidate = picks.isEmpty ? previous.candidates.first : previous.candidates.first { picks.contains($0.id) }
            guard let candidate else { throw PosterError.invalid("No matching poster was found.") }
            let out = URL(fileURLWithPath: options["--out"] ?? "output/export", isDirectory: true)
            try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
            let stage = ConstructionStage(rawValue: options["--stage"] ?? "finished")
            guard let stage else { throw PosterError.invalid("Stage must be blockout, primary, secondary, or finished.") }
            let image = try PosterRenderer.render(candidate.genome, copy: previous.copy, width: try integer("--width", default: 3508), stage: stage)
            try PosterRenderer.png(image, to: out.appending(path: "poster-\(candidate.genome.seed).png"))
            try PosterRenderer.pdf(candidate.genome, copy: previous.copy, to: out.appending(path: "poster-\(candidate.genome.seed).pdf"))
            print("Exported \(candidate.id) → \(out.path)"); return
        }
        guard ["generate", "evolve"].contains(args[0]) else { throw PosterError.invalid("Unknown command. Use --help.") }
        if args[0] == "evolve", previous == nil { throw PosterError.invalid("evolve requires --resume generation.json.") }
        if args[0] == "generate", previous != nil { throw PosterError.invalid("Use evolve with --resume.") }
        var settings = previous?.settings ?? EvolutionSettings()
        if let s = options["--seed"] { guard let seed = UInt64(s) else { throw PosterError.invalid("Seed must be an unsigned 64-bit integer.") }; settings.seed = seed }
        settings.count = try integer("--count", default: settings.count)
        settings.width = try integer("--width", default: settings.width)
        if let s = options["--mutation"] { guard let mutation = Double(s) else { throw PosterError.invalid("Mutation must be a number.") }; settings.mutation = mutation }
        settings.useAppleIntelligence = enabled.contains("--apple-intelligence") || settings.useAppleIntelligence
        if let mix=options["--mix"] {
            var weights=StyleCatalog.balancedWeights
            for pair in mix.split(separator:",") {let parts=pair.split(separator:"=",omittingEmptySubsequences:false);guard parts.count==2,let value=Double(parts[1]) else{throw PosterError.invalid("Mix uses Judge=weight pairs.")};weights[String(parts[0])]=value}
            settings.judgeWeights=weights
        }
        if let path=options["--style-models"]{settings.styleModelsURL=URL(fileURLWithPath:path)}
        if let path=options["--taste"]{settings.tasteDirectory=URL(fileURLWithPath:path)}
        try settings.validate()
        let rounds = try integer("--rounds", default: previous == nil ? 3 : 1)
        guard (1...50).contains(rounds) else { throw PosterError.invalid("Rounds must be 1–50.") }
        if let id=options["--brief"],ContentBriefLibrary.brief(id)==nil{throw PosterError.invalid("Unknown content brief. Use poster briefs list.")}
        var copy = options["--brief"].flatMap{ContentBriefLibrary.brief($0)?.posterCopy} ?? previous?.copy ?? ContentBriefLibrary.copy(seed:settings.seed)
        if ["--title","--subtitle","--institution","--footer"].contains(where:{options[$0] != nil}) {copy.briefID=nil;copy.displayPhrases=nil}
        if let title = options["--title"] { copy.title = title }
        if let subtitle = options["--subtitle"] { copy.subtitle = subtitle }
        if let venue=options["--institution"]{copy.institution=venue}
        if let footer=options["--footer"]{copy.footer=footer}
        let reference = options["--reference"].map { URL(fileURLWithPath: $0) } ?? previous?.referenceURL ?? Resources.referenceURL
        let crop = enabled.contains("--crop-reference") || (options["--reference"] == nil && (previous?.cropReference ?? true))
        let engine = try EvolutionEngine(referenceURL: reference, cropReference: crop, cpuOnly: enabled.contains("--cpu-only"))
        let out = options["--out"].map { URL(fileURLWithPath: $0, isDirectory: true) } ?? previous?.directory.deletingLastPathComponent() ?? URL(fileURLWithPath: "output/study-\(settings.seed)", isDirectory: true)
        var current = previous
        for round in 0..<rounds {
            print("Generating round \((current?.number ?? -1) + 1), \(settings.count) candidates…")
            current = try await engine.generate(copy: copy, settings: settings, previous: current, selectedIDs: round == 0 ? picks : [], output: out)
            if let result = current, let best = result.candidates.first {
                print("  winner \(best.id) · consensus \(best.consensus.formatted(.number.precision(.fractionLength(1)))) · \(best.measurements.recognizedWords) OCR words")
                print("  \(result.directory.appending(path: "generation.json").path)")
                for note in result.notes where note.contains("excluded") { print("  \(note)") }
            }
        }
    }
}

private extension ProcessInfo {
    var machineArchitecture: String {
        #if arch(arm64)
        "arm64"
        #else
        "Intel (Core ML CPU/GPU available)"
        #endif
    }
}
