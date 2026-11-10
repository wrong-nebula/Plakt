import Foundation

public struct SAM2Manifest: Codable, Sendable {
    public let version: Int
    public let model: String
    public let revision: String
    public let fingerprint: String
    public let preprocessing: String
    public let inputSize: Int
    public let maskSize: Int
    public let maxPoints: Int
    public let packages: [String: String]
    public let files: [String: String]
}
