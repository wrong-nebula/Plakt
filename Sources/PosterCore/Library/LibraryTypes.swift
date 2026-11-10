import Foundation

public struct UnitBox: Codable, Hashable, Sendable {
    public var x: Double; public var y: Double; public var width: Double; public var height: Double
    public init(x: Double, y: Double, width: Double, height: Double) { self.x=x; self.y=y; self.width=width; self.height=height }
    public static let full = Self(x: 0, y: 0, width: 1, height: 1)
    public var area: Double { width * height }
    public var rect: CGRect { CGRect(x:x,y:y,width:width,height:height) }
    public var valid: Bool { [x,y,width,height].allSatisfy(\.isFinite) && x >= 0 && y >= 0 && width > 0 && height > 0 && x+width <= 1.001 && y+height <= 1.001 }
    public func overlap(_ other: Self) -> Double { let i=rect.intersection(other.rect); return i.isNull ? 0 : i.width*i.height / max(0.00001,min(area,other.area)) }
}

public struct TechniqueTag: Codable, Hashable, Sendable {
    public var name: String
    public var state: String // detected, suggested, confirmed, rejected
    public var confidence: Double
    public var evidence: [String]
    public var origin: String // measurement, OCR, caption, review, model
    public init(_ name: String, state: String = "suggested", confidence: Double, evidence: [String], origin: String) {
        self.name=name; self.state=state; self.confidence=confidence; self.evidence=evidence; self.origin=origin
    }
}

public enum TechniqueTaxonomy {
    public static let version = "poster-techniques-v2"
    public static let names = ["text-duplication", "shape-replication", "offset-replication", "drop-shadow", "extrusion", "outline-text", "circular-text", "text-on-path", "rotation", "stacked-type", "grid", "overlap", "cropping", "gradient", "halftone", "texture", "photography", "collage", "monochrome", "high-contrast", "dense-typography", "color-inversion", "distortion", "geometric-shapes", "grapheme-migration", "adjacent-transposition", "anagram-sequence", "compensated-erosion", "periodic-insertion", "glyph-repetition", "paired-column-repetition", "staggered-repetition", "stepped-alignment", "scale-ramp", "alternating-rotation", "vertical-type", "radial-type", "word-reflow", "tittle-substitution", "reflection", "alternating-ink", "bilateral-symmetry", "radial-symmetry", "concentric-shapes", "perforated-shapes", "modular-tiles", "curved-line-field"]
}

public struct VisualEmbedding: Codable, Sendable {
    public var model: String
    public var revision: Int
    public var dimensions: Int
    public var scalar: String
    public var data: Data
    public var preprocessing: String
    public func values() throws -> [Float] {
        guard scalar == "float32-le", data.count == dimensions * 4 else { throw PosterError.invalid("Unsupported embedding scalar or length.") }
        return data.withUnsafeBytes { bytes in (0..<dimensions).map { Float(bitPattern: UInt32(littleEndian: bytes.loadUnaligned(fromByteOffset: $0*4, as: UInt32.self))) } }
    }
    public func distance(to other: Self) throws -> Double {
        guard model==other.model, revision==other.revision, dimensions==other.dimensions, preprocessing==other.preprocessing else {
            throw PosterError.invalid("Embedding models/preprocessing differ; reindex before comparing.")
        }
        let a=try values(), b=try other.values()
        return sqrt(zip(a,b).reduce(0.0) { $0 + pow(Double($1.0-$1.1),2) })
    }
}

