import Foundation
import CoreGraphics

/// Authored constructions distilled from a visual census of the poster library.
/// Source imagery supplies evidence, never pixels or traced outlines.
enum SurveyShapeGeometry {
    static let operations: Set<String> = ["meander", "tunnel", "dendrite", "tension-web", "density-field", "scalloped-frame", "chevron-stack", "corner-brackets"]

    static func draw(_ operation: String, rect: CGRect, context: CGContext, values: [String: Double]) -> Bool {
        guard operations.contains(operation) else { return false }
        func n(_ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double {
            let v = values[key] ?? fallback
            return v.isFinite ? min(high, max(low, v)) : fallback
        }
        func count(_ key: String, _ fallback: Int, _ low: Int, _ high: Int) -> Int {
            Int(n(key, Double(fallback), Double(low), Double(high)).rounded())
        }
        let unit = min(rect.width, rect.height), tau = Double.pi * 2
        func p(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(x: rect.minX + x * rect.width, y: rect.minY + y * rect.height)
        }
        func polygon(_ points: [CGPoint]) {
            guard let first = points.first else { return }
            context.beginPath(); context.move(to: first)
            for point in points.dropFirst() { context.addLine(to: point) }
            context.closePath(); context.fillPath()
        }
        context.saveGState(); defer { context.restoreGState() }
        context.setLineJoin(.miter)
        switch operation {
        case "meander":
            let turns = count("turns", 7, 2, 14), inset = n("inset", 0.038, 0.012, 0.08)
            let step = (0.46 - inset) / Double(turns)
            context.setLineWidth(min(n("thickness", 0.012, 0.003, 0.12), step * 0.65) * unit)
            let path = CGMutablePath(); var left = inset, right = 1 - inset
            var top = inset, bottom = 1 - inset
            path.move(to: p(left, top))
            for _ in 0..<turns {
                path.addLine(to: p(right, top)); path.addLine(to: p(right, bottom)); left += step
                path.addLine(to: p(left, bottom)); top += step; path.addLine(to: p(left, top))
                right -= step; bottom -= step
            }
            context.addPath(path); context.strokePath()
        case "tunnel":
            let total = count("count", 22, 4, 40), rate = n("recession", 1, 0.72, 1)
            let focusX = n("focusX", 0.56, 0.2, 0.8), focusY = n("focusY", 0.54, 0.2, 0.8)
            context.setLineWidth(n("lineWidth", 0.004, 0.0015, 0.014) * unit)
            for i in 0..<total {
                let depth=abs(1-rate)<0.000001 ? Double(i)/Double(total-1):(1-pow(rate,Double(i)))/(1-pow(rate,Double(total-1)))
                let scale = 1-depth*0.94
                let x = focusX * (1 - scale) + 0.025 * scale
                let y = focusY * (1 - scale) + 0.025 * scale
                context.stroke(CGRect(x: p(x, y).x, y: p(x, y).y, width: 0.95 * scale * rect.width, height: 0.95 * scale * rect.height))
            }
        case "dendrite":
            let branches = count("branches", 5, 3, 8), depth = count("depth", 3, 1, 4)
            let spread = n("spread", 0.72, 0.3, 1.15), taper = n("taper", 0.62, 0.42, 0.76)
            let phase = n("phase", 0.15, -1.3, 1.3)
            let thickness = n("thickness", 0.034, 0.009, 0.14)
            var rng = SeededRandom(seed: UInt64(n("shapeSeed", 817, 0, 9_000_000)))
            context.setLineCap(.round)
            func limb(_ origin: CGPoint, _ angle: Double, _ length: Double, _ level: Int) {
                let end = CGPoint(x: origin.x + cos(angle) * length * unit, y: origin.y + sin(angle) * length * unit)
                context.setLineWidth(thickness * pow(0.78, Double(depth - level)) * unit)
                context.beginPath(); context.move(to: origin); context.addLine(to: end); context.strokePath()
                guard level > 0 else { return }
                for side in [-1.0, 1.0] {
                    limb(end, angle + side * spread + rng.value(-0.07, 0.07), length * taper, level - 1)
                }
            }
            // Total limb length is bounded, so no seed escapes its specimen field.
            let reach = (1 - pow(taper, Double(depth + 1))) / (1 - taper)
            for i in 0..<branches { limb(p(0.5, 0.5), phase + Double(i) / Double(branches) * tau, 0.44 / reach, depth) }
        case "tension-web":
            let strands = count("count", 9, 3, 20), pinch = n("pinch", 0.52, 0.22, 0.78)
            let bow = n("bow", 0.72, 0.15, 0.95)
            context.setLineCap(.round); context.setLineWidth(n("lineWidth", 0.009, 0.002, 0.045) * unit)
            if count("structure",0,0,1)==1 {
                let opening=n("opening",0.08,0,0.3)
                for side in [false,true] {for lower in [false,true] {for i in 0..<strands {
                    let t=Double(i)/Double(strands-1),x=(0.18+0.32*t)*(1-opening)
                    let y=0.025+0.35*t,endY=lower ? 1-y:y
                    func q(_ x:Double,_ y:Double)->CGPoint{p(side ? 1-x:x,y)}
                    let path=CGMutablePath();path.move(to:q(0.025,pinch))
                    path.addCurve(to:q(x,endY),control1:q(0.025+bow*0.27,pinch),control2:q(x,endY+(pinch-endY)*bow*0.65))
                    context.addPath(path);context.strokePath()
                }}}
                return true
            }
            for i in 0..<strands {
                let t = Double(i) / Double(strands - 1), y = 0.03 + t * 0.94
                let path = CGMutablePath(); path.move(to: p(0.04, pinch))
                path.addCurve(to: p(0.5, y), control1: p(0.04 + bow * 0.30, pinch), control2: p(0.5 - bow * 0.22, y))
                path.addCurve(to: p(0.96, pinch), control1: p(0.5 + bow * 0.22, y), control2: p(0.96 - bow * 0.30, pinch))
                context.addPath(path); context.strokePath()
            }
        case "density-field":
            let rows = count("rows", 19, 6, 32), columns = count("columns", 13, 5, 26)
            let bias = n("bias", 2.1, 0.5, 3.8), radius = n("radius", 0.012, 0.003, 0.055)
            let jitter = n("jitter", 0.12, 0, 0.6)
            var rng = SeededRandom(seed: UInt64(n("shapeSeed", 817, 0, 9_000_000)))
            for row in 0..<rows {
                let t = Double(row) / Double(rows - 1), y = 0.035 + pow(t, bias) * 0.93
                // Radius also responds to local row pitch; dense rows remain discrete.
                let next = pow(min(1, t + 1 / Double(rows - 1)), bias)
                let previous = pow(max(0, t - 1 / Double(rows - 1)), bias)
                let pitch = max(0.001, (next - previous) * 0.465 * rect.height)
                let rad = min(radius * unit, pitch * 0.39, rect.width / Double(columns) * 0.35)
                for col in 0..<columns {
                    let x = 0.035 + Double(col) / Double(columns - 1) * 0.93
                    let dx = rng.value(-1, 1) * jitter * rect.width / Double(columns)
                    let dy = rng.value(-1, 1) * jitter * pitch * 0.2
                    let point = p(x, y)
                    let box=CGRect(x:point.x+dx-rad,y:point.y+dy-rad,width:rad*2,height:rad*2)
                    if count("module",0,0,1)==1 {context.addPath(CGPath(roundedRect:box,cornerWidth:rad*0.55,cornerHeight:rad*0.55,transform:nil));context.fillPath()}
                    else {context.fillEllipse(in:box)}
                }
            }
        case "scalloped-frame":
            let lobes = count("lobes", 9, 3, 18), depth = n("depth", 0.025, 0.007, 0.055)
            let aperture = n("aperture", 0.68, 0.25, 0.82), phase = n("phase", 0, -1.2, 1.2)
            let safeDepth=min(depth,(0.84-aperture)*0.42)
            let path = CGMutablePath(), samples = lobes * 12
            for edge in 0..<4 {
                for i in 0...samples {
                    let t = Double(i) / Double(samples)
                    // Fade displacement and its derivative at corners: otherwise the
                    // phase-shifted edges cross and leave needle-like fill artifacts.
                    let envelope = pow(sin(t * Double.pi), 2)
                    let wave = sin(t * Double(lobes) * tau + phase) * safeDepth * envelope
                    let x: Double, y: Double
                    switch edge {
                    case 0: x = 0.08 + t * 0.84; y = 0.08 + wave
                    case 1: x = 0.92 + wave; y = 0.08 + t * 0.84
                    case 2: x = 0.92 - t * 0.84; y = 0.92 - wave
                    default: x = 0.08 - wave; y = 0.92 - t * 0.84
                    }
                    if edge == 0 && i == 0 { path.move(to: p(x, y)) } else { path.addLine(to: p(x, y)) }
                }
            }
            path.closeSubpath()
            let margin = (1 - aperture) / 2
            path.addRect(CGRect(x: p(margin, margin).x, y: p(margin, margin).y, width: aperture * rect.width, height: aperture * rect.height))
            context.addPath(path); context.drawPath(using: .eoFill)
        case "chevron-stack":
            let total = count("count", 17, 4, 32), drift = n("drift", 0.35, -0.4, 0.4)
            let growth = n("growth", 0.55, 0.15, 0.85), thickness = n("thickness", 0.024, 0.002, 0.05)
            let angle = n("angle", 0.32, 0.12, 0.5)
            if count("symbol",0,0,1)==1 {
                context.setLineCap(.butt);context.setLineJoin(.miter);context.setLineWidth(thickness*unit)
                for i in 0..<total {
                    let t=Double(i)/Double(total-1),scale=0.18+growth*t
                    func q(_ x:Double,_ y:Double)->CGPoint{p(0.5+(x-0.5)*scale+drift*(t-0.5),0.5+(y-0.5)*scale)}
                    context.beginPath();context.move(to:q(0.03,0.04));context.addLine(to:q(0.95,0.04+angle*0.25));context.addLine(to:q(0.10,0.97));context.strokePath()
                }
                return true
            }
            for i in 0..<total {
                let t = Double(i) / Double(total - 1), width = 0.18 + growth * t * 0.55
                let cx = 0.5 + drift * (t - 0.5), y = 0.08 + t * 0.74
                polygon([p(cx - width / 2, y), p(cx, y + angle * width), p(cx + width / 2, y), p(cx + width / 2, y + thickness), p(cx, y + angle * width + thickness), p(cx - width / 2, y + thickness)])
            }
        case "corner-brackets":
            let thickness = n("thickness", 0.038, 0.01, 0.09), arm = n("arm", 0.78, 0.35, 0.87)
            let inset = n("inset", 0.065, 0.025, 0.13), disc = n("disc", 0.27, 0.08, 0.33)
            for flip in [false, true] {
                func q(_ x: Double, _ y: Double) -> CGPoint { p(flip ? 1 - x : x, flip ? 1 - y : y) }
                let points=[q(inset,inset),q(inset+arm,inset),q(inset+arm,inset+arm*0.26),q(inset+arm-thickness,inset+arm*0.26),q(inset+arm-thickness,inset+thickness),q(inset,inset+thickness)]
                if count("outline",0,0,1)==1 {context.setLineWidth(n("lineWidth",0.005,0.002,0.015)*unit);context.beginPath();context.move(to:points[0]);for point in points.dropFirst(){context.addLine(to:point)};context.closePath();context.strokePath()}
                else{polygon(points)}
            }
            context.fillEllipse(in: CGRect(x: rect.midX - disc * unit, y: rect.midY - disc * unit, width: disc * unit * 2, height: disc * unit * 2))
        default: break
        }
        return true
    }
}
