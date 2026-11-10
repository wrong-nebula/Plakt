import Foundation

public struct SAMSelection: Codable, Sendable {
    public let imageHash: String
    public let modelFingerprint: String
    public let prompts: [SAMPoint]
    public let masks: [SegmentationMask]
    public let reusedImageEncoding: Bool
    public let elapsedSeconds: Double
    public let computeUnits: String
}
