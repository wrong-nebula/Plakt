import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkReviewedShapes() throws {
        let expected = Set(["disc-wreath", "segmented-ring", "polygon-contours", "star-frame", "notched-disc", "cellular-disc"])
        let reviewed = PosterShapeLibrary.recipes.filter { $0.tags.contains("sam-reviewed") }
        try require(Set(reviewed.map(\.id)) == expected, "Reviewed shape families missing")
        func scene(_ id: String, _ parameters: [String: Double] = [:], seed: UInt64 = 817, aspect: Double = 1) throws -> StyleGenome {
            guard let recipe = PosterShapeLibrary.recipe(id) else { throw CheckFailure("Missing reviewed recipe") }
            var genome = try PosterShapeLibrary.scene(PosterShapePreset(recipe: recipe, seed: seed, parameters: parameters))
            genome.aspect = aspect; return genome
        }
        func mask(_ genome: StyleGenome) throws -> SegmentationMask {
            let image = try LibrarySceneRenderer.render(genome, width: 640), pixels = try rgba(image)
            var bytes = Data(count: image.width * image.height)
            for index in 0..<bytes.count {
                let offset = index * 4
                if Int(pixels[offset]) + Int(pixels[offset+1]) + Int(pixels[offset+2]) < 450 { bytes[index] = 255 }
            }
            return SegmentationMask(id: 0, width: image.width, height: image.height, bytes: bytes, predictedIoU: 1, stability: 1)
        }
        func geometry(_ id: String, _ parameters: [String: Double] = [:], aspect: Double = 1) throws -> RegionGeometry {
            let bitmap = try mask(scene(id, parameters, aspect: aspect))
            return try RegionGeometry.measure(bitmap, imageAspect: Double(bitmap.height) / Double(bitmap.width), textBoxes: [])
        }
        let wreath = try geometry("disc-wreath")
        try require(wreath.components.count == 8 && wreath.holes == 0, "Disc wreath lost separate modules")
        try require((wreath.circularLayout?.relativeResidual ?? 1) < 0.01 && (wreath.circularLayout?.angularSpan ?? 0) > 310, "Disc centers do not follow the declared orbit")
        for aspect in [0.7, 1.8] {
            let physical = try geometry("disc-wreath", aspect: aspect)
            try require(physical.components.count == 8, "Aspect change merged wreath discs")
            for component in physical.components {
                let ratio = component.bounds.width / (component.bounds.height * aspect)
                try require(abs(ratio - 1) < 0.06, "Physical aspect stretched a circular module")
            }
        }
        let crowded = try geometry("disc-wreath", ["count":24,"orbitRadius":0.35,"discRadius":0.18,"flatten":0.7])
        try require(crowded.components.count == 24 && crowded.holes == 0, "Wreath collision bound failed")
        let grid = try geometry("circle-clusters", ["rows":4,"columns":3,"satellite":0])
        try require(grid.components.count == 12 && grid.holes == 0, "Zero-satellite control did not produce a plain disc grid")

        let arcs = try geometry("segmented-ring", ["count":8,"duty":0.64,"thickness":0.18])
        let expectedArea = Double.pi * (pow(0.46,2) - pow(0.46*0.82,2)) * 0.64 * pow(0.86,2)
        try require(arcs.components.count == 8 && arcs.holes == 0 && abs(arcs.areaFraction - expectedArea) < 0.01,
                    "Annular sector counts, gaps or area are wrong")
        let hexagon = try geometry("polygon-contours", ["count":1,"sides":6,"lineWidth":0.025,"phase":0])
        try require(hexagon.components.count == 1 && hexagon.holes == 1 && hexagon.quarterTurnSymmetry < 0.75, "Hexagonal frame became a disc or lost its aperture")
        let nested = try geometry("polygon-contours", ["count":5,"sides":4,"lineWidth":0.012])
        try require(nested.components.count == 5 && nested.holes == 5, "Nested polygon contours merged or lost gaps")
        let star = try geometry("star-frame"), solidStar = try geometry("star-frame", ["aperture":0])
        try require(star.components.count == 1 && star.holes == 1 && solidStar.holes == 0 && solidStar.areaFraction > star.areaFraction * 1.2,
                    "Star-frame subtraction failed")
        let opening = Double.pi / 3
        let disc = try geometry("notched-disc", ["opening":opening,"depth":1,"flatten":1,"phase":0])
        let expectedDisc = Double.pi * pow(0.46*0.86,2) * (1-opening/(Double.pi*2))
        try require(disc.components.count == 1 && disc.holes == 0 && abs(disc.areaFraction-expectedDisc)<0.012,
                    "Notched disc violates its sector-area construction")
        let cells = try geometry("cellular-disc", ["rings":6,"count":24,"gutter":0.12])
        try require(cells.components.count == 74 && cells.holes == 0, "Polar mosaic cells merged or do not follow the declared six bands")
        let seededA = try mask(scene("cellular-disc", seed:817)), seededB = try mask(scene("cellular-disc", seed:818))
        try require(seededA.bytes != seededB.bytes, "Mosaic ignores its seed")

        for recipe in reviewed {
            guard let reference = recipe.references.first, let sha = reference.sourceImageSHA256,
                  sha.count == 64, reference.sourceBounds?.valid == true, reference.evidenceURL != nil else {
                throw CheckFailure("Reviewed source provenance missing: \(recipe.id)")
            }
            try require(reference.similarity == nil, "Visual review was assigned a fabricated cosine")
            guard let source = ShapeSystemLibrary.systems.first(where: { $0.operation == recipe.id }) else { throw CheckFailure("Missing source-linked shape system") }
            let sourceScene = try ShapeSystemEngine.scene(source)
            var libraryScene = try scene(recipe.id, source.parameters, seed:source.seed ?? 817)
            libraryScene.background = sourceScene.background
            libraryScene.elements[0].color = sourceScene.elements[0].color
            let a = try mask(sourceScene), b = try mask(libraryScene)
            try require(a.bytes == b.bytes, "Source system and library recipe use different geometry: \(recipe.id)")
            if let control = recipe.parameters.first {
                try require(rejected { _ = try ShapeSystemEngine.scene(source, overrides:[control.id:control.max+1]) }, "Source system bypassed recipe control bounds")
            }
        }
        print("PASS: six SAM-reviewed vector families, physical circles, collision-safe orbits, annular areas, polygon/star topology, 74 polar cells, seed variation and shared source/library geometry")
    }
}
