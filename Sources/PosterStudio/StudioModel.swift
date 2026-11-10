import SwiftUI
import PosterCore

@MainActor @Observable
final class StudioModel {
    var copy = ContentBriefLibrary.copy()
    var contentSelection="auto"
    var seedText = "2026"
    var batchSize = 8
    /// The artwork the glass window shows; set by the Glass actions.
    var glassArtworkURL: URL?
    /// Genomes built per source-study slot; the jury surrogate picks one to render. 1 turns the filter off.
    var proposalsPerSlot = 1
    var rounds = 2
    var mutation = 0.25
    var appleIntelligence = false
    var judgeWeights=StyleCatalog.balancedWeights
    var styleModelsURL:URL?=UserDefaults.standard.string(forKey:"posterlab-style-models").map{URL(fileURLWithPath:$0)}
    var reviewLibraryURL:URL?=UserDefaults.standard.string(forKey:"posterlab-library-directory").map{URL(fileURLWithPath:$0)} ?? (Bundle.main.object(forInfoDictionaryKey:"PosterLabProjectRoot") as? String).map{URL(fileURLWithPath:$0).appending(path:"library")}
    var sourceStudyURL:URL?
    var useLibraryCompositions=true
    var useModifiers=false
    var live:LiveStudy?
    var shapePreset:PosterShapePreset?=UserDefaults.standard.data(forKey:"posterlab-shape-preset").flatMap{try? JSONDecoder().decode(PosterShapePreset.self,from:$0)}
    func chooseShape(_ preset:PosterShapePreset?){shapePreset=preset;if let preset,let data=try? JSONEncoder().encode(preset){UserDefaults.standard.set(data,forKey:"posterlab-shape-preset");if let font=preset.fontProfileID{fontProfileID=font;UserDefaults.standard.set(font,forKey:"posterlab-font-profile")}}else{UserDefaults.standard.removeObject(forKey:"posterlab-shape-preset")}}
    var tasteProfiles:[TasteProfile]=[]
    var tasteDirectory:URL{(reviewLibraryURL?.deletingLastPathComponent() ?? URL(fileURLWithPath:FileManager.default.currentDirectoryPath)).appending(path:"taste")}
    func refreshTasteJury(){Task{do{let archive=try await TasteStore(directory:tasteDirectory).load();tasteProfiles=archive.profiles;judgeWeights=judgeWeights.filter{!TasteTrainer.isJudge($0.key)};for profile in tasteProfiles where profile.ready && profile.enabled{judgeWeights[profile.judgeName]=profile.weight}}catch{self.error=error.localizedDescription}}}
    func useOnlyTasteJury(){guard tasteProfiles.contains(where:{$0.ready && $0.enabled && $0.weight>0}) else{return};judgeWeights=judgeWeights.mapValues{_ in 0};for p in tasteProfiles where p.ready && p.enabled{judgeWeights[p.judgeName]=p.weight}}
    var typeSystem:TypeSystemVariant?=UserDefaults.standard.data(forKey:"posterlab-type-system").flatMap{try? JSONDecoder().decode(TypeSystemVariant.self,from:$0)}
    func chooseTypeSystem(_ variant:TypeSystemVariant?){typeSystem=variant;if let variant,let data=try? JSONEncoder().encode(variant){UserDefaults.standard.set(data,forKey:"posterlab-type-system")}else{UserDefaults.standard.removeObject(forKey:"posterlab-type-system")}}
    var fontProfileID:String?=UserDefaults.standard.string(forKey:"posterlab-font-profile")
    var referenceURL = Resources.referenceURL
    var cropReference = true
    var generations: [Generation] = []
    var selectedID: String?
    var picks: Set<String> = []
    /// The one sheet on screen; see `StudioSheet`.
    var sheet: StudioSheet?
    /// What the studio is doing; see `JobLifecycle`. `busy` is true for any job.
    let jobs = JobRunner()
    var busy: Bool { jobs.busy }
    var status = "Ready to make a study"
    var error: String?
    var images: [String: NSImage] = [:]
    var processImages: [String: [NSImage]] = [:]
    var referenceImage: NSImage?
    var output: URL?
    private var engine: EvolutionEngine?
    init() {
        if let data=UserDefaults.standard.data(forKey:"posterlab-judge-weights"),let saved=try? JSONDecoder().decode([String:Double].self,from:data) {judgeWeights=saved}
        findSavedSourceStudy();refreshTasteJury()
    }
    var current: Generation? { generations.last }
    var selected: Candidate? { current?.candidates.first { $0.id == selectedID } }

