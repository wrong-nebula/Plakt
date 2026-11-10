import Foundation
import CoreML
import CoreVideo
import CoreGraphics

/// One image encoding serves many point/box refinements. Actor isolation owns all MLModel state.
public actor SAM2Segmenter {
    private let modelDirectory: URL?
    private let cacheDirectory: URL
    private var runtime: SAM2Runtime?

    public init(models: URL? = nil, cache: URL) {
        modelDirectory = models; cacheDirectory = cache
    }

    public func manifest() throws -> SAM2Manifest { try encoder().manifest }

    private func encoder() throws -> SAM2Runtime {
        if let runtime { return runtime }
        let loaded = try SAM2Runtime(directory: modelDirectory, cache: cacheDirectory)
        runtime = loaded
        return loaded
    }

    public func segment(imageURL: URL, points: [SAMPoint]) throws -> SAMSelection {
        try Task.checkCancellation()
        return try encoder().segment(imageURL: imageURL, points: points)
    }
}

private final class SAM2Runtime {
    let manifest: SAM2Manifest
    private let imageEncoder: MLModel
    private let promptEncoder: MLModel
    private let maskDecoder: MLModel
    private var imageHash: String?
    private var features: (any MLFeatureProvider)?

    init(directory explicit: URL?, cache: URL) throws {
        let executable = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent()
        let candidates = [explicit,
            ProcessInfo.processInfo.environment["POSTERLAB_SAM2_MODELS"].map { URL(fileURLWithPath: $0) },
            Bundle.main.resourceURL?.appending(path: "SAM2"), executable.appending(path: "SAM2"),
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appending(path: "models/sam2")].compactMap { $0 }
        guard let directory = candidates.first(where: { FileManager.default.fileExists(atPath: $0.appending(path: "manifest.json").path) }) else {
            throw PosterError.invalid("SAM 2.1 models are unavailable. Run scripts/prepare-sam2.py, then rebuild the app, or set POSTERLAB_SAM2_MODELS.")
        }
        let definition = try JSONDecoder().decode(SAM2Manifest.self, from: Data(contentsOf: directory.appending(path: "manifest.json")))
        manifest = definition
        guard manifest.version == 1, manifest.inputSize == 1024, manifest.maskSize == 256,
              manifest.maxPoints == 14, manifest.packages.count == 3, !manifest.files.isEmpty else {
            throw PosterError.invalid("Unsupported SAM model contract.")
        }
        var identity = manifest.preprocessing + "\n"
        for (name, digest) in manifest.files.sorted(by: { $0.key < $1.key }) {
            guard !name.hasPrefix("/"), !name.split(separator: "/").contains(".."),
                  LibraryRaster.hash(try Data(contentsOf: directory.appending(path: name))) == digest else {
                throw PosterError.invalid("SAM model checksum mismatch: \(name).")
            }
            identity += name + "\t" + digest + "\n"
        }
        guard LibraryRaster.hash(Data(identity.utf8)) == manifest.fingerprint else { throw PosterError.invalid("SAM model fingerprint mismatch.") }
        let configuration = MLModelConfiguration()
        // This released graph disagrees with its CPU reference on the local Neural Engine.
        // CPU execution is the verified path for every component; no silent accelerator fallback.
        configuration.computeUnits = .cpuOnly
        let compiled = cache.appending(path: manifest.fingerprint)
        try FileManager.default.createDirectory(at: compiled, withIntermediateDirectories: true)
        let lock = try SemanticIndexLock(url: compiled.appending(path: ".compiler.lock"))
        defer { lock.release() }
        func load(_ role: String) throws -> MLModel {
            guard let name = definition.packages[role], !name.contains("/"), name.hasSuffix(".mlpackage"),
                  definition.files[name + "/Manifest.json"] != nil else { throw PosterError.invalid("Invalid SAM package path.") }
            let target = compiled.appending(path: role + ".mlmodelc")
            if !FileManager.default.fileExists(atPath: target.path) {
                let temporary = try MLModel.compileModel(at: directory.appending(path: name))
                defer { try? FileManager.default.removeItem(at: temporary) }
                try FileManager.default.copyItem(at: temporary, to: target)
            }
            return try MLModel(contentsOf: target, configuration: configuration)
        }
        imageEncoder = try load("encoder"); promptEncoder = try load("prompt"); maskDecoder = try load("decoder")
    }

