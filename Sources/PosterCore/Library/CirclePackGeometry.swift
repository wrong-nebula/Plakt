import Foundation
import CoreGraphics
import CoreText

/// Shapes placed or removed by hand in a circle packing. Positions are fractions of the field, sizes fractions of its
/// short side. A void keeps its space empty, so removing a packed circle leaves a gap the others repack around.
public struct CirclePackEdits: Codable, Sendable, Hashable {
    public enum Kind: String, Codable, Sendable, Hashable { case circle, letter, void }
    public struct Item: Codable, Sendable, Hashable {
        public var kind: Kind; public var x: Double; public var y: Double; public var r: Double
        public var character: String? = nil; public var turn: Double? = nil
        public init(kind: Kind, x: Double, y: Double, r: Double, character: String? = nil, turn: Double? = nil) {
            self.kind = kind; self.x = x; self.y = y; self.r = r; self.character = character; self.turn = turn
        }
    }
    public var items: [Item]
    public init(items: [Item]) { self.items = items }
    public func validate() throws {
        guard items.count <= 300, items.allSatisfy({ [$0.x, $0.y, $0.r, $0.turn ?? 0].allSatisfy(\.isFinite) && (0.002...0.9).contains($0.r) && (-0.5...1.5).contains($0.x) && (-0.5...1.5).contains($0.y) }),
              items.allSatisfy({ $0.kind != .letter || $0.character?.count == 1 }) else {
            throw PosterError.invalid("Placed shapes need a position in the field, a size of 0.002–0.9 and one character per letter.")
        }
    }
    /// Flattened into the element's geometry so drawing, type anchors and saved scenes all see the same edits.
    func encode(into values: inout [String: Double]) {
        values["pack.n"] = Double(items.count)
        for (i, item) in items.enumerated() {
            values["pack.\(i).k"] = item.kind == .circle ? 0 : item.kind == .letter ? 1 : 2
            values["pack.\(i).x"] = item.x; values["pack.\(i).y"] = item.y; values["pack.\(i).r"] = item.r; values["pack.\(i).t"] = item.turn ?? 0
            if let scalar = item.character?.unicodeScalars.first { values["pack.\(i).c"] = Double(scalar.value) }
        }
    }
    static func decode(_ values: [String: Double]) -> [Item] {
        let n = min(300, max(0, Int(values["pack.n"] ?? 0)))
        return (0..<n).compactMap { i in
            guard let x = values["pack.\(i).x"], let y = values["pack.\(i).y"], let r = values["pack.\(i).r"], [x, y, r].allSatisfy(\.isFinite), r > 0 else { return nil }
            let k = Int(values["pack.\(i).k"] ?? 0), c = values["pack.\(i).c"].flatMap { Unicode.Scalar(UInt32(max(0, min(0x10ffff, $0)))) }.map { String(Character($0)) }
            return Item(kind: k == 1 ? .letter : k == 2 ? .void : .circle, x: x, y: y, r: r, character: c, turn: values["pack.\(i).t"])
        }
    }
}

/// A packed shape as the editor sees it: x and y are fractions of the field, r a fraction of its short side.
/// `pin` is the index of the edit that placed it; packed shapes have none.
public struct CirclePackShape: Sendable, Hashable {
    public var kind: CirclePackEdits.Kind; public var x: Double; public var y: Double; public var r: Double
    public var character: String?; public var turn: Double; public var pin: Int?
    public init(kind: CirclePackEdits.Kind, x: Double, y: Double, r: Double, character: String? = nil, turn: Double = 0, pin: Int? = nil) {
        self.kind = kind; self.x = x; self.y = y; self.r = r; self.character = character; self.turn = turn; self.pin = pin
    }
}

/// Circle packing: circles (and letters) packed into a field until they kiss, with sharp wedges cut through the gaps
/// they leave. The packing is greedy (the largest gap first, steered toward a diagonal, the centre, the edges or the
/// foot), an Apollonian gasket, rolling rows of tangent circles, a sunflower spiral or a hex lattice with a size field.
/// Letters pack by their real outlines, so small circles can settle into counters. Every circle is drawn with one mark
/// (disc, ring, target, half moon, pac, ball, halftone, hatch, flower, rounded square); wedges run from the kissing
/// points out to the field edge. The field can be filled, or the shapes punched out of it.
public enum CirclePackGeometry {
    public static let shape = "motif-survey-circle-pack"
    static let operation = "survey-circle-pack"

    /// A circle in unit space: the short side of the drawing rect is 1, the origin its top-left corner.
    struct Disc { var x: Double; var y: Double; var r: Double }
    /// A placed shape. A glyph's r is half the larger side of its outline box; a void is space kept empty.
    struct Item { var x: Double; var y: Double; var r: Double; var glyph = -1; var turn = 0.0; var pin: Int? = nil; var void = false
        var isDisc: Bool { glyph < 0 && !void }
    }
    /// A letter outline normalized to its box centre, with half its larger side as 1 (y down), and samples of its
    /// outline and interior for fitting.
    struct Glyph { var character: String; var path: CGPath; var boundary: [(Double, Double)]; var interior: [(Double, Double)] }

    struct Values {
        var raw: [String: Double]
        func n(_ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double { ExtendedSurveyGeometry.value(raw, key, fallback, low, high) }
        func count(_ key: String, _ fallback: Int, _ low: Int, _ high: Int) -> Int { Int(n(key, Double(fallback), Double(low), Double(high)).rounded()) }
    }

