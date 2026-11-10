import Foundation

public struct SemanticSearchHit: Codable, Sendable {
    public let posterID: String
    public let elementID: String?
    public let imageURL: URL
    public let text: String
    /// Cosine affinity, not a quality rating or calibrated probability.
    public let similarity: Double
}

public struct SemanticSearchResults: Codable, Sendable {
    public let query: String
    public let model: String
    public let revision: String
    public let fingerprint: String
    public let indexed: Int
    public let eligible: Int
    public let missingOrStale: Int
    public let hits: [SemanticSearchHit]
}

public struct SemanticIndexSummary: Codable, Sendable {
    public let indexed: Int
    public let eligible: Int
    public let computed: Int
    public let cached: Int
    public let includesElements: Bool
}

public struct CachedSemanticImage: Sendable {
    public let imageHash: String
    public let vector: [Float]
    public let fingerprint: String
}

public struct SigLIPVerification: Codable, Sendable {
    public let tokenizerFixtures: Int
    public let textFixtures: Int
    public let imageFixtures: Int
    public let minimumTextCosine: Double
    public let minimumImageCosine: Double
}

/// Separate storage and models: Vision feature prints and all existing ballots remain independent.
public actor SemanticLibrarySearch {
    private struct Entry: Codable {
        let id: String; let posterID: String; let elementID: String?; let imageHash: String; let vector: [Float]
        /// File identity when imageHash was verified; unchanged images are then not reread. Absent in older indexes.
        var imageSignature: String? = nil
        var digest: FileDigest { FileDigest(hash: imageHash, signature: imageSignature) }
    }
    private struct Index: Codable {
        var version = 1
        let fingerprint: String
        let preprocessing: String
        var entries: [Entry]
    }
    /// Columnar binary copy of index.json, which stays canonical. It is used only while index.json keeps the
    /// identity recorded here, so older builds and any rewrite of index.json simply bypass it.
    private struct BinaryIndex: Codable {
        let indexSignature: String
        let version: Int; let fingerprint: String; let preprocessing: String
        let ids: [String]; let posterIDs: [String]; let elementIDs: [String?]; let imageHashes: [String]; let imageSignatures: [String?]
        let dimensions: Int
        /// Native little-endian Float32, entry after entry.
        let vectors: Data
    }
    private struct Item {
        let id: String; let posterID: String; let elementID: String?; let imageURL: URL; let text: String; let tags: [String]
    }
    private let directory: URL
    private let modelDirectory: URL?
    private let cpuOnly: Bool
    private var runtime: SigLIPEncoder?
    private var queryCache: [String:[Float]] = [:]
    private var savedIndex = DecodedFiles<Index>()
    private var savedCatalog = DecodedFiles<PosterLibrary>()

    public init(directory: URL, models: URL? = nil, cpuOnly: Bool = false) {
        self.directory = directory.standardizedFileURL; modelDirectory = models; self.cpuOnly = cpuOnly
    }

    private func encoder() throws -> SigLIPEncoder {
        if let runtime { return runtime }
        let loaded = try SigLIPEncoder(directory:modelDirectory,cpuOnly:cpuOnly,cacheDirectory:directory.appending(path:"semantic-siglip/compiled"))
        runtime = loaded; return loaded
    }

    private var indexURL: URL { directory.appending(path:"semantic-siglip/index.json") }
    private var binaryURL: URL { directory.appending(path:"semantic-siglip/index.bin") }

    /// Decoding 870,000 JSON numbers dominated the first search after launch; the binary copy skips that.
    private static func binaryIndex(_ url: URL, for indexURL: URL) -> Index? {
        guard let data = try? Data(contentsOf: url), let saved = try? PropertyListDecoder().decode(BinaryIndex.self, from: data),
              let signature = FileDigests.signature(indexURL), saved.indexSignature == signature, saved.dimensions > 0,
              [saved.posterIDs.count, saved.elementIDs.count, saved.imageHashes.count, saved.imageSignatures.count].allSatisfy({ $0 == saved.ids.count }),
              saved.vectors.count == saved.ids.count * saved.dimensions * 4 else { return nil }
        var floats = [Float](repeating: 0, count: saved.ids.count * saved.dimensions)
        _ = floats.withUnsafeMutableBytes { saved.vectors.copyBytes(to: $0) }
        let d = saved.dimensions
        return Index(version: saved.version, fingerprint: saved.fingerprint, preprocessing: saved.preprocessing, entries: saved.ids.indices.map { i in
            Entry(id: saved.ids[i], posterID: saved.posterIDs[i], elementID: saved.elementIDs[i], imageHash: saved.imageHashes[i],
                  vector: Array(floats[(i * d)..<((i + 1) * d)]), imageSignature: saved.imageSignatures[i])
        })
    }

    /// Best effort: without the binary copy, loading falls back to index.json.
    private func writeBinary(_ index: Index) {
        guard let signature = FileDigests.signature(indexURL) else { return }
        let dimensions = index.entries.first?.vector.count ?? 0
        guard dimensions > 0, index.entries.allSatisfy({ $0.vector.count == dimensions }) else { try? FileManager.default.removeItem(at: binaryURL); return }
        var vectors = Data(capacity: index.entries.count * dimensions * 4)
        for entry in index.entries { entry.vector.withUnsafeBufferPointer { vectors.append($0) } }
        let binary = BinaryIndex(indexSignature: signature, version: index.version, fingerprint: index.fingerprint, preprocessing: index.preprocessing,
            ids: index.entries.map(\.id), posterIDs: index.entries.map(\.posterID), elementIDs: index.entries.map(\.elementID),
            imageHashes: index.entries.map(\.imageHash), imageSignatures: index.entries.map(\.imageSignature), dimensions: dimensions, vectors: vectors)
        let encoder = PropertyListEncoder(); encoder.outputFormat = .binary
        if (try? encoder.encode(binary).write(to: binaryURL, options: .atomic)) == nil { try? FileManager.default.removeItem(at: binaryURL) }
    }

    /// Decoded and validated once per index file version, not once per query.
    private func loadIndex(_ encoder: SigLIPEncoder) throws -> Index? {
        let binaryURL = binaryURL, indexURL = indexURL
        return try savedIndex.value(indexURL) { data in
            let index = try Self.binaryIndex(binaryURL, for: indexURL) ?? JSONDecoder().decode(Index.self,from:data)
            guard index.version == 1, index.fingerprint == encoder.manifest.fingerprint,
                  index.preprocessing == encoder.manifest.preprocessing else {
                throw PosterError.invalid("Semantic index belongs to another model or preprocessing version. Rebuild it with semantic-index --force.")
            }
            guard Set(index.entries.map(\.id)).count == index.entries.count else { throw PosterError.invalid("Duplicate semantic index entries. Rebuild with --force.") }
            for entry in index.entries {
                guard entry.vector.count == encoder.manifest.dimensions, entry.vector.allSatisfy(\.isFinite),
                      abs(entry.vector.reduce(0.0){$0+Double($1)*Double($1)}-1) < 0.001 else {
                    throw PosterError.invalid("Malformed semantic features. Rebuild with --force.")
                }
            }
            return index
        }
    }

    private func items(_ records: [PosterRecord], includeElements: Bool) -> [Item] {
        records.sorted{$0.id<$1.id}.flatMap { record -> [Item] in
            var items = [Item(id:record.id,posterID:record.id,elementID:nil,imageURL:record.imageURL,
                text:record.textIndex,tags:LibraryRaster.tagNames(record.tags))]
            if includeElements {
                items += record.elements.filter{$0.reviewStatus != "rejected"}.sorted{$0.id<$1.id}.map {
                    Item(id:$0.id,posterID:record.id,elementID:$0.id,imageURL:$0.imageURL,
                         text:$0.text ?? $0.kind,tags:LibraryRaster.tagNames($0.tags))
                }
            }
            return items
        }
    }

    /// Callers must match the current image hash before reuse. The feature space is validated here.
    public func cachedPosterFeatures() throws -> [String: CachedSemanticImage] {
        let encoder = try encoder()
        guard let index = try loadIndex(encoder) else { return [:] }
        return Dictionary(uniqueKeysWithValues: index.entries.filter { $0.elementID == nil }.map {
            ($0.posterID, CachedSemanticImage(imageHash: $0.imageHash, vector: $0.vector, fingerprint: index.fingerprint))
        })
    }

    /// Atomic checkpoints make interrupted indexing resumable. Changed crop bytes invalidate features.
    public func index(includeElements: Bool = false, limit: Int? = nil, force: Bool = false,
                      progress: @Sendable(String) -> Void = {_ in}) async throws -> SemanticIndexSummary {
        guard limit == nil || limit! > 0 else { throw PosterError.invalid("Semantic index limit must be positive.") }
        let encoder = try encoder()
        let engine = PosterLibraryEngine(directory:directory)
        let records = try await engine.records()
        let all = items(records,includeElements:includeElements)
        let folder = indexURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        let lock = try SemanticIndexLock(url:folder.appending(path:".writer.lock"))
        defer { lock.release() }
        var index = try (force ? nil : loadIndex(encoder)) ?? Index(fingerprint:encoder.manifest.fingerprint,
            preprocessing:encoder.manifest.preprocessing,entries:[])
        // Keep cached element features when running a posters-only refresh; discard deleted/rejected items.
        let activeIDs = Set(items(records,includeElements:true).map(\.id))
        index.entries.removeAll{!activeIDs.contains($0.id)}
        var entries = Dictionary(uniqueKeysWithValues:index.entries.map{($0.id,$0)})
        var computed = 0, cached = 0
        for (position,item) in all.prefix(limit ?? all.count).enumerated() {
            if Task.isCancelled {
                index.entries = entries.values.sorted{$0.id<$1.id}; try LibraryRaster.write(index,to:indexURL)
                throw CancellationError()
            }
            try autoreleasepool {
                let previous = entries[item.id]
                let digest = try FileDigests.shared.digest(item.imageURL,known:previous?.digest)
                if var previous, previous.imageHash == digest.hash {
                    cached += 1
                    // Backfills identities into older indexes, so their searches stop rereading every image.
                    if previous.imageSignature != digest.signature { previous.imageSignature = digest.signature; entries[item.id] = previous }
                } else {
                    let image = try LibraryRaster.oriented(item.imageURL)
                    let vector = try encoder.image(image)
                    entries[item.id] = Entry(id:item.id,posterID:item.posterID,elementID:item.elementID,imageHash:digest.hash,vector:vector,
                                             imageSignature:digest.signature)
                    computed += 1
                }
            }
            if (position+1) % 20 == 0 {
                index.entries = entries.values.sorted{$0.id<$1.id}; try LibraryRaster.write(index,to:indexURL)
            }
            if position % 20 == 0 || position+1 == all.count { progress("\(position+1)/\(all.count) semantic images · \(computed) embedded · \(cached) cached") }
        }
        index.entries = entries.values.sorted{$0.id<$1.id}; try LibraryRaster.write(index,to:indexURL)
        savedIndex.store(index,for:indexURL)
        writeBinary(index)
        let ids = Set(all.map(\.id))
        return SemanticIndexSummary(indexed:index.entries.filter{ids.contains($0.id)}.count,eligible:all.count,
            computed:computed,cached:cached,includesElements:includeElements)
    }

    public func search(query: String, includeElements: Bool = false, tag: String? = nil, posterIDs: Set<String>? = nil,
                       limit: Int = 20) async throws -> SemanticSearchResults {
        let query = query.trimmingCharacters(in:.whitespacesAndNewlines)
        guard !query.isEmpty, (1...200).contains(limit) else { throw PosterError.invalid("Enter a search description and a result limit from 1 to 200.") }
        let encoder = try encoder()
        guard let index = try loadIndex(encoder) else { throw PosterError.invalid("This library has no semantic index. Build it with semantic-index or Build search index.") }
        let engine = PosterLibraryEngine(directory:directory)
        // Whole-poster retrieval needs only the small active catalog. Decoding every word/crop's
        // Vision embedding would otherwise dominate each query on a large collection.
        let candidates: [Item]
        if includeElements { candidates = items(try await engine.records(),includeElements:true) }
        else {
            // The catalog is decoded again only when library.json changes.
            let catalogURL = directory.appending(path:"library.json"), saved = savedCatalog.lookup(catalogURL)
            let catalog: PosterLibrary
            if let value = saved.value { catalog = value }
            else { catalog = try await engine.load(); savedCatalog.store(catalog,for:catalogURL,signature:saved.signature) }
            candidates = catalog.posters.map {
                Item(id:$0.id,posterID:$0.id,elementID:nil,imageURL:$0.imageURL,text:$0.title,tags:$0.tags)
            }
        }
        let active = candidates.filter {
            (tag == nil || $0.tags.contains(tag!)) && (posterIDs == nil || posterIDs!.contains($0.posterID))
        }
        let entries = Dictionary(uniqueKeysWithValues:index.entries.map{($0.id,$0)})
        let textVector: [Float]
        if let cached = queryCache[query] { textVector = cached }
        else {
            textVector = try encoder.text(query)
            if queryCache.count >= 64 { queryCache.removeAll(keepingCapacity:true) }
            queryCache[query] = textVector
        }
        var hits: [SemanticSearchHit] = [], missing = 0
        for item in active {
            try Task.checkCancellation()
            // Unchanged files are only stat'ed; any changed or replaced image is rehashed before it can rank.
            guard let entry = entries[item.id], entry.posterID == item.posterID, entry.elementID == item.elementID,
                  (try? FileDigests.shared.digest(item.imageURL,known:entry.digest))?.hash == entry.imageHash else { missing += 1; continue }
            let dot = zip(textVector,entry.vector).reduce(0.0){$0+Double($1.0)*Double($1.1)}
            hits.append(SemanticSearchHit(posterID:item.posterID,elementID:item.elementID,imageURL:item.imageURL,
                text:String(item.text.prefix(350)),similarity:min(1,max(-1,dot))))
        }
        guard active.isEmpty || !hits.isEmpty else { throw PosterError.invalid("No current semantic features match this scope. Build or refresh the search index.") }
        hits.sort { $0.similarity == $1.similarity ? ($0.elementID ?? $0.posterID)<($1.elementID ?? $1.posterID) : $0.similarity>$1.similarity }
        return SemanticSearchResults(query:query,model:encoder.manifest.model,revision:encoder.manifest.revision,
            fingerprint:encoder.manifest.fingerprint,indexed:hits.count,eligible:active.count,missingOrStale:missing,hits:Array(hits.prefix(limit)))
    }

    public func verifyModelPack() throws -> SigLIPVerification {
        struct Fixture: Decodable { let text: String; let tokens: [Int32]; let embedding: [Float]? }
        let encoder = try encoder()
        let fixtures = try JSONDecoder().decode([Fixture].self,from:Data(contentsOf:encoder.directory.appending(path:"tokenizer-fixtures.json")))
        var textCosines: [Double] = [], imageCosines: [Double] = []
        for fixture in fixtures {
            guard try encoder.tokenizer.tokens(for:fixture.text) == fixture.tokens else { throw PosterError.invalid("Tokenizer differs from original for: \(fixture.text)") }
            if let expected = fixture.embedding {
                let vector = try encoder.text(fixture.text)
                textCosines.append(zip(vector,expected).reduce(0){$0+Double($1.0)*Double($1.1)})
            }
        }
        for i in 0..<8 {
            let imageURL = encoder.directory.appending(path:"fixture-image-\(i).png")
            if !FileManager.default.fileExists(atPath:imageURL.path) { continue }
            let expected = try JSONDecoder().decode([Float].self,from:Data(contentsOf:encoder.directory.appending(path:"fixture-image-\(i).json")))
            let vector = try encoder.image(LibraryRaster.oriented(imageURL))
            imageCosines.append(zip(vector,expected).reduce(0){$0+Double($1.0)*Double($1.1)})
        }
        guard let textMin = textCosines.min(), let imageMin = imageCosines.min(), textMin > 0.999, imageMin > 0.999 else {
            throw PosterError.invalid("Native SigLIP inference failed original-model parity checks.")
        }
        return SigLIPVerification(tokenizerFixtures:fixtures.count,textFixtures:textCosines.count,imageFixtures:imageCosines.count,
            minimumTextCosine:textMin,minimumImageCosine:imageMin)
    }
}
