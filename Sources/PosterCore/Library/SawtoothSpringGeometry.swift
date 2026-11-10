import Foundation
import CoreGraphics
import CoreText

/// Sawtooth and spring: one waveform laid along a run. The run is a straight or bent line, a ring or a spiral; the wave
/// is drawn as a band (a spring, a sawblade, a coiled line), as stripes that tile the field, as rows of fins, or mirrored
/// into a waveform. Every turn of the wave is a face that can fold, shade, screen or hatch. Effects stack over the whole
/// drawing: an extruded depth, a misregistered second printing and glitch slices.
public enum SawtoothSpringGeometry {
    public static let shape = "motif-survey-sawtooth-spring"
    static let operation = "survey-sawtooth-spring"

    /// A vertex of the wave in run/cross units: u along the run, v across it. `face` numbers the stretch that starts
    /// here (a straight side of a sharp wave, half a period of a smooth one); `tooth` is the period it belongs to.
    struct Node { var u: Double; var v: Double; var face: Int; var tooth: Int }

    static func value(_ values: [String: Double], _ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double {
        ExtendedSurveyGeometry.value(values, key, fallback, low, high)
    }

    /// Sharp waves as their corners in t (periods from the start, phase included) and height (−1…1).
    static func corners(_ kind: Int, from a: Double, to b: Double, skew: Double, seed: UInt64) -> [(Double, Double)] {
        var e: [(Double, Double)] = []
        let first = Int(floor(a)) - 1, last = Int(ceil(b)) + 1
        for k in first...last {
            let t = Double(k)
            switch kind {
            case 1: e += [(t, 1), (t, -1)]
            case 2: e += [(t, -1), (t, 1), (t + 0.5, 1), (t + 0.5, -1)]
            case 5: e += [(t, 0), (t + 0.55, 0), (t + 0.62, -0.25), (t + 0.7, 1), (t + 0.78, -0.6), (t + 0.86, 0)]
            case 6:
                let steps: [Double] = [-1, -1.0 / 3, 1.0 / 3, 1]
                for j in 0..<4 { e += [(t + Double(j) / 4, steps[j]), (t + Double(j + 1) / 4, steps[j])] }
                e.append((t + 1, -1))
            case 8:
                // Noise: crests of seeded height, alternating sides, like an audio waveform.
                for half in 0..<2 {
                    let m = Double(2 * k + half), r = sin(m * 12.9898 + Double(seed % 997) * 0.731) * 43758.5453
                    e.append((t + Double(half) / 2, (half == 0 ? 1 : -1) * (0.15 + 0.85 * (r - floor(r)))))
                }
            default: e += [(t, 1), (t + 0.5 + 0.45 * skew, -1)]
            }
        }
        func at(_ t: Double) -> Double {
            for i in 1..<e.count where e[i].0 >= t {
                let (t0, f0) = e[i - 1], (t1, f1) = e[i]
                return t1 - t0 < 0.000001 ? f1 : f0 + (f1 - f0) * (t - t0) / (t1 - t0)
            }
            return e.last!.1
        }
        return [(a, at(a))] + e.filter { $0.0 > a && $0.0 < b } + [(b, at(b))]
    }

    /// The wave along a run of `length`, `amplitude` either side of the axis.
    static func nodes(_ values: [String: Double], length: Double, amplitude: Double, pitchUnit: Double, seed: UInt64, shift: Double = 0) -> [Node] {
        func n(_ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double { value(values, key, fallback, low, high) }
        let kind = Int(n("wave", 0, 0, 8).rounded()), teeth = Int(n("teeth", 9, 1, 40).rounded())
        let compression = n("compression", 0.65, -1, 1), swell = n("swell", 0, -1, 1), phase = n("phase", 0, -0.25, 0.25) + shift
        let total = Double(teeth), k = 2.8 * compression
        // Compression packs the turns toward the end of the run (negative: toward its start), like a loaded spring.
        func run(_ p: Double) -> Double {
            let x = min(1, max(0, p / total))
            let g = abs(k) < 0.001 ? x : (1 - exp(-k * x)) / (1 - exp(-k))
            return -length / 2 + length * g
        }
        func reach(_ p: Double) -> Double { amplitude * max(0.05, 1 + swell * (2 * min(1, max(0, p / total)) - 1)) }
        func tooth(_ p: Double) -> Int { min(teeth - 1, max(0, Int(floor(p)))) }
        var out: [Node] = []
        let sampled = kind == 3 || kind == 4 || kind == 7
        if sampled {
            // Sine, a looping coil (a trochoid that runs back on itself at every crest), or bouncing arcs.
            let steps = teeth * (kind == 4 ? 48 : 24), base = Int(floor(2 * phase))
            for i in 0...steps {
                let p = total * Double(i) / Double(steps), t = p + phase
                var u = run(p), v = reach(p) * sin(2 * Double.pi * t), face = Int(floor(2 * t)) - base
                if kind == 4 {
                    let lo = max(0, p - 0.01), hi = min(total, p + 0.01), pitch = (run(hi) - run(lo)) / (hi - lo)
                    u -= 0.36 * pitch * cos(2 * Double.pi * t); v = -reach(p) * sin(2 * Double.pi * t)
                } else if kind == 7 {
                    v = reach(p) * (1 - 2 * abs(sin(Double.pi * t))); face = Int(floor(t)) - Int(floor(phase))
                }
                out.append(Node(u: u, v: v, face: face, tooth: tooth(p)))
            }
        } else {
            for (t, f) in corners(kind, from: phase, to: total + phase, skew: n("skew", 0, -1, 1), seed: seed) {
                let p = t - phase
                out.append(Node(u: run(p), v: reach(p) * f, face: out.count, tooth: tooth(p)))
            }
        }
        // A hand-drawn wobble: sharp waves shift their corners, smooth ones drift slowly.
        let jitter = n("jitter", 0, 0, 1)
        if jitter > 0 {
            var random = SeededRandom(seed: seed ^ 0x5341_5754)
            let a = random.value(0, 6.28), b = random.value(0, 6.28), size = jitter * pitchUnit
            for i in out.indices {
                if sampled { let p = Double(i) / Double(max(1, out.count - 1)) * total; out[i].v += size * (0.6 * sin(p * 2.3 + a) + 0.4 * sin(p * 5.1 + b)) }
                else { out[i].u += size * random.value(-0.5, 0.5); out[i].v += size * random.value(-0.9, 0.9) }
            }
        }
        // Rounded corners replace every interior corner of a sharp wave with a short curve.
        let corner = n("corner", 0, 0, 1)
        guard corner > 0, !sampled, out.count > 2 else { return out }
        let radius = corner * pitchUnit * 0.5
        var rounded: [Node] = [out[0]]
        for i in 1..<(out.count - 1) {
            let a = out[i - 1], c = out[i], b = out[i + 1]
            let la = hypot(c.u - a.u, c.v - a.v), lb = hypot(b.u - c.u, b.v - c.v)
            guard la > 0.000001, lb > 0.000001 else { rounded.append(c); continue }
            let da = min(radius, la * 0.45), db = min(radius, lb * 0.45)
            let s = (c.u + (a.u - c.u) / la * da, c.v + (a.v - c.v) / la * da), e = (c.u + (b.u - c.u) / lb * db, c.v + (b.v - c.v) / lb * db)
            for j in 0...8 {
                let t = Double(j) / 8, w0 = (1 - t) * (1 - t), w1 = 2 * (1 - t) * t, w2 = t * t
                rounded.append(Node(u: w0 * s.0 + w1 * c.u + w2 * e.0, v: w0 * s.1 + w1 * c.v + w2 * e.1, face: t < 0.5 ? a.face : c.face, tooth: t < 0.5 ? a.tooth : c.tooth))
            }
        }
        rounded.append(out[out.count - 1])
        return rounded
    }

    /// Splits long sides so they follow a curved run (a bend, a ring or a spiral) instead of cutting across it.
    static func densify(_ nodes: [Node], step: Double) -> [Node] {
        guard nodes.count > 1, step > 0 else { return nodes }
        var out: [Node] = []
        for i in 0..<(nodes.count - 1) {
            let a = nodes[i], b = nodes[i + 1], pieces = max(1, min(40, Int(ceil(hypot(b.u - a.u, b.v - a.v) / step))))
            for j in 0..<pieces { let t = Double(j) / Double(pieces); out.append(Node(u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t, face: a.face, tooth: a.tooth)) }
        }
        out.append(nodes[nodes.count - 1])
        return out
    }

    static func draw(_ operation: String, rect: CGRect, context: CGContext, values: [String: Double], inks given: [CGColor], text: String?, font: CTFont?, stage: ConstructionStage) -> Bool {
        guard operation == Self.operation else { return false }
        func n(_ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double { value(values, key, fallback, low, high) }
        func count(_ key: String, _ fallback: Int, _ low: Int, _ high: Int) -> Int { Int(n(key, Double(fallback), Double(low), Double(high)).rounded()) }
        let finished = stage != .blockout
        let black = CGColor(srgbRed: 0.04, green: 0.04, blue: 0.05, alpha: 1), white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
        let inks = given.isEmpty ? [black] : given
        let layout = count("layout", 0, 0, 5), copies = count("copies", 1, 1, 16), inkMode = count("inkMode", 0, 0, 3)
        let teeth = count("teeth", 9, 1, 40), cap = count("cap", 0, 0, 3)
        let unit = min(rect.width, rect.height), weight = n("weight", 0.035, 0.004, 0.2) * unit
        let angle = n("angle", 0, -90, 90) * Double.pi / 180
        let fold = finished ? n("fold", 0, 0, 1) : 0, shade = finished ? n("shade", 0, 0, 1) : 0, glow = finished ? n("glow", 0, 0, 1) : 0
        let shadeStyle = count("shadeStyle", 0, 0, 2), taper = n("taper", 0, -1, 1), dash = n("dash", 0, 0, 1)
        let outline = count("outline", 0, 0, 1) == 1, seed = UInt64(n("shapeSeed", 817, 0, 9_000_000))
        let fill = n("fill", 1, 0.1, 1), amplitudeShare = n("amplitude", 0.92, 0.1, 1.2)
        // The run direction (0° runs down the page) and the cross direction; extents cover the field at any angle.
        let run = CGPoint(x: sin(angle), y: cos(angle)), cross = CGPoint(x: cos(angle), y: -sin(angle))
        let halfRun = (abs(rect.width * run.x) + abs(rect.height * run.y)) / 2, halfCross = (abs(rect.width * cross.x) + abs(rect.height * cross.y)) / 2
        let center = CGPoint(x: rect.midX, y: rect.midY)
        func fit(_ d: CGPoint) -> Double { min(abs(d.x) > 0.001 ? rect.width / 2 / abs(d.x) : .infinity, abs(d.y) > 0.001 ? rect.height / 2 / abs(d.y) : .infinity) }

        // Where the run goes: a straight or bent line, a ring, or a spiral. Bending turns the run into an arc of up to 160°.
        let kappa = n("bend", 0, -1, 1) * 0.9 * Double.pi / (2 * halfRun)
        let ringRadius = n("radius", 0.62, 0.1, 0.95) * unit / 2, coils = n("coils", 3, 1, 8)
        func line(_ u: Double, _ v: Double) -> CGPoint {
            var along = u, across = v
            if abs(kappa) > 0.000001 { let phi = kappa * u, r0 = 1 / kappa; along = (r0 - v) * sin(phi); across = r0 * (1 - cos(phi)) + v * cos(phi) }
            return CGPoint(x: center.x + run.x * along + cross.x * across, y: center.y + run.y * along + cross.y * across)
        }
        func ring(_ u: Double, _ v: Double, _ length: Double, _ radius: Double) -> CGPoint {
            let theta = 2 * Double.pi * (u + length / 2) / length - Double.pi / 2 + angle, rho = max(0, radius + v)
            return CGPoint(x: center.x + rho * cos(theta), y: center.y + rho * sin(theta))
        }
        func spiral(_ u: Double, _ v: Double, _ length: Double) -> CGPoint {
            let x = min(1, max(0, (u + length / 2) / length)), theta = 2 * Double.pi * coils * x - Double.pi / 2 + angle, rho = max(0, ringRadius * (0.1 + 0.9 * x) + v)
            return CGPoint(x: center.x + rho * cos(theta), y: center.y + rho * sin(theta))
        }

        func inkAt(copy: Int, tooth: Int, u: Double, length: Double) -> CGColor {
            let k = inks.count
            switch inkMode {
            case 1: return inks[((copy % k) + k) % k]
            case 2: return inks[tooth % k]
            case 3:
                guard k > 1 else { return inks[0] }
                let x = min(1, max(0, (u + length / 2) / max(0.0001, length))) * Double(k - 1), i = min(k - 2, Int(floor(x)))
                return OrbitWrapGeometry.mix(inks[i], inks[i + 1], x - Double(i))
            default: return inks[0]
            }
        }
        /// Folded faces alternate a darker and a lighter tone of their ink.
        func folded(_ color: CGColor, _ face: Int) -> CGColor {
            guard fold > 0 else { return color }
            return face % 2 == 1 ? OrbitWrapGeometry.mix(color, black, 0.38 * fold) : OrbitWrapGeometry.mix(color, white, 0.12 * fold)
        }

        /// One printing of the whole construction: the main pass, an extrusion layer or the misregistered second ink.
        struct Pass { var full: Bool; var tone: (CGColor) -> CGColor }
        var pass = Pass(full: true, tone: { $0 })
        func glowing(_ color: CGColor) { let on = pass.full && glow > 0; context.setShadow(offset: .zero, blur: on ? glow * unit * 0.06 : 0, color: on ? color.copy(alpha: 0.95) : nil) }
        func gradient(_ from: CGColor, _ to: CGColor) -> CGGradient? { CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [from, to] as CFArray, locations: [0, 1]) }
        /// Shading from a dark start (`a`) to the ink (`b`): smooth, a halftone dot screen, or a line screen.
        func shading(_ region: CGPath, _ color: CGColor, from a: CGPoint, to b: CGPoint) {
            context.saveGState(); context.addPath(region); context.clip()
            if shadeStyle == 0 {
                if let g = gradient(OrbitWrapGeometry.mix(color, black, 0.85 * shade), color.copy(alpha: 0)!) { context.drawLinearGradient(g, start: a, end: b, options: [.drawsBeforeStartLocation]) }
                context.restoreGState(); return
            }
            let box = region.boundingBoxOfPath.intersection(rect), cell = unit / 58, dx = b.x - a.x, dy = b.y - a.y, l = max(0.000001, hypot(dx, dy))
            let d = CGPoint(x: dx / l, y: dy / l), q = CGPoint(x: -d.y, y: d.x), marks = CGMutablePath()
            guard !box.isNull else { context.restoreGState(); return }
            var y = box.minY + cell / 2
            while y < box.maxY {
                var x = box.minX + cell / 2
                while x < box.maxX {
                    let t = min(1, max(0, ((x - a.x) * d.x + (y - a.y) * d.y) / l)), k = shade * (1 - t)
                    if k > 0.04 {
                        if shadeStyle == 1 { let r = cell * 0.62 * k.squareRoot(); marks.addEllipse(in: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)) }
                        else {
                            let h = cell * 0.5, w = cell * 0.4 * k
                            marks.addLines(between: [CGPoint(x: x + q.x * h + d.x * w, y: y + q.y * h + d.y * w), CGPoint(x: x - q.x * h + d.x * w, y: y - q.y * h + d.y * w),
                                                     CGPoint(x: x - q.x * h - d.x * w, y: y - q.y * h - d.y * w), CGPoint(x: x + q.x * h - d.x * w, y: y + q.y * h - d.y * w)])
                            marks.closeSubpath()
                        }
                    }
                    x += cell
                }
                y += cell
            }
            context.setFillColor(OrbitWrapGeometry.mix(color, black, 0.82)); context.addPath(marks); context.fillPath()
            context.restoreGState()
        }
        func paint(_ region: CGPath, _ base: CGColor, from a: CGPoint, to b: CGPoint) {
            let color = pass.tone(base)
            glowing(color)
            if outline { context.setStrokeColor(color); context.setLineWidth(max(unit * 0.0018, weight * 0.09)); context.addPath(region); context.strokePath(); return }
            context.setFillColor(color); context.addPath(region); context.fillPath()
            context.setShadow(offset: .zero, blur: 0, color: nil)
            if pass.full && shade > 0 { shading(region, color, from: a, to: b) }
        }

        /// A band along mapped points: stroked when it is one flat tone, otherwise built face by face as strips whose
        /// sides meet exactly at shared corners, so faces can fold, shade and taper.
        func band(_ wave: [Node], _ points: [CGPoint], copy c: Int, length: Double, closed: Bool, heads: Bool) {
            guard points.count > 1 else { return }
            let flat = fold == 0 && shade == 0 && inkMode != 2 && inkMode != 3 && taper == 0
            let color = inkAt(copy: c, tooth: 0, u: 0, length: length), roundJoin = n("corner", 0, 0, 1) > 0
            if flat {
                let path = CGMutablePath(); path.addLines(between: points); if closed { path.closeSubpath() }
                context.saveGState()
                // Stroked directly: Core Graphics joins very acute corners reliably, a filled stroke outline does not.
                context.setLineWidth(weight); context.setLineCap(cap == 1 || cap == 3 ? .round : .butt); context.setMiterLimit(6)
                context.setLineJoin(roundJoin ? .round : .miter); glowing(pass.tone(color)); context.setStrokeColor(pass.tone(color)); context.addPath(path)
                if dash > 0 { context.setLineDash(phase: 0, lengths: [weight * (3.2 - 2.4 * dash), weight * (0.6 + 2.6 * dash)]) }
                if outline { context.replacePathWithStrokedPath(); context.setLineDash(phase: 0, lengths: []); context.setLineWidth(max(unit * 0.0018, weight * 0.09)) }
                context.strokePath(); context.restoreGState()
            } else {
                let pts = closed ? points + [points[0]] : points, nodes = closed ? wave + [wave[0]] : wave
                func segment(_ a: Int, _ b: Int) -> CGPoint { let dx = pts[b].x - pts[a].x, dy = pts[b].y - pts[a].y, l = max(0.000001, hypot(dx, dy)); return CGPoint(x: -dy / l, y: dx / l) }
                func normal(_ i: Int) -> CGPoint {
                    if i == 0 { return segment(0, 1) }
                    if i == pts.count - 1 { return segment(i - 1, i) }
                    let a = segment(i - 1, i), b = segment(i, i + 1), m = CGPoint(x: a.x + b.x, y: a.y + b.y), l = hypot(m.x, m.y)
                    guard l > 0.000001 else { return a }
                    let unitM = CGPoint(x: m.x / l, y: m.y / l), cosHalf = max(1.0 / 6, unitM.x * a.x + unitM.y * a.y)
                    return CGPoint(x: unitM.x / cosHalf, y: unitM.y / cosHalf)
                }
                // Taper narrows the band toward one end of the run.
                func half(_ i: Int) -> Double { let x = min(1, max(0, (nodes[i].u + length / 2) / max(0.0001, length))); return weight / 2 * max(0.12, 1 + taper * (2 * x - 1)) }
                let normals = pts.indices.map(normal), halves = pts.indices.map(half)
                var start = 0
                while start < pts.count - 1 {
                    var end = start + 1
                    while end < pts.count - 1 && nodes[end].face == nodes[start].face { end += 1 }
                    let region = CGMutablePath()
                    region.addLines(between: (start...end).map { CGPoint(x: pts[$0].x + normals[$0].x * halves[$0], y: pts[$0].y + normals[$0].y * halves[$0]) } + (start...end).reversed().map { CGPoint(x: pts[$0].x - normals[$0].x * halves[$0], y: pts[$0].y - normals[$0].y * halves[$0]) })
                    region.closeSubpath()
                    let mid = nodes[(start + end) / 2]
                    paint(region, folded(inkAt(copy: c, tooth: mid.tooth, u: mid.u, length: length), nodes[start].face), from: pts[start], to: pts[end])
                    start = end
                }
                if (cap == 1 || cap == 3) && !closed {
                    context.setFillColor(pass.tone(color))
                    for i in [0, pts.count - 1] { let h = halves[i]; context.fillEllipse(in: CGRect(x: pts[i].x - h, y: pts[i].y - h, width: h * 2, height: h * 2)) }
                }
            }
            guard heads && !closed else { return }
            // Heads: an arrow, or a snake's head with a forked tongue.
            let tip = points[points.count - 1], before = points[max(0, points.count - 3)], ink = pass.tone(color)
            let dx = tip.x - before.x, dy = tip.y - before.y, l = max(0.000001, hypot(dx, dy)), d = CGPoint(x: dx / l, y: dy / l), q = CGPoint(x: -d.y, y: d.x)
            let w = taper == 0 ? weight : weight * max(0.12, 1 + taper)
            context.setFillColor(ink); context.setStrokeColor(ink); glowing(ink)
            if cap == 2 {
                let head = CGMutablePath()
                head.addLines(between: [CGPoint(x: tip.x + d.x * w * 1.7, y: tip.y + d.y * w * 1.7), CGPoint(x: tip.x + q.x * w * 1.4, y: tip.y + q.y * w * 1.4), CGPoint(x: tip.x - q.x * w * 1.4, y: tip.y - q.y * w * 1.4)]); head.closeSubpath()
                if outline { context.setLineWidth(max(unit * 0.0018, w * 0.09)); context.addPath(head); context.strokePath() } else { context.addPath(head); context.fillPath() }
            } else if cap == 3 {
                let head = CGPoint(x: tip.x + d.x * w * 0.35, y: tip.y + d.y * w * 0.35)
                var t = CGAffineTransform(translationX: head.x, y: head.y).rotated(by: atan2(d.y, d.x))
                let skull = CGPath(ellipseIn: CGRect(x: -w * 0.95, y: -w * 0.72, width: w * 1.9, height: w * 1.44), transform: &t)
                if outline { context.setLineWidth(max(unit * 0.0018, w * 0.09)); context.addPath(skull); context.strokePath() } else { context.addPath(skull); context.fillPath() }
                let root = CGPoint(x: head.x + d.x * w * 0.9, y: head.y + d.y * w * 0.9), fork = CGPoint(x: root.x + d.x * w * 0.8, y: root.y + d.y * w * 0.8)
                context.setLineWidth(max(unit * 0.002, w * 0.16)); context.setLineCap(.round)
                context.move(to: root); context.addLine(to: fork)
                for side in [-1.0, 1.0] { context.move(to: fork); context.addLine(to: CGPoint(x: fork.x + (d.x * 0.85 + q.x * side * 0.5) * w * 0.8, y: fork.y + (d.y * 0.85 + q.y * side * 0.5) * w * 0.8)) }
                context.strokePath()
            }
            context.setShadow(offset: .zero, blur: 0, color: nil)
        }
        func copyOnBand(_ points: [CGPoint], color: CGColor) {
            guard pass.full, finished, !outline, count("bandCopy", 0, 0, 1) == 1, points.count > 1 else { return }
            let face = font ?? FontLibrary.font(name: "HelveticaNeue-Bold")
            let reading = points[0].x <= points[points.count - 1].x ? points : points.reversed()
            context.setFillColor(OrbitWrapGeometry.luma(color) < 0.55 ? white : black)
            context.addPath(PathType.along(reading, text: (text ?? "FORM & SPACE").uppercased() + " · ", font: face, size: weight * 0.66)); context.fillPath()
        }

        /// The construction itself, drawn once per pass.
        func construction() {
            switch layout {
            case 1, 2, 5:
                // Stripes, fins and mirrored waveforms stand in rows across the run. Depth lets the rows recede.
                let rows = copies, length = 2 * halfRun * 1.04, gamma = exp(1.1 * n("depth", 0, -1, 1))
                func edge(_ k: Int) -> Double {
                    if k < 0 { return 2 * edge(0) - edge(1) }
                    if k > rows { return 2 * edge(rows) - edge(rows - 1) }
                    return -halfCross + 2 * halfCross * pow(Double(k) / Double(rows), gamma)
                }
                let share = layout == 1 ? 0.62 : 0.48, stagger = n("stagger", 0.5, 0, 1)
                func rowWave(_ row: Int) -> [Node] {
                    let spacing = edge(row + 1) - edge(row), shift = layout == 2 && row % 2 == 0 ? stagger * 0.5 : 0
                    let wave = nodes(values, length: length, amplitude: amplitudeShare * spacing * share, pitchUnit: length / Double(teeth), seed: seed &+ UInt64(row + 1), shift: shift)
                    let step = Double(length) / Double(teeth) / 6.0
                    return abs(kappa) > 0.000001 ? densify(wave, step: step) : wave
                }
                for row in -1...rows {
                    let top = edge(row), spacing = edge(row + 1) - top, mid = top + spacing / 2, wave = rowWave(row)
                    switch layout {
                    case 1:
                        // Each stripe runs from its wave to the next row's wave: at full depth neighbours tile exactly.
                        let next = rowWave(row + 1), nextMid = edge(row + 1) + (edge(row + 2) - edge(row + 1)) / 2
                        let span = min(wave.count, next.count)
                        var faceStart = 0
                        while faceStart < span - 1 {
                            var end = faceStart + 1
                            let face = wave[faceStart].face
                            if fold == 0 && shade == 0 && inkMode != 2 && inkMode != 3 { end = span - 1 } else { while end < span - 1 && wave[end].face == face { end += 1 } }
                            let upper = (faceStart...end).map { line(wave[$0].u, mid + wave[$0].v) }
                            let lower = (faceStart...end).map { i -> CGPoint in let a = mid + wave[i].v, b = nextMid + next[i].v; return line(wave[i].u, a + fill * (b - a)) }
                            let region = CGMutablePath(); region.addLines(between: upper + lower.reversed()); region.closeSubpath()
                            let m = wave[(faceStart + end) / 2]
                            paint(region, folded(inkAt(copy: row, tooth: m.tooth, u: m.u, length: length), face), from: upper[0], to: upper[upper.count - 1])
                            faceStart = end
                        }
                    case 2:
                        // Fins: the area between the row's baseline and its wave, one fin per period, shaded base to tip.
                        let floorV = top + spacing
                        var start = 0
                        while start < wave.count - 1 {
                            var end = start + 1
                            while end < wave.count - 1 && wave[end].tooth == wave[start].tooth { end += 1 }
                            let slice = wave[start...end], tip = slice.min { $0.v < $1.v }!, region = CGMutablePath()
                            let footing = (0...8).map { line(wave[end].u + (wave[start].u - wave[end].u) * Double($0) / 8, floorV) }
                            region.addLines(between: slice.map { line($0.u, mid + $0.v) } + footing); region.closeSubpath()
                            paint(region, folded(inkAt(copy: row, tooth: wave[start].tooth, u: tip.u, length: length), wave[start].tooth), from: line(tip.u, floorV), to: line(tip.u, mid + tip.v))
                            start = end
                        }
                    default:
                        // Mirrored: the wave and its reflection about the row's axis enclose a waveform.
                        var start = 0
                        while start < wave.count - 1 {
                            var end = start + 1
                            if fold == 0 && shade == 0 && inkMode != 2 && inkMode != 3 { end = wave.count - 1 } else { while end < wave.count - 1 && wave[end].tooth == wave[start].tooth { end += 1 } }
                            let upper = (start...end).map { line(wave[$0].u, mid + wave[$0].v) }, lower = (start...end).map { line(wave[$0].u, mid - wave[$0].v) }
                            let region = CGMutablePath(); region.addLines(between: upper + lower.reversed()); region.closeSubpath()
                            let m = wave[(start + end) / 2]
                            paint(region, folded(inkAt(copy: row, tooth: m.tooth, u: m.u, length: length), m.tooth), from: line(m.u, mid), to: line(m.u, mid - abs(m.v) - spacing * 0.1))
                            start = end
                        }
                    }
                }
            case 3:
                // A ring: the wave closes round a circle, as a band, or filled solid as a sawblade or sun.
                let length = 2 * Double.pi * ringRadius, amplitude = amplitudeShare * ringRadius * 0.32
                let wave = densify(nodes(values.merging(["compression": 0]) { $1 }, length: length, amplitude: amplitude, pitchUnit: length / Double(teeth), seed: seed), step: length / Double(teeth) / 6)
                let closing = Array(wave.dropLast())
                for c in 0..<copies {
                    if fill >= 0.999 {
                        // Solid rings nest inward, each a smaller blade.
                        let radius = ringRadius * (1 - 0.82 * Double(c) / Double(copies)), scale = radius / ringRadius
                        let outer = closing.map { ring($0.u, $0.v * scale + weight / 2, length, radius) }
                        let color = inkAt(copy: c, tooth: 0, u: 0, length: length)
                        if fold == 0 && shade == 0 && inkMode != 2 && inkMode != 3 {
                            let region = CGMutablePath(); region.addLines(between: outer); region.closeSubpath()
                            paint(region, color, from: center, to: outer[0])
                        } else {
                            // Faces become rays from the centre: folded, they read as a sunburst.
                            var start = 0
                            while start < closing.count {
                                var end = start + 1
                                while end < closing.count && closing[end].face == closing[start].face { end += 1 }
                                let last = min(end, closing.count - 1)
                                let region = CGMutablePath(); region.addLines(between: [center] + (start...last).map { outer[$0] } + (end >= closing.count ? [outer[0]] : [])); region.closeSubpath()
                                let m = closing[(start + last) / 2]
                                paint(region, folded(inkAt(copy: c, tooth: m.tooth, u: m.u, length: length), closing[start].face), from: center, to: outer[last])
                                start = end
                            }
                        }
                    } else {
                        let offset = (Double(c) - Double(copies - 1) / 2) * weight * 2.3
                        let points = closing.map { ring($0.u, $0.v + offset, length, ringRadius) }
                        band(closing, points, copy: c, length: length, closed: true, heads: false)
                        if c == 0 { copyOnBand(points, color: pass.tone(inkAt(copy: 0, tooth: 0, u: 0, length: length))) }
                    }
                }
            case 4:
                // A spiral: the wave coils outward from the centre.
                let length = 2 * Double.pi * coils * ringRadius * 0.55, amplitude = amplitudeShare * ringRadius / coils * 0.3
                let wave = densify(nodes(values, length: length, amplitude: amplitude, pitchUnit: length / Double(teeth), seed: seed), step: length / Double(teeth) / 6)
                for c in 0..<copies {
                    let offset = (Double(c) - Double(copies - 1) / 2) * weight * 2.3
                    let points = wave.map { spiral($0.u, $0.v + offset, length) }
                    band(wave, points, copy: c, length: length, closed: false, heads: true)
                    if c == 0 { copyOnBand(points, color: pass.tone(inkAt(copy: 0, tooth: 0, u: 0, length: length))) }
                }
            default:
                // A spring: one band (or parallel bands) along the run. A cut spring runs off the field; a capped one
                // fits inside, with its run length solved against its swing so both ends and the head show.
                var length = 2 * halfRun * 1.04
                var amplitude = max(0, amplitudeShare * (halfCross - weight * Double(copies)) * 0.95)
                if cap != 0 {
                    let margin = weight * (cap == 3 ? 2.6 : 1.9) + weight * Double(copies - 1) * 1.2, halfW = rect.width / 2 - margin, halfH = rect.height / 2 - margin
                    amplitude = max(0, amplitudeShare * max(0, min(halfCross, fit(cross)) - margin) * 0.95)
                    func room(_ a: Double) -> Double {
                        let x = abs(run.x) > 0.001 ? (halfW - a * abs(cross.x)) / abs(run.x) : .infinity, y = abs(run.y) > 0.001 ? (halfH - a * abs(cross.y)) / abs(run.y) : .infinity
                        return min(x, y)
                    }
                    var half = room(amplitude)
                    let floorHalf = fit(run) * 0.35
                    if half < floorHalf {
                        half = floorHalf
                        let x = abs(cross.x) > 0.001 ? (halfW - half * abs(run.x)) / abs(cross.x) : .infinity, y = abs(cross.y) > 0.001 ? (halfH - half * abs(run.y)) / abs(cross.y) : .infinity
                        amplitude = max(0, min(amplitude, min(x, y)))
                    }
                    length = 2 * half
                }
                var wave = nodes(values, length: length, amplitude: amplitude, pitchUnit: length / Double(teeth), seed: seed)
                let step = Double(length) / Double(teeth) / 6.0
                if abs(kappa) > 0.000001 { wave = densify(wave, step: step) }
                guard wave.count > 1 else { return }
                for c in 0..<copies {
                    let offset = (Double(c) - Double(copies - 1) / 2) * weight * 2.3
                    let points = wave.map { line($0.u, $0.v + offset) }
                    band(wave, points, copy: c, length: length, closed: false, heads: true)
                    if c == 0 { copyOnBand(points, color: pass.tone(inkAt(copy: 0, tooth: 0, u: 0, length: length))) }
                }
            }
        }

        context.saveGState(); defer { context.restoreGState() }
        context.setLineJoin(n("corner", 0, 0, 1) > 0 ? .round : .miter); context.setMiterLimit(6)
        // Graph paper sits under the construction.
        let grid = n("grid", 0, 0, 1)
        if grid > 0 && finished {
            let step = unit / 22, path = CGMutablePath()
            var x = rect.minX; while x <= rect.maxX { path.move(to: CGPoint(x: x, y: rect.minY)); path.addLine(to: CGPoint(x: x, y: rect.maxY)); x += step }
            var y = rect.minY; while y <= rect.maxY { path.move(to: CGPoint(x: rect.minX, y: y)); path.addLine(to: CGPoint(x: rect.maxX, y: y)); y += step }
            context.setStrokeColor(inks[0].copy(alpha: 0.1 + 0.16 * grid)!); context.setLineWidth(unit * 0.0012); context.addPath(path); context.strokePath()
        }
        let extrude = finished ? n("extrude", 0, 0, 1) : 0, misregister = finished ? n("misregister", 0, 0, 1) : 0, glitch = finished ? n("glitch", 0, 0, 1) : 0
        /// The printings in order: extrusion layers from deepest up, the construction, then the second ink out of register.
        func printings() {
            if extrude > 0 {
                let depth = extrude * unit * 0.07, steps = 10
                for i in stride(from: steps, to: 0, by: -1) {
                    let t = Double(i) / Double(steps)
                    context.saveGState(); context.translateBy(x: depth * t * 0.7, y: depth * t)
                    pass = Pass(full: false, tone: { OrbitWrapGeometry.mix($0, black, 0.42 + 0.3 * t) }); construction()
                    context.restoreGState()
                }
            }
            pass = Pass(full: true, tone: { $0 }); construction()
            if misregister > 0 {
                let second = inks.count > 1 ? inks[1] : CGColor(srgbRed: 1, green: 0.17, blue: 0.6, alpha: 1)
                context.saveGState(); context.translateBy(x: misregister * unit * 0.018, y: -misregister * unit * 0.012); context.setAlpha(0.72)
                pass = Pass(full: false, tone: { _ in second }); construction()
                context.restoreGState()
            }
        }
        if glitch > 0 {
            // Glitch: the page is cut into bands and some of them slide sideways.
            var random = SeededRandom(seed: seed ^ 0x474c_4954)
            var y = rect.minY
            while y < rect.maxY {
                let h = min(rect.maxY - y, rect.height * random.value(0.02, 0.11)), slide = random.unit() < 0.5 ? 0 : random.value(-1, 1) * glitch * unit * 0.1
                context.saveGState(); context.clip(to: CGRect(x: rect.minX - unit, y: y, width: rect.width + 2 * unit, height: h)); context.translateBy(x: slide, y: 0)
                printings(); context.restoreGState()
                y += h
            }
        } else { printings() }
        return true
    }
}