    /// The field the shapes fill: rectangle, circle, arch, triangle or diamond.
    struct Container {
        var kind: Int; var w: Double; var h: Double
        var radius: Double { min(w, h) / 2 }
        var polygon: [(Double, Double)] {
            switch kind {
            case 3: return [(w / 2, 0), (w, h), (0, h)]
            case 4: return [(w / 2, 0), (w, h / 2), (w / 2, h), (0, h / 2)]
            default: return []
            }
        }
        /// Distance to the boundary, positive inside. The arch is the union of a box and its cap, so this is conservative.
        func inside(_ x: Double, _ y: Double) -> Double {
            switch kind {
            case 1: return radius - hypot(x - w / 2, y - h / 2)
            case 2:
                let a = radius, x0 = w / 2 - a, x1 = w / 2 + a
                return max(min(min(x - x0, x1 - x), min(y - a, h - y)), a - hypot(x - w / 2, y - a))
            case 3, 4:
                let p = polygon, cx = p.map(\.0).reduce(0, +) / Double(p.count), cy = p.map(\.1).reduce(0, +) / Double(p.count)
                var d = Double.infinity
                for i in p.indices {
                    let a = p[i], b = p[(i + 1) % p.count], l = hypot(b.0 - a.0, b.1 - a.1)
                    let side = ((b.0 - a.0) * (cy - a.1) - (b.1 - a.1) * (cx - a.0)) >= 0 ? 1.0 : -1.0
                    d = min(d, side * ((b.0 - a.0) * (y - a.1) - (b.1 - a.1) * (x - a.0)) / l)
                }
                return d
            default: return min(min(x, w - x), min(y, h - y))
            }
        }
        func path(_ map: (Double, Double) -> CGPoint) -> CGPath {
            let path = CGMutablePath()
            switch kind {
            case 1:
                let c = map(w / 2, h / 2), e = map(w / 2 + radius, h / 2)
                path.addEllipse(in: CGRect(x: c.x - (e.x - c.x), y: c.y - (e.x - c.x), width: 2 * (e.x - c.x), height: 2 * (e.x - c.x)))
            case 2:
                let a = radius
                path.move(to: map(w / 2 - a, h))
                for i in 0...48 { let t = Double.pi + Double.pi * Double(i) / 48; path.addLine(to: map(w / 2 + a * cos(t), a + a * sin(t))) }
                path.addLine(to: map(w / 2 + a, h)); path.closeSubpath()
            case 3, 4:
                let p = polygon
                path.move(to: map(p[0].0, p[0].1)); for q in p.dropFirst() { path.addLine(to: map(q.0, q.1)) }; path.closeSubpath()
            default:
                let a = map(0, 0), b = map(w, h)
                path.addRect(CGRect(x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y))
            }
            return path
        }
    }

    struct Construction { var container: Container; var items: [Item]; var glyphs: [Glyph]; var wedges: [[(Double, Double)]] }

    /// A deterministic value in 0…1 for a pair of indices.
    static func hash01(_ a: Int, _ b: Int, _ seed: UInt64) -> Double {
        var z = UInt64(truncatingIfNeeded: a) &* 0x9e37_79b9_7f4a_7c15 ^ UInt64(truncatingIfNeeded: b) &* 0xc2b2_ae3d_27d4_eb4f ^ seed
        z = (z ^ (z >> 30)) &* 0xbf58_476d_1ce4_e5b9; z = (z ^ (z >> 27)) &* 0x94d0_49bb_1331_11eb; z ^= z >> 31
        return Double(z >> 11) / 9_007_199_254_740_992
    }

    nonisolated(unsafe) static var glyphCache: [String: Glyph] = [:]
    static let glyphLock = NSLock()
    static func defaultFont() -> CTFont { CTFontCreateWithName("HelveticaNeue" as CFString, 200, nil) }

    static func quad(_ a: CGPoint, _ b: CGPoint, _ c: CGPoint, _ k: Double) -> CGPoint {
        let u: Double = 1 - k, wa: Double = u * u, wb: Double = 2 * u * k, wc: Double = k * k
        return CGPoint(x: wa * a.x + wb * b.x + wc * c.x, y: wa * a.y + wb * b.y + wc * c.y)
    }
    static func cubic(_ a: CGPoint, _ b: CGPoint, _ c: CGPoint, _ d: CGPoint, _ k: Double) -> CGPoint {
        let u: Double = 1 - k, wa: Double = u * u * u, wb: Double = 3 * u * u * k, wc: Double = 3 * u * k * k, wd: Double = k * k * k
        let x: Double = wa * a.x + wb * b.x + wc * c.x + wd * d.x, y: Double = wa * a.y + wb * b.y + wc * c.y + wd * d.y
        return CGPoint(x: x, y: y)
    }

