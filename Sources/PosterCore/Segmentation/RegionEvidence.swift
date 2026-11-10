import Foundation

public struct RegionTagEvidence: Codable, Sendable {
    public let tag: String
    public let affinity: Double
    public let contrastMargin: Double
    public let geometrySupport: [String]
    public let explanation: String
}

public struct RegionSystemCandidate: Codable, Sendable, Identifiable {
    public let id: String
    public let scope: String
    public let relationship: String
    public let regionIDs: [String]
    public let evidence: [String]
    public let sourceText: String
    public let status: String
}

public struct RegionAnalysis: Codable, Sendable, Identifiable {
    public let id: String
    public let posterID: String
    public let sourceImageHash: String
    public let samFingerprint: String
    public let samComputeUnits: String
    public let siglipFingerprint: String
    public let prompt: [SAMPoint]
    public let maskURL: URL
    public let inkMaskURL: URL
    public let inkRefinement: InkRefinement
    public let imageURL: URL
    public let imageHash: String
    public let cutoutURL: URL
    public let bounds: UnitBox
    public let predictedIoU: Double
    public let stability: Double
    public let geometry: RegionGeometry
    public let vision: VisualEmbedding
    public let siglip: VisualEmbedding
    public let contextSiglip: VisualEmbedding
    public let tags: [RegionTagEvidence]
    public let text: String
    public let linkedElementIDs: [String]
    public let relatedSystems: [RelatedSourceSystem]
}

public struct PosterRegionAnalysis: Codable, Sendable {
    public let version: String
    public let recipeRevision: String
    public let posterID: String
    public let imageHash: String
    public let samFingerprint: String
    public let siglipFingerprint: String
    public let settingsHash: String
    public let attemptedPrompts: Int
    public let rejectedMasks: Int
    public let regions: [RegionAnalysis]
    public var tags: [RegionTagEvidence]
    public var systems: [RegionSystemCandidate]
    public var relationshipRevision: String? = nil
    public let note: String
}
