import Foundation
import CoreGraphics

public struct RegionAnalysisSettings: Codable, Sendable {
    public var gridSize = 3
    public var maximumRegions = 6
    public var minimumStability = 0.82
    public var minimumPredictedIoU = 0.65
    /// Extra point prompts placed on ink components when the border shows one paper color; zero disables them.
    public var inkPoints = 6
    public init() {}
    public var valid: Bool {
        (1...8).contains(gridSize) && (1...24).contains(maximumRegions) && (0...24).contains(inkPoints) && minimumStability.isFinite &&
        minimumPredictedIoU.isFinite && (0...1).contains(minimumStability) && (0...1).contains(minimumPredictedIoU)
    }
}

public struct RegionCollectionSummary: Codable, Sendable {
    public let version: String
    public let analyzedPosters: Int
    public let cachedPosters: Int
    public let regionCount: Int
    public let suggestedTags: Int
    public let typeCandidates: Int
    public let shapeCandidates: Int
    public let failures: [String: String]
}

/// SAM discovers support regions; SigLIP describes them; Vision and geometry compare them.
public actor MultimodalLibraryAnalysis {
    public static let recipeRevision = "sam-ink-contrast-layout-v5-ink-seeds"
    private let directory: URL
    private let semanticModels: URL?
    private let cpuOnly: Bool
    private let sampler: SAM2Segmenter
    private var encoder: SigLIPEncoder?
    private var tagger: RegionSemanticTagger?
    private var matcher: SourceSystemMatcher?
    private var inkField: PrintedInkField?
    private var inkImageHash: String?
    private let visual = LibraryVisualEmbedder()
    // Region search reuses decoded analyses until their files change.
    private var savedAnalyses = DecodedFiles<PosterRegionAnalysis>()
    private var savedAccepted = DecodedFiles<[RegionAnalysis]>()
    private var savedCatalog = DecodedFiles<PosterLibrary>()

    public init(directory: URL, samModels: URL? = nil, semanticModels: URL? = nil, cpuOnly: Bool = false) {
        self.directory = directory.standardizedFileURL; self.semanticModels = semanticModels; self.cpuOnly = cpuOnly
        sampler = SAM2Segmenter(models: samModels, cache: directory.appending(path: "segmentation/compiled"))
    }

    private func semantic() throws -> SigLIPEncoder {
        if let encoder { return encoder }
        let runtime = try SigLIPEncoder(directory: semanticModels, cpuOnly: cpuOnly, cacheDirectory: directory.appending(path: "semantic-siglip/compiled"))
        encoder = runtime
        return runtime
    }

    private func descriptions() throws -> RegionSemanticTagger {
        if let tagger { return tagger }
        let loaded = try RegionSemanticTagger(encoder: semantic()); tagger = loaded
        return loaded
    }

    public func select(imageURL: URL, points: [SAMPoint]) async throws -> SAMSelection {
        try await sampler.segment(imageURL: imageURL, points: points)
    }

    public func describe(record: PosterRecord, selection: SAMSelection, maskID: Int) throws -> RegionAnalysis {
        guard selection.imageHash == (try LibraryRaster.hash(Data(contentsOf: record.imageURL))),
              let mask = selection.masks.first(where: { $0.id == maskID }), mask.valid, let bounds = mask.bounds else {
            throw PosterError.invalid("The selection no longer matches this poster.")
        }
        let image = try LibraryRaster.oriented(record.imageURL, maxSize: 2048)
        return try describe(record: record, source: image, selection: selection, mask: mask, bounds: bounds)
    }

    private func describe(record: PosterRecord, source: CGImage, selection: SAMSelection, mask: SegmentationMask, bounds: UnitBox) throws -> RegionAnalysis {
        let semantic = try semantic(), descriptions = try descriptions()
        // Saved masks, ink, geometry and cutouts use SAM's scores upsampled to the physical aspect.
        // Selections without scores keep their 256 grid.
        let size = SegmentationMask.detailSize(width: source.width, height: source.height)
        let detailed = try mask.logits == nil ? mask : mask.upsampled(width: size.width, height: size.height)
        if inkField == nil || inkImageHash != selection.imageHash || inkField?.width != detailed.width || inkField?.height != detailed.height {
            inkField = try PrintedInkField(image: source, width: detailed.width, height: detailed.height); inkImageHash = selection.imageHash
        }
        guard let inkField else { throw PosterError.render }
        let (ink, refinement) = inkField.refine(detailed)
        let selectedBounds = ink.bounds ?? detailed.bounds ?? bounds
        let identity = selection.imageHash + selection.modelFingerprint + LibraryRaster.hash(mask.bytes) + "ink-v2-\(detailed.width)x\(detailed.height)"
        let id = record.id + "-sam-" + String(LibraryRaster.hash(Data(identity.utf8)).prefix(16))
        let folder = directory.appending(path: "segmentation/posters/\(record.id)/regions/\(id)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let maskURL = folder.appending(path: "mask.png"), inkURL = folder.appending(path: "ink-mask.png")
        let cutoutURL = folder.appending(path: "cutout.png"), imageURL = folder.appending(path: "isolated.png")
        let isolated = try ink.cutout(source, maximumSize: 512)
        try PosterRenderer.png(detailed.image(), to: maskURL)
        try PosterRenderer.png(ink.image(), to: inkURL)
        try PosterRenderer.png(ink.cutout(source, transparent: true, maximumSize: 768), to: cutoutURL)
        try PosterRenderer.png(isolated, to: imageURL)
        let encoded = try LibraryRaster.oriented(imageURL)
        let textElements = record.elements.filter { $0.reviewStatus != "rejected" && $0.kind == "word" }
        let fallback = record.elements.filter { $0.reviewStatus != "rejected" && $0.kind == "text-line" }
        let geometry = try RegionGeometry.measure(ink, imageAspect: Double(source.height) / Double(source.width), textBoxes: (textElements.isEmpty ? fallback : textElements).map(\.bounds))
        let linked = fallback.filter {
            let intersection = $0.bounds.rect.intersection(selectedBounds.rect)
            return !intersection.isNull && intersection.width * intersection.height / max(0.00001, $0.bounds.area) > 0.55
        }
        let text = linked.sorted { $0.bounds.y == $1.bounds.y ? $0.bounds.x < $1.bounds.x : $0.bounds.y < $1.bounds.y }.compactMap(\.text).joined(separator: " ")
        let vector = try semantic.image(encoded)
        let context = try semantic.image(LibraryRaster.crop(source, selectedBounds))
        let rejected = Set(record.tags.filter { $0.state == "rejected" }.map(\.name))
        let tags = descriptions.tags(vector: vector, geometry: geometry, rejected: rejected)
        if matcher == nil { matcher = try SourceSystemMatcher(encoder: semantic) }
        let vision = try visual.embed(encoded)
        let related = try matcher?.related(vision: vision, context: context) ?? []
        let region = RegionAnalysis(id: id, posterID: record.id, sourceImageHash: selection.imageHash,
            samFingerprint: selection.modelFingerprint, samComputeUnits: selection.computeUnits, siglipFingerprint: semantic.manifest.fingerprint, prompt: selection.prompts,
            maskURL: maskURL, inkMaskURL: inkURL, inkRefinement: refinement, imageURL: imageURL,
            imageHash: try LibraryRaster.hash(Data(contentsOf: imageURL)), cutoutURL: cutoutURL, bounds: selectedBounds, predictedIoU: mask.predictedIoU,
            stability: mask.stability, geometry: geometry, vision: vision,
            siglip: RegionSemanticTagger.embedding(vector, manifest: semantic.manifest),
            contextSiglip: RegionSemanticTagger.embedding(context, manifest: semantic.manifest), tags: tags,
            text: text, linkedElementIDs: linked.map(\.id), relatedSystems: related)
        try LibraryRaster.write(region, to: folder.appending(path: "region.json"))
        return region
    }

    public func currentAnalysis(record: PosterRecord) throws -> PosterRegionAnalysis? {
        let url = directory.appending(path: "segmentation/posters/\(record.id)/analysis.json")
        guard let data = try? Data(contentsOf: url), let analysis = try? JSONDecoder().decode(PosterRegionAnalysis.self, from: data),
              analysis.version == "sam-siglip-vision-v1", analysis.imageHash == (try LibraryRaster.hash(Data(contentsOf: record.imageURL))) else { return nil }
        return analysis
    }

    public func run(settings: RegionAnalysisSettings = RegionAnalysisSettings(), posterID: String? = nil,
                    limit: Int? = nil, force: Bool = false, progress: @Sendable (String) -> Void = { _ in }) async throws -> RegionCollectionSummary {
        guard settings.valid, limit == nil || limit! > 0 else { throw PosterError.invalid("Invalid segmentation analysis settings.") }
        let root = directory.appending(path: "segmentation")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let lock = try SemanticIndexLock(url: root.appending(path: ".analysis.lock")); defer { lock.release() }
        let engine = PosterLibraryEngine(directory: directory)
        let catalog = try await engine.load()
        if let posterID, !catalog.posters.contains(where: { $0.id == posterID }) { throw PosterError.invalid("Unknown poster ID.") }
        let entries = Array(catalog.posters.filter { posterID == nil || $0.id == posterID }.sorted { $0.id < $1.id }.prefix(limit ?? Int.max))
        let sam = try await sampler.manifest(), semantic = try semantic(), descriptions = try descriptions()
        let prior = SemanticLibrarySearch(directory: directory, models: semanticModels)
        let cachedFeatures = try await prior.cachedPosterFeatures()
        var completed = 0, cached = 0, regions = 0, tags = 0, type = 0, shape = 0, failures: [String: String] = [:]
        let json = JSONEncoder(); json.outputFormatting = [.sortedKeys]
        func summary() -> RegionCollectionSummary {
            RegionCollectionSummary(version: "sam-siglip-vision-v1", analyzedPosters: completed, cachedPosters: cached,
                regionCount: regions, suggestedTags: tags, typeCandidates: type, shapeCandidates: shape, failures: failures)
        }
        for (position, entry) in entries.enumerated() {
            try Task.checkCancellation()
            let capacity = try FileManager.default.attributesOfFileSystem(forPath: directory.path)[.systemFreeSize] as? NSNumber
            if let capacity, capacity.uint64Value < 192 * 1024 * 1024 {
                throw PosterError.invalid("Region analysis stopped before disk space ran out. Free space and run the same command to resume; completed posters are cached.")
            }
            do {
                let record = try PosterLibraryEngine.readRecord(entry.recordURL)
                let hash = try LibraryRaster.hash(Data(contentsOf: record.imageURL))
                let reviewed = record.tags.filter { $0.origin == "review" || ["confirmed", "rejected"].contains($0.state) }
                let reviewIdentity = try LibraryRaster.hash(json.encode(reviewed))
                let settingsHash = LibraryRaster.hash(try json.encode(settings) + Data((Self.recipeRevision + reviewIdentity).utf8))
                let destination = root.appending(path: "posters/\(record.id)/analysis.json")
                var analysis: PosterRegionAnalysis
                if !force, let data = try? Data(contentsOf: destination), let saved = try? JSONDecoder().decode(PosterRegionAnalysis.self, from: data),
                   saved.version == "sam-siglip-vision-v1", saved.imageHash == hash, saved.samFingerprint == sam.fingerprint,
                   saved.siglipFingerprint == semantic.manifest.fingerprint, saved.settingsHash == settingsHash,
                   saved.regions.allSatisfy({ region in
                       guard FileManager.default.fileExists(atPath: region.maskURL.path), FileManager.default.fileExists(atPath: region.inkMaskURL.path),
                             let data = try? Data(contentsOf: region.imageURL) else { return false }
                       return LibraryRaster.hash(data) == region.imageHash
                   }) {
                    analysis = saved; cached += 1
                } else {
                    let image = try LibraryRaster.oriented(record.imageURL, maxSize: 2048)
                    var prompts: [[SAMPoint]] = []
                    let boxes = record.elements.filter { $0.reviewStatus != "rejected" && $0.kind == "text-line" && $0.bounds.area > 0.003 && $0.bounds.area < 0.65 }.sorted { $0.bounds.area > $1.bounds.area }
                    for element in boxes.prefix(3) { prompts.append(SAMPoint.box(element.bounds)) }
                    let areas = record.elements.filter { $0.reviewStatus != "rejected" && $0.kind == "region-proposal" && $0.bounds.area < 0.75 }.sorted { $0.bounds.area > $1.bounds.area }
                    for element in areas.prefix(2) { prompts.append(SAMPoint.box(element.bounds)) }
                    for y in 0..<settings.gridSize { for x in 0..<settings.gridSize {
                        prompts.append([SAMPoint(x: (Double(x) + 0.5) / Double(settings.gridSize), y: (Double(y) + 0.5) / Double(settings.gridSize))])
                    }}
                    // The grid often lands on bare paper; ink seeds add prompts on actual marks when paper is identifiable.
                    for point in InkSeeds.points(image, limit: settings.inkPoints, skipping: boxes.prefix(3).map(\.bounds)) ?? [] { prompts.append([point]) }
                    var selected: [(SAMSelection, SegmentationMask)] = [], rejected = 0
                    for points in prompts {
                        try Task.checkCancellation()
                        let result = try await sampler.segment(imageURL: record.imageURL, points: points)
                        let candidates = result.masks.filter { $0.areaFraction > 0.001 && $0.areaFraction < 0.80 &&
                            $0.predictedIoU >= settings.minimumPredictedIoU && $0.stability >= settings.minimumStability }
                        // SAM's three outputs are roughly whole, part and subpart (block, word, letter);
                        // every one that passes the gates competes, and near-duplicates are dropped.
                        for mask in candidates.sorted(by: { $0.predictedIoU > $1.predictedIoU }) {
                            if selected.contains(where: { $0.1.intersectionOverUnion(mask) > 0.88 }) { rejected += 1 }
                            else { selected.append((result, mask)) }
                        }
                        rejected += result.masks.count - candidates.count
                    }
                    let ranked = selected.sorted { $0.1.predictedIoU * $0.1.stability > $1.1.predictedIoU * $1.1.stability }
                    var measured: [RegionAnalysis] = []
                    for (selection, mask) in ranked.prefix(settings.maximumRegions) {
                        try Task.checkCancellation()
                        if let bounds = mask.bounds { measured.append(try describe(record: record, source: image, selection: selection, mask: mask, bounds: bounds)) }
                    }
                    let whole: [Float]
                    if let feature = cachedFeatures[record.id], feature.imageHash == hash, feature.fingerprint == semantic.manifest.fingerprint { whole = feature.vector }
                    else { whole = try semantic.image(image) }
                    let rejectedNames = Set(record.tags.filter { $0.state == "rejected" }.map(\.name))
                    let suggestions = descriptions.tags(vector: whole, geometry: nil, rejected: rejectedNames) + measured.flatMap(\.tags)
                    let grouped = Dictionary(grouping: suggestions, by: \.tag)
                    let combined = grouped.keys.sorted().compactMap { tag in grouped[tag]?.max(by: { $0.contrastMargin < $1.contrastMargin }) }
                    analysis = PosterRegionAnalysis(version: "sam-siglip-vision-v1", recipeRevision: Self.recipeRevision, posterID: record.id, imageHash: hash,
                        samFingerprint: sam.fingerprint, siglipFingerprint: semantic.manifest.fingerprint, settingsHash: settingsHash,
                        attemptedPrompts: prompts.count, rejectedMasks: rejected, regions: measured, tags: combined,
                        systems: RegionRelationships.candidates(measured, posterID: record.id),
                        note: "SAM masks and estimated IoU are proposals. Geometry measures predicted pixels. SigLIP descriptions are uncalibrated affinities. Only explicit local review creates confirmed labels; Vision, SigLIP and geometry retain separate feature spaces.")
                    try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
                    try LibraryRaster.write(analysis, to: destination)
                }
                let (joint, jointTags) = CrossRegionRelationships.candidates(analysis.regions, posterID: record.id)
                analysis.systems = RegionRelationships.candidates(analysis.regions, posterID: record.id) + joint
                analysis.relationshipRevision = CrossRegionRelationships.revision
                let existingNames = Set(analysis.tags.map(\.tag)), rejectedNames = Set(record.tags.filter { $0.state == "rejected" }.map(\.name))
                analysis.tags += jointTags.filter { !existingNames.contains($0.tag) && !rejectedNames.contains($0.tag) }
                try LibraryRaster.write(analysis, to: destination)
                try await engine.attachRegionAnalysis(analysis, at: destination)
                completed += 1; regions += analysis.regions.count; tags += analysis.tags.count
                type += analysis.systems.filter { $0.scope == "type" }.count; shape += analysis.systems.filter { $0.scope == "shape" }.count
            } catch is CancellationError { try LibraryRaster.write(summary(), to: root.appending(path: "run.json")); throw CancellationError() }
            catch { failures[entry.id] = error.localizedDescription }
            try LibraryRaster.write(summary(), to: root.appending(path: "run.json"))
            progress("Regions \(position + 1)/\(entries.count): \(regions) isolated · \(tags) tag proposals · \(type) type / \(shape) shape candidates · \(failures.count) failures")
        }
        return summary()
    }

    /// Reuses recorded masks/features; no segmentation or embedding inference is required.
    public func refreshRelationships(progress: @Sendable (String) -> Void = { _ in }) async throws -> Int {
        let engine = PosterLibraryEngine(directory: directory), catalog = try await engine.load()
        var count = 0
        for entry in catalog.posters {
            try Task.checkCancellation()
            let url = directory.appending(path: "segmentation/posters/\(entry.id)/analysis.json")
            guard let data = try? Data(contentsOf: url), var analysis = try? JSONDecoder().decode(PosterRegionAnalysis.self, from: data),
                  let image = try? Data(contentsOf: entry.imageURL), LibraryRaster.hash(image) == analysis.imageHash else { continue }
            let record = try PosterLibraryEngine.readRecord(entry.recordURL)
            let (joint, proposals) = CrossRegionRelationships.candidates(analysis.regions, posterID: record.id)
            analysis.systems = RegionRelationships.candidates(analysis.regions, posterID: record.id) + joint
            analysis.relationshipRevision = CrossRegionRelationships.revision
            let rejected = Set(record.tags.filter { $0.state == "rejected" }.map(\.name)), existing = Set(analysis.tags.map(\.tag))
            analysis.tags += proposals.filter { !rejected.contains($0.tag) && !existing.contains($0.tag) }
            try LibraryRaster.write(analysis, to: url)
            try await engine.attachRegionAnalysis(analysis, at: url)
            count += 1
            if count % 50 == 0 { progress("Refreshed cross-region relationships for \(count) posters.") }
        }
        return count
    }

    public func search(query: String?, regionID: String?, limit: Int = 20) async throws -> [RegionSearchHit] {
        let runtime = try semantic()
        let catalogURL = directory.appending(path: "library.json"), saved = savedCatalog.lookup(catalogURL)
        let catalog: PosterLibrary
        if let value = saved.value { catalog = value }
        else { catalog = try await PosterLibraryEngine(directory: directory).load(); savedCatalog.store(catalog, for: catalogURL, signature: saved.signature) }
        var regions: [RegionAnalysis] = []
        // Source and isolated images are rehashed only when their file identity changes.
        func current(_ url: URL, _ hash: String) -> Bool { (try? FileDigests.shared.digest(url))?.hash == hash }
        for entry in catalog.posters {
            let url = directory.appending(path: "segmentation/posters/\(entry.id)/analysis.json")
            guard let analysis = try? savedAnalyses.value(url, decode: { try JSONDecoder().decode(PosterRegionAnalysis.self, from: $0) }),
                  analysis.version == "sam-siglip-vision-v1",
                  analysis.siglipFingerprint == runtime.manifest.fingerprint,
                  current(entry.imageURL, analysis.imageHash) else { continue }
            regions += analysis.regions.filter { current($0.imageURL, $0.imageHash) }
        }
        let acceptedURL = directory.appending(path: "segmentation/accepted-regions.json")
        if let accepted = try? savedAccepted.value(acceptedURL, decode: { try JSONDecoder().decode([RegionAnalysis].self, from: $0) }) {
            for region in accepted where region.siglipFingerprint == runtime.manifest.fingerprint && !regions.contains(where: { $0.id == region.id }) {
                guard let entry = catalog.posters.first(where: { $0.id == region.posterID }),
                      current(entry.imageURL, region.sourceImageHash), current(region.imageURL, region.imageHash) else { continue }
                regions.append(region)
            }
        }
        if let regionID, !regions.contains(where: { $0.id == regionID }),
           let entry = catalog.posters.first(where: { regionID.hasPrefix($0.id + "-sam-") }) {
            let url = directory.appending(path: "segmentation/posters/\(entry.id)/regions/\(regionID)/region.json")
            if let data = try? Data(contentsOf: url), let region = try? JSONDecoder().decode(RegionAnalysis.self, from: data),
               region.id == regionID, region.siglipFingerprint == runtime.manifest.fingerprint,
               current(entry.imageURL, region.sourceImageHash), current(region.imageURL, region.imageHash) { regions.append(region) }
        }
        let anchor = regions.first { $0.id == regionID }
        if regionID != nil && anchor == nil { throw PosterError.invalid("The selected region has no current indexed features.") }
        let text = query?.trimmingCharacters(in: .whitespacesAndNewlines)
        let vector = try text.flatMap { $0.isEmpty ? nil : try runtime.text($0) }
        return try MultimodalFusion.search(regions: regions, textVector: vector, anchor: anchor, limit: limit)
    }
}
