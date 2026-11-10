import Foundation
import Vision

public struct ExternalSample: Codable, Sendable {
    public var id: String
    public var backend: String
    public var seed: UInt64
    public var generation: Int
    public var imageURL: URL
    public var parameters: [String: Double]
}

public struct ExternalEvaluation: Codable, Sendable {
    public var samples: [ExternalSample]
    public var results: [Candidate]
    public var compute: String
    public var note: String
}

public extension EvolutionEngine {
    func judgeExternal(_ samples: [ExternalSample],weights:[String:Double]?=nil,styleModelsURL:URL?=nil) throws -> ExternalEvaluation {
        try evaluateExternal(samples,weights:weights,styleModelsURL:styleModelsURL)
    }
}
