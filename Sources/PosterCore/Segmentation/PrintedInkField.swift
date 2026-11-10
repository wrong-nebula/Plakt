import Foundation
import CoreGraphics

public struct InkRefinement: Codable, Sendable {
    public let applied: Bool
    public let backgroundHex: String?
    public let backgroundSpread: Double?
    public let removedFraction: Double
    public let note: String
}

/// Restricts measured ink to a SAM object; only removes a locally consistent paper color.
final class PrintedInkField {
    private let rgb: [UInt8]
    let width: Int
    let height: Int

    /// Samples the upright image on the mask grid, so mask and color pixels share coordinates.
    init(image: CGImage, width: Int = 256, height: Int = 256) throws {
        guard (1...2048).contains(width), (1...2048).contains(height) else { throw PosterError.invalid("Invalid ink field size.") }
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        let success = bytes.withUnsafeMutableBytes { memory -> Bool in
            guard let context = CGContext(data: memory.baseAddress, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.interpolationQuality = .high; context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard success else { throw PosterError.render }
        rgb = bytes; self.width = width; self.height = height
    }

    private func color(_ index: Int) -> PerceptualColor.Lab {
        PerceptualColor.fromRGB(Double(rgb[index * 4]) / 255, Double(rgb[index * 4 + 1]) / 255, Double(rgb[index * 4 + 2]) / 255)
    }

    func refine(_ mask: SegmentationMask) -> (SegmentationMask, InkRefinement) {
        func original(_ note: String) -> (SegmentationMask, InkRefinement) {
            (mask, InkRefinement(applied: false, backgroundHex: nil, backgroundSpread: nil, removedFraction: 0, note: note))
        }
        guard mask.width == width, mask.height == height, let bounds = mask.bounds else { return original("No measurable object mask.") }
        // Pixel constants were tuned on the 256 × 256 grid; scale them so every grid keeps the same normalized behavior.
        let area = Double(width * height) / 65536
        let marginX = max(5, Int((5 * Double(width) / 256).rounded())), marginY = max(5, Int((5 * Double(height) / 256).rounded()))
        let left = max(0, Int(bounds.x * Double(width))), right = min(width - 1, Int((bounds.x + bounds.width) * Double(width)))
        let top = max(0, Int(bounds.y * Double(height))), bottom = min(height - 1, Int((bounds.y + bounds.height) * Double(height)))
        var samples: [Int] = []
        for y in max(0, top - marginY)...min(height - 1, bottom + marginY) { for x in max(0, left - marginX)...min(width - 1, right + marginX) {
            let index = y * width + x
            if mask.bytes[index] == 0 && (x < left || x > right || y < top || y > bottom) { samples.append(index) }
        }}
        guard samples.count >= max(20, Int((20 * area).rounded())) else { return original("Not enough visible background around the selected object.") }
        let sampleColors = samples.map(color)
        func median(_ values: [Double]) -> Double { values.sorted()[values.count / 2] }
        let paper = PerceptualColor.Lab(l: median(sampleColors.map(\.l)), a: median(sampleColors.map(\.a)), b: median(sampleColors.map(\.b)))
        let distances = sampleColors.map { sqrt(PerceptualColor.squared($0, paper)) }.sorted()
        let spread = distances[min(distances.count - 1, Int(Double(distances.count) * 0.85))]
        guard spread <= 0.065 else { return original("Surrounding colors vary; retained the original SAM object rather than guessing paper removal.") }
        let threshold = max(0.055, spread * 2)
        var bytes = mask.bytes, removed = 0, ink = 0
        for index in bytes.indices where bytes[index] != 0 {
            if PerceptualColor.squared(color(index), paper) < threshold * threshold { bytes[index] = 0; removed += 1 }
            else { ink += 1 }
        }
        let originalCount = removed + ink
        guard ink >= max(8, Int((8 * area).rounded())), Double(ink) / Double(max(1, originalCount)) >= 0.04 else {
            return original("Ink could not be separated reliably from the surrounding color.")
        }
        let nearest = samples.indices.min { PerceptualColor.squared(sampleColors[$0], paper) < PerceptualColor.squared(sampleColors[$1], paper) }!
        let pixel = samples[nearest] * 4
        let hex = String(format: "#%02x%02x%02x", rgb[pixel], rgb[pixel + 1], rgb[pixel + 2])
        return (SegmentationMask(id: mask.id, width: mask.width, height: mask.height, bytes: bytes, predictedIoU: mask.predictedIoU, stability: mask.stability),
                InkRefinement(applied: true, backgroundHex: hex, backgroundSpread: spread,
                    removedFraction: Double(removed) / Double(max(1, originalCount)),
                    note: "SAM-constrained ink estimate; locally consistent background removed in OKLab. Threshold \(threshold); SAM's IoU estimate applies to the original object mask."))
    }
}
