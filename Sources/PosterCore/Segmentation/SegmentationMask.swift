import Foundation
import CoreGraphics

public struct SegmentationMask: Codable, Sendable, Identifiable {
    public let id: Int
    public let width: Int
    public let height: Int
    public let bytes: Data
    public let predictedIoU: Double
    public let stability: Double
    /// SAM's raw mask scores on this grid (little-endian Float16). Nil for derived or older masks.
    public let logits: Data?

    /// Long side of saved region masks: four times SAM's 256 grid, at the source's physical aspect.
    public static let detailLongSide = 1024

    public init(id: Int, width: Int, height: Int, bytes: Data, predictedIoU: Double, stability: Double, logits: Data? = nil) {
        self.id = id; self.width = width; self.height = height; self.bytes = bytes
        self.predictedIoU = predictedIoU; self.stability = stability; self.logits = logits
    }

    public var valid: Bool {
        width > 0 && height > 0 && width <= 2048 && height <= 2048 && bytes.count == width * height &&
        predictedIoU.isFinite && stability.isFinite && (0...1).contains(stability) && (logits == nil || logits!.count == width * height * 2)
    }

    public static func detailSize(width: Int, height: Int) -> (width: Int, height: Int) {
        let scale = Double(detailLongSide) / Double(max(1, max(width, height)))
        return (max(1, Int((Double(width) * scale).rounded())), max(1, Int((Double(height) * scale).rounded())))
    }

    /// SAM's own post-processing: bilinear upsampling of the raw scores (align_corners false), then a
    /// zero threshold. The score grid covers the stretched model input, so any output aspect maps by
    /// normalized position. Thresholding first would leave 256-grid stair steps in every edge.
    public func upsampled(width outputWidth: Int, height outputHeight: Int) throws -> SegmentationMask {
        guard valid, let logits, (1...2048).contains(outputWidth), (1...2048).contains(outputHeight) else {
            throw PosterError.invalid("This mask has no model scores to upsample.")
        }
        let scores: [Float] = logits.withUnsafeBytes { raw in
            (0..<(width * height)).map { Float(Float16(bitPattern: UInt16(littleEndian: raw.loadUnaligned(fromByteOffset: $0 * 2, as: UInt16.self)))) }
        }
        func taps(_ output: Int, _ input: Int) -> [(Int, Int, Float)] {
            (0..<output).map { index in
                let position = min(max((Double(index) + 0.5) * Double(input) / Double(output) - 0.5, 0), Double(input - 1))
                let low = Int(position)
                return (low, min(low + 1, input - 1), Float(position - Double(low)))
            }
        }
        let columns = taps(outputWidth, width), rows = taps(outputHeight, height)
        var bytes = [UInt8](repeating: 0, count: outputWidth * outputHeight)
        for (y, row) in rows.enumerated() {
            let upper = row.0 * width, lower = row.1 * width
            for (x, column) in columns.enumerated() {
                let top = scores[upper + column.0] * (1 - column.2) + scores[upper + column.1] * column.2
                let bottom = scores[lower + column.0] * (1 - column.2) + scores[lower + column.1] * column.2
                if top * (1 - row.2) + bottom * row.2 > 0 { bytes[y * outputWidth + x] = 255 }
            }
        }
        return SegmentationMask(id: id, width: outputWidth, height: outputHeight, bytes: Data(bytes), predictedIoU: predictedIoU, stability: stability)
    }

    public var bounds: UnitBox? {
        guard valid else { return nil }
        var left = width, top = height, right = -1, bottom = -1
        for (index, value) in bytes.enumerated() where value != 0 {
            let x = index % width, y = index / width
            left = min(left, x); right = max(right, x); top = min(top, y); bottom = max(bottom, y)
        }
        guard right >= left && bottom >= top else { return nil }
        return UnitBox(x: Double(left) / Double(width), y: Double(top) / Double(height),
                       width: Double(right - left + 1) / Double(width), height: Double(bottom - top + 1) / Double(height))
    }

    public var areaFraction: Double { Double(bytes.filter { $0 != 0 }.count) / Double(max(1, bytes.count)) }

    public func intersectionOverUnion(_ other: SegmentationMask) -> Double {
        guard valid, other.valid, width == other.width, height == other.height else { return 0 }
        var intersection = 0, union = 0
        for (a, b) in zip(bytes, other.bytes) {
            if a != 0 || b != 0 { union += 1 }
            if a != 0 && b != 0 { intersection += 1 }
        }
        return union == 0 ? 0 : Double(intersection) / Double(union)
    }

    public func image() throws -> CGImage {
        guard valid, let provider = CGDataProvider(data: bytes as CFData),
              let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 8,
                  bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: [],
                  provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent) else {
            throw PosterError.invalid("Invalid segmentation bitmap.")
        }
        return image
    }

    /// The mask and upright source share normalized coordinates; no image pixels are moved.
    public func cutout(_ source: CGImage, transparent: Bool = false, maximumSize: Int = 768) throws -> CGImage {
        guard valid, let bounds else { throw PosterError.invalid("The selected mask is empty.") }
        let sourceRect = CGRect(x: bounds.x * Double(source.width), y: bounds.y * Double(source.height),
            width: bounds.width * Double(source.width), height: bounds.height * Double(source.height)).integral
            .intersection(CGRect(x: 0, y: 0, width: source.width, height: source.height))
        guard let cropped = source.cropping(to: sourceRect) else { throw PosterError.render }
        let scale = min(1, Double(maximumSize) / Double(max(cropped.width, cropped.height)))
        let w = max(2, Int(Double(cropped.width) * scale)), h = max(2, Int(Double(cropped.height) * scale))
        var rgba = [UInt8](repeating: 0, count: w * h * 4)
        let okay = rgba.withUnsafeMutableBytes { memory -> Bool in
            guard let context = CGContext(data: memory.baseAddress, width: w, height: h, bitsPerComponent: 8,
                bytesPerRow: w * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: w, height: h))
            context.interpolationQuality = .high
            context.draw(cropped, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        guard okay else { throw PosterError.render }
        let bitmap = [UInt8](bytes)
        for y in 0..<h { for x in 0..<w {
            let nx = (sourceRect.minX + (Double(x) + 0.5) * sourceRect.width / Double(w)) / Double(source.width)
            let ny = (sourceRect.minY + (Double(y) + 0.5) * sourceRect.height / Double(h)) / Double(source.height)
            let maskIndex = min(height - 1, Int(ny * Double(height))) * width + min(width - 1, Int(nx * Double(width)))
            if bitmap[maskIndex] == 0 {
                let index = (y * w + x) * 4
                let matte: UInt8 = transparent ? 0 : 247
                rgba[index] = matte; rgba[index + 1] = matte; rgba[index + 2] = matte; rgba[index + 3] = transparent ? 0 : 255
            }
        }}
        guard let provider = CGDataProvider(data: Data(rgba) as CFData),
              let image = CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w * 4,
                  space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                  provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent) else { throw PosterError.render }
        return image
    }
}