    func chooseContent(_ id:String) {
        contentSelection=id
        if id=="auto" {refreshContentPreview()}
        else if let brief=ContentBriefLibrary.brief(id){copy=brief.posterCopy}
        else {copy.briefID=nil;copy.displayPhrases=nil}
    }
    func refreshContentPreview() {
        if contentSelection=="auto",let seed=UInt64(seedText){copy=ContentBriefLibrary.copy(seed:seed)}
    }
    func editCopy(_ path:WritableKeyPath<PosterCopy,String>,_ value:String) {
        copy[keyPath:path]=value;copy.briefID=nil;copy.displayPhrases=nil;contentSelection="custom"
    }
    var previewBrief:PosterContentBrief? {ContentBriefLibrary.brief(copy.briefID)}
    var previewSourcePosterURL:URL? {
        guard let id=previewBrief?.sourcePosterID,let directory=reviewLibraryURL else{return nil}
        for ext in ["jpg","png"] {let url=directory.appending(path:"posters/\(id)/poster.\(ext)");if FileManager.default.fileExists(atPath:url.path){return url}}
        return nil
    }
    func start(newSession: Bool) {
        if newSession && useLibraryCompositions && reviewLibraryURL != nil {startSourceStudy();return}
        guard !busy else { return }
        guard let seed = UInt64(seedText) else { error = "Seed must be an unsigned integer."; return }
        do { _ = try copy.validated() } catch { self.error = error.localizedDescription; return }
        var settings = EvolutionSettings()
        settings.seed = seed; settings.count = batchSize; settings.mutation = mutation
        settings.useAppleIntelligence = appleIntelligence
        settings.judgeWeights=judgeWeights;settings.styleModelsURL=styleModelsURL;settings.tasteDirectory=tasteDirectory
        let snapshot = copy
        let reference = referenceURL, crop = cropReference
        let inputPicks = picks
        let previous = newSession ? nil : current
        let root: URL
        if newSession || output == nil {
            root = URL.documentsDirectory.appending(path: "PosterLab", directoryHint: .isDirectory)
                .appending(path: "study-\(UUID().uuidString.prefix(8))", directoryHint: .isDirectory)
        } else { root = output! }
        error = nil
        jobs.run(.rounds) { [self] in
            do {
                if engine == nil || newSession { engine = try await EvolutionEngine.make(referenceURL: reference, cropReference: crop) }
                guard let engine else { return }
                if newSession { generations = []; images = [:]; selectedID = nil }
                output = root
                var prior = previous
                for i in 0..<rounds {
                    try Task.checkCancellation()
                    status = "Round \((prior?.number ?? -1) + 1) · rendering and judging \(batchSize) posters"
                    let generation = try await engine.generate(copy: snapshot, settings: settings, previous: prior,
                                                               selectedIDs: i == 0 ? inputPicks : [], output: root)
                    generations.append(generation); prior = generation
                    cacheImages(generation)
                    selectedID = generation.candidates.first?.id
                    picks = []
                }
                status = "Round \(prior?.number ?? 0) complete · choose parents or evolve the top three"
            } catch is CancellationError { status = "Stopped · completed rounds are saved" }
            catch { self.error = error.localizedDescription; status = "Could not complete this round" }
        }
    }
    func stop() { if jobs.stop() { status = "Stopping after the current analysis…" } }
    /// Shows a job's progress unless it has been asked to stop or has already ended.
    private func report(_ message: String) { if jobs.lifecycle.acceptsProgress { status = message } }
    func togglePick(_ id: String) { if picks.contains(id) { picks.remove(id) } else { picks.insert(id) } }
    func importReference() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.image]; panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            referenceURL = url; cropReference = false; referenceImage = NSImage(contentsOf: url)
            engine = nil; generations = []; images = [:]; picks = []; selectedID = nil; output = nil
            status = "Reference loaded · generate a new study"
        }
    }
    func loadGeneration() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.json]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        restoreGeneration(url)
    }
    func restoreGeneration(_ url:URL) {
        do {
            let generation = try EvolutionEngine.load(url)
            guard generation.candidates.allSatisfy({ FileManager.default.fileExists(atPath: $0.imageURL.path) }) else {
                throw PosterError.invalid("Some poster images are missing. Restore the original generation folder before opening this study.")
            }
            UserDefaults.standard.set(url.path,forKey:"posterlab-last-study")
            copy = generation.copy; generations = [generation]; selectedID = generation.candidates.first?.id
            judgeWeights=generation.settings.judgeWeights ?? StyleCatalog.balancedWeights
            styleModelsURL=generation.settings.styleModelsURL
            seedText = String(generation.settings.seed); batchSize = generation.settings.count; mutation = generation.settings.mutation
            referenceURL = generation.referenceURL; cropReference = generation.cropReference
            referenceImage = NSImage(contentsOf: referenceURL); output = generation.directory.deletingLastPathComponent()
            cacheImages(generation)
            engine = nil; picks = []; status = "Study restored · round \(generation.number)"
        } catch { self.error = error.localizedDescription }
    }
    private func cacheImages(_ generation: Generation) {
        images = Dictionary(uniqueKeysWithValues: generation.candidates.compactMap { c in NSImage(contentsOf: c.imageURL).map { (c.id, $0) } })
        var steps: [String: [NSImage]] = [:]
        for candidate in generation.candidates {
            if let urls = candidate.processURLs, urls.count == 4 {
                let previews = urls.compactMap { NSImage(contentsOf: $0) }
                if previews.count == 4 { steps[candidate.id] = previews }
            }
        }
        processImages = steps
    }
    func exportSelected(pdf: Bool) {
        guard !busy, let selected, let current else { return }
        let panel = NSSavePanel(); panel.allowedContentTypes = pdf ? [.pdf] : [.png]
        panel.nameFieldStringValue = "poster-\(selected.genome.seed).\(pdf ? "pdf" : "png")"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        status = "Exporting \(pdf ? "vector PDF" : "3508 px PNG")…"
        let genome = selected.genome, snapshot = current.copy
        jobs.run(.export) { [self] in
            do {
                try await ExportWorker.export(genome, copy: snapshot, pdf: pdf, to: url)
                status = "Exported \(url.lastPathComponent)"
            } catch { self.error = error.localizedDescription }
        }
    }
    func findSavedSourceStudy() {
        guard let library=reviewLibraryURL else{return}
        let root=library.deletingLastPathComponent().appending(path:"output")
        let urls=(try? FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:[.contentModificationDateKey])) ?? []
        let candidates=urls.filter{$0.lastPathComponent.hasPrefix("source-") && FileManager.default.fileExists(atPath:$0.appending(path:"manifest.json").path)}
        sourceStudyURL=candidates.sorted{a,b in
            let x=(try? a.resourceValues(forKeys:[.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            let y=(try? b.resourceValues(forKeys:[.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            return x>y
        }.first
    }
    func startSourceStudy() {
        guard !busy else{return}
        guard let library=reviewLibraryURL else{error="Open your source library in Review library first.";return}
        guard let seed=UInt64(seedText) else{error="Seed must be an unsigned integer.";return}
        guard (4...16).contains(batchSize) else{error="Source studies use 4–16 candidates per round.";return}
        do{_ = try copy.validated()}catch{self.error=error.localizedDescription;return}
        let snapshot=copy,count=batchSize,proposals=proposalsPerSlot,fontProfile=fontProfileID,typeVariant=typeSystem,shapeVariant=shapePreset,tastePath=tasteDirectory,mixBriefs=contentSelection=="auto"
        // The bundled default reference is a placeholder; only a reference the user chose steers the study.
        let judgingReference=referenceURL==Resources.referenceURL ? nil:referenceURL,cropJudgingReference=cropReference,modifiers=useModifiers
        let weights=StyleCatalog.balancedWeights.allSatisfy({(judgeWeights[$0.key] ?? 0)==$0.value}) ? nil:judgeWeights
        let folder=library.deletingLastPathComponent().appending(path:"output/source-study-\(UUID().uuidString.prefix(8))")
        status="Pairing source genomes for five rounds in each direction…"
        let (stream,feed)=AsyncStream.makeStream(of:SourceStudyEvent.self)
        live=LiveStudy(resultURL:folder,events:stream)
        jobs.run(.sourceStudy) { [self] in
            defer{feed.finish()}
            do {
                let records=try await PosterLibraryEngine(directory:library).records()
                let breeder=try await LibraryBreeder.make(records:records,output:folder)
                let reference=try judgingReference.map{try SourceStudyReference(url:$0,crop:cropJudgingReference)}
                try await breeder.run(rounds:5,count:count,seed:seed,copy:snapshot,useBriefLibrary:mixBriefs,overrideWeights:weights,fontProfileID:fontProfile,typeSystem:typeVariant,shapePreset:shapeVariant,tasteDirectory:tastePath,reference:reference,useModifiers:modifiers,proposalsPerSlot:proposals,events:{feed.yield($0)},progress:{message in Task{@MainActor in self.report(message)}})
                sourceStudyURL=folder;finishLive(stopped:false)
                status="Source study complete · \(StyleCatalog.categories.count) winners from \(StyleCatalog.categories.count*5*count) candidates."
            }catch is CancellationError{status="Source study stopped · completed rounds remain saved.";finishLive(stopped:true)}
            catch{self.error=error.localizedDescription;status="Source study did not finish."}
        }
    }
    func applyJudgingMix() {
        guard !busy else{return}
        if let data=try? JSONEncoder().encode(judgeWeights){UserDefaults.standard.set(data,forKey:"posterlab-judge-weights")}
        if var generation=current {
            generation.settings.judgeWeights=judgeWeights
            generation.candidates=Voting.rank(generation.candidates,weights:judgeWeights)
            generations[generations.count-1]=generation
            status="Judging mix updated. Next evolution uses this ranking."
        }
    }
    func trainStyleJudges() {
        guard !busy else{return}
        status="Training \(StyleCatalog.categories.count) local style judges…"
        let source=reviewLibraryURL
        let destination=(source ?? URL.applicationSupportDirectory.appending(path:"PosterLab")).appending(path:"style-models/run-\(UUID().uuidString.prefix(8))")
        jobs.run(.styleTraining) { [self] in
            do {
                _ = try await StyleTrainingWorker.train(directory:destination,library:source)
                styleModelsURL=destination
                UserDefaults.standard.set(destination.path,forKey:"posterlab-style-models")
                status="\(StyleCatalog.categories.count) style judges trained. Generate a new study to use these models."
            }catch is CancellationError{status="Style training stopped · the current judges stay in use."}
            catch{self.error=error.localizedDescription;status="Style training did not finish."}
        }
    }
    func reveal() { if let output { NSWorkspace.shared.open(output) } }

    func openSourceStudy() {
        findSavedSourceStudy()
        if let sourceStudyURL { sheet = .sourceStudy(sourceStudyURL) } else { status = "No saved source study in this library’s output folder." }
    }
    /// Opens the sheet a `-PosterLabSheet` launch argument names.
    @ObservationIgnored private var glassPrintArtwork: [URL: URL] = [:]
    @ObservationIgnored private var glassPrintPending: Set<URL> = []

    /// Opens glass on the on-screen image at once, then swaps in the same design as a vector PDF. Glass renders
    /// it at print size (study previews are only 700–1000 px wide), and its SVG export keeps the poster's vectors.
    func editInGlass(_ url: URL?, vectorPoster: (@Sendable (URL) throws -> Void)? = nil) {
        guard let url else { glassArtworkURL = nil; return }
        if let print = glassPrintArtwork[url] { glassArtworkURL = print; return }
        // PosterLab's command-line studies write each poster.png beside its vector poster.pdf.
        let twin = url.deletingLastPathComponent().appending(path: "poster.pdf")
        if vectorPoster == nil, url.lastPathComponent == "poster.png", FileManager.default.fileExists(atPath: twin.path) {
            glassArtworkURL = twin; return
        }
        glassArtworkURL = url
        guard let vectorPoster, glassPrintPending.insert(url).inserted else { return }
        let destination = FileManager.default.temporaryDirectory
            .appending(path: "PosterLab Glass/\(UUID().uuidString)/\(url.deletingPathExtension().lastPathComponent).pdf")
        Task {
            defer { glassPrintPending.remove(url) }
            do {
                try await Task.detached(priority: .userInitiated) {
                    try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
                    try vectorPoster(destination)
                }.value
                glassPrintArtwork[url] = destination
                if glassArtworkURL == url { glassArtworkURL = destination }
            } catch {
                status = "Glass is using the \(url.lastPathComponent) preview: \(error.localizedDescription)"
            }
        }
    }

    func editSelectedInGlass() {
        guard let selected, let current else { editInGlass(nil); return }
        let genome = selected.genome, copy = current.copy
        editInGlass(selected.imageURL) { try PosterRenderer.pdf(genome, copy: copy, to: $0) }
    }

    /// Source-study and image-study candidates re-render from their scene genome and seed.
    func editSceneInGlass(_ imageURL: URL, genome: StyleGenome, seed: UInt64) {
        editInGlass(imageURL) { try LibrarySceneRenderer.pdf(genome, to: $0, seed: seed) }
    }

    func openLaunchSheet(_ name: String) {
        if name == "sourceStudy" { findSavedSourceStudy() }
        if let next = StudioSheet(name: name, sourceStudy: sourceStudyURL) { sheet = next }
        else { error = "PosterLabSheet “\(name)” isn’t available. Use one of: \(StudioSheet.names.joined(separator: ", "))." }
    }
    /// Opens a sheet when a job finishes, without replacing a sheet the person is using.
    /// The live stage plays events with pauses, so it ends once its queue has caught up.
    private func finishLive(stopped:Bool) {
        guard let live else{return}
        Task{@MainActor in
            while !live.caughtUp && !stopped {try? await Task.sleep(for:.milliseconds(300))}
            try? await Task.sleep(for:.seconds(stopped ? 0:1.5))
            live.finish(stopped:stopped)
        }
    }
    func openLiveResults() {if let live{sheet = .sourceStudy(live.resultURL)}}
    func closeLive() {live=nil}
    private func offer(_ next: StudioSheet) { if sheet == nil { sheet = next } }
}

private actor ExportWorker {
    static func export(_ genome: Genome, copy: PosterCopy, pdf: Bool, to url: URL) async throws {
        if pdf { try PosterRenderer.pdf(genome, copy: copy, to: url) }
        else { try PosterRenderer.png(PosterRenderer.render(genome, copy: copy, width: 3508), to: url) }
    }
}

private actor StyleTrainingWorker {
    static func train(directory:URL,library:URL?) async throws->StyleJudgeTraining {
        let records=try await library.map{PosterLibraryEngine(directory:$0)}?.records() ?? []
        return try StyleJudgeTrainer.train(directory:directory,seeds:32,records:records)
    }
}
