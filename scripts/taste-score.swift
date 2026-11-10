// Scores PNGs with a frozen PosterLab taste model, reproducing the app's path:
// Vision feature print (revision 2, scaleFit) → signed-bucket 64-d L2 projection → Core ML labelProbability["yes"].
// Usage: swift taste-score.swift MODEL.mlmodel SHA256 IMAGE... ; prints one JSON object per line.
import Foundation
import Vision
import CoreML
import ImageIO
import CryptoKit

let args = CommandLine.arguments
let modelURL = URL(fileURLWithPath: args[1]), expected = args[2]
let digest = SHA256.hash(data: try Data(contentsOf: modelURL)).map { String(format: "%02x", $0) }.joined()
guard digest == expected else { fatalError("Model checksum mismatch: \(digest)") }
let compiled = try MLModel.compileModel(at: modelURL)
let model = try MLModel(contentsOf: compiled)
let request = VNGenerateImageFeaturePrintRequest()
request.revision = VNGenerateImageFeaturePrintRequestRevision2
request.imageCropAndScaleOption = .scaleFit

func project(_ values: [Float]) -> [Double] {
    var result = [Double](repeating: 0, count: 64)
    for (i, value) in values.enumerated() {
        let sign = ((i &* 1103515245 &+ 12345) >> 8) & 1 == 0 ? 1.0 : -1.0
        result[i % 64] += Double(value) * sign
    }
    let norm = sqrt(result.reduce(0) { $0 + $1 * $1 })
    return norm > 0 ? result.map { $0 / norm } : result
}

for path in args.dropFirst(3) {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fatalError("Cannot decode \(path)") }
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    guard let feature = request.results?.first, feature.elementType == .float, feature.elementCount == 768 else { fatalError("No feature print for \(path)") }
    let values = feature.data.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
    let features = project(values)
    let input = try MLDictionaryFeatureProvider(dictionary: Dictionary(uniqueKeysWithValues: features.enumerated().map { ("f\($0.offset)", MLFeatureValue(double: $0.element)) }))
    let score = try model.prediction(from: input).featureValue(for: "labelProbability")?.dictionaryValue[AnyHashable("yes")]?.doubleValue ?? .nan
    let row: [String: Any] = ["image": path, "score": score, "features": features]
    print(String(data: try JSONSerialization.data(withJSONObject: row), encoding: .utf8)!)
}
