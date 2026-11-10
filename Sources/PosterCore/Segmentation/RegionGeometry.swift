import Foundation

public struct MaskComponent: Codable, Sendable {
    public let bounds: UnitBox
    public let centerX: Double
    public let centerY: Double
    public let pixels: Int
}

public struct CircularComponentLayout: Codable, Sendable {
    public let centerX: Double
    public let centerY: Double
    public let radius: Double
    public let relativeResidual: Double
    public let angularSpan: Double
    public let componentCount: Int
}

/// Measurements describe the predicted mask, not the unknowable source authoring layers.
public struct RegionGeometry: Codable, Sendable {
    public let version: String
    public let bounds: UnitBox
    public let imageAspect: Double
    public let areaFraction: Double
    public let aspect: Double
    public let fillFraction: Double
    public let horizontalSymmetry: Double
    public let verticalSymmetry: Double
    public let quarterTurnSymmetry: Double
    public let holes: Int
    public let ocrCoverage: Double
    public let components: [MaskComponent]
    public let gaps: [MaskComponent]
    public let circularLayout: CircularComponentLayout?
    public let silhouette: Data

    public static func measure(_ mask: SegmentationMask, imageAspect: Double, textBoxes: [UnitBox]) throws -> RegionGeometry {
        guard mask.valid, let bounds = mask.bounds, imageAspect.isFinite, imageAspect > 0 else { throw PosterError.invalid("Cannot measure an empty mask.") }
        let w = mask.width, h = mask.height, pixels = [UInt8](mask.bytes)
        var seen = [Bool](repeating: false, count: pixels.count), components: [MaskComponent] = [], gaps: [MaskComponent] = [], holes = 0
        var foreground = 0, textPixels = 0
        for start in pixels.indices {
            if pixels[start] != 0 {
                foreground += 1
                let x = (Double(start % w) + 0.5) / Double(w), y = (Double(start / w) + 0.5) / Double(h)
                if textBoxes.contains(where: { x >= $0.x && x <= $0.x + $0.width && y >= $0.y && y <= $0.y + $0.height }) { textPixels += 1 }
            }
            if seen[start] { continue }
            let ink = pixels[start] != 0
            var queue = [start], cursor = 0, left = w, right = 0, top = h, bottom = 0, sx = 0.0, sy = 0.0, edge = false
            seen[start] = true
            while cursor < queue.count {
                let position = queue[cursor], x = position % w, y = position / w
                cursor += 1; left = min(left, x); right = max(right, x); top = min(top, y); bottom = max(bottom, y)
                sx += Double(x) + 0.5; sy += Double(y) + 0.5
                edge = edge || x == 0 || y == 0 || x == w - 1 || y == h - 1
                for dy in -1...1 { for dx in -1...1 where dx != 0 || dy != 0 {
                    // Eight-connected foreground, four-connected background preserves diagonal ink joins.
                    if !ink && abs(dx) + abs(dy) != 1 { continue }
                    let nx = x + dx, ny = y + dy
                    if nx >= 0 && nx < w && ny >= 0 && ny < h {
                        let next = ny * w + nx
                        if !seen[next] && (pixels[next] != 0) == ink { seen[next] = true; queue.append(next) }
                    }
                }}
            }
            if ink && queue.count >= max(4, pixels.count / 5000) {
                components.append(MaskComponent(bounds: UnitBox(x: Double(left) / Double(w), y: Double(top) / Double(h),
                    width: Double(right - left + 1) / Double(w), height: Double(bottom - top + 1) / Double(h)),
                    centerX: sx / Double(queue.count * w), centerY: sy / Double(queue.count * h), pixels: queue.count))
            } else if !ink && !edge && queue.count >= max(4, pixels.count / 16384) {
                // Four pixels on SAM's 256 grid; the same physical area on detailed masks.
                holes += 1
                gaps.append(MaskComponent(bounds: UnitBox(x: Double(left) / Double(w), y: Double(top) / Double(h),
                    width: Double(right - left + 1) / Double(w), height: Double(bottom - top + 1) / Double(h)),
                    centerX: sx / Double(queue.count * w), centerY: sy / Double(queue.count * h), pixels: queue.count))
            }
        }
        let physicalAspect = bounds.width / (bounds.height * imageAspect)
        let side = 32
        let drawWidth = physicalAspect >= 1 ? 32.0 : 32.0 * physicalAspect
        let drawHeight = physicalAspect >= 1 ? 32.0 / physicalAspect : 32.0
        let offsetX = (32.0 - drawWidth) / 2, offsetY = (32.0 - drawHeight) / 2
        var silhouette = [UInt8](repeating: 0, count: side * side)
        for y in 0..<side { for x in 0..<side {
            let nx = (Double(x) + 0.5 - offsetX) / drawWidth, ny = (Double(y) + 0.5 - offsetY) / drawHeight
            if (0..<1).contains(nx) && (0..<1).contains(ny) {
                let px = min(w - 1, Int((bounds.x + nx * bounds.width) * Double(w)))
                let py = min(h - 1, Int((bounds.y + ny * bounds.height) * Double(h)))
                silhouette[y * side + x] = pixels[py * w + px]
            }
        }}
        func agreement(_ transform: (Int, Int) -> Int) -> Double {
            var intersection = 0, union = 0
            for y in 0..<side { for x in 0..<side {
                let a = silhouette[y * side + x] != 0, b = silhouette[transform(x, y)] != 0
                if a || b { union += 1 }; if a && b { intersection += 1 }
            }}
            return Double(intersection) / Double(max(1, union))
        }
        return RegionGeometry(version: "predicted-mask-geometry-v2", bounds: bounds, imageAspect: imageAspect, areaFraction: mask.areaFraction, aspect: physicalAspect,
            fillFraction: mask.areaFraction / bounds.area, horizontalSymmetry: agreement { x, y in y * side + side - 1 - x },
            verticalSymmetry: agreement { x, y in (side - 1 - y) * side + x },
            quarterTurnSymmetry: agreement { x, y in x * side + side - 1 - y }, holes: holes,
            ocrCoverage: Double(textPixels) / Double(max(1, foreground)),
            components: Array(components.sorted { $0.pixels == $1.pixels ? $0.centerY < $1.centerY : $0.pixels > $1.pixels }.prefix(256)),
            gaps: Array(gaps.sorted { $0.pixels > $1.pixels }.prefix(256)), circularLayout: circle(components, aspect: imageAspect),
            silhouette: Data(silhouette))
    }

