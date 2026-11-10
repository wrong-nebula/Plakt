import Foundation
import CoreML
import CoreGraphics
import CoreVideo

public struct SigLIPManifest: Codable, Sendable {
    public let version: Int
    public let model: String
    public let revision: String
    public let fingerprint: String
    public let dimensions: Int
    public let imageSize: Int
    public let maxTokens: Int
    public let precision: String
    public let imageModel: String
    public let textModel: String
    public let tokenizer: String
    public let preprocessing: String
    public let files: [String:String]
}

/// Actor-confined, reusable models; inference never runs on the UI actor.
final class SigLIPEncoder {
    let directory: URL
    let manifest: SigLIPManifest
    let tokenizer: SigLIPTokenizer
    private var imageModel: MLModel?
    private var textModel: MLModel?
    private let cpuOnly: Bool
    private let cacheDirectory: URL?

    static func locate(_ explicit: URL? = nil) throws -> URL {
        let candidates = [explicit,
            ProcessInfo.processInfo.environment["POSTERLAB_SIGLIP_MODELS"].map{URL(fileURLWithPath:$0)},
            Bundle.main.resourceURL?.appending(path:"SigLIP"),
            URL(fileURLWithPath:CommandLine.arguments[0]).standardizedFileURL.deletingLastPathComponent().appending(path:"SigLIP"),
            URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appending(path:"models/siglip")].compactMap{$0}
        // An explicit path must fail visibly rather than silently selecting another model.
        if let explicit { return explicit }
        guard let found = candidates.first(where:{FileManager.default.fileExists(atPath:$0.appending(path:"manifest.json").path)}) else {
            throw PosterError.invalid("Semantic search needs the SigLIP model pack. Run scripts/prepare-siglip.py, or choose its folder.")
        }
        return found
    }

    init(directory: URL? = nil, cpuOnly: Bool = false, cacheDirectory: URL? = nil) throws {
        self.directory = try Self.locate(directory)
        let manifest = try JSONDecoder().decode(SigLIPManifest.self,from:Data(contentsOf:self.directory.appending(path:"manifest.json")))
        self.manifest = manifest
        guard manifest.version == 1, manifest.model == "google/siglip-base-patch16-224", manifest.dimensions == 768,
              manifest.imageSize == 224, manifest.maxTokens == 64, manifest.precision == "float16",
              manifest.imageModel == "image.mlpackage", manifest.textModel == "text.mlpackage", manifest.tokenizer == "tokenizer.json",
              manifest.preprocessing == "upright-sRGB-CG-high-stretch224-minus1plus1-v1", manifest.fingerprint.count == 64 else {
            throw PosterError.invalid("Unsupported SigLIP model pack. Rebuild it with scripts/prepare-siglip.py.")
        }
        let files = manifest.files
        let identity = files.keys.sorted().map{"\($0)\t\(files[$0]!)\n"}.joined()
        guard manifest.files["tokenizer.json"] != nil, manifest.files.keys.contains(where:{$0.hasPrefix("image.mlpackage/")}),
              manifest.files.keys.contains(where:{$0.hasPrefix("text.mlpackage/")}),
              LibraryRaster.hash(Data(identity.utf8)) == manifest.fingerprint else {
            throw PosterError.invalid("SigLIP model pack identity is invalid. Rebuild the pack.")
        }
        // Verify the pack once before using its identity to cache image embeddings.
        for (relative,hash) in manifest.files {
            guard !relative.hasPrefix("/"), !relative.split(separator:"/").contains(".."),
                  try LibraryRaster.hash(Data(contentsOf:self.directory.appending(path:relative))) == hash else {
                throw PosterError.invalid("SigLIP model pack checksum mismatch: \(relative). Rebuild the pack.")
            }
        }
        tokenizer = try SigLIPTokenizer(url:self.directory.appending(path:manifest.tokenizer))
        self.cpuOnly = cpuOnly
        self.cacheDirectory = cacheDirectory
    }