public struct ColorSample: Codable, Hashable, Sendable {
    public var hex: String; public var proportion: Double
}
public struct VisualStatistics: Codable, Sendable {
    public var meanLuminance: Double; public var contrast: Double; public var saturation: Double
    public var edgeDensity: Double; public var palette: [ColorSample]
}
public struct SourceAttribution: Codable, Sendable {
    public var sourceURL: URL
    public var account: String
    public var postID: String
    public var postURL: String?
    public var caption: String
    public var metadataURL: URL?
    public var contentHash: String
}
public struct PosterElement: Codable, Identifiable, Sendable {
    public var id: String
    public var parentID: String
    public var kind: String // text-line, word, region-proposal, manual-region
    public var bounds: UnitBox
    public var rotation: Double
    public var text: String?
    public var confidence: Double
    public var reviewStatus: String
    public var imageURL: URL
    public var embedding: VisualEmbedding
    public var statistics: VisualStatistics
    public var tags: [TechniqueTag]
    public var relatedIDs: [String]
    public var colors: PosterColorProfile? = nil
    public var segmentation: RegionAnalysis? = nil
}
public struct SceneElement: Codable, Sendable {
    public var paperRelief:PaperReliefGenome?=nil
    public var paperAttachment:PaperSurfaceAttachment?=nil
    public var physics:PhysicsTypeGenome?=nil
    public var contour:ContourCustomization? = nil
    public var rasterAsset:SceneRasterAsset? = nil
    public var sourceElementID: String
    public var kind: String
    public var bounds: UnitBox
    public var rotation: Double
    public var text: String?
    public var color: String
    public var shape: String
    public var outline: Bool
    public var shadow: Bool
    public var offsetX: Double
    public var offsetY: Double
    public var copies: Int
    public var preserveTypeProportions: Bool? = nil
    public var fontName: String? = nil
    public var textAlignment: String? = nil
    public var minimumStage: Int? = nil
    public var textTreatment: String? = nil
    public var outlineWidth:Double? = nil
    public var clipBounds:UnitBox? = nil
    public var geometry:[String:Double]? = nil
    public var blendMode:String? = nil
    public var fontProfileID:String? = nil
    public var fontAssetID:String? = nil
    public var fontAssetSHA256:String? = nil
    public var fontVariations:[String:Double]? = nil
    public var tracking:Double? = nil
    public var typeTransform:[String:Double]? = nil
    public var zIndex:Int? = nil
    public var allowsBleed:Bool? = nil
    public var sourcePosterID:String? = nil
    public var sourceAnchor:UnitBox? = nil
    public var typeSystemID:String? = nil
    public var typeSystemIDs:[String]? = nil
    public var typeSystemStep:Int? = nil
    public var graphemeIndexMap:[Int]? = nil
    public var typeEmSize:Double? = nil
    public var glyphTreatment:String? = nil
    public var glyphIndex:Int? = nil
    public var typeAnchorID:String? = nil
    public var overlapContrast:OverlapContrast? = nil
    /// Inks after `color`, for material systems that paint with several.
    public var inks:[String]? = nil
    /// Explicit kerning. Without it a line is set as scenes always were (see TextKerning.legacy).
    public var kerning:TextKerning? = nil
}
public struct StyleGenome: Codable, Sendable {
    public var imageInfluence:ImageCompositionInfluence? = nil
    public var version = "layout-genome-v1"
    public var posterID: String
    public var aspect: Double
    public var background: String
    public var font: String
    public var textScale: Double
    public var tracking: Double
    public var elements: [SceneElement]
    public var score: Double?
    public var fittingStatus: String
    public var sourceEmbeddingModel: String
    public var styleCategory: String? = nil
    public var layoutVariant: Int? = nil
    public var composition: CompositionPlan? = nil
    public var layoutInheritance:LayoutInheritance? = nil
    public var posterCopy:PosterCopy? = nil
    public var contentBrief:PosterContentBrief? = nil
    public var typeSystemIDs:[String]? = nil
    public var appliedTypeSystems:[TypeSystemApplication]? = nil
    public var typePlacement:TypePlacementSettings? = nil
    public var typeAnchors:[TypeAnchor]? = nil
    /// Kerning for every text line without its own. Scenes made from now on start optical; scenes saved before kerning
    /// existed decode without it and keep their original setting.
    public var kerning:TextKerning? = TextKerning.newPosters
}
public struct PosterRecord: Codable, Identifiable, Sendable {
    public var id: String
    public var sourceID: String
    public var source: SourceAttribution
    public var surfaceIndex: Int
    public var sourceQuad: [[Double]] // top-left normalized coordinates, TL/TR/BR/BL
    public var surfaceConfidence: Double
    public var reviewStatus: String
    public var warnings: [String]
    public var imageURL: URL
    public var width: Int
    public var height: Int
    public var embedding: VisualEmbedding
    public var textIndex: String
    public var statistics: VisualStatistics
    public var tags: [TechniqueTag]
    public var elements: [PosterElement]
    public var genome: StyleGenome
    public var colors: PosterColorProfile? = nil
    public var styleLabels: [String:String]? = nil
    public var regionAnalysis: RegionAnalysisReference? = nil
}
public struct LibraryEntry: Codable, Identifiable, Sendable {
    public var id: String; public var sourceID: String; public var title: String
    public var recordURL: URL; public var imageURL: URL; public var elementCount: Int
    public var tags: [String]; public var sourceGroup: String
}
public struct IndexedSource: Codable, Sendable {
    public var path: String; public var signature: String; public var posterIDs: [String]
}
public struct PosterLibrary: Codable, Sendable {
    public var version = 1
    public var analyzer = "vision-library-v1"
    public var taxonomy = TechniqueTaxonomy.version
    public var sourceRoot: URL
    public var directory: URL
    public var sources: [IndexedSource] = []
    public var posters: [LibraryEntry] = []
    public var failures: [String:String] = [:]
    public var note = "Poster surfaces and sub-elements are proposals; segmentation and technique attribution require review. Missing tags mean unknown, never a negative label. Vision embeddings are visual feature prints, not text-aligned CLIP embeddings."
}
public struct ReviewEdit: Codable, Sendable {
    public var posterID: String
    public var elementID: String?
    public var bounds: UnitBox?
    public var sourceQuad: [[Double]]?
    public var tags: [String]
    public var rejectedTags: [String]?
    public var rejectElement: Bool?
    public var styleLabels: [String:String]?
}
public struct SearchHit: Codable, Sendable {
    public var posterID: String; public var elementID: String?; public var imageURL: URL
    public var text: String; public var distance: Double?; public var tags: [String]
}
