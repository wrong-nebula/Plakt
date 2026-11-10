import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkSegmentation() async throws {
        struct Fixture: Decodable { let id: String; let imageURL: URL; let points: [SAMPoint]; let masks: [Data]; let scores: [Double] }
        struct References: Decodable { let fingerprint: String; let fixtures: [Fixture] }
        let references = try JSONDecoder().decode(References.self, from: Data(contentsOf: URL(fileURLWithPath: "output/sam2-integration-v1/reference.json")))
        let root = URL(fileURLWithPath: NSTemporaryDirectory()).appending(path: "poster-sam-checks-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let segmenter = SAM2Segmenter(cache: root.appending(path: "compiled"))
        let manifest = try await segmenter.manifest()
        try require(manifest.fingerprint == references.fingerprint, "SAM reference fixtures belong to another model pack")
        var minimumIoU = 1.0, minimumDetailIoU = 1.0
        for fixture in references.fixtures {
            let result = try await segmenter.segment(imageURL: fixture.imageURL, points: fixture.points)
            try require(result.computeUnits == "CPU_ONLY", "Unverified compute configuration")
            for (index, mask) in result.masks.enumerated() {
                let expected = SegmentationMask(id: index, width: 256, height: 256, bytes: fixture.masks[index], predictedIoU: fixture.scores[index], stability: 1)
                let iou = mask.intersectionOverUnion(expected)
                minimumIoU = min(minimumIoU, iou)
                try require(iou > 0.995 && abs(mask.predictedIoU - fixture.scores[index]) < 0.002, "Native/Python SAM parity failed: \(fixture.id), option \(index)")
            }
            let repeated = try await segmenter.segment(imageURL: fixture.imageURL, points: fixture.points)
            try require(repeated.reusedImageEncoding && repeated.masks.map(\.bytes) == result.masks.map(\.bytes), "Repeated prompts changed masks or re-encoded the image")
            // At the model's own size, upsampling reproduces SAM's thresholded grid exactly.
            for mask in result.masks {
                let same = try mask.upsampled(width: 256, height: 256)
                try require(same.bytes == mask.bytes, "Same-size upsampling changed a SAM mask: \(fixture.id)")
            }
            // At a portrait aspect, read back at the grid's cell centers. Bilinear scores legitimately thin
            // one-cell strokes (0.86 on the type fixture, matching Pillow), so this only guards orientation.
            for mask in result.masks where mask.areaFraction > 0 {
                let detailed = try mask.upsampled(width: 683, height: 1024)
                var intersection = 0, union = 0
                for y in 0..<256 { for x in 0..<256 {
                    let px = Int((Double(x) + 0.5) / 256 * 683), py = Int((Double(y) + 0.5) / 256 * 1024)
                    let a = mask.bytes[y * 256 + x] != 0, b = detailed.bytes[py * 683 + px] != 0
                    if a || b { union += 1 }; if a && b { intersection += 1 }
                }}
                minimumDetailIoU = min(minimumDetailIoU, Double(intersection) / Double(max(1, union)))
            }
        }
        try require(minimumDetailIoU > 0.8, "Upsampled SAM masks lost their orientation or position: IoU \(minimumDetailIoU)")
        // Linear score ramps have closed-form zero crossings under half-pixel bilinear sampling:
        // an x ramp keeps exactly x ≥ 342 of 683 columns, a y ramp exactly y ≥ 512 of 1024 rows.
        func ramp(_ value: (Int, Int) -> Double) -> SegmentationMask {
            var logits = [UInt16](repeating: 0, count: 65536), bytes = Data(count: 65536)
            for y in 0..<256 { for x in 0..<256 {
                let score = value(x, y); logits[y * 256 + x] = Float16(score).bitPattern.littleEndian
                if score > 0 { bytes[y * 256 + x] = 255 }
            }}
            return SegmentationMask(id: 0, width: 256, height: 256, bytes: bytes, predictedIoU: 1, stability: 1,
                                    logits: logits.withUnsafeBufferPointer { Data(buffer: $0) })
        }
        let columns = try ramp { x, _ in Double(x) - 127.5 }.upsampled(width: 683, height: 1024)
        let rows = try ramp { _, y in Double(y) - 127.5 }.upsampled(width: 683, height: 1024)
        try require((0..<1024).allSatisfy { y in (0..<683).allSatisfy { x in (columns.bytes[y * 683 + x] != 0) == (x >= 342) && (rows.bytes[y * 683 + x] != 0) == (y >= 512) } },
                    "Bilinear upsampling misplaced a known zero crossing")
        try require(SegmentationMask.detailSize(width: 1400, height: 2100) == (683, 1024) && SegmentationMask.detailSize(width: 3000, height: 1000) == (1024, 341),
                    "Detailed mask size ignores the physical aspect")
        try require(rejected { _ = try SegmentationMask(id: 0, width: 4, height: 4, bytes: Data(count: 16), predictedIoU: 1, stability: 1).upsampled(width: 8, height: 8) },
                    "A mask without model scores was upsampled")
        for points in [[SAMPoint(x: -.infinity, y: 0)], [SAMPoint(x: 1.1, y: 0)], [SAMPoint(x: 0.5, y: 0.5, foreground: false)], []] {
            do { _ = try await segmenter.segment(imageURL: references.fixtures[0].imageURL, points: points); throw CheckFailure("Invalid SAM prompt accepted") }
            catch is PosterError { }
        }
        print("PASS: native/Python SAM 2.1 parity on type, box, foreground/background prompts; minimum mask IoU \(minimumIoU); exact prompt replay and image-encoding reuse")
        print("PASS: score upsampling is exact at the model size, places closed-form ramp crossings, keeps orientation at physical aspect (grid IoU ≥ \(minimumDetailIoU)); score-less masks are not upsampled")

        var bytes = Data(count: 64 * 64)
        for y in 0..<64 { for x in 0..<64 {
            let radius = hypot(Double(x) - 31.5, Double(y) - 31.5)
            if radius < 25 && radius > 15 { bytes[y * 64 + x] = 255 }
        }}
        let ring = SegmentationMask(id: 0, width: 64, height: 64, bytes: bytes, predictedIoU: 1, stability: 1)
        let geometry = try RegionGeometry.measure(ring, imageAspect: 1, textBoxes: [])
        try require(geometry.holes == 1 && geometry.components.count == 1 && geometry.quarterTurnSymmetry > 0.98, "Ring topology or physical symmetry is wrong")
        var dots = Data(count: 64 * 64)
        for i in 0..<8 {
            let angle = Double(i) * Double.pi / 4, cx = 31.5 + cos(angle) * 20, cy = 31.5 + sin(angle) * 20
            for y in 0..<64 { for x in 0..<64 where hypot(Double(x) - cx, Double(y) - cy) < 3 { dots[y * 64 + x] = 255 } }
        }
        let circular = try RegionGeometry.measure(SegmentationMask(id: 0, width: 64, height: 64, bytes: dots, predictedIoU: 1, stability: 1), imageAspect: 1, textBoxes: [.full])
        try require(circular.circularLayout?.relativeResidual ?? 1 < 0.03 && circular.circularLayout?.angularSpan ?? 0 > 300, "Circular layout fitting failed on known component centers")
        try require(!SegmentationMask(id: 0, width: 64, height: 64, bytes: Data(), predictedIoU: 1, stability: 1).valid, "Malformed bitmap accepted")
        print("PASS: mask topology, physical aspect, quarter-turn symmetry and malformed-bitmap rejection")

        // Ink seeds: a ring and a square on paper give two points on ink; the ring's lands on the ring, not its hole.
        func drawn(_ paint: (CGContext) -> Void) throws -> CGImage {
            guard let context = CGContext(data: nil, width: 300, height: 400, bitsPerComponent: 8, bytesPerRow: 0,
                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw CheckFailure("No context") }
            context.setFillColor(CGColor(red: 0.96, green: 0.94, blue: 0.9, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: 300, height: 400))
            paint(context)
            guard let image = context.makeImage() else { throw CheckFailure("No image") }
            return image
        }
        let printed = try drawn { context in
            context.setStrokeColor(CGColor(gray: 0.1, alpha: 1)); context.setLineWidth(14)
            context.strokeEllipse(in: CGRect(x: 60, y: 200, width: 180, height: 180))   // bottom-left origin: upper half of the poster
            context.setFillColor(CGColor(red: 0.8, green: 0.1, blue: 0.1, alpha: 1)); context.fill(CGRect(x: 120, y: 40, width: 60, height: 60))
        }
        let seeds = InkSeeds.points(printed, limit: 6) ?? []
        let ringSeed = seeds.first { $0.y < 0.5 }, squareSeed = seeds.first { $0.y > 0.5 }
        let ringRadius = ringSeed.map { hypot(($0.x - 0.5) * 300, ($0.y - 0.275) * 400) } ?? 0
        try require(seeds.count == 2 && ringRadius > 75 && ringRadius < 100 && squareSeed.map { abs($0.x - 0.5) < 0.1 && abs($0.y - 0.825) < 0.08 } == true,
                    "Ink seeds missed the printed marks or prompted a ring's empty center: \(seeds)")
        let photographic = try drawn { context in
            var generator = SystemRandomNumberGenerator()
            for y in stride(from: 0, to: 400, by: 10) { for x in stride(from: 0, to: 300, by: 10) {
                context.setFillColor(CGColor(red: .random(in: 0...1, using: &generator), green: .random(in: 0...1, using: &generator), blue: .random(in: 0...1, using: &generator), alpha: 1))
                context.fill(CGRect(x: x, y: y, width: 10, height: 10))
            }}
        }
        try require(InkSeeds.points(photographic, limit: 6) == nil && InkSeeds.points(printed, limit: 0) == [],
                    "Ink seeds guessed a paper color on a varied border, or ignored a zero limit")
        print("PASS: ink seeds land on printed marks (ring prompted on its stroke), skip varied borders and respect a zero limit")

        // Isolated catalog: no production records, review votes or original photographs are edited.
        let production = PosterLibraryEngine(directory: URL(fileURLWithPath: "library"))
        var catalog = try await production.load()
        guard var entry = catalog.posters.first(where: { $0.id == "02f8efca35d0a69f7065e7e8-p0" }) else { throw CheckFailure("Missing collection fixture") }
        var record = try PosterLibraryEngine.readRecord(entry.recordURL)
        let folder = root.appending(path: "library/posters/\(record.id)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let source = root.appending(path: "source.png")
        try FileManager.default.copyItem(at: references.fixtures[0].imageURL, to: source)
        record.imageURL = source; record.width = 1024; record.height = 1024
        record.tags = [TechniqueTag("grid", state: "confirmed", confidence: 1, evidence: ["fixture"], origin: "review"),
                       TechniqueTag("reflection", state: "rejected", confidence: 1, evidence: ["fixture"], origin: "review")]
        entry.recordURL = folder.appending(path: "record.json"); entry.imageURL = source
        catalog.posters = [entry]; catalog.directory = root.appending(path: "library")
        try LibraryRaster.write(record, to: entry.recordURL)
        try LibraryRaster.write(catalog, to: catalog.directory.appending(path: "library.json"))
        let assistant = MultimodalLibraryAnalysis(directory: catalog.directory, cpuOnly: true)
        var settings = RegionAnalysisSettings(); settings.gridSize = 1; settings.maximumRegions = 2
        let first = try await assistant.run(settings: settings)
        try require(first.analyzedPosters == 1 && first.failures.isEmpty && first.regionCount > 0, "Integrated region analysis failed")
        let resumed = try await assistant.run(settings: settings)
        try require(resumed.cachedPosters == 1, "Unchanged multimodal analysis did not resume from cache")
        guard let analysis = try await assistant.currentAnalysis(record: record), let region = analysis.regions.first else { throw CheckFailure("Missing measured region") }
        try require(region.vision.model != region.siglip.model && region.siglip.dimensions == 768 && !region.relatedSystems.isEmpty, "Feature spaces or saved-system references are missing")
        let savedMask = try LibraryRaster.oriented(region.maskURL, maxSize: 4096), savedInk = try LibraryRaster.oriented(region.inkMaskURL, maxSize: 4096)
        try require(savedMask.width == 1024 && savedMask.height == 1024 && savedInk.width == 1024 && savedInk.height == 1024,
                    "Saved region masks were not upsampled to the 1024 detail grid")
        let anchor = try syntheticRegion(region, id: "anchor", appearance: 0, affinity: 1, alteredGeometry: false)
        let a = try syntheticRegion(region, id: "a", appearance: 0.05, affinity: 0.95, alteredGeometry: false)
        let b = try syntheticRegion(region, id: "b", appearance: 0.01, affinity: 0.10, alteredGeometry: true)
        let c = try syntheticRegion(region, id: "c", appearance: 0.90, affinity: 0.99, alteredGeometry: true)
        let fused = try MultimodalFusion.search(regions: [a, b, c], textVector: nil, anchor: anchor)
        let textOnly = try MultimodalFusion.search(regions: [a, b, c], textVector: anchor.siglip.values(), anchor: nil)
        try require(fused.first?.id == "a" && fused.first?.ranks.count == 3 && textOnly.first?.id == "c", "Rank fusion mixed raw scales or ignored a signal")
        var foreign = try JSONSerialization.jsonObject(with: JSONEncoder().encode(b)) as! [String: Any]
        var foreignEmbedding = foreign["siglip"] as! [String: Any]; foreignEmbedding["model"] = "Apple-Vision-image-feature-print"; foreign["siglip"] = foreignEmbedding
        let incompatible = try JSONDecoder().decode(RegionAnalysis.self, from: JSONSerialization.data(withJSONObject: foreign))
        try require(rejected { _ = try MultimodalFusion.search(regions: [incompatible], textVector: nil, anchor: anchor) }, "Equal-dimensional Vision and SigLIP spaces were silently mixed")
        print("PASS: integrated segmentation, lossless isolated features, cached analysis, saved-system matches and three-signal rank fusion")

        let encoded = JSONEncoder(); encoded.outputFormatting = [.sortedKeys]
        var document = try JSONSerialization.jsonObject(with: encoded.encode(analysis)) as! [String: Any]
        document["tags"] = ["grid", "reflection", "radial-symmetry"].map { name in
            ["tag": name, "affinity": 0.2, "contrastMargin": 0.1, "geometrySupport": ["isolated fixture"], "explanation": "Test proposal, not a real annotation."] as [String: Any]
        }
        let proposals = try JSONDecoder().decode(PosterRegionAnalysis.self, from: JSONSerialization.data(withJSONObject: document))
        let engine = PosterLibraryEngine(directory: catalog.directory)
        try await engine.attachRegionAnalysis(proposals, at: catalog.directory.appending(path: "fixture-analysis.json"))
        let updated = try PosterLibraryEngine.readRecord(entry.recordURL)
        try require(updated.tags.contains { $0.name == "grid" && $0.state == "confirmed" } && updated.tags.contains { $0.name == "reflection" && $0.state == "rejected" }, "Enrichment overwrote reviewed positive/negative labels")
        try require(updated.tags.contains { $0.name == "radial-symmetry" && $0.state == "suggested" && $0.confidence == 0 }, "Uncalibrated suggestion became a trusted label")
        let originalGenome = try encoded.encode(record.genome), updatedGenome = try encoded.encode(updated.genome)
        try require(updated.sourceQuad == record.sourceQuad && updated.reviewStatus == record.reviewStatus && updated.styleLabels == record.styleLabels && updatedGenome == originalGenome, "Enrichment changed protected source state")
        try await engine.acceptSegmentedRegion(region)
        let accepted = try PosterLibraryEngine.readRecord(entry.recordURL)
        try require(accepted.elements.contains { $0.id == region.id && $0.segmentation?.sourceImageHash == region.sourceImageHash }, "Accepted mask provenance was discarded")
        var joint = try JSONSerialization.jsonObject(with: JSONEncoder().encode(analysis)) as! [String: Any]
        joint["regions"] = try (0..<3).map { index -> [String: Any] in
            let value = try syntheticRegion(region, id: "joint-\(index)", appearance: Float(index) * 0.01, affinity: 1, alteredGeometry: false)
            var object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as! [String: Any]
            object["bounds"] = ["x": Double(index) * 0.3, "y": Double(index) * 0.2, "width": 0.2, "height": 0.1]
            object["text"] = "ECHO"
            var geometry = object["geometry"] as! [String: Any]; geometry["ocrCoverage"] = 1.0; object["geometry"] = geometry
            return object
        }
        let jointURL = catalog.directory.appending(path: "segmentation/posters/\(record.id)/analysis.json")
        try JSONSerialization.data(withJSONObject: joint).write(to: jointURL, options: .atomic)
        _ = try await assistant.refreshRelationships()
        let linked = try await assistant.currentAnalysis(record: record)
        try require(linked?.systems.contains { $0.relationship == "related-type-sequence" && $0.regionIDs.count == 3 } == true,
                    "Separate masks were not linked using three-way agreement")
        let oldBytes = try Data(contentsOf: entry.recordURL)
        try PosterRenderer.png(PosterRenderer.render(.random(seed: 2202), copy: PosterCopy(), width: 300), to: source)
        do { try await engine.acceptSegmentedRegion(region); throw CheckFailure("Stale mask accepted after crop change") } catch is PosterError { }
        let afterRejectedWrite = try Data(contentsOf: entry.recordURL)
        try require(afterRejectedWrite == oldBytes, "Stale-mask rejection partially wrote the record")
        let fullCatalog = try await production.load()
        if var emptyEntry = fullCatalog.posters.first(where: { $0.id == "081f8cbdcaabb4558ce1d94f-p1" }) {
            let emptyRecord = try PosterLibraryEngine.readRecord(emptyEntry.recordURL)
            let emptyFolder = catalog.directory.appending(path: "posters/\(emptyRecord.id)")
            try FileManager.default.createDirectory(at: emptyFolder, withIntermediateDirectories: true)
            emptyEntry.recordURL = emptyFolder.appending(path: "record.json")
            catalog.posters.append(emptyEntry)
            try LibraryRaster.write(emptyRecord, to: emptyEntry.recordURL)
            try LibraryRaster.write(catalog, to: catalog.directory.appending(path: "library.json"))
            var strict = RegionAnalysisSettings(); strict.gridSize = 2; strict.maximumRegions = 4
            strict.minimumPredictedIoU = 1; strict.minimumStability = 1
            let empty = try await assistant.run(settings: strict, posterID: emptyRecord.id)
            try require(empty.analyzedPosters == 1 && empty.failures.isEmpty && empty.regionCount == 0,
                        "A poster with no acceptable masks did not save an empty analysis")
        }
        print("PASS: reviewed labels/borders/genomes preserved, unconfirmed proposals excluded from trusted labels, accepted-mask provenance and stale-mask rejection")
    }

    private static func syntheticRegion(_ original: RegionAnalysis, id: String, appearance: Float, affinity: Float, alteredGeometry: Bool) throws -> RegionAnalysis {
        var document = try JSONSerialization.jsonObject(with: JSONEncoder().encode(original)) as! [String: Any]
        document["id"] = id; document["posterID"] = id
        func bytes(_ values: [Float]) -> String {
            var data = Data()
            for value in values { var word = value.bitPattern.littleEndian; withUnsafeBytes(of: &word) { data.append(contentsOf: $0) } }
            return data.base64EncodedString()
        }
        var appearanceVector = [Float](repeating: 0, count: original.vision.dimensions); appearanceVector[0] = appearance
        var semantic = [Float](repeating: 0, count: 768); semantic[0] = affinity; semantic[1] = sqrt(max(0, 1 - affinity * affinity))
        var vision = document["vision"] as! [String: Any]; vision["data"] = bytes(appearanceVector); document["vision"] = vision
        var siglip = document["siglip"] as! [String: Any]; siglip["data"] = bytes(semantic); document["siglip"] = siglip
        if alteredGeometry {
            var geometry = document["geometry"] as! [String: Any]
            geometry["silhouette"] = Data(original.geometry.silhouette.map { $0 == 0 ? 255 : 0 }).base64EncodedString()
            document["geometry"] = geometry
        }
        return try JSONDecoder().decode(RegionAnalysis.self, from: JSONSerialization.data(withJSONObject: document))
    }
}