    public func distance(to other: RegionGeometry) -> Double {
        guard version == other.version, silhouette.count == 1024, other.silhouette.count == 1024 else { return 1 }
        var intersection = 0, union = 0
        for (a, b) in zip(silhouette, other.silhouette) { if a != 0 || b != 0 { union += 1 }; if a != 0 && b != 0 { intersection += 1 } }
        let shape = 1 - Double(intersection) / Double(max(1, union))
        let topology = min(1, Double(abs(holes - other.holes)) / 3)
        let component = min(1, Double(abs(components.count - other.components.count)) / Double(max(1, max(components.count, other.components.count))))
        let ratio = min(1, abs(log(max(0.001, aspect) / max(0.001, other.aspect))) / 2)
        return 0.55 * shape + 0.15 * topology + 0.15 * component + 0.15 * ratio
    }

    private static func circle(_ components: [MaskComponent], aspect: Double) -> CircularComponentLayout? {
        let largest = components.map(\.pixels).max() ?? 0
        let points = components.filter { $0.pixels >= max(8, largest / 20) }.prefix(64).map { ($0.centerX, $0.centerY * aspect) }
        guard points.count >= 5 else { return nil }
        var matrix = [[Double]](repeating: [Double](repeating: 0, count: 4), count: 3)
        for (x, y) in points {
            let row = [x, y, 1.0], target = -(x * x + y * y)
            for i in 0..<3 { for j in 0..<3 { matrix[i][j] += row[i] * row[j] }; matrix[i][3] += row[i] * target }
        }
        for column in 0..<3 {
            let pivot = (column..<3).max { abs(matrix[$0][column]) < abs(matrix[$1][column]) }!
            guard abs(matrix[pivot][column]) > 1e-9 else { return nil }
            matrix.swapAt(column, pivot)
            let divisor = matrix[column][column]
            for j in column..<4 { matrix[column][j] /= divisor }
            for i in 0..<3 where i != column {
                let multiplier = matrix[i][column]
                for j in column..<4 { matrix[i][j] -= multiplier * matrix[column][j] }
            }
        }
        let cx = -matrix[0][3] / 2, cy = -matrix[1][3] / 2
        let squaredRadius = cx * cx + cy * cy - matrix[2][3]
        guard squaredRadius > 0.0001 else { return nil }
        let radius = sqrt(squaredRadius)
        let residual = sqrt(points.reduce(0.0) { $0 + pow(hypot($1.0 - cx, $1.1 - cy) - radius, 2) } / Double(points.count)) / radius
        let angles = points.map { atan2($0.1 - cy, $0.0 - cx) }.sorted()
        var gap = 0.0
        for i in angles.indices {
            let next = i + 1 < angles.count ? angles[i + 1] : angles[0] + 2 * Double.pi
            gap = max(gap, next - angles[i])
        }
        guard residual.isFinite, radius.isFinite else { return nil }
        return CircularComponentLayout(centerX: cx, centerY: cy / aspect, radius: radius,
            relativeResidual: residual, angularSpan: (2 * Double.pi - gap) * 180 / Double.pi, componentCount: points.count)
    }
}
