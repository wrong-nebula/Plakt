import Foundation
import Vision

public actor EvolutionEngine {
    private let judge: PosterJudge
    private let referenceURL: URL
    private let cropReference: Bool
    private let scoringCPUOnly:Bool
    private var cachedStyleBank:StyleJudgeBank?
    private var styleBankKey:String?
    public init(referenceURL: URL = Resources.referenceURL, cropReference: Bool = true, cpuOnly: Bool = false) throws {
        self.referenceURL = referenceURL; self.cropReference = cropReference;self.scoringCPUOnly=cpuOnly
        judge = try PosterJudge(referenceURL: referenceURL, cropReference: cropReference, cpuOnly: cpuOnly)
    }

    private func styles(directory:URL?)throws->StyleJudgeBank {
        let key=directory?.path ?? "bundled"
        if styleBankKey != key || cachedStyleBank==nil {cachedStyleBank=try StyleJudgeBank(directory:directory,cpuOnly:scoringCPUOnly);styleBankKey=key}
        return cachedStyleBank!
    }
    public static func make(referenceURL: URL = Resources.referenceURL, cropReference: Bool = true, cpuOnly: Bool = false) async throws -> EvolutionEngine {
        try EvolutionEngine(referenceURL: referenceURL, cropReference: cropReference, cpuOnly: cpuOnly)
    }

    public func generate(copy input: PosterCopy, settings: EvolutionSettings, previous: Generation? = nil,
                         selectedIDs: Set<String> = [], output: URL) async throws -> Generation {
        try settings.validate()
        let styleBank=try styles(directory:settings.styleModelsURL)
        let taste=try TasteJudgeBank(directory:settings.tasteDirectory)
        var judgeWeights=settings.judgeWeights ?? StyleCatalog.balancedWeights
        judgeWeights.merge(taste.weights){old,_ in old}
        guard judgeWeights.contains(where:{$0.value>0 && (!TasteTrainer.isJudge($0.key) || taste.weights[$0.key] != nil)}) else{throw PosterError.invalid("Your taste jurors need more yes/no votes. Enable a craft judge or finish their taste check.")}
        let copy = try input.validated()
        let number = (previous?.number ?? -1) + 1
        let folder = output.appending(path: "generation-\(number)", directoryHint: .isDirectory)
        guard !FileManager.default.fileExists(atPath: folder.appending(path: "generation.json").path) else {
            throw PosterError.invalid("Generation \(number) already exists in this folder. Choose a new output folder or resume that generation.")
        }
        if let previous, previous.copy != copy { throw PosterError.invalid("Copy changed. Start a new session to compare candidates with consistent text.") }
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var roundMixer = SeededRandom(seed: settings.seed ^ (UInt64(number) &* 0xd1b54a32d192ed03))
        var rng = SeededRandom(seed: roundMixer.next())
        var usedSeeds: Set<UInt64> = []
        func uniqueSeed() -> UInt64 {
            var seed = rng.next()
            while usedSeeds.contains(seed) { seed = rng.next() }
            usedSeeds.insert(seed)
            return seed
        }
        var genomes: [(Genome, String?)] = []
        var parentIDs: [String] = []
        if let previous {
            let chosen = previous.candidates.filter { selectedIDs.contains($0.id) }
            guard selectedIDs.isSubset(of: Set(previous.candidates.map(\.id))) else { throw PosterError.invalid("A selected parent is not in the current generation.") }
            let parents = chosen.isEmpty ? Array(previous.candidates.prefix(3)) : chosen
            parentIDs = parents.map(\.id)
            // Elitism: retain the strongest chosen parent unchanged, then mutate.
            if let champion = parents.first { genomes.append((champion.genome, champion.id)); usedSeeds.insert(champion.genome.seed) }
            for i in genomes.count..<settings.count {
                if i == settings.count - 1 { genomes.append((.random(seed: uniqueSeed()), nil)) } // immigrant prevents collapse
                else {
                    let parent = parents[(i - 1) % parents.count]
                    genomes.append((parent.genome.mutated(seed: uniqueSeed(), strength: settings.mutation), parent.id))
                }
            }
        } else {
            genomes = (0..<settings.count).map { i in (.random(seed: settings.seed &+ UInt64(i)), nil) }
        }
        let generationWeights=StyleCatalog.generationWeights(judgeWeights)
        let activeStyles=StyleCatalog.categories.filter{(generationWeights[$0.id] ?? 0)>0}
        if !activeStyles.isEmpty {
            var styleRandom=SeededRandom(seed:settings.seed ^ UInt64(number) ^ 0x4d49585354594c45)
            let total=activeStyles.reduce(0.0){$0+(generationWeights[$1.id] ?? 0)}
            for i in genomes.indices where !(previous != nil && i==0) {
                if styleRandom.unit()<(genomes[i].1==nil ? 1:0.25) {
                    var pick=styleRandom.unit()*total
                    for category in activeStyles {pick-=generationWeights[category.id] ?? 0;if pick<=0{genomes[i].0.renderStyle=category.id;break}}
                }
            }
        }
        guard Set(genomes.map { $0.0.seed }).count == genomes.count else { throw PosterError.invalid("Duplicate candidate seed detected.") }
        var candidates: [Candidate] = []
        var prints: [VNFeaturePrintObservation] = []
        for (inputGenome, parent) in genomes {
            var genome=inputGenome;genome.composition=genome.renderStyle == nil ? CompositionPlan.procedural(genome):SourceComposition.recipe(genome,copy:copy).composition
            try Task.checkCancellation()
            let image = try PosterRenderer.render(genome, copy: copy, width: settings.width)
            let url = folder.appending(path: "poster-\(genome.seed).png")
            try PosterRenderer.png(image, to: url)
            let (metrics, prior, feature) = try judge.evaluate(image, genome: genome)
            var candidate = Candidate(id: "g\(number)-\(genome.seed)", genome: genome, generation: number, parentID: parent, imageURL: url,
                                        measurements: metrics, scores: ["Composition": prior, "Reference": metrics.reference,
                                            "Typography": metrics.readability * 0.65 + metrics.hierarchy * 0.35,
                                            "Rhythm": metrics.detail * 0.45 + metrics.balance * 0.3 + metrics.coverage * 0.25])
            candidate.scores.merge(try styleBank.scores(image)){_,new in new}
            candidate.scores.merge(try taste.scores(image)){_,new in new}
            if genome.renderStyle != nil {candidate.scores.merge(CompositionJudges.evaluate(SourceComposition.recipe(genome,copy:copy),measurements:metrics,copy:copy,style:genome.renderStyle)){_,new in new}}
            if genome.usesStagedConstruction {
                let process = folder.appending(path: "process-\(genome.seed)", directoryHint: .isDirectory)
                try FileManager.default.createDirectory(at: process, withIntermediateDirectories: true)
                var urls: [URL] = []
                for stage in ConstructionStage.allCases {
                    try Task.checkCancellation()
                    let step = try PosterRenderer.render(genome, copy: copy, width: 600, stage: stage)
                    let stepURL = process.appending(path: "\(stage.rawValue).png")
                    try PosterRenderer.png(step, to: stepURL); urls.append(stepURL)
                }
                let planEncoder = JSONEncoder(); planEncoder.outputFormatting = [.prettyPrinted, .sortedKeys]
                try planEncoder.encode(BlockoutPlan.make(genome)).write(to: process.appending(path: "blockout-plan.json"))
                try ContactSheet.writeProcess(urls, seed: genome.seed, to: process)
                candidate.processURLs = urls
            }
            candidates.append(candidate)
            prints.append(feature)
        }
        for i in candidates.indices {
            var nearest = Double.greatestFiniteMagnitude
            for j in candidates.indices where i != j {
                var d: Float = 0; try prints[i].computeDistance(&d, to: prints[j]); nearest = min(nearest, Double(d))
            }
            candidates[i].scores["Diversity"] = min(1, nearest / 0.8)
        }
        var notes = ["Weighted Borda ballots; zero-weight judges and judges that score the whole batch identically are excluded. Scores are relative to this batch; compare raw judge values across generations.", styleBank.note,
                     "Composition is an authored Core ML prior, not a trained aesthetic model. Vision supplies feature similarity and OCR."]
        let staged = candidates.filter { $0.genome.usesStagedConstruction }.count
        notes.append("Seeded coin toss: \(staged) staged / \(candidates.count - staged) direct. Staged seeds choose among six geometric blockout plans before adding primary type, secondary type, then repetition and detail.")
        var critique: String?
        if settings.useAppleIntelligence {
            do {
                let verdict = try await AppleCritic.critique(candidates)
                critique = verdict.text
                for i in candidates.indices { candidates[i].scores["Apple Intelligence"] = verdict.scores[candidates[i].id] }
            } catch is CancellationError { throw CancellationError() }
            catch { notes.append("Apple Intelligence ballot excluded: \(error.localizedDescription)") }
        }
        try Task.checkCancellation()
        var frozenSettings=settings;frozenSettings.judgeWeights=judgeWeights
        var generation = Generation(number: number, candidates: Voting.rank(candidates,weights:judgeWeights), copy: copy, notes: notes,
                                    appleCritique: critique, selectedParents: parentIDs, compute: judge.computeDescription,
                                    model: "CompositionPrior v1 · authored weights; style heads · procedural starter labels + reviewed examples", referenceURL: referenceURL,
                                    cropReference: cropReference, settings: frozenSettings, directory: folder)
        generation.personalJury=taste.members
        try ContactSheet.write(generation)
        try Self.save(generation)
        return generation
    }

    func evaluateExternal(_ samples: [ExternalSample],weights:[String:Double]?=nil,styleModelsURL:URL?=nil) throws -> ExternalEvaluation {
        guard (2...256).contains(samples.count), Set(samples.map(\.id)).count == samples.count else {
            throw PosterError.invalid("External batch must contain 2–256 unique sample IDs.")
        }
        let styles=weights==nil ? nil:try self.styles(directory:styleModelsURL)
        var candidates: [Candidate] = []
        var prints: [VNFeaturePrintObservation] = []
        for sample in samples {
            try Task.checkCancellation()
            guard sample.imageURL.isFileURL else { throw PosterError.invalid("Only local image files can be judged.") }
            let image = try PosterRenderer.load(sample.imageURL)
            guard image.width <= 8000, image.height <= 12000 else { throw PosterError.invalid("External image is too large.") }
            var genome = Genome.random(seed: sample.seed)
            genome.repetition = min(1, max(0, sample.parameters["repetition"] ?? 0.65))
            let (m, quality, feature) = try judge.evaluate(image, genome: genome)
            var scores: [String: Double] = ["Composition": quality, "Reference": m.reference,
                "Typography": m.readability * 0.65 + m.hierarchy * 0.35,
                "Rhythm": m.detail * 0.45 + m.balance * 0.30 + m.coverage * 0.25]
            if let styles {scores.merge(try styles.scores(image)){_,new in new}}
            candidates.append(Candidate(id: sample.id, genome: genome, generation: sample.generation,
                                        imageURL: sample.imageURL, measurements: m, scores: scores))
            prints.append(feature)
        }
        for i in candidates.indices {
            var nearest = Double.greatestFiniteMagnitude
            for j in candidates.indices where i != j {
                var distance: Float = 0
                try prints[i].computeDistance(&distance, to: prints[j]); nearest = min(nearest, Double(distance))
            }
            candidates[i].scores["Diversity"] = min(1, nearest / 0.8)
        }
        return ExternalEvaluation(samples: samples, results: Voting.rank(candidates,weights:weights), compute: judge.computeDescription,
            note: "Weighted committee of image, style and optional designer-affinity scores. This is not an objective ranking of library quality. Genome fields in results are scoring placeholders; source images and backend parameters are in samples. Use the real scene genome or backend SVG for vector export.")
    }

    public static func save(_ generation: Generation) throws {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(generation).write(to: generation.directory.appending(path: "generation.json"), options: .atomic)
    }
    public static func load(_ url: URL) throws -> Generation {
        let generation = try JSONDecoder().decode(Generation.self, from: Data(contentsOf: url))
        try generation.settings.validate()
        _ = try generation.copy.validated()
        let candidates = generation.candidates
        guard (0...100000).contains(generation.number), (4...32).contains(candidates.count),
              Set(candidates.map(\.id)).count == candidates.count,
              Set(candidates.map { $0.genome.seed }).count == candidates.count else {
            throw PosterError.invalid("Invalid study: candidate IDs and seeds must be unique, with 4–32 candidates.")
        }
        for c in candidates {
            let g = c.genome
            guard g.fingerprint.allSatisfy({ $0.isFinite && (0...1).contains($0) }), (0..<4).contains(g.layout),
                  (g.renderStyle==nil || StyleCatalog.categories.contains{$0.id==g.renderStyle}),
                  g.motifs.count == 24, g.motifs.allSatisfy({ (0..<12).contains($0) }),
                  c.scores.values.allSatisfy({ $0.isFinite && (0...1).contains($0) }) else {
                throw PosterError.invalid("Invalid study: malformed genome or judge score.")
            }
        }
        return generation
    }
}
