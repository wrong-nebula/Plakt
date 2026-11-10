import Foundation
import CoreML
import CoreGraphics
import CoreVideo
import ImageIO

// Embeds images with PosterLab's SigLIP image model, outside the app.
// Usage: swiftc -O -o .build/siglip-embed-images scripts/siglip-embed-images.swift
//        .build/siglip-embed-images library/semantic-siglip/compiled/FINGERPRINT/image.mlmodelc LIST.txt OUT.json
// Mirrors SigLIPEncoder.image: upright thumbnail (max 1400), stretched to 224 with high-quality
// interpolation onto white sRGB, normalized 768-d output. LIST has one image path per line.
let arguments = CommandLine.arguments
let configuration = MLModelConfiguration(); configuration.computeUnits = .cpuOnly
let model = try MLModel(contentsOf: URL(fileURLWithPath: arguments[1]), configuration: configuration)
let paths = try String(contentsOfFile: arguments[2], encoding: .utf8).split(separator: "\n").map(String.init)

func oriented(_ url: URL) -> CGImage {
    let source = CGImageSourceCreateWithURL(url as CFURL, nil)!
    return CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 1400] as CFDictionary)!
}

func embed(_ image: CGImage) throws -> [Float] {
    var buffer: CVPixelBuffer?
    CVPixelBufferCreate(kCFAllocatorDefault, 224, 224, kCVPixelFormatType_32BGRA,
        [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary, &buffer)
    CVPixelBufferLockBaseAddress(buffer!, [])
    let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer!), width: 224, height: 224, bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer!), space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.noneSkipFirst.rawValue)!
    context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: 224, height: 224))
    context.interpolationQuality = .high; context.draw(image, in: CGRect(x: 0, y: 0, width: 224, height: 224))
    CVPixelBufferUnlockBaseAddress(buffer!, [])
    let output = try model.prediction(from: MLDictionaryFeatureProvider(dictionary: ["image": MLFeatureValue(pixelBuffer: buffer!)]))
    let array = output.featureValue(for: "image_embedding")!.multiArrayValue!
    let values = (0..<array.count).map { array[$0].floatValue }
    let length = sqrt(values.reduce(0) { $0 + Double($1) * Double($1) })
    return values.map { Float(Double($0) / length) }
}

var result: [String: [Float]] = [:]
for (i, path) in paths.enumerated() {
    try autoreleasepool { result[path] = try embed(oriented(URL(fileURLWithPath: path))) }
    if (i + 1) % 100 == 0 { print("\(i + 1)/\(paths.count)") }
}
try JSONEncoder().encode(result).write(to: URL(fileURLWithPath: arguments[3]))
print("embedded \(result.count) images")
