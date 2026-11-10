import Foundation
import CoreGraphics

/// Vector interpretations of the SAM sources reviewed in the shape expansion.
/// The caller supplies a physical coordinate space and its clipping rectangle.
enum ReviewedShapeGeometry {
    static let operations: Set<String> = ["disc-wreath", "segmented-ring", "polygon-contours", "star-frame", "notched-disc", "cellular-disc"]

    static func draw(_ operation: String, rect: CGRect, context: CGContext, values: [String: Double]) -> Bool {
        guard operations.contains(operation) else { return false }
        func n(_ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double {
            let value = values[key] ?? fallback
            return value.isFinite ? min(high, max(low, value)) : fallback
        }
        func count(_ key: String, _ fallback: Int, _ low: Int, _ high: Int) -> Int {
            Int(n(key, Double(fallback), Double(low), Double(high)).rounded())
        }
        let unit = min(rect.width, rect.height), center = CGPoint(x: rect.midX, y: rect.midY)
        let phase = n("phase", 0, -Double.pi, Double.pi), tau = Double.pi * 2
        func polar(_ angle: Double, _ radius: Double) -> CGPoint {
            CGPoint(x: center.x + cos(angle) * radius * unit, y: center.y + sin(angle) * radius * unit)
        }
        func polygon(_ path: CGMutablePath, radii: [Double], phase: Double) {
            for (index, radius) in radii.enumerated() {
                let point = polar(phase + Double(index) / Double(radii.count) * tau, radius)
                if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
            }
            path.closeSubpath()
        }
        context.saveGState(); defer { context.restoreGState() }
        switch operation {
        case "disc-wreath":
            let total = count("count", 8, 3, 24), orbit = n("orbitRadius", 0.35, 0.12, 0.43)
            let flatten = n("flatten", 1, 0.45, 1)
            // The lower bound on ellipse chord lengths protects every neighboring pair.
            let radius = min(n("discRadius", 0.105, 0.015, 0.18), 0.48 - orbit,
                             orbit * sin(Double.pi / Double(total)) * flatten * 0.88) * unit
            for index in 0..<total {
                let angle = phase + Double(index) / Double(total) * tau
                let x = center.x + cos(angle) * orbit * unit
                let y = center.y + sin(angle) * orbit * unit * flatten
                context.fillEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
            }
        case "segmented-ring":
            let total = count("count", 8, 2, 32), duty = n("duty", 0.64, 0.15, 0.88)
            let outer = 0.46, inner = outer * (1 - n("thickness", 0.18, 0.06, 0.65))
            for index in 0..<total {
                let angle = phase + Double(index) / Double(total) * tau
                let a = angle - Double.pi / Double(total) * duty, b = angle + Double.pi / Double(total) * duty
                let path = CGMutablePath(); path.move(to: polar(a, inner)); path.addLine(to: polar(a, outer))
                path.addArc(center: center, radius: outer * unit, startAngle: a, endAngle: b, clockwise: false)
                path.addLine(to: polar(b, inner))
                path.addArc(center: center, radius: inner * unit, startAngle: b, endAngle: a, clockwise: true)
                path.closeSubpath(); context.addPath(path); context.fillPath()
            }
        case "polygon-contours":
            let total = count("count", 9, 1, 28), sides = count("sides", 4, 3, 12)
            let inset = n("inset", 0.84, 0.15, 0.94), outer = 0.46
            let separation = total > 1 ? outer * inset / Double(total - 1) : 1
            context.setLineJoin(.miter)
            context.setLineWidth(min(n("lineWidth", 0.009, 0.002, 0.06), separation * 0.6) * unit)
            for index in 0..<total {
                let progress = total == 1 ? 0 : Double(index) / Double(total - 1)
                let path = CGMutablePath()
                polygon(path, radii: [Double](repeating: outer * (1 - inset * progress), count: sides), phase: phase)
                context.addPath(path); context.strokePath()
            }
        case "star-frame":
            let total = count("count", 12, 4, 24), depth = n("depth", 0.25, 0.08, 0.65)
            let aperture = n("aperture", 0.58, 0, 0.82), path = CGMutablePath()
            let radii = (0..<(total * 2)).map { $0.isMultiple(of: 2) ? 0.46 : 0.46 * (1 - depth) }
            polygon(path, radii: radii, phase: phase)
            if aperture > 0 { polygon(path, radii: radii.map { $0 * aperture }, phase: phase) }
            context.addPath(path); context.drawPath(using: .eoFill)
        case "notched-disc":
            let radius = unit * 0.46, opening = n("opening", 0.95, 0.15, 2.8)
            let depth = n("depth", 1, 0.2, 1.3), flatten = n("flatten", 1, 0.45, 1)
            context.translateBy(x: center.x, y: center.y); context.rotate(by: phase); context.scaleBy(x: 1, y: flatten)
            // Trace the remaining boundary directly. Combining an ellipse clip with
            // an even-odd subtraction leaves an antialiased arc across the opening.
            let tipX = (1 - depth) * radius
            let dx = cos(opening / 2) * radius * 3 - tipX
            let dy = sin(opening / 2) * radius * 3
            let a = dx * dx + dy * dy, b = 2 * tipX * dx
            let t = (-b + sqrt(b * b - 4 * a * (tipX * tipX - radius * radius))) / (2 * a)
            let edge = CGPoint(x: tipX + t * dx, y: t * dy)
            let angle = atan2(edge.y, edge.x), path = CGMutablePath()
            path.move(to: CGPoint(x: tipX, y: 0)); path.addLine(to: edge)
            path.addArc(center: .zero, radius: radius, startAngle: angle, endAngle: tau - angle, clockwise: false)
            path.closeSubpath(); context.addPath(path); context.fillPath()
        case "cellular-disc":
            let rings = count("rings", 6, 2, 10), sectors = count("count", 24, 8, 36)
            let gutter = n("gutter", 0.09, 0.02, 0.22), irregularity = n("irregularity", 0.4, 0, 0.8)
            let stagger = n("stagger", 0.5, 0, 0.9), band = 0.46 / Double(rings)
            var random = SeededRandom(seed: UInt64(n("shapeSeed", 817, 0, 9_000_000)))
            let waves = (0...rings).map { _ in random.unit() * tau }
            func boundary(_ row: Int, _ angle: Double) -> Double {
                if row == 0 { return 0 }
                if row == rings { return 0.46 }
                return band * Double(row) + band * irregularity *
                    (0.12 * sin(angle * 3 + waves[row]) + 0.07 * cos(angle * 5 - waves[row]))
            }
            for row in 0..<rings {
                let total = max(4, Int((Double(sectors) * (Double(row) + 0.5) / Double(rings)).rounded()))
                let step = tau / Double(total)
                let offset = phase + (row.isMultiple(of: 2) ? 0 : stagger * step)
                var angles = (0..<total).map { index in offset + (Double(index) + random.value(-0.22, 0.22) * irregularity) * step }
                angles.append(angles[0] + tau)
                for index in 0..<total {
                    var vertices: [CGPoint] = []
                    for sample in 0...8 {
                        let angle = angles[index] + (angles[index + 1] - angles[index]) * Double(sample) / 8
                        vertices.append(polar(angle, boundary(row + 1, angle)))
                    }
                    for sample in (0...8).reversed() {
                        let angle = angles[index] + (angles[index + 1] - angles[index]) * Double(sample) / 8
                        vertices.append(polar(angle, boundary(row, angle)))
                    }
                    let cx = vertices.map(\.x).reduce(0, +) / Double(vertices.count)
                    let cy = vertices.map(\.y).reduce(0, +) / Double(vertices.count)
                    let path = CGMutablePath()
                    for (index, vertex) in vertices.enumerated() {
                        let point = CGPoint(x: cx + (vertex.x - cx) * (1 - gutter), y: cy + (vertex.y - cy) * (1 - gutter))
                        if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
                    }
                    path.closeSubpath(); context.addPath(path); context.fillPath()
                }
            }
        default: break
        }
        return true
    }

}