    /// A letter's outline, normalized and sampled; nil for characters without ink (spaces).
    static func glyph(_ character: Character, font: CTFont) -> Glyph? {
        let key = "\(CTFontCopyPostScriptName(font))|\(String(describing: CTFontCopyVariation(font)))|\(character)"
        glyphLock.lock(); if let cached = glyphCache[key] { glyphLock.unlock(); return cached }; glyphLock.unlock()
        let sized = CTFontCreateCopyWithAttributes(font, 200, nil, nil), raw = CGMutablePath()
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: String(character), attributes: [NSAttributedString.Key(kCTFontAttributeName as String): sized]))
        for run in CTLineGetGlyphRuns(line) as? [CTRun] ?? [] {
            let n = CTRunGetGlyphCount(run)
            var ids = [CGGlyph](repeating: 0, count: n), positions = [CGPoint](repeating: .zero, count: n)
            CTRunGetGlyphs(run, CFRange(location: 0, length: n), &ids); CTRunGetPositions(run, CFRange(location: 0, length: n), &positions)
            for g in 0..<n { if let p = CTFontCreatePathForGlyph(sized, ids[g], nil) { raw.addPath(p, transform: CGAffineTransform(translationX: positions[g].x, y: positions[g].y)) } }
        }
        let box = raw.boundingBoxOfPath
        guard !box.isNull, box.width > 0, box.height > 0 else { return nil }
        let half = max(box.width, box.height) / 2
        var t = CGAffineTransform(scaleX: 1 / half, y: -1 / half).translatedBy(x: -box.midX, y: -box.midY)
        guard let path = raw.copy(using: &t) else { return nil }
        // Flatten the outline and resample it evenly; interior samples keep shapes from slipping inside the letter.
        var boundary: [(Double, Double)] = [], start = CGPoint.zero, last = CGPoint.zero
        func segment(_ a: CGPoint, _ b: CGPoint) {
            let steps = max(1, Int(ceil(hypot(b.x - a.x, b.y - a.y) / 0.035)))
            for i in 1...steps { let k = Double(i) / Double(steps); boundary.append((a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)) }
        }
        path.applyWithBlock { element in
            let p = element.pointee.points
            switch element.pointee.type {
            case .moveToPoint: start = p[0]; last = p[0]
            case .addLineToPoint: segment(last, p[0]); last = p[0]
            case .addQuadCurveToPoint:
                var a = last
                for i in 1...8 { let b = quad(last, p[0], p[1], Double(i) / 8); segment(a, b); a = b }
                last = p[1]
            case .addCurveToPoint:
                var a = last
                for i in 1...10 { let b = cubic(last, p[0], p[1], p[2], Double(i) / 10); segment(a, b); a = b }
                last = p[2]
            case .closeSubpath: segment(last, start); last = start
            @unknown default: break
            }
        }
        var interior: [(Double, Double)] = []
        for i in 0...16 { for j in 0...16 { let x = -1 + Double(i) / 8, y = -1 + Double(j) / 8; if path.contains(CGPoint(x: x, y: y)) { interior.append((x, y)) } } }
        let glyph = Glyph(character: String(character), path: path, boundary: boundary, interior: interior)
        glyphLock.lock(); glyphCache[key] = glyph; glyphLock.unlock()
        return glyph
    }

    /// Unit-space glyph point for local (x, y) of an item.
    static func place(_ item: Item, _ q: (Double, Double)) -> (Double, Double) {
        let c = cos(item.turn), s = sin(item.turn)
        return (item.x + item.r * (q.0 * c - q.1 * s), item.y + item.r * (q.0 * s + q.1 * c))
    }
    static func local(_ item: Item, _ x: Double, _ y: Double) -> CGPoint {
        let dx = (x - item.x) / item.r, dy = (y - item.y) / item.r, c = cos(item.turn), s = sin(item.turn)
        return CGPoint(x: dx * c + dy * s, y: -dx * s + dy * c)
    }
    /// Signed distance from a point to an item (negative inside); glyph distances come from the outline samples.
    static func distance(_ item: Item, _ glyphs: [Glyph], _ x: Double, _ y: Double) -> Double {
        guard item.glyph >= 0 else { return hypot(x - item.x, y - item.y) - item.r }
        let g = glyphs[item.glyph], p = local(item, x, y)
        var d = Double.infinity
        for q in g.boundary { d = min(d, (p.x - q.0) * (p.x - q.0) + (p.y - q.1) * (p.y - q.1)) }
        return (g.path.contains(p) ? -1 : 1) * d.squareRoot() * item.r
    }

    static func construction(_ values: [String: Double], width w: Double, height h: Double, text: String? = nil, font: CTFont? = nil) -> Construction {
        let v = Values(raw: values), layout = v.count("layout", 0, 0, 4), seed = UInt64(v.n("shapeSeed", 817, 0, 9_000_000))
        let container = Container(kind: layout == 1 ? 1 : layout == 2 ? 0 : v.count("container", 0, 0, 4), w: w, h: h)
        let face = font ?? defaultFont(), letters = v.count("letters", 0, 0, 3)
        var glyphs: [Glyph] = [], index: [String: Int] = [:]
        func glyphIndex(_ c: Character) -> Int? {
            if let i = index[String(c)] { return i }
            guard let g = glyph(c, font: face) else { return nil }
            glyphs.append(g); index[String(c)] = glyphs.count - 1; return glyphs.count - 1
        }
        // Placed shapes come first, in field fractions; letters with an unusable character are dropped.
        var pins: [Item] = []
        for (i, e) in CirclePackEdits.decode(values).enumerated() {
            var item = Item(x: e.x * w, y: e.y * h, r: e.r, turn: (e.turn ?? 0) * Double.pi / 180, pin: i, void: e.kind == .void)
            if e.kind == .letter { guard let c = e.character?.first, let g = glyphIndex(c) else { continue }; item.glyph = g }
            pins.append(item)
        }
        let queue = letters >= 2 && layout == 0 ? (text ?? "FORM SPACE").filter { !$0.isWhitespace }.prefix(60).compactMap(glyphIndex) : []
        var items: [Item]
        if layout == 0 {
            items = greedy(container, v, seed: seed, pins: pins, glyphs: glyphs, queue: queue, cycle: letters == 3)
        } else {
            let discs: [Disc]
            switch layout {
            case 1: discs = gasket(container, v)
            case 2: discs = rows(container, v)
            case 3: discs = sunflower(container, v)
            default: discs = lattice(container, v, seed: seed)
            }
            // Fixed layouts keep their geometry; placed shapes and voids take the discs they overlap.
            func covered(_ d: Disc) -> Bool {
                pins.contains { pin in
                    let reach: Double = pin.r * (pin.glyph >= 0 ? 0.85 : 1) + d.r - 0.002
                    return hypot(pin.x - d.x, pin.y - d.y) < reach
                }
            }
            items = pins + discs.filter { !covered($0) }.map { Item(x: $0.x, y: $0.y, r: $0.r) }
        }
        return Construction(container: container, items: items, glyphs: glyphs, wedges: wedges(items, glyphs, container, v))
    }

    /// Circles in the drawing rect's own coordinates, largest first; type anchors sit in them.
    static func circles(_ values: [String: Double], rect: CGRect) -> [(center: CGPoint, radius: Double)] {
        let unit = min(rect.width, rect.height)
        return construction(values, width: rect.width / unit, height: rect.height / unit).items.filter(\.isDisc).sorted { $0.r > $1.r }
            .map { (CGPoint(x: rect.minX + $0.x * unit, y: rect.minY + $0.y * unit), $0.r * unit) }
    }

    /// The field's size in units (its short side is 1), as drawn for this element on a poster of this aspect.
    public static func fieldSize(_ element: SceneElement, aspect: Double) -> (width: Double, height: Double) {
        let w = element.bounds.width, h = element.bounds.height * aspect, unit = max(0.000001, min(w, h))
        return (w / unit, h / unit)
    }
    /// Every shape the element draws (placed ones included), for editing: positions as fractions of the field.
    public static func shapes(_ element: SceneElement, aspect: Double) -> [CirclePackShape] {
        let size = fieldSize(element, aspect: aspect)
        let font = element.text == nil ? nil : FontLibrary.font(name: element.fontName ?? "HelveticaNeue", variations: element.fontVariations)
        let built = construction(element.geometry ?? [:], width: size.width, height: size.height, text: element.text, font: font)
        return built.items.map { item in
            CirclePackShape(kind: item.void ? .void : item.glyph >= 0 ? .letter : .circle, x: item.x / size.width, y: item.y / size.height, r: item.r,
                            character: item.glyph >= 0 ? built.glyphs[item.glyph].character : nil, turn: item.turn * 180 / Double.pi, pin: item.pin)
        }
    }

    /// The largest gap first: each shape takes the biggest size the free space still holds, capped by the size
    /// (which can fall off toward the edge or the centre). Ties go to snug places that touch a neighbour or the edge,
    /// then to the bias: scattered, along the diagonal, at the centre, at the edges, at the foot, or from the top left.
    /// Placed shapes are stamped first; letters from the queue pack before circles by their own outlines.
    static func greedy(_ c: Container, _ v: Values, seed: UInt64, pins: [Item], glyphs: [Glyph], queue: [Int], cycle: Bool) -> [Item] {
        let maxR = v.n("size", 0.29, 0.02, 0.6), minR = v.n("minSize", 0.07, 0.004, 0.3), limit = v.count("count", 13, 1, 400)
        let gap = v.n("gap", 0, 0, 0.06), falloff = v.n("falloff", 0, -0.9, 0.9), bias = v.count("bias", 1, 0, 5), loose = v.n("looseness", 0.15, 0, 1)
        let letterTurn = v.n("letterTurn", 0, 0, 1)
        let nx = max(2, Int(c.w / max(c.w, c.h) * 150)), ny = max(2, Int(c.h / max(c.w, c.h) * 150)), sx = c.w / Double(nx), sy = c.h / Double(ny)
        let cell = max(sx, sy), cx = c.w / 2, cy = c.h / 2, reach = hypot(cx, cy)
        func cap(_ x: Double, _ y: Double) -> Double {
            let rho = min(1, hypot(x - cx, y - cy) / reach), t = falloff >= 0 ? rho : 1 - rho
            return maxR * max(0.08, 1 - abs(falloff) * t)
        }
        func preference(_ x: Double, _ y: Double, _ i: Int, _ j: Int) -> Double {
            let rho = min(1, hypot(x - cx, y - cy) / reach)
            switch bias {
            case 0: return hash01(i, j, seed)
            case 1: return abs(x * c.h - y * c.w) / (c.w * c.h)
            case 2: return rho
            case 3: return 1 - rho
            case 4: return 1 - y / c.h
            default: return (x / c.w + y / c.h) / 2
            }
        }
        // A full grid of free distance: to the field edge and every shape placed so far, less the gap.
        var xs = [Double](repeating: 0, count: nx * ny), ys = xs, dist = xs, caps = xs, pref = xs
        for j in 0..<ny { for i in 0..<nx {
            let k = j * nx + i, x = (Double(i) + 0.5) * sx, y = (Double(j) + 0.5) * sy
            xs[k] = x; ys[k] = y; dist[k] = c.inside(x, y); caps[k] = cap(x, y); pref[k] = preference(x, y, i, j)
        } }
        var items: [Item] = []
        func stamp(_ item: Item) {
            items.append(item)
            for k in dist.indices where dist[k] > 0 {
                let rough = hypot(xs[k] - item.x, ys[k] - item.y) - item.r * (item.glyph >= 0 ? 1.42 : 1) - gap
                guard rough < dist[k] else { continue }
                dist[k] = min(dist[k], item.glyph >= 0 ? distance(item, glyphs, xs[k], ys[k]) - gap : rough)
            }
        }
        for pin in pins { stamp(pin) }
        func free(_ x: Double, _ y: Double) -> Double {
            var d = c.inside(x, y)
            for q in items { d = min(d, (q.glyph >= 0 ? distance(q, glyphs, x, y) : hypot(x - q.x, y - q.y) - q.r) - gap) }
            return d
        }
        func lookup(_ x: Double, _ y: Double) -> Double {
            let i = Int(x / sx), j = Int(y / sy)
            return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : dist[j * nx + i]
        }
        /// Whether a letter fits at (x, y) at size s: every outline and interior sample must land in free space.
        func fits(_ g: Glyph, _ x: Double, _ y: Double, _ s: Double, _ turn: Double) -> Bool {
            let cs = cos(turn), sn = sin(turn), need = 0.6 * cell
            for q in g.interior where lookup(x + s * (q.0 * cs - q.1 * sn), y + s * (q.0 * sn + q.1 * cs)) < need { return false }
            for (n, q) in g.boundary.enumerated() where n % 2 == 0 && lookup(x + s * (q.0 * cs - q.1 * sn), y + s * (q.0 * sn + q.1 * cs)) < need { return false }
            return true
        }
        var placed = 0, lettersLeft = true
        while placed < limit {
            let step = items.count
            // Letters: the largest size each one still fits at, anywhere; ties as for circles.
            if lettersLeft, !queue.isEmpty, cycle || placed < queue.count {
                let g = glyphs[queue[placed % queue.count]], turn = letterTurn * (hash01(step, 11, seed) * 2 - 1) * Double.pi
                var best = (score: -Double.infinity, s: 0.0, x: 0.0, y: 0.0)
                for j in stride(from: 1, to: ny, by: 3) { for i in stride(from: 1, to: nx, by: 3) {
                    let k = j * nx + i, x = xs[k], y = ys[k]
                    guard dist[k] > minR * 0.3, fits(g, x, y, minR, turn) else { continue }
                    var lo = minR, hi = caps[k]
                    if fits(g, x, y, hi, turn) { lo = hi } else { for _ in 0..<7 { let mid = (lo + hi) / 2; if fits(g, x, y, mid, turn) { lo = mid } else { hi = mid } } }
                    let score = lo * (1 - 0.12 * pref[k] - 0.3 * loose * hash01(k, step, seed ^ 0x47))
                    if score > best.score { best = (score, lo, x, y) }
                } }
                guard best.s >= minR else { lettersLeft = false; if cycle { break }; continue }
                stamp(Item(x: best.x, y: best.y, r: best.s, glyph: queue[placed % queue.count], turn: turn)); placed += 1
                continue
            }
            var best = 0.0
            for k in dist.indices { best = max(best, min(dist[k], caps[k])) }
            guard best >= minR else { break }
            let floor = best * (1 - 0.5 * loose)
            var pick = -1, low = Double.infinity
            for k in dist.indices {
                let prim = min(dist[k], caps[k])
                guard prim >= floor else { continue }
                let slack = max(0, dist[k] - caps[k]) / caps[k]
                let cost = -2 * prim / best + 1.5 * min(1, slack) + pref[k] + 1.5 * loose * hash01(k, step, seed ^ 0x51)
                if cost < low { low = cost; pick = k }
            }
            guard pick >= 0 else { break }
            // Settle the circle: a capped one slides until it touches something, a free one grows into its gap.
            var x = xs[pick], y = ys[pick], length = cell
            let capped = dist[pick] > caps[pick]
            func score(_ x: Double, _ y: Double) -> Double { let f = free(x, y), m = cap(x, y); return capped ? -abs(f - m) : min(f, m) }
            var current = score(x, y)
            for _ in 0..<16 {
                var moved = false
                for a in 0..<8 {
                    let t = Double(a) * Double.pi / 4, px = x + cos(t) * length, py = y + sin(t) * length, s = score(px, py)
                    if s > current + 1e-10 { x = px; y = py; current = s; moved = true }
                }
                if !moved { length /= 2 }
            }
            let r = min(free(x, y), cap(x, y))
            guard r >= minR * 0.6 else { dist[pick] = 0; placed += 1; continue }
            stamp(Item(x: x, y: y, r: r)); placed += 1
        }
        return items
    }

    /// An Apollonian gasket: three mutually tangent circles inside the round field, each gap filled with the circle that
    /// kisses its three neighbours, recursively (Descartes' theorem as a reflection of the opposite circle).
    static func gasket(_ c: Container, _ v: Values) -> [Disc] {
        struct Circle { var k: Double; var x: Double; var y: Double }
        let R = c.radius, minR = v.n("minSize", 0.07, 0.004, 0.3), limit = v.count("count", 13, 1, 400), gap = v.n("gap", 0, 0, 0.06)
        let start = v.count("start", 0, 0, 2), split = v.n("split", 0.62, 0.15, 0.85), turn = v.n("angle", 0, 0, 175) * Double.pi / 180
        let outer = Circle(k: -1 / R, x: 0, y: 0)
        var seeds: [Circle]
        switch start {
        case 1:
            let r = R / (1 + 2 / 3.0.squareRoot())
            seeds = [-90.0, 30, 150].map { Circle(k: 1 / r, x: (R - r) * cos($0 * Double.pi / 180), y: (R - r) * sin($0 * Double.pi / 180)) }
        default:
            let a = start == 2 ? split : 0.5, r1 = a * R, r2 = (1 - a) * R, r3 = a * (1 - a) / (1 - a * (1 - a)) * R
            // The third circle: R − r3 from the centre and r1 + r3 from the first circle, above the diameter.
            let x1 = -R + r1, d0 = R - r3, d1 = r1 + r3, x = (d0 * d0 - d1 * d1 + x1 * x1) / (2 * x1)
            seeds = [Circle(k: 1 / r1, x: x1, y: 0), Circle(k: 1 / r2, x: R - r2, y: 0), Circle(k: 1 / r3, x: x, y: -max(0, d0 * d0 - x * x).squareRoot())]
        }
        var out = seeds
        let (a, b, d) = (seeds[0], seeds[1], seeds[2])
        var stack: [(Circle, Circle, Circle, Circle)] = [(a, b, d, outer), (outer, a, b, d), (outer, a, d, b), (outer, b, d, a)]
        while let (p, q, s, w) = stack.popLast(), out.count < 6000 {
            let k = 2 * (p.k + q.k + s.k) - w.k
            guard k > 0, 1 / k >= minR else { continue }
            let e = Circle(k: k, x: (2 * (p.k * p.x + q.k * q.x + s.k * s.x) - w.k * w.x) / k, y: (2 * (p.k * p.y + q.k * q.y + s.k * s.y) - w.k * w.y) / k)
            out.append(e); stack += [(p, q, e, s), (p, s, e, q), (q, s, e, p)]
        }
        return out.sorted { $0.k < $1.k }.prefix(limit).map {
            Disc(x: c.w / 2 + $0.x * cos(turn) - $0.y * sin(turn), y: c.h / 2 + $0.x * sin(turn) + $0.y * cos(turn), r: max(0.001, 1 / $0.k - gap / 2))
        }
    }

    /// Rows of tangent circles that grow or shrink along the row, sitting on a baseline or strung on a centre line.
    static func rows(_ c: Container, _ v: Values) -> [Disc] {
        let rows = v.count("rows", 4, 1, 12), per = v.count("perRow", 5, 1, 20), growth = v.n("growth", 0.5, -1, 1)
        let alternate = v.count("alternate", 0, 0, 1) == 1, centred = v.count("align", 0, 0, 1) == 1, gap = v.n("gap", 0, 0, 0.06)
        let q = per > 1 ? exp(2 * growth / Double(per - 1)) : 1, base = (0..<per).map { pow(q, Double($0)) }
        func step(_ a: Double, _ b: Double) -> Double { centred ? a + b : 2 * (a * b).squareRoot() }
        var span = base[0] + base[per - 1]
        for i in 0..<(per - 1) { span += step(base[i], base[i + 1]) }
        let fit = min(c.w / span, c.h / (Double(rows) * 2 * base.max()!)), height = 2 * base.max()! * fit
        let left = (c.w - span * fit) / 2, spare = (c.h - Double(rows) * height) / Double(rows)
        var discs: [Disc] = []
        for row in 0..<rows {
            let radii = (alternate && row % 2 == 1 ? base.reversed() : base).map { $0 * fit }, top = spare / 2 + Double(row) * (height + spare)
            var x = left + radii[0]
            for (i, r) in radii.enumerated() {
                if i > 0 { x += step(radii[i - 1], r) }
                discs.append(Disc(x: x, y: centred ? top + height / 2 : top + height - r, r: max(0.001, r - gap / 2)))
            }
        }
        return discs
    }

    /// A sunflower: points on the golden-angle spiral, each disc half the distance to its nearest neighbour.
    /// Spread below one half crowds the centre with small discs; above it, the rim.
    static func sunflower(_ c: Container, _ v: Values) -> [Disc] {
        let count = v.count("count", 13, 1, 400), spread = v.n("spread", 0.5, 0.25, 1.2), turn = v.n("angle", 0, 0, 175) * Double.pi / 180, gap = v.n("gap", 0, 0, 0.06)
        let reach = c.kind == 1 ? c.radius : hypot(c.w, c.h) / 2
        var points: [(Double, Double)] = []
        for i in 0..<count {
            let rho = reach * pow((Double(i) + 0.5) / Double(count), spread), t = Double(i) * 2.399_963_229_7 + turn
            let x = c.w / 2 + rho * cos(t), y = c.h / 2 + rho * sin(t)
            if c.inside(x, y) > 0 { points.append((x, y)) }
        }
        return points.indices.compactMap { i in
            var nearest = Double.infinity
            for j in points.indices where j != i { nearest = min(nearest, hypot(points[i].0 - points[j].0, points[i].1 - points[j].1)) }
            let r = min(nearest.isFinite ? nearest / 2 : reach * 0.5, c.inside(points[i].0, points[i].1)) - gap / 2
            return r > 0.002 ? Disc(x: points[i].0, y: points[i].1, r: r) : nil
        }
    }

    /// A hex lattice whose discs shrink with a size field: radial, linear, waves or seeded at random.
    static func lattice(_ c: Container, _ v: Values, seed: UInt64) -> [Disc] {
        let count = v.count("count", 13, 1, 400), pattern = v.count("pattern", 0, 0, 3), falloff = v.n("falloff", 0, -0.9, 0.9)
        let turn = v.n("angle", 0, 0, 175) * Double.pi / 180, gap = v.n("gap", 0, 0, 0.06)
        let d = (c.w * c.h / (Double(count) * 0.866)).squareRoot(), pitch = d * 0.866
        let cols = Int(c.w / d) + 1, rowsN = Int(c.h / pitch) + 1
        let x0 = (c.w - Double(cols - 1) * d) / 2, y0 = (c.h - Double(rowsN - 1) * pitch) / 2, reach = hypot(c.w, c.h) / 2
        var discs: [Disc] = []
        for j in 0..<rowsN {
            for i in 0..<(cols + 1) {
                let x = x0 + Double(i) * d - (j % 2 == 1 ? d / 2 : 0), y = y0 + Double(j) * pitch
                let along = ((x - c.w / 2) * cos(turn) + (y - c.h / 2) * sin(turn)) / reach
                let f: Double
                switch pattern {
                case 1: f = min(1, max(0, 0.5 + 0.5 * along))
                case 2: f = 0.5 + 0.5 * sin(along * Double.pi * 3)
                case 3: f = hash01(i, j, seed)
                default: f = min(1, hypot(x - c.w / 2, y - c.h / 2) / reach)
                }
                let t = falloff >= 0 ? f : 1 - f, r = min(d / 2 * (1 - abs(falloff) * 0.92 * t) - gap / 2, c.inside(x, y))
                if r > 0.12 * d / 2 { discs.append(Disc(x: x, y: y, r: r)) }
            }
        }
        return discs
    }

    /// Wedges: long thin triangles from the points where two circles kiss, out through the gap they open, to the field
    /// edge. Candidates fan around the gap's own direction; the clearest and longest win, spread apart.
    static func wedges(_ items: [Item], _ glyphs: [Glyph], _ c: Container, _ v: Values) -> [[(Double, Double)]] {
        let wanted = v.count("wedges", 4, 0, 16), width = v.n("wedgeWidth", 0.13, 0.02, 0.45), reach = v.n("reach", 1, 0.2, 1), gap = v.n("gap", 0, 0, 0.06)
        let discs = items.filter(\.isDisc), solid = items.filter { !$0.void }
        guard wanted > 0, discs.count > 1 else { return [] }
        var kisses: [(x: Double, y: Double, nx: Double, ny: Double, size: Double)] = []
        for i in discs.indices {
            for j in (i + 1)..<discs.count {
                let a = discs[i], b = discs[j], d = hypot(b.x - a.x, b.y - a.y)
                guard d > 0, abs(d - a.r - b.r) < gap + 0.008 else { continue }
                let ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, t = a.r + (d - a.r - b.r) / 2
                kisses.append((a.x + ux * t, a.y + uy * t, -uy, ux, min(a.r, b.r)))
            }
        }
        kisses = Array(kisses.sorted { $0.size > $1.size }.prefix(60))
        func covered(_ x: Double, _ y: Double) -> Bool {
            solid.contains { q in
                let d = hypot(x - q.x, y - q.y)
                if q.glyph < 0 { return d < q.r }
                return d < q.r * 1.42 && glyphs[q.glyph].path.contains(local(q, x, y))
            }
        }
        var candidates: [(score: Double, kiss: Int, ax: Double, ay: Double, dx: Double, dy: Double, length: Double)] = []
        for (k, kiss) in kisses.enumerated() {
            for side in [-1.0, 1.0] {
                for turn in -4...4 {
                    let t = Double(turn) * 8 * Double.pi / 180, bx = kiss.nx * side, by = kiss.ny * side
                    let dx = bx * cos(t) - by * sin(t), dy = bx * sin(t) + by * cos(t)
                    var s = 0.02, open = 0.0, total = 0.0
                    while c.inside(kiss.x + dx * s, kiss.y + dy * s) > 0, s < 4 {
                        if !covered(kiss.x + dx * s, kiss.y + dy * s) { open += 0.012 }
                        total += 0.012; s += 0.012
                    }
                    guard s > 0.2, total > 0 else { continue }
                    let share = open / total
                    if share > 0.6 { candidates.append((share * share * s, k, kiss.x, kiss.y, dx, dy, s)) }
                }
            }
        }
        var chosen: [(kiss: Int, bx: Double, by: Double, dx: Double, dy: Double)] = [], out: [[(Double, Double)]] = []
        for w in candidates.sorted(by: { $0.score > $1.score }) where out.count < wanted {
            let bx = w.ax + w.dx * w.length, by = w.ay + w.dy * w.length
            guard !chosen.contains(where: { hypot($0.bx - bx, $0.by - by) < 0.15 || ($0.kiss == w.kiss && $0.dx * w.dx + $0.dy * w.dy > 0) }) else { continue }
            chosen.append((w.kiss, bx, by, w.dx, w.dy))
            let far = reach >= 0.999 ? w.length * 1.6 : w.length * reach, half = width * far * 0.75
            out.append([(w.ax, w.ay), (w.ax + w.dx * far - w.dy * half, w.ay + w.dy * far + w.dx * half), (w.ax + w.dx * far + w.dy * half, w.ay + w.dy * far - w.dx * half)])
        }
        return out
    }

    static func luminance(_ c: CGColor) -> Double {
        let x = c.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil)?.components ?? [0, 0, 0, 1]
        return 0.2126 * Double(x[0]) + 0.7152 * Double(x.count > 1 ? x[1] : x[0]) + 0.0722 * Double(x.count > 2 ? x[2] : x[0])
    }

    static func draw(_ operation: String, rect: CGRect, context: CGContext, values: [String: Double], inks given: [CGColor], text: String?, font: CTFont?, stage: ConstructionStage) -> Bool {
        guard operation == Self.operation else { return false }
        let v = Values(raw: values), finished = stage != .blockout, unit = Double(min(rect.width, rect.height))
        let built = construction(values, width: rect.width / unit, height: rect.height / unit, text: text, font: font), seed = UInt64(v.n("shapeSeed", 817, 0, 9_000_000))
        func pt(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: rect.minX + x * unit, y: rect.minY + y * unit) }
        let black = CGColor(srgbRed: 0.05, green: 0.05, blue: 0.06, alpha: 1), white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
        let inks = given.isEmpty ? [black] : given, mix = OrbitWrapGeometry.mix
        let fieldInk = inks.count > 1 ? inks[1] : mix(inks[0], white, 0.75), wedgeInk = inks.count > 2 ? inks[2] : white
        let palette = [inks[0]] + Array(inks.dropFirst(3)) + (inks.count > 2 ? [inks[2]] : [])
        let mark = finished ? v.count("mark", 0, 0, 9) : 0, inset = v.n("inset", 0, 0, 0.6), inkMode = v.count("inkMode", 0, 0, 5)
        let field = v.count("field", 1, 0, 1) == 1, holes = field && v.count("holes", 0, 0, 1) == 1, outline = finished && v.count("outline", 0, 0, 1) == 1
        let line = v.n("line", 0.01, 0.002, 0.05) * unit, markAngle = v.n("markAngle", 0, -90, 90) * Double.pi / 180, spin = v.n("spin", 0, 0, 1)
        let shadow = finished ? v.n("shadow", 0, 0, 1) : 0, misregister = finished ? v.n("misregister", 0, 0, 1) : 0
        let fieldPath = built.container.path(pt)
        let items = built.items.enumerated().filter { !$0.element.void }.map(\.element)
        /// Each shape's outline in the drawing rect: a circle (inset in its slot) or a letter.
        let paths: [CGPath] = items.map { item in
            let r = item.r * unit * (1 - inset), c = pt(item.x, item.y)
            if item.glyph < 0 { return CGPath(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r), transform: nil) }
            var t = CGAffineTransform(translationX: c.x, y: c.y).rotated(by: item.turn).scaledBy(x: r, y: r)
            return built.glyphs[item.glyph].path.copy(using: &t) ?? CGMutablePath()
        }
        let wedges: [CGPath] = built.wedges.map { w in let p = CGMutablePath(); p.addLines(between: w.map { pt($0.0, $0.1) }); p.closeSubpath(); return p }
        func disc(_ c: CGPoint, _ r: Double) -> CGRect { CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r) }

        // Inks by size rank, order, chance, or blended by size or down the field.
        let ranks: [Int] = { var out = [Int](repeating: 0, count: items.count); for (i, k) in items.indices.sorted(by: { items[$0].r > items[$1].r }).enumerated() { out[k] = i }; return out }()
        func blend(_ t: Double) -> CGColor {
            guard palette.count > 1 else { return palette[0] }
            let x = min(1, max(0, t)) * Double(palette.count - 1), i = min(palette.count - 2, Int(floor(x)))
            return mix(palette[i], palette[i + 1], x - Double(i))
        }
        func ink(_ i: Int) -> CGColor {
            let k = palette.count, rank = Double(ranks[i]) / Double(max(1, items.count - 1))
            switch inkMode {
            case 1: return palette[rank < 0.5 ? 0 : 1 % k]
            case 2: return palette[i % k]
            case 3: return palette[Int(hash01(i, 7, seed) * Double(k)) % k]
            case 4: return blend(rank)
            case 5: return blend(items[i].y / (rect.height / unit))
            default: return palette[0]
            }
        }

        context.saveGState()
        context.setLineWidth(line); context.setLineJoin(.miter)
        // The field: filled, or (with holes) punched by every shape and wedge so the paper or image shows through.
        if outline {
            context.setStrokeColor(fieldInk); context.addPath(fieldPath); context.strokePath()
        } else if field {
            context.saveGState()
            if holes {
                let bound = rect.insetBy(dx: -4, dy: -4)
                for p in paths + wedges { context.addRect(bound); context.addPath(p); context.clip(using: .evenOdd) }
            }
            context.setFillColor(fieldInk); context.addPath(fieldPath); context.fillPath()
            context.restoreGState()
        }
        let offset = shadow * unit * 0.022, shadowInk = mix(field ? fieldInk : inks[0], black, 0.55).copy(alpha: 0.5)!
        if shadow > 0 {
            var shift = CGAffineTransform(translationX: offset, y: offset)
            if holes {
                // The punched field casts a crescent of shadow into each hole.
                context.saveGState(); context.setFillColor(shadowInk)
                for p in paths {
                    context.saveGState(); context.addPath(p); context.clip()
                    context.addPath(p); if let moved = p.copy(using: &shift) { context.addPath(moved) }; context.fillPath(using: .evenOdd)
                    context.restoreGState()
                }
                context.restoreGState()
            } else if !outline {
                context.saveGState(); context.addPath(fieldPath); context.clip(); context.setFillColor(shadowInk)
                for p in wedges + paths { if let moved = p.copy(using: &shift) { context.addPath(moved) } }
                context.fillPath(); context.restoreGState()
            }
        }
        // Wedges sit under the shapes and stop at the field edge.
        if !holes && !wedges.isEmpty {
            context.saveGState(); context.addPath(fieldPath); context.clip()
            for w in wedges { context.addPath(w) }
            if outline { context.setStrokeColor(wedgeInk); context.strokePath() } else { context.setFillColor(wedgeInk); context.fillPath() }
            context.restoreGState()
        }

        for (i, item) in items.enumerated() where item.r * (1 - inset) > 0.0005 {
            let color = ink(i), c = pt(item.x, item.y), r = item.r * unit * (1 - inset), box = disc(c, r)
            let angle = markAngle + spin * (hash01(i, 3, seed) * 2 - 1) * Double.pi
            context.saveGState(); defer { context.restoreGState() }
            context.setFillColor(color); context.setStrokeColor(color)
            if outline { context.addPath(paths[i]); context.strokePath(); continue }
            // Letters are solid ink (or holes); the marks belong to circles. Packed among circles, the title takes the
            // third ink so it reads against them.
            if item.glyph >= 0 {
                if !holes { if v.count("letters", 0, 0, 3) == 2 && inks.count > 2 && inkMode == 0 { context.setFillColor(wedgeInk) }; context.addPath(paths[i]); context.fillPath() }
                continue
            }
            if holes && mark == 0 { continue }
            switch mark {
            case 1: context.strokeEllipse(in: box.insetBy(dx: line / 2, dy: line / 2))
            case 2:
                let rings = v.count("rings", 4, 2, 10)
                for k in 0..<rings { context.addEllipse(in: disc(c, r * (1 - Double(k) / Double(rings)))) }
                context.fillPath(using: .evenOdd)
            case 3:
                // Half moons: the far half in a second ink.
                context.fillEllipse(in: box)
                let other = palette.count > 1 ? palette[(palette.firstIndex { $0 == color }.map { $0 + 1 } ?? 1) % palette.count] : mix(color, black, 0.4)
                let half = CGMutablePath(); half.addArc(center: c, radius: r, startAngle: angle, endAngle: angle + Double.pi, clockwise: false); half.closeSubpath()
                context.setFillColor(other); context.addPath(half); context.fillPath()
            case 4:
                let cut = v.n("cut", 0.22, 0.05, 0.45) * Double.pi, pac = CGMutablePath()
                pac.move(to: c); pac.addArc(center: c, radius: r, startAngle: angle + cut, endAngle: angle + 2 * Double.pi - cut, clockwise: false); pac.closeSubpath()
                context.addPath(pac); context.fillPath()
            case 5:
                context.addEllipse(in: box); context.clip()
                let light = CGPoint(x: c.x - r * 0.46 * cos(angle + Double.pi / 4), y: c.y - r * 0.46 * sin(angle + Double.pi / 4))
                if let g = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [mix(color, white, 0.55), color, mix(color, black, 0.45)] as CFArray, locations: [0, 0.45, 1]) {
                    context.drawRadialGradient(g, startCenter: light, startRadius: 0, endCenter: c, endRadius: r * 1.05, options: [.drawsAfterEndLocation])
                }
            case 6, 7:
                let cell = v.n("screen", 0.014, 0.005, 0.04) * unit, ux = cos(angle), uy = sin(angle), marks = CGMutablePath()
                context.addEllipse(in: box); context.clip()
                var s = -r
                while s <= r {
                    if mark == 6 {
                        // Halftone: dots grow across the disc along the mark angle.
                        var t = -r
                        while t <= r {
                            let k = 0.2 + 0.8 * (s + r) / (2 * r), dot = cell * 0.56 * k.squareRoot()
                            marks.addEllipse(in: disc(CGPoint(x: c.x + s * ux - t * uy, y: c.y + s * uy + t * ux), dot)); t += cell
                        }
                    } else {
                        marks.move(to: CGPoint(x: c.x + s * ux + r * uy, y: c.y + s * uy - r * ux)); marks.addLine(to: CGPoint(x: c.x + s * ux - r * uy, y: c.y + s * uy + r * ux))
                    }
                    s += cell
                }
                context.addPath(marks)
                if mark == 6 { context.fillPath() } else { context.setLineWidth(min(line, cell * 0.6)); context.strokePath() }
            case 8:
                let lobes = v.count("lobes", 8, 3, 18), k = sin(Double.pi / Double(lobes)), lobe = r * k / (1 + k), petals = CGMutablePath()
                petals.addEllipse(in: disc(c, r - lobe))
                for j in 0..<lobes { let t = angle + 2 * Double.pi * Double(j) / Double(lobes); petals.addEllipse(in: disc(CGPoint(x: c.x + (r - lobe) * cos(t), y: c.y + (r - lobe) * sin(t)), lobe)) }
                context.addPath(petals); context.fillPath()
            case 9:
                let side = r * 2.0.squareRoot(), round = v.n("roundness", 0.3, 0, 1) * side / 2
                let square = CGPath(roundedRect: CGRect(x: -side / 2, y: -side / 2, width: side, height: side), cornerWidth: round, cornerHeight: round, transform: nil)
                var t = CGAffineTransform(translationX: c.x, y: c.y).rotated(by: angle)
                if let p = square.copy(using: &t) { context.addPath(p); context.fillPath() }
            default: context.fillEllipse(in: box)
            }
        }

        // A second printing out of register, in the darkest other ink, multiplied.
        if misregister > 0 && !outline {
            let dark = inks.dropFirst().min { luminance($0) < luminance($1) }.flatMap { luminance($0) < luminance(inks[0]) ? $0 : nil } ?? mix(inks[0], black, 0.5)
            context.saveGState(); context.setBlendMode(.multiply); context.setFillColor(dark.copy(alpha: 0.85)!)
            context.translateBy(x: misregister * unit * 0.016, y: -misregister * unit * 0.011)
            for p in paths { context.addPath(p) }
            context.fillPath(); context.restoreGState()
        }

        // Letters in circles: the title one character per circle, from the third largest down, in reading order.
        if finished && v.count("letters", 0, 0, 3) == 1 {
            let chars = Array((text ?? "FORM SPACE").filter { !$0.isWhitespace }.prefix(40))
            let discs = items.indices.filter { items[$0].glyph < 0 }.sorted { items[$0].r > items[$1].r }, first = min(2, max(0, discs.count - chars.count))
            var taken = Array(discs.dropFirst(first).prefix(chars.count))
            let typical = taken.map { items[$0].r }.reduce(0, +) / Double(max(1, taken.count))
            taken.sort { let a = items[$0], b = items[$1], ra = Int(a.y / (typical * 1.6)), rb = Int(b.y / (typical * 1.6)); return ra != rb ? ra < rb : a.x < b.x }
            context.setFillColor(holes ? fieldInk : wedgeInk)
            let face = CTFontCreateCopyWithAttributes(font ?? defaultFont(), 100, nil, nil), capHeight = max(1, CTFontGetCapHeight(face))
            for (k, i) in taken.enumerated() {
                let line = CTLineCreateWithAttributedString(NSAttributedString(string: String(chars[k]), attributes: [NSAttributedString.Key(kCTFontAttributeName as String): face]))
                let glyphs = CGMutablePath()
                for run in CTLineGetGlyphRuns(line) as? [CTRun] ?? [] {
                    let n = CTRunGetGlyphCount(run)
                    var ids = [CGGlyph](repeating: 0, count: n), positions = [CGPoint](repeating: .zero, count: n)
                    CTRunGetGlyphs(run, CFRange(location: 0, length: n), &ids); CTRunGetPositions(run, CFRange(location: 0, length: n), &positions)
                    for g in 0..<n { if let p = CTFontCreatePathForGlyph(face, ids[g], nil) { glyphs.addPath(p, transform: CGAffineTransform(translationX: positions[g].x, y: positions[g].y)) } }
                }
                // Figures sit on the cap height's centre line, so full stops stay small and low.
                let b = glyphs.boundingBoxOfPath, r = items[i].r * unit * (1 - inset), c = pt(items[i].x, items[i].y)
                guard !b.isNull, b.width > 0 else { continue }
                let scale = min(1.2 * r / capHeight, 1.5 * r / max(b.width, capHeight * 0.5))
                var t = CGAffineTransform(translationX: c.x, y: c.y).scaledBy(x: scale, y: -scale).translatedBy(x: -b.midX, y: -capHeight / 2)
                if let p = glyphs.copy(using: &t) { context.addPath(p); context.fillPath() }
            }
        }
        context.restoreGState()
        return true
    }
}
