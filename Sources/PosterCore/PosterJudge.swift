import Foundation
import CoreGraphics
import CoreML
import Vision

/// Used only inside EvolutionEngine's actor. Framework request objects never cross isolation boundaries.
final class PosterJudge {
    let model: MLModel
    let reference: VNFeaturePrintObservation
    let referenceMetrics: PixelMetrics
    let computeDescription: String

    init(referenceURL: URL, cropReference: Bool, cpuOnly: Bool) throws {
        guard let modelURL = Resources.modelURL else { throw PosterError.invalid("Bundled composition model is missing. Run scripts/build_model.py, then rebuild.") }
        let compiled = try MLModel.compileModel(at: modelURL)
        let configuration = MLModelConfiguration()
        configuration.computeUnits = cpuOnly ? .cpuOnly : .all
        model = try MLModel(contentsOf: compiled, configuration: configuration)
        var image = try PosterRenderer.load(referenceURL)
        if cropReference {
            let rect = CGRect(x: Double(image.width) * 0.077, y: Double(image.height) * 0.055,
                              width: Double(image.width) * 0.845, height: Double(image.height) * 0.88).integral
            if let cropped = image.cropping(to: rect) { image = cropped }
        }
        reference = try Self.featurePrint(image)
        referenceMetrics = try Self.pixels(image)
        computeDescription = cpuOnly ? "Core ML · CPU only" : "Core ML · all compute units (OS scheduled)"
    }

    static func featurePrint(_ image: CGImage) throws -> VNFeaturePrintObservation {
        let request = VNGenerateImageFeaturePrintRequest()
        request.revision = VNGenerateImageFeaturePrintRequestRevision2
        request.imageCropAndScaleOption = .scaleFit
        try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
        guard let result = request.results?.first else { throw PosterError.invalid("Vision returned no image feature print.") }
        return result
    }

    func evaluate(_ image: CGImage, genome: Genome) throws -> (Measurements, Double, VNFeaturePrintObservation) {
        let pixel = try Self.pixels(image)
        let feature = try Self.featurePrint(image)
        var distance: Float = 0
        try feature.computeDistance(&distance, to: reference)
        let ocr = VNRecognizeTextRequest()
        ocr.recognitionLevel = .accurate
        ocr.usesLanguageCorrection = false
        ocr.minimumTextHeight = 0.012
        try VNImageRequestHandler(cgImage: image, options: [:]).perform([ocr])
        let lines=(ocr.results ?? []).compactMap { observation->RecognizedLine? in
            guard let value=observation.topCandidates(1).first else{return nil}
            let box=observation.boundingBox
            return RecognizedLine(text:value.string,confidence:Double(value.confidence),bounds:UnitBox(x:box.minX,y:1-box.maxY,width:box.width,height:box.height))
        }
        let texts = (ocr.results ?? []).compactMap { $0.topCandidates(1).first }
        let words = texts.reduce(0) { $0 + $1.string.split(whereSeparator: { $0.isWhitespace }).count }
        let confidence = texts.isEmpty ? 0 : texts.reduce(0.0) { $0 + Double($1.confidence) } / Double(texts.count)
        let readability = min(1, Double(words) / 35) * confidence
        func near(_ v: Double, _ target: Double, _ tolerance: Double) -> Double { exp(-pow((v - target) / tolerance, 2)) }
        let metrics = Measurements(
            coverage: near(pixel.coverage, referenceMetrics.coverage, 0.24),
            detail: near(pixel.edge, referenceMetrics.edge, 0.14), balance: pixel.balance,
            contrast: min(1, pixel.contrast / 0.37), readability: readability,
            reference: exp(-Double(distance) * 1.4),
            hierarchy: min(1, pixel.tileVariation / 0.16),
            repetition: 1 - abs(genome.repetition - 0.65), recognizedWords: words, featureDistance: Double(distance),recognizedText:texts.map(\.string).joined(separator:" "),recognizedLines:lines)
        let array = try MLMultiArray(shape: [8], dataType: .float32)
        for (i, value) in metrics.vector.enumerated() { array[i] = NSNumber(value: value) }
        let input = try MLDictionaryFeatureProvider(dictionary: ["features": MLFeatureValue(multiArray: array)])
        let output = try model.prediction(from: input)
        guard let quality = output.featureValue(for: "quality")?.multiArrayValue?[0].doubleValue, quality.isFinite else {
            throw PosterError.invalid("Core ML returned an invalid composition score.")
        }
        return (metrics, quality, feature)
    }

    struct PixelMetrics {
        var coverage: Double; var edge: Double; var balance: Double; var contrast: Double; var tileVariation: Double
    }
    static func pixels(_ image: CGImage) throws -> PixelMetrics {
        let w = 96, h = 136
        var bytes = [UInt8](repeating: 0, count: w * h)
        let ok = bytes.withUnsafeMutableBytes { storage -> Bool in
            guard let ctx = CGContext(data: storage.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                                      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return false }
            ctx.interpolationQuality = .medium
            ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        guard ok else { throw PosterError.render }
        let values = bytes.map { Double($0) / 255 }
        let mean = values.reduce(0, +) / Double(values.count)
        let variance = values.reduce(0) { $0 + pow($1 - mean, 2) } / Double(values.count)
        var edge = 0.0, left = 0.0, right = 0.0
        var tileSums = [Double](repeating: 0, count: 16), tileCounts = [Int](repeating: 0, count: 16)
        for y in 0..<h { for x in 0..<w {
            let v = values[y * w + x]
            if x > 0 { edge += abs(v - values[y * w + x - 1]) }
            if y > 0 { edge += abs(v - values[(y - 1) * w + x]) }
            if x < w / 2 { left += v } else { right += v }
            let tile = min(3, y * 4 / h) * 4 + min(3, x * 4 / w)
            tileSums[tile] += v; tileCounts[tile] += 1
        } }
        let means = zip(tileSums, tileCounts).map { $0 / Double($1) }
        let tileVariation = sqrt(means.reduce(0) { $0 + pow($1 - mean, 2) } / 16)
        return PixelMetrics(coverage: mean, edge: edge / Double(w * h * 2), balance: 1 - abs(left - right) / max(1, left + right),
                            contrast: sqrt(variance), tileVariation: tileVariation)
    }
}