    private func pixels(_ image: CGImage) throws -> CVPixelBuffer {
        let size = manifest.inputSize
        var buffer: CVPixelBuffer?
        let result = CVPixelBufferCreate(kCFAllocatorDefault, size, size, kCVPixelFormatType_32BGRA,
            [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary, &buffer)
        guard result == kCVReturnSuccess, let buffer else { throw PosterError.render }
        CVPixelBufferLockBaseAddress(buffer, []); defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: size, height: size, bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.noneSkipFirst.rawValue) else { throw PosterError.render }
        context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: size, height: size))
        context.interpolationQuality = .high; context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
        return buffer
    }

    func segment(imageURL: URL, points: [SAMPoint]) throws -> SAMSelection {
        guard !points.isEmpty, points.count <= manifest.maxPoints, points.allSatisfy(\.valid),
              points.contains(where: { $0.label == 1 || $0.label == 2 }),
              points.filter({ $0.label == 2 }).count == points.filter({ $0.label == 3 }).count else {
            throw PosterError.invalid("Use 1–14 valid foreground/background points, or paired box corners.")
        }
        let start = Date(), hash = try LibraryRaster.hash(Data(contentsOf: imageURL))
        let reused = hash == imageHash && features != nil
        if !reused {
            let image = try LibraryRaster.oriented(imageURL, maxSize: 2048)
            features = try imageEncoder.prediction(from: MLDictionaryFeatureProvider(dictionary: ["image": MLFeatureValue(pixelBuffer: pixels(image))]))
            imageHash = hash
        }
        try Task.checkCancellation()
        let coordinates = try MLMultiArray(shape: [1, NSNumber(value: points.count), 2], dataType: .float16)
        let labels = try MLMultiArray(shape: [1, NSNumber(value: points.count)], dataType: .float16)
        for (index, point) in points.enumerated() {
            coordinates[index * 2] = NSNumber(value: point.x * Double(manifest.inputSize))
            coordinates[index * 2 + 1] = NSNumber(value: point.y * Double(manifest.inputSize))
            labels[index] = NSNumber(value: point.label)
        }
        let prompt = try promptEncoder.prediction(from: MLDictionaryFeatureProvider(dictionary: ["points": coordinates, "labels": labels]))
        guard let features, let sparse = prompt.featureValue(for: "sparse_embeddings"),
              let dense = prompt.featureValue(for: "dense_embeddings") else { throw PosterError.invalid("SAM prompt features are missing.") }
        var inputs: [String: MLFeatureValue] = ["sparse_embedding": sparse, "dense_embedding": dense]
        for name in ["image_embedding", "feats_s0", "feats_s1"] {
            guard let value = features.featureValue(for: name) else { throw PosterError.invalid("SAM image features are missing.") }
            inputs[name] = value
        }
        let result = try maskDecoder.prediction(from: MLDictionaryFeatureProvider(dictionary: inputs))
        guard let masks = result.featureValue(for: "low_res_masks")?.multiArrayValue,
              let scores = result.featureValue(for: "scores")?.multiArrayValue,
              masks.shape.map(\.intValue) == [1, 3, 256, 256], scores.count == 3 else { throw PosterError.invalid("Unexpected SAM output shape.") }
        var candidates: [SegmentationMask] = []
        let strides = masks.strides.map(\.intValue)
        let half = masks.dataPointer.assumingMemoryBound(to: Float16.self)
        let single = masks.dataPointer.assumingMemoryBound(to: Float.self)
        guard masks.dataType == .float16 || masks.dataType == .float32 else { throw PosterError.invalid("Unexpected SAM mask scalar type.") }
        let isHalf = masks.dataType == .float16
        for candidate in 0..<3 {
            var data = Data(count: 256 * 256), intersection = 0, union = 0
            // Raw scores are kept so saved regions can be upsampled before thresholding.
            var logits = [UInt16](repeating: 0, count: 256 * 256)
            for y in 0..<256 { for x in 0..<256 {
                let index = candidate * strides[1] + y * strides[2] + x * strides[3]
                let value = isHalf ? Double(half[index]) : Double(single[index])
                guard value.isFinite else { throw PosterError.invalid("SAM returned nonfinite mask values.") }
                if value > 0 { data[y * 256 + x] = 255 }
                if value > 1 { intersection += 1 }
                if value > -1 { union += 1 }
                logits[y * 256 + x] = Float16(value).bitPattern.littleEndian
            }}
            let stability = union == 0 ? 0 : Double(intersection) / Double(union)
            candidates.append(SegmentationMask(id: candidate, width: 256, height: 256, bytes: data,
                predictedIoU: scores[candidate].doubleValue, stability: stability,
                logits: logits.withUnsafeBufferPointer { Data(buffer: $0) }))
        }
        return SAMSelection(imageHash: hash, modelFingerprint: manifest.fingerprint, prompts: points, masks: candidates,
                            reusedImageEncoding: reused, elapsedSeconds: Date().timeIntervalSince(start), computeUnits: "CPU_ONLY")
    }
}
