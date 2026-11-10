import Foundation

public struct RegionAnalysisReference: Codable, Sendable {
    public let version: String
    public let imageHash: String
    public let samFingerprint: String
    public let siglipFingerprint: String
    public let url: URL
    public let regionCount: Int
    public let systemCandidateCount: Int
}