    private func load(_ name: String) throws -> MLModel {
        let configuration = MLModelConfiguration()
        // Short 64-token queries avoid GPU graph compilation and leave the GPU available for the studio.
        configuration.computeUnits = cpuOnly || name == manifest.textModel ? .cpuOnly : .all
        let cached = cacheDirectory?.appending(path:manifest.fingerprint)
            .appending(path:URL(fileURLWithPath:name).deletingPathExtension().lastPathComponent+".mlmodelc")
        if let cached, FileManager.default.fileExists(atPath:cached.path),
           let model = try? MLModel(contentsOf:cached,configuration:configuration) { return model }
        let compiled = try MLModel.compileModel(at:directory.appending(path:name))
        defer { try? FileManager.default.removeItem(at:compiled) }
        if let cached {
            let manager = FileManager.default
            try manager.createDirectory(at:cached.deletingLastPathComponent(),withIntermediateDirectories:true)
            let temporary = cached.deletingLastPathComponent().appending(path:UUID().uuidString+".mlmodelc")
            try manager.copyItem(at:compiled,to:temporary)
            defer { try? manager.removeItem(at:temporary) }
            if !manager.fileExists(atPath:cached.path) {
                do { try manager.moveItem(at:temporary,to:cached) }
                catch { if !manager.fileExists(atPath:cached.path) { throw error } }
            }
            if let model = try? MLModel(contentsOf:cached,configuration:configuration) { return model }
        }
        return try MLModel(contentsOf:compiled,configuration:configuration)
    }

    static func unitVector(_ values: [Float], dimensions: Int = 768) throws -> [Float] {
        guard values.count == dimensions, values.allSatisfy(\.isFinite) else { throw PosterError.invalid("Invalid SigLIP feature vector.") }
        let length = sqrt(values.reduce(0.0){$0+Double($1)*Double($1)})
        guard length > 0.000001 else { throw PosterError.invalid("Empty SigLIP feature vector.") }
        return values.map{Float(Double($0)/length)}
    }

    private func vector(_ prediction: MLFeatureProvider, name: String) throws -> [Float] {
        guard let array = prediction.featureValue(for:name)?.multiArrayValue else { throw PosterError.invalid("SigLIP output \(name) is missing.") }
        return try Self.unitVector((0..<array.count).map{array[$0].floatValue})
    }

    func text(_ description: String) throws -> [Float] {
        if textModel == nil { textModel = try load(manifest.textModel) }
        let tokens = try tokenizer.tokens(for:description)
        guard tokens.contains(where:{$0 != 1}) else { throw PosterError.invalid("Describe the design using words, such as geometric typography.") }
        let ids = try MLMultiArray(shape:[1,64],dataType:.int32)
        for (i,id) in tokens.enumerated() { ids[i] = NSNumber(value:id) }
        let input = try MLDictionaryFeatureProvider(dictionary:["input_ids":MLFeatureValue(multiArray:ids)])
        return try vector(textModel!.prediction(from:input),name:"text_embedding")
    }

    func image(_ source: CGImage) throws -> [Float] {
        if imageModel == nil { imageModel = try load(manifest.imageModel) }
        var buffer: CVPixelBuffer?
        let size = manifest.imageSize
        let result = CVPixelBufferCreate(kCFAllocatorDefault,size,size,kCVPixelFormatType_32BGRA,
            [kCVPixelBufferCGImageCompatibilityKey:true,kCVPixelBufferCGBitmapContextCompatibilityKey:true] as CFDictionary,&buffer)
        guard result == kCVReturnSuccess, let buffer else { throw PosterError.render }
        CVPixelBufferLockBaseAddress(buffer,[])
        defer { CVPixelBufferUnlockBaseAddress(buffer,[]) }
        guard let context = CGContext(data:CVPixelBufferGetBaseAddress(buffer),width:size,height:size,bitsPerComponent:8,
            bytesPerRow:CVPixelBufferGetBytesPerRow(buffer),space:CGColorSpace(name:CGColorSpace.sRGB)!,
            bitmapInfo:CGBitmapInfo.byteOrder32Little.rawValue|CGImageAlphaInfo.noneSkipFirst.rawValue) else { throw PosterError.render }
        context.setFillColor(CGColor(gray:1,alpha:1)); context.fill(CGRect(x:0,y:0,width:size,height:size))
        context.interpolationQuality = .high
        context.draw(source,in:CGRect(x:0,y:0,width:size,height:size))
        let input = try MLDictionaryFeatureProvider(dictionary:["image":MLFeatureValue(pixelBuffer:buffer)])
        return try vector(imageModel!.prediction(from:input),name:"image_embedding")
    }
}
