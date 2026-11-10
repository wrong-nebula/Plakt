import Foundation

/// Self-contained project: source pixels travel with the editable optical scene.
public struct GlassDocument: Codable, Sendable {
    public var version = 1
    public var artworkName: String
    public var artworkPNG: Data
    /// The poster as a vector PDF, when it came as one. The PNG is its rendering; the SVG export keeps these vectors.
    public var artworkPDF: Data?
    public var scene: GlassScene
    public var vectorColors: Int
    public var vectorWidth: Int

    public init(artworkName: String, artworkPNG: Data, artworkPDF: Data? = nil, scene: GlassScene,
                vectorColors: Int = 12, vectorWidth: Int = 600) {
        self.artworkName = artworkName
        self.artworkPNG = artworkPNG
        self.artworkPDF = artworkPDF
        self.scene = scene
        self.vectorColors = vectorColors
        self.vectorWidth = vectorWidth
    }

    public func validate() throws {
        guard version == 1, artworkPNG.count <= 80_000_000, (artworkPDF?.count ?? 0) <= 40_000_000,
              artworkPDF.map(GlassPosterPDF.isPDF) ?? true,
              (2...32).contains(vectorColors), (160...1200).contains(vectorWidth) else {
            throw PosterError.invalid("This glass project has an unsupported version or trace settings.")
        }
        try scene.validate()
    }
}
