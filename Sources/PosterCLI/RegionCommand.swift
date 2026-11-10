import Foundation
import PosterCore

enum RegionCommand {
    static func run(_ command: String, options: [String: String], flags: Set<String>, directory: URL) async throws {
        let assistant = MultimodalLibraryAnalysis(directory: directory,
            samModels: options["--sam-models"].map { URL(fileURLWithPath: $0) },
            semanticModels: options["--models"].map { URL(fileURLWithPath: $0) }, cpuOnly: flags.contains("--cpu-only"))
        func integer(_ name: String, fallback: Int) throws -> Int {
            guard let text = options[name] else { return fallback }
            guard let value = Int(text), value > 0 else { throw PosterError.invalid("\(name) must be a positive integer.") }
            return value
        }
        if command == "refresh-region-links" {
            let count = try await assistant.refreshRelationships(progress: { FileHandle.standardError.write(Data(($0 + "\n").utf8)) })
            print("Refreshed relationships for \(count) posters using their saved masks and features.")
            return
        }
        if command == "analyze-regions" {
            var settings = RegionAnalysisSettings()
            settings.gridSize = try integer("--grid", fallback: 3)
            settings.maximumRegions = try integer("--max-regions", fallback: 6)
            if let text = options["--ink-points"] {
                guard let value = Int(text), (0...24).contains(value) else { throw PosterError.invalid("--ink-points must be from 0 to 24.") }
                settings.inkPoints = value
            }
            let summary = try await assistant.run(settings: settings, posterID: options["--poster"],
                limit: options["--limit"] == nil ? nil : try integer("--limit", fallback: 10),
                force: flags.contains("--force"), progress: {
                    let message = String(format: "[uptime %.1f] ", ProcessInfo.processInfo.systemUptime) + $0 + "\n"
                    FileHandle.standardError.write(Data(message.utf8))
                })
            if let output = options["--out"] {
                let folder = URL(fileURLWithPath: output)
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                try LibraryRaster.write(summary, to: folder.appending(path: "summary.json"))
            }
            print("Analyzed \(summary.analyzedPosters) posters (\(summary.cachedPosters) cached); \(summary.regionCount) regions, \(summary.suggestedTags) tag proposals, \(summary.typeCandidates) type / \(summary.shapeCandidates) shape candidates; \(summary.failures.count) failures.")
            return
        }
        if command == "region-search" {
            let hits = try await assistant.search(query: options["--query"], regionID: options["--region"], limit: try integer("--limit", fallback: 20))
            if let output = options["--out"] { try LibraryRaster.write(hits, to: URL(fileURLWithPath: output)) }
            for hit in hits { print("\(hit.id) · fused rank \(hit.rankFusionScore) · \(hit.ranks) · \(hit.imageURL.path)") }
            return
        }
        guard command == "segment" else { throw PosterError.invalid("Unknown region command.") }
        guard let output = options["--out"] else { throw PosterError.invalid("segment requires --out.") }
        let imageURL: URL
        if let image = options["--image"] { imageURL = URL(fileURLWithPath: image) }
        else {
            let catalog = try await PosterLibraryEngine(directory: directory).load()
            guard let id = options["--poster"], let entry = catalog.posters.first(where: { $0.id == id }) else { throw PosterError.invalid("Choose --poster ID or --image file.") }
            imageURL = entry.imageURL
        }
        var points: [SAMPoint] = []
        if let values = options["--box"] {
            let fields = values.split(separator: ",", omittingEmptySubsequences: false)
            let coordinates = fields.compactMap { Double($0) }
            guard fields.count == 4, coordinates.count == 4 else { throw PosterError.invalid("Use --box x,y,width,height in normalized coordinates.") }
            let box = UnitBox(x: coordinates[0], y: coordinates[1], width: coordinates[2], height: coordinates[3])
            guard box.valid else { throw PosterError.invalid("Invalid segmentation box.") }
            points += SAMPoint.box(box)
        }
        if let values = options["--points"] {
            for value in values.split(separator: ";") {
                let fields = value.split(separator: ",", omittingEmptySubsequences: false)
                let coordinates = fields.compactMap { Double($0) }
                guard fields.count == 3, coordinates.count == 3, coordinates[2] == 0 || coordinates[2] == 1 else { throw PosterError.invalid("Use --points 'x,y,1;x,y,0' for foreground/background marks.") }
                points.append(SAMPoint(x: coordinates[0], y: coordinates[1], foreground: coordinates[2] == 1))
            }
        }
        let root = URL(fileURLWithPath: output)
        guard !FileManager.default.fileExists(atPath: root.appending(path: "selection.json").path) else { throw PosterError.invalid("Selection export exists; choose another output folder.") }
        let segmenter = SAM2Segmenter(models: options["--sam-models"].map { URL(fileURLWithPath: $0) }, cache: directory.appending(path: "segmentation/compiled"))
        let selection = try await segmenter.segment(imageURL: imageURL, points: points)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let image = try LibraryRaster.oriented(imageURL, maxSize: 2048)
        // Exported PNGs use the same upsampled masks as saved regions; selection.json keeps SAM's 256 grid and scores.
        let size = SegmentationMask.detailSize(width: image.width, height: image.height)
        for mask in selection.masks where mask.bounds != nil {
            let detailed = try mask.upsampled(width: size.width, height: size.height)
            try PosterRenderer.png(detailed.image(), to: root.appending(path: "mask-\(mask.id).png"))
            try PosterRenderer.png(detailed.cutout(image, transparent: true), to: root.appending(path: "cutout-\(mask.id).png"))
            print("Mask \(mask.id): predicted IoU \(mask.predictedIoU), stability \(mask.stability), area \(mask.areaFraction)")
        }
        try LibraryRaster.write(selection, to: root.appending(path: "selection.json"))
        print("SAM 2.1: \(selection.elapsedSeconds.formatted(.number.precision(.fractionLength(3)))) seconds; reused image encoding: \(selection.reusedImageEncoding)")
    }
}
