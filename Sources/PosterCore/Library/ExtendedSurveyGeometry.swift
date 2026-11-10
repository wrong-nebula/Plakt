import Foundation
import CoreGraphics
import CoreText

/// Material and silhouette grammars from the second visual-survey pass.
/// Keys added later (materials: prongs, sheen, bleed, mirroring, inversion, streams, inks, two-tone, centre block;
/// variations: direction, repeats, curvature, primitives, axis, twist, flow, arrangement, waves, lobe count/shape/spin)
/// fall back to the original behavior when a saved genome does not contain them.
enum ExtendedSurveyGeometry {
    static let operations: Set<String> = ["faceted-spire", "sliced-orb", "gravity-drips", "bilateral-soft-cross"]
    /// Type-as-material switches: the system draws the poster title itself, as letters, surface print, outline or engraving.
    static let typeKeys = ["survey-gravity-drips": "letters", "survey-sliced-orb": "surfaceType", "survey-bilateral-soft-cross": "outlineType", "survey-faceted-spire": "finType", "survey-orbit-wrap": "bandCopy", "survey-sawtooth-spring": "bandCopy", "survey-circle-pack": "letters"]
    static func carriesType(_ recipeID: String, _ values: [String: Double]) -> Bool { typeKeys[recipeID].map { (values[$0] ?? 0) >= 0.5 } ?? false }
    static func value(_ values: [String: Double], _ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double {
        let value = values[key] ?? fallback
        return value.isFinite ? min(high, max(low, value)) : fallback
    }
    /// Constructions are authored with their "top" up. A quarter turn maps that authored rect onto the field:
    /// 0 as authored, 1 flipped vertically, 2 authored top facing left, 3 facing right.
    static func orientation(_ turn: Int, rect: CGRect) -> (transform: CGAffineTransform, authored: CGRect) {
        switch turn {
        case 1: return (CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: rect.minY + rect.maxY), rect)
        case 2: return (CGAffineTransform(a: 0, b: -1, c: 1, d: 0, tx: rect.minX, ty: rect.maxY), CGRect(x: 0, y: 0, width: rect.height, height: rect.width))
        case 3: return (CGAffineTransform(a: 0, b: 1, c: -1, d: 0, tx: rect.maxX, ty: rect.minY), CGRect(x: 0, y: 0, width: rect.height, height: rect.width))
        default: return (.identity, rect)
        }
    }

    struct SpireTier { var apex: Double; var reach: Double; var tip: Double; var inner: Double }
    /// Nested chevrons in the unit field. Edge prongs push every tier's wing tips out to the outer reach and raise
    /// the deeper ones, so lower chevrons flatten and meet the edge at different heights, as in the ZHdK spire.
    static func spireTiers(_ values: [String: Double]) -> [SpireTier] {
        let folds = Int(value(values, "folds", 5, 2, 10).rounded()), spread = value(values, "spread", 0.88, 0.4, 1)
        let notch = value(values, "notch", 0.42, 0.18, 0.7), fan = value(values, "tipFan", 0, 0, 1)
        return (0..<folds).map { i in
            let t = Double(i) / Double(folds), apex = 0.025 + pow(t, 0.55) * 0.95
            let reach = (1 - t * 0.72 * (1 - fan)) * spread * 0.46
            let tip = i == 0 ? 0.97 : 0.97 - (0.97 - apex) * 0.55 * fan
            return SpireTier(apex: apex, reach: reach, tip: tip, inner: min(tip - 0.018, apex + (tip - apex) * notch))
        }
    }

    struct DripStream { var start: CGPoint; var end: CGPoint; var width: Double }
    struct DripPool { var center: CGPoint; var radius: Double; var ink: Int; var streams: [DripStream] }
    static func legacyDrips(_ values: [String: Double]) -> Bool { ["streams", "softness", "inkCount", "scatter", "arrangement", "wave", "flow", "letters"].allSatisfy { values[$0] == nil } }
    struct DripLetter { var path: CGPath; var ink: Int; var streams: [DripStream] }
    /// The title set as the pigment band, on one line or two, whichever gives larger letters. Every letter sheds
    /// streams from points along its lower silhouette (its upper one when rising), as thick as its strokes suggest.
    static func letterDrips(_ values: [String: Double], rect: CGRect, text: String, font: CTFont, rising: Bool) -> [DripLetter] {
        func n(_ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double { value(values, key, fallback, low, high) }
        let reach = n("length", 0.67, 0.24, 0.77), width = n("width", 0.014, 0.004, 0.034), wind = n("wind", 0.06, -0.2, 0.2)
        let streams = Int(n("streams", 1, 1, 14).rounded()), inkCount = Int(n("inkCount", 1, 1, 5).rounded()), unit = min(rect.width, rect.height)
        var detail = SeededRandom(seed: UInt64(n("shapeSeed", 817, 0, 9_000_000)) ^ 0x4c45_5454)
        func glyphs(_ string: String) -> [CGPath] {
            let line = CTLineCreateWithAttributedString(NSAttributedString(string: string, attributes: [.font: font]))
            var out: [CGPath] = []
            for run in CTLineGetGlyphRuns(line) as! [CTRun] {
                let count = CTRunGetGlyphCount(run)
                var ids = [CGGlyph](repeating: 0, count: count), positions = [CGPoint](repeating: .zero, count: count)
                CTRunGetGlyphs(run, CFRange(location: 0, length: count), &ids); CTRunGetPositions(run, CFRange(location: 0, length: count), &positions)
                let runFont = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
                for i in 0..<count { if let g = CTFontCreatePathForGlyph(runFont, ids[i], nil), !g.boundingBoxOfPath.isEmpty { var t = CGAffineTransform(translationX: positions[i].x, y: positions[i].y); if let placed = g.copy(using: &t) { out.append(placed) } } }
            }
            return out
        }
        // One line, or two broken at the word boundary nearest the middle.
        let words = text.split(separator: " ").map(String.init)
        var options = [[text]]
        if words.count > 1 {
            let half = text.count / 2, k = (1..<words.count).min { abs(words[..<$0].joined(separator: " ").count - half) < abs(words[..<$1].joined(separator: " ").count - half) }!
            options.append([words[..<k].joined(separator: " "), words[k...].joined(separator: " ")])
        }
        var best: (scale: Double, lines: [[CGPath]], boxes: [CGRect]) = (0, [], [])
        for option in options {
            let lines = option.map(glyphs), boxes = lines.map { $0.reduce(CGRect.null) { $0.union($1.boundingBoxOfPath) } }
            guard boxes.allSatisfy({ !$0.isNull && $0.width > 0 }) else { continue }
            let widest = boxes.map(\.width).max()!, tall = boxes.map(\.height).max()!, stack = tall * (Double(lines.count) + 0.2 * Double(lines.count - 1))
            let scale = min(rect.width * 0.9 / widest, rect.height * 0.3 / stack)
            if scale > best.scale { best = (scale, lines, boxes) }
        }
        guard best.scale > 0 else { return [] }
        let tall = best.boxes.map(\.height).max()! * best.scale, gap = tall * 0.2, block = tall * Double(best.lines.count) + gap * Double(best.lines.count - 1)
        let top = rising ? rect.maxY - rect.height * 0.05 - block : rect.minY + rect.height * 0.05
        var placed: [CGPath] = []
        for (row, line) in best.lines.enumerated() {
            let box = best.boxes[row], x0 = rect.minX + (rect.width - box.width * best.scale) / 2, y0 = top + Double(row) * (tall + gap)
            var t = CGAffineTransform(translationX: x0, y: y0).scaledBy(x: best.scale, y: -best.scale).translatedBy(x: -box.minX, y: -box.maxY)
            placed += line.compactMap { $0.copy(using: &t) }
        }
        return placed.enumerated().map { k, path in
            let box = path.boundingBoxOfPath, contours = SurveyTypeGeometry.contours(path), stroke = max(width * unit, tall * 0.05)
            var list: [DripStream] = []
            for _ in 0..<min(14, max(2, Int((Double(streams) * box.width / (unit * 0.05)).rounded()))) {
                // Outermost ink under (or over) a sampled column of the letter: where a drip would leave it.
                let x = detail.value(box.minX + box.width * 0.04, box.maxX - box.width * 0.04)
                var edge = rising ? Double.infinity : -Double.infinity
                for c in contours where c.count > 1 { for i in 1..<c.count { let p = c[i - 1], q = c[i]; if (p.x - x) * (q.x - x) <= 0, p.x != q.x { let y = p.y + (x - p.x) * (q.y - p.y) / (q.x - p.x); edge = rising ? min(edge, y) : max(edge, y) } } }
                guard edge.isFinite else { continue }
                let sy = (edge - rect.minY) / rect.height, run = reach * 1.1 * pow(detail.unit(), 0.45), sx = (x - rect.minX) / rect.width
                let ey = rising ? max(-0.02, sy - run) : min(1.02, sy + run), w = stroke * detail.value(0.35, 0.8)
                list.append(DripStream(start: CGPoint(x: x, y: edge + (rising ? w : -w)), end: CGPoint(x: rect.minX + (sx + wind * abs(ey - sy)) * rect.width, y: rect.minY + ey * rect.height), width: w))
            }
            return DripLetter(path: path, ink: k % max(1, inkCount), streams: list)
        }
    }
    /// Pools keep the original main random stream (crest jitter, radius, reach, width); scatter, arrangement, ink
    /// fields and the streams that run from each pool's lower rim draw from a separate stream. `rect` is authored
    /// with gravity pointing down; flow turns it afterwards.
    static func dripLayout(_ values: [String: Double], rect: CGRect) -> [DripPool] {
        func n(_ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double { value(values, key, fallback, low, high) }
        func count(_ key: String, _ fallback: Int, _ low: Int, _ high: Int) -> Int { Int(n(key, Double(fallback), Double(low), Double(high)).rounded()) }
        let total = count("count", 13, 4, 28), pool = n("pool", 0.115, 0.045, 0.18), reach = n("length", 0.67, 0.24, 0.77)
        let width = n("width", 0.014, 0.004, 0.034), wind = n("wind", 0.06, -0.2, 0.2), streams = count("streams", 1, 1, 14)
        let inkCount = count("inkCount", 1, 1, 5), scatter = n("scatter", 0, 0, 1), arrangement = count("arrangement", 0, 0, 3)
        let unit = min(rect.width, rect.height)
        func p(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: rect.minX + x * rect.width, y: rect.minY + y * rect.height) }
        let seed = UInt64(n("shapeSeed", 817, 0, 9_000_000))
        var rng = SeededRandom(seed: seed), detail = SeededRandom(seed: seed ^ 0x4452_4950)
        var pools: [DripPool] = []
        for i in 0..<total {
            let t = Double(i) / Double(total - 1)
            var x = 0.12 + t * 0.76 + scatter * detail.value(-0.035, 0.035)
            var y = 0.15 + 0.055 * sin(t * Double.pi * 2 * 1.3) + rng.value(-0.025, 0.025) + scatter * detail.value(-0.05, 0.17)
            var size = 1.0
            // Arrangements: one dominant pool with satellites, two staggered rows, or a loose cloud.
            switch arrangement {
            case 1:
                if i == 0 { x = 0.5; y = 0.2; size = 2.4 }
                else { let a = Double(i) / Double(total - 1) * Double.pi * 2 + detail.value(-0.2, 0.2), d = pool * 2.6; x = 0.5 + cos(a) * d * unit / rect.width; y = 0.2 + sin(a) * d * 0.7 * unit / rect.height; size = 0.55 }
            case 2: y = (i % 2 == 0 ? 0.11 : 0.3) + detail.value(-0.02, 0.02); x = 0.1 + t * 0.8
            case 3: x = detail.value(0.1, 0.9); y = detail.value(0.08, 0.42)
            default: break
            }
            let center = p(x, y), raw = pool * rng.value(0.65, 1.05) * unit * (1 + scatter * detail.value(-0.3, 0.45)) * size
            let radius = max(0.001, min(raw, min(center.x - rect.minX, rect.maxX - center.x) * 0.94, (center.y - rect.minY) * 0.94))
            let endY = min(0.965, y + reach * rng.value(0.48, 1)), w = width * unit * rng.value(0.6, 1.3)
            // Inks occupy broad side-by-side regions that blur where they meet, like sprayed colour fields.
            let ink = min(inkCount - 1, max(0, Int(floor((arrangement == 3 ? x : t) * Double(inkCount) + detail.value(-0.4, 0.4)))))
            var list: [DripStream] = []
            if streams == 1 { list = [DripStream(start: center, end: p(min(0.97, max(0.03, x + wind * (endY - y))), endY), width: w)] }
            else {
                for _ in 0..<max(1, Int((Double(streams) * radius / (pool * 0.85 * unit)).rounded())) {
                    let a = detail.value(-1.15, 1.15), start = CGPoint(x: center.x + sin(a) * radius * 0.9, y: center.y + cos(a) * radius * 0.9)
                    let sx = (start.x - rect.minX) / rect.width, sy = (start.y - rect.minY) / rect.height
                    // Long-tailed reach: most streams run far, a few stop short, the longest leave the field.
                    let ey = min(1.02, sy + reach * 1.1 * pow(detail.unit(), 0.45))
                    list.append(DripStream(start: start, end: p(sx + wind * (ey - sy) + detail.value(-0.006, 0.006), ey), width: w * detail.value(0.35, 1)))
                }
            }
            pools.append(DripPool(center: center, radius: radius, ink: ink, streams: list))
        }
        return pools
    }

    struct CrossForm { var lobes: Double; var exponent: Double; var spin: Double; var neck: Double; var bulge: Double; var scale: Double }
    static func crossForm(_ values: [String: Double]) -> CrossForm {
        let neck = value(values, "neck", 0.2, 0.11, 0.3), bulge = value(values, "bulge", 0.7, 0.22, 1), lobes = value(values, "lobes", 4, 3, 8).rounded()
        return CrossForm(lobes: lobes, exponent: 1 / (1 + 2 * value(values, "lobeShape", 0, 0, 1)), spin: value(values, "spin", 0, 0, 0.5) * 2 * Double.pi / lobes,
                         neck: neck, bulge: bulge, scale: 0.45 * value(values, "bodyScale", 1, 0.5, 1.2) / (neck + bulge * 0.36))
    }
    /// Polar silhouette radius (in units of the field's short side). Lobes peak where cos(lobes·(a−spin)) = −1;
    /// an exponent below 1 flattens their crowns into squarer lobes.
    static func crossRadius(_ f: CrossForm, _ a: Double) -> Double {
        if f.exponent == 1 { return (f.neck + f.bulge * 0.18 * (1 - cos(f.lobes * (a - f.spin)))) * f.scale }
        return (f.neck + f.bulge * 0.36 * pow((1 - cos(f.lobes * (a - f.spin))) / 2, f.exponent)) * f.scale
    }

    static func draw(_ operation: String, rect: CGRect, context: CGContext, values: [String: Double], ink: CGColor, inks: [CGColor] = [], text: String? = nil, font: CTFont? = nil, stage: ConstructionStage) -> Bool {
        guard operations.contains(operation) else { return false }
        // Specimens carry no brief: they spell the specimen title.
        let title = text ?? "FORM SPACE", face = font ?? FontLibrary.font(name: "HelveticaNeue-Bold")
        func n(_ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double { value(values, key, fallback, low, high) }
        func count(_ key: String, _ fallback: Int, _ low: Int, _ high: Int) -> Int { Int(n(key, Double(fallback), Double(low), Double(high)).rounded()) }
        let unit = min(rect.width, rect.height), tau = Double.pi * 2
        let white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1), black = CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 1)
        func p(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: rect.minX + x * rect.width, y: rect.minY + y * rect.height) }
        func gradient(_ colors: [CGColor], _ locations: [CGFloat]) -> CGGradient? { CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: colors as CFArray, locations: locations) }
        func tonal(_ bounds: CGRect, light: CGPoint, contrast: Double, color: CGColor? = nil) {
            let base = color ?? ink
            guard let low = base.copy(alpha: 0.10 + (1 - contrast) * 0.22), let high = base.copy(alpha: 1),
                  let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [low, high] as CFArray, locations: [0, 1]) else { return }
            context.drawRadialGradient(gradient, startCenter: light, startRadius: 0, endCenter: light, endRadius: max(bounds.width, bounds.height) * 0.65, options: [.drawsAfterEndLocation])
        }
        context.saveGState(); defer { context.restoreGState() }
        context.setFillColor(ink); context.setStrokeColor(ink)
        switch operation {
        case "faceted-spire":
            let spine = n("spine", 0.5, 0.32, 0.68), facets = n("facets", 0.55, 0, 1), sheen = n("sheen", 0, 0, 1)
            let curve = n("curve", 0, 0, 1), spires = count("spires", 1, 1, 3), oriented = orientation(count("direction", 0, 0, 3), rect: rect)
            context.concatenate(oriented.transform)
            let tiers = spireTiers(values)
            // Repeated spires share the authored field side by side; each keeps its own two faces.
            for s in 0..<spires {
                let a = oriented.authored, cell = CGRect(x: a.minX + a.width * Double(s) / Double(spires), y: a.minY, width: a.width / Double(spires), height: a.height)
                func q(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: cell.minX + x * cell.width, y: cell.minY + y * cell.height) }
                let foldsPath = CGMutablePath()
                for tier in tiers {
                    let apex = q(spine, tier.apex), left = q(spine - tier.reach, tier.tip), right = q(spine + tier.reach, tier.tip), notch = q(spine, tier.inner)
                    // Curved fins bow each outer edge in toward the fold axis.
                    func bow(_ tip: CGPoint) -> CGPoint { CGPoint(x: (apex.x + tip.x) / 2 + (apex.x - tip.x) / 2 * curve * 0.55, y: (apex.y + tip.y) / 2 + (tip.y - apex.y) * curve * 0.12) }
                    foldsPath.move(to: apex)
                    if curve > 0 { foldsPath.addQuadCurve(to: left, control: bow(left)) } else { foldsPath.addLine(to: left) }
                    foldsPath.addLine(to: notch); foldsPath.addLine(to: right)
                    if curve > 0 { foldsPath.addQuadCurve(to: apex, control: bow(right)) }
                    foldsPath.closeSubpath()
                }
                // A shared even-odd silhouette preserves the negative folds. Painting
                // each triangle separately would fill earlier cutouts back in.
                for right in [false, true] {
                    context.saveGState()
                    let axis = q(spine, 0).x, alpha = right ? 1 - facets * 0.65 : 1
                    context.clip(to: CGRect(x: right ? axis : cell.minX, y: cell.minY, width: right ? cell.maxX - axis : axis - cell.minX, height: cell.height))
                    if sheen > 0 && stage != .blockout {
                        // Metal: a lit band along the fold falls off toward the wing tips; the far face reverses it.
                        let light = ShapeMaterials.mix(ink, white, 0.55 * sheen).copy(alpha: alpha)!, mid = ink.copy(alpha: alpha)!, dark = ShapeMaterials.mix(ink, black, 0.4 * sheen).copy(alpha: alpha)!
                        let tip = q(spine + (right ? 1 : -1) * (tiers.first?.reach ?? 0.4), 0.97)
                        context.addPath(foldsPath); context.clip(using: .evenOdd)
                        if let g = gradient(right ? [dark, mid, light] : [light, mid, dark], [0, 0.5, 1]) { context.drawLinearGradient(g, start: q(spine, 0.025), end: tip, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]) }
                    } else {
                        context.setFillColor(ink.copy(alpha: alpha) ?? ink)
                        context.addPath(foldsPath); context.drawPath(using: .eoFill)
                    }
                    context.restoreGState()
                }
                if n("finType", 0, 0, 1) >= 0.5 && stage != .blockout, let outer = tiers.first {
                    // Engraved title: runs up the left fin and down the right one, just inside each outer edge,
                    // letter tops toward the edge, cut into the metal in a lighter (or darker) tone of the ink.
                    let apex = q(spine, outer.apex), em = min(cell.width, cell.height) * 0.05
                    func edge(_ from: CGPoint, _ to: CGPoint) -> [CGPoint] {
                        let tip = from == apex ? to : from
                        let control = CGPoint(x: (apex.x + tip.x) / 2 + (apex.x - tip.x) / 2 * curve * 0.55, y: (apex.y + tip.y) / 2 + (tip.y - apex.y) * curve * 0.12)
                        return (0...40).map { i -> CGPoint in
                            let t: Double = Double(i) / 40, s: Double = 1 - t, a: Double = s * s, b: Double = 2 * s * t, c: Double = t * t
                            let x: Double = a * from.x + b * control.x + c * to.x, y: Double = a * from.y + b * control.y + c * to.y
                            return CGPoint(x: x, y: y)
                        }
                    }
                    let lightness = ink.components.map { $0.count >= 3 ? 0.2126 * $0[0] + 0.7152 * $0[1] + 0.0722 * $0[2] : 0 } ?? 0
                    let engraved = ShapeMaterials.mix(ink, lightness > 0.5 ? black : white, 0.62)
                    // Set in page space so a turned or flipped spire still reads left to right, on each fin's inner side.
                    let interior = q(spine, 0.62).applying(oriented.transform), letters = CGMutablePath()
                    for fin in [edge(q(spine - outer.reach, outer.tip), apex), edge(apex, q(spine + outer.reach, outer.tip))] {
                        var line = fin.map { $0.applying(oriented.transform) }
                        if let first = line.first, let last = line.last, last.x < first.x - 0.000001 { line.reverse() }
                        let a = line[0], b = line[line.count - 1], side = (b.x - a.x) * (interior.y - a.y) - (b.y - a.y) * (interior.x - a.x)
                        letters.addPath(PathType.along(line, text: title, font: face, size: em, lift: side < 0 ? em * 0.95 : -em * 0.95))
                    }
                    context.saveGState(); context.addPath(foldsPath); context.clip(using: .evenOdd); context.concatenate(oriented.transform.inverted())
                    context.setFillColor(engraved); context.addPath(letters); context.fillPath(); context.restoreGState()
                }
            }
        case "sliced-orb":
            let slices = count("slices", 6, 2, 12), meridians = count("meridians", 7, 3, 15)
            let displacement = n("displacement", 0.09, 0, 0.24), phase = n("phase", 0.6, -1.2, 1.2)
            let gap = n("gap", 0, 0, 0.045), light = n("light", 0, -0.8, 0.8)
            let stack = count("stack", 1, 1, 3), flatten = n("flatten", 0.9, 0.35, 1.2), bleed = n("bleed", 1, 1, 1.7)
            let mirror = n("mirror", 0, 0, 1) >= 0.5, invert = n("invert", 0, 0, 1) >= 0.5
            let primitive = count("primitive", 0, 0, 2), twist = n("twist", 0, -1, 1)
            // Side-by-side stacking authors the vertical stack and turns it a quarter.
            let oriented = orientation(count("axis", 0, 0, 1) == 1 ? 2 : 0, rect: rect), a = oriented.authored
            context.concatenate(oriented.transform)
            let second = inks.count > 1 ? inks[1] : CGColor(srgbRed: 0.96, green: 0.95, blue: 0.91, alpha: 1)
            // Inverted volumes are always dark and lit by the lighter ink, whichever of the two is the shape colour,
            // so dark posters get FUBU's black-on-black volumes with white wireframe.
            func lightness(_ c: CGColor) -> Double { let v = c.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil)?.components ?? [0, 0, 0]; return v.count >= 3 ? 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] : 0 }
            let ground = lightness(ink) <= lightness(second) ? ink : second, paper = lightness(ink) <= lightness(second) ? second : ink
            let volumeHeight = unit * flatten
            // Overscale crops the volumes at the field edges, so they read as wider than the paper.
            let volumeWidth = unit * (values["stack"] == nil ? 0.72 : 0.98) * bleed
            let band = volumeHeight / Double(slices)
            // Ellipsoid, barrel (flat flanks, round ends) or lens (two arcs meeting at sharp ends).
            func outline(_ o: CGRect) -> CGPath {
                switch primitive {
                case 1: return CGPath(roundedRect: o, cornerWidth: min(o.width * 0.2, o.height / 2), cornerHeight: o.height / 2, transform: nil)
                case 2:
                    let path = CGMutablePath(); path.move(to: CGPoint(x: o.minX, y: o.midY))
                    path.addQuadCurve(to: CGPoint(x: o.maxX, y: o.midY), control: CGPoint(x: o.midX, y: o.minY - o.height * 0.5))
                    path.addQuadCurve(to: CGPoint(x: o.minX, y: o.midY), control: CGPoint(x: o.midX, y: o.maxY + o.height * 0.5)); path.closeSubpath(); return path
                default: return CGPath(ellipseIn: o, transform: nil)
                }
            }
            for volume in 0..<stack {for i in 0..<slices {
                context.saveGState()
                let cy = a.midY + (Double(volume) - Double(stack - 1) / 2) * volumeHeight
                let top = cy - volumeHeight / 2 + Double(i) * band
                context.clip(to: CGRect(x: a.minX, y: top + gap * a.height / 2, width: a.width, height: max(0.001, band - gap * a.height)))
                let shift = sin(Double(i) * 1.7 + phase) * displacement * unit
                let orb = CGRect(x: a.midX - volumeWidth / 2 + shift, y: cy - volumeHeight / 2, width: volumeWidth, height: volumeHeight)
                context.addPath(outline(orb)); context.clip()
                if stage == .blockout { context.fill(orb) }
                else {
                    func shade(_ x: Double) {
                        let spot = CGPoint(x: x, y: orb.minY + orb.height * 0.3)
                        if invert {
                            if let g = gradient([paper.copy(alpha: 0.9)!, paper.copy(alpha: 0.35)!, paper.copy(alpha: 0)!], [0, 0.35, 1]) { context.drawRadialGradient(g, startCenter: spot, startRadius: 0, endCenter: spot, endRadius: min(orb.width, orb.height) * 0.42, options: []) }
                        } else { tonal(orb, light: spot, contrast: 0.9) }
                    }
                    if invert { context.setFillColor(ground); context.fill(orb) }
                    if mirror {
                        // Mirrored halves: each side lit symmetrically about the centre; light sets how far apart the two glows sit.
                        for side in [-1.0, 1.0] {
                            context.saveGState()
                            context.clip(to: CGRect(x: side < 0 ? orb.minX : orb.midX, y: orb.minY, width: orb.width / 2, height: orb.height))
                            shade(orb.midX + side * orb.width * (0.22 + light * 0.14)); context.restoreGState()
                        }
                    } else { shade(orb.midX + light * orb.width * 0.4) }
                    let line = invert ? paper : ink
                    context.setStrokeColor(line.copy(alpha: invert ? 0.6 : 0.55) ?? line); context.setLineWidth(unit * 0.0028)
                    // Twist shears the wireframe slice by slice, as if the volume were wrung about its axis.
                    let skew = twist * (Double(i) - Double(slices - 1) / 2) / Double(slices) * orb.width * 0.18
                    for j in 0..<meridians {
                        let latitude = (Double(j) + 0.5) / Double(meridians)
                        switch primitive {
                        case 1:
                            let x = orb.midX + skew + cos(Double.pi * latitude) * orb.width * 0.47
                            context.move(to: CGPoint(x: x, y: orb.minY)); context.addLine(to: CGPoint(x: x, y: orb.maxY)); context.strokePath()
                        case 2:
                            let control = orb.minY - orb.height * 0.5 + latitude * orb.height * 2
                            context.move(to: CGPoint(x: orb.minX, y: orb.midY)); context.addQuadCurve(to: CGPoint(x: orb.maxX, y: orb.midY), control: CGPoint(x: orb.midX + skew, y: control)); context.strokePath()
                        default:
                            let oval = CGRect(x: orb.midX + skew - orb.width * latitude / 2, y: orb.minY, width: orb.width * latitude, height: orb.height)
                            context.strokeEllipse(in: oval)
                        }
                    }
                    for j in 1..<6 {
                        let y = orb.minY + orb.height * Double(j) / 6
                        if primitive == 0 { context.strokeEllipse(in: CGRect(x: orb.minX, y: y - orb.height * 0.065, width: orb.width, height: orb.height * 0.13)) }
                        else if primitive == 1 { context.move(to: CGPoint(x: orb.minX, y: y)); context.addLine(to: CGPoint(x: orb.maxX, y: y)); context.strokePath() }
                        else { let x = orb.minX + orb.width * Double(j) / 6 + skew; context.move(to: CGPoint(x: x, y: orb.minY)); context.addLine(to: CGPoint(x: x, y: orb.maxY)); context.strokePath() }
                    }
                    if n("surfaceType", 0, 0, 1) >= 0.5 {
                        // Title printed round the volume: each slice carries one line, wrapped over the visible half so
                        // letters narrow toward the rims, the way print foreshortens on a globe, barrel or lens.
                        func halfWidth(_ y: Double) -> Double {
                            let k = max(0, 1 - pow((y - cy) / (volumeHeight / 2), 2))
                            return primitive == 1 ? orb.width / 2 : primitive == 2 ? orb.width / 2 * k : orb.width / 2 * sqrt(k)
                        }
                        let bandTop = top + gap * a.height / 2, bandHeight = max(0.001, band - gap * a.height), unitLine = title + "   "
                        let sample = SurveyTypeGeometry.outline(unitLine, font: face).boundingBoxOfPath
                        // The visible half of the surface is about π/2 widths long; the line's height sets one repeat's length.
                        let arc: Double = Double.pi / 2 * orb.width * 0.96, aspect: Double = sample.width / max(1, sample.height)
                        let repeats = max(1, Int((arc / max(0.0001, bandHeight * 0.62 * aspect)).rounded()))
                        let shifted = String(repeating: unitLine, count: repeats + 1).dropFirst((i * 3 + volume * 5) % max(1, unitLine.count)).prefix(unitLine.count * repeats)
                        let path = SurveyTypeGeometry.outline(String(shifted), font: face), b = path.boundingBoxOfPath, printed = CGMutablePath()
                        if b.width > 0, b.height > 0 {
                            for contour in SurveyTypeGeometry.contours(path) where contour.count > 2 {
                                let mapped = contour.map { g -> CGPoint in
                                    let u = (g.x - b.minX) / b.width, v = 1 - (g.y - b.minY) / b.height
                                    let y = bandTop + bandHeight * (0.19 + 0.62 * v)
                                    return CGPoint(x: orb.midX + skew * 0.5 + sin((u - 0.5) * Double.pi * 0.96) * halfWidth(y), y: y)
                                }
                                printed.addLines(between: mapped); printed.closeSubpath()
                            }
                            context.setFillColor(line.copy(alpha: 0.92) ?? line); context.addPath(printed); context.fillPath()
                        }
                    }
                }
                context.restoreGState()
            }}
        case "gravity-drips":
            let total = count("count", 13, 4, 28), pool = n("pool", 0.115, 0.045, 0.18)
            let length = n("length", 0.67, 0.24, 0.77), width = n("width", 0.014, 0.004, 0.034)
            let wind = n("wind", 0.06, -0.2, 0.2), taper = n("taper", 0.55, 0.15, 0.85)
            context.setLineCap(.round)
            guard !legacyDrips(values) else {
                var rng = SeededRandom(seed: UInt64(n("shapeSeed", 817, 0, 9_000_000)))
                for i in 0..<total {
                    let t = Double(i) / Double(total - 1), x = 0.12 + t * 0.76
                    let y = 0.15 + 0.055 * sin(t * tau * 1.3) + rng.value(-0.025, 0.025)
                    let center = p(x, y)
                    let rawRadius = pool * rng.value(0.65, 1.05) * unit
                    let sideClearance=min(center.x-rect.minX,rect.maxX-center.x)*0.94
                    let radius=min(rawRadius,sideClearance,(center.y-rect.minY)*0.94)
                    context.fillEllipse(in: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
                    let endY = min(0.965, y + length * rng.value(0.48, 1)), endX = min(0.97, max(0.03, x + wind * (endY - y)))
                    // Contiguous tapered stream, beginning inside its own pigment pool.
                    let w = width * unit * rng.value(0.6, 1.3), end = p(endX, endY)
                    let path = CGMutablePath(); path.move(to: CGPoint(x: center.x - w, y: center.y))
                    path.addCurve(to: CGPoint(x: end.x - w * taper, y: end.y), control1: CGPoint(x: center.x - w, y: center.y + rect.height * 0.2), control2: CGPoint(x: end.x - w * taper, y: end.y - rect.height * 0.1))
                    path.addLine(to: CGPoint(x: end.x + w * taper, y: end.y))
                    path.addCurve(to: CGPoint(x: center.x + w, y: center.y), control1: CGPoint(x: end.x + w * taper, y: end.y - rect.height * 0.1), control2: CGPoint(x: center.x + w, y: center.y + rect.height * 0.2))
                    path.closeSubpath(); context.addPath(path); context.fillPath()
                    context.fillEllipse(in: CGRect(x: end.x - w * taper, y: end.y - w * taper, width: w * taper * 2, height: w * taper * 2))
                }
                return true
            }
            // Flow turns the gravity-down authoring: 0 down, 1 up, 2 right, 3 left. Letters stay upright and only rise or fall.
            let flow = count("flow", 0, 0, 3), lettering = n("letters", 0, 0, 1) >= 0.5
            let oriented = orientation(lettering ? 0 : flow, rect: rect)
            context.concatenate(oriented.transform)
            let softness = n("softness", 0, 0, 1), wave = n("wave", 0, 0, 1)
            func color(_ index: Int) -> CGColor { inks.isEmpty ? ink : inks[index % inks.count] }
            func pour(_ s: DripStream, _ k: Int, _ j: Int) {
                // Signed run: rising letters pour upward with the same curve, mirrored.
                let w = s.width, rise = s.end.y - s.start.y, run = rise >= 0 ? max(1, rise) : min(-1, rise), path = CGMutablePath()
                if wave > 0 {
                    // Wavy streams meander sideways as they fall; the outline follows the centre line on both sides.
                    let phase = Double(k * 7 + j) * 1.3, steps = 28
                    let centre = (0...steps).map { i -> (CGPoint, Double) in
                        let f = Double(i) / Double(steps), drift = sin(phase + f * Double.pi * 3) * wave * unit * 0.018 * f
                        return (CGPoint(x: s.start.x + (s.end.x - s.start.x) * f + drift, y: s.start.y + (s.end.y - s.start.y) * f), w * (1 - f * (1 - taper)))
                    }
                    path.move(to: CGPoint(x: centre[0].0.x - centre[0].1, y: centre[0].0.y))
                    for (point, half) in centre.dropFirst() { path.addLine(to: CGPoint(x: point.x - half, y: point.y)) }
                    for (point, half) in centre.reversed() { path.addLine(to: CGPoint(x: point.x + half, y: point.y)) }
                } else {
                    path.move(to: CGPoint(x: s.start.x - w, y: s.start.y))
                    path.addCurve(to: CGPoint(x: s.end.x - w * taper, y: s.end.y), control1: CGPoint(x: s.start.x - w, y: s.start.y + run * 0.35), control2: CGPoint(x: s.end.x - w * taper, y: s.end.y - run * 0.25))
                    path.addLine(to: CGPoint(x: s.end.x + w * taper, y: s.end.y))
                    path.addCurve(to: CGPoint(x: s.start.x + w, y: s.start.y), control1: CGPoint(x: s.end.x + w * taper, y: s.end.y - run * 0.25), control2: CGPoint(x: s.start.x + w, y: s.start.y + run * 0.35))
                }
                path.closeSubpath(); context.addPath(path); context.fillPath()
                let bead = w * max(taper, 0.5) * 1.25, tail = wave > 0 ? CGPoint(x: s.end.x + sin(Double(k * 7 + j) * 1.3 + Double.pi * 3) * wave * unit * 0.018, y: s.end.y) : s.end
                context.fillEllipse(in: CGRect(x: tail.x - bead, y: tail.y - bead, width: bead * 2, height: bead * 2))
            }
            if lettering {
                // The title's own letters are the pigment: each bleeds from its lower edges in its own ink.
                let letters = letterDrips(values, rect: oriented.authored, text: title, font: face, rising: flow == 1)
                for (k, letter) in letters.enumerated() { context.setFillColor(color(letter.ink)); for (j, s) in letter.streams.enumerated() { pour(s, k, j) } }
                for letter in letters { context.setFillColor(color(letter.ink)); context.addPath(letter.path); context.fillPath() }
                return true
            }
            let layout = dripLayout(values, rect: oriented.authored)
            // Streams first, so each emerges from under the rim of its pool.
            for (k, pool) in layout.enumerated() { context.setFillColor(color(pool.ink)); for (j, s) in pool.streams.enumerated() { pour(s, k, j) } }
            for pool in layout {
                let c = color(pool.ink), r = pool.radius
                if softness > 0 && stage != .blockout {
                    // Sprayed pools: an opaque core feathering past the nominal radius.
                    let outer = r * (1 + 0.3 * softness)
                    if let g = gradient([c, c, c.copy(alpha: 0)!], [0, CGFloat(r * (1 - 0.5 * softness) / outer), 1]) { context.drawRadialGradient(g, startCenter: pool.center, startRadius: 0, endCenter: pool.center, endRadius: outer, options: []) }
                } else { context.setFillColor(c); context.fillEllipse(in: CGRect(x: pool.center.x - r, y: pool.center.y - r, width: r * 2, height: r * 2)) }
            }
        case "bilateral-soft-cross":
            let stretch = n("stretch", 1.03, 0.65, 1.4), stem = n("stem", 0.12, 0, 0.5)
            let bodyScale=n("bodyScale",1,0.5,1.2),centerY=n("centerY",0.5,0.28,0.6),stemWidth=n("stemWidth",0.036,0.02,0.16)
            let glow = n("glow", 0.65, 0, 1), twoTone = n("twoTone", 0, 0, 1), centre = n("centre", 0, 0, 0.6), round = n("centreRound", 0.3, 0, 0.5)
            let coreInk = inks.count > 1 ? inks[1] : ink, headInk = inks.count > 2 ? inks[2] : coreInk
            let form = crossForm(values)
            let path = CGMutablePath()
            for i in 0..<360 {
                let a = Double(i) / 360 * tau, radius = crossRadius(form, a)
                let x = rect.midX + cos(a) * radius * unit / max(1, stretch)
                let y = rect.minY+rect.height*centerY + sin(a) * radius * unit * min(1, stretch)
                if i == 0 { path.move(to: CGPoint(x:x,y:y)) } else { path.addLine(to:CGPoint(x:x,y:y)) }
            }
            path.closeSubpath()
            let cy = rect.minY + rect.height * centerY
            let stemRect = CGRect(x: rect.midX-unit*stemWidth/2,y:cy,width:unit*stemWidth,height:rect.height*(0.2+stem))
            if stem > 0 && centre == 0 { context.fill(stemRect) }
            context.saveGState(); context.addPath(path); context.clip()
            if stage != .blockout && twoTone > 0 {
                // Hot core cooling to the lobe tips, like the source's red centre inside pink lobes.
                let core = ShapeMaterials.mix(ink, coreInk, twoTone), center = CGPoint(x: rect.midX, y: cy)
                if let g = gradient([core, core, ink], [0, CGFloat(0.12 + 0.5 * glow), 1]) { context.drawRadialGradient(g, startCenter: center, startRadius: 0, endCenter: center, endRadius: 0.45 * bodyScale * unit * 1.05, options: [.drawsAfterEndLocation]) }
            }
            else if stage != .blockout && glow > 0 { tonal(rect, light: p(0.5, 0.4), contrast: glow) }
            else {context.setFillColor(ink);context.fill(rect)}
            context.restoreGState()
            if centre > 0 {
                // A rounded block and its stem in the third ink sit over the body, as the teal head does in the source.
                context.setFillColor(stage == .blockout ? ink : headInk)
                if stem > 0 { context.fill(stemRect) }
                let side = 2 * centre * 0.45 * bodyScale * unit
                context.addPath(CGPath(roundedRect: CGRect(x: rect.midX - side / 2, y: cy - side / 2, width: side, height: side), cornerWidth: side * round, cornerHeight: side * round, transform: nil)); context.fillPath()
            }
            if n("outlineType", 0, 0, 1) >= 0.5 && stage != .blockout {
                // Title running clockwise just outside the silhouette, tops outward, in the lobe ink.
                let ring = (0...360).map { i -> CGPoint in
                    let a = Double(i % 360) / 360 * tau, radius = crossRadius(form, a)
                    return CGPoint(x: rect.midX + cos(a) * radius * unit / max(1, stretch), y: cy + sin(a) * radius * unit * min(1, stretch))
                }
                let em = unit * 0.042
                context.setFillColor(ink); context.addPath(PathType.along(ring, text: title, font: face, size: em, lift: em * 0.45)); context.fillPath()
            }
        default: break
        }
        return true
    }
}
