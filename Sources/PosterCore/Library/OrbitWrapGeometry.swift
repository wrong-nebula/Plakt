import Foundation
import CoreGraphics
import CoreText

/// Orbit wrap: rings, a coil, crossed orbits, a double coil, Saturn rings, gimbals, a torus knot, a crown, an electron
/// swarm or a whirl wound round a subject (a solid of revolution, a slab, a glow, a torus, a pill, a star, a striped
/// orb, or the poster's own title). Every orbit is a 3D curve round a vertical axis, seen by a raised camera and leaned
/// (and optionally bent) in the page. The scene draws an orbit element twice: the far half of every orbit, then the
/// subject, in the element's own place below the type; the near half above the title. The title sits inside the rings.
/// Keys added in v2 (bend, taper, jitter, spacing, echo, shadow, depthBlur, rungs, dashDuty, knotLobes, crownWaves,
/// wave, backCopy) are neutral when absent, so v1 genomes draw exactly as before.
public enum OrbitWrapGeometry {
    public static let shape = "motif-survey-orbit-wrap"
    static let operation = "survey-orbit-wrap"
    /// Draw-time keys, never saved: which pass is drawing (0 far, 1 near) and the page colour as 0xRRGGBB.
    static let layerKey = "orbitLayer", paperKey = "orbitPaper", onlyKey = "orbitOnly"
    static let frontZ = 1000

    /// The elements as drawn: orbit elements learn the paper colour and gain a near pass drawn right above the
    /// title (the largest text), while the rest of the type stays above the near arcs and readable.
    public static func passes(_ genome: StyleGenome) -> [SceneElement] {
        guard genome.elements.contains(where: { $0.shape == shape }) else { return genome.elements }
        let paper = encode(genome.background)
        let title = genome.elements.filter { $0.kind == "text" }.max { $0.bounds.area < $1.bounds.area }
        let titleZ = title.map { $0.zIndex ?? 100 } ?? frontZ
        var out: [SceneElement] = [], near: [SceneElement] = []
        for element in genome.elements {
            guard element.shape == shape else {
                var other = element
                if other.kind == "text", other.sourceElementID != title?.sourceElementID, (other.zIndex ?? 100) == titleZ { other.zIndex = titleZ + 1 }
                out.append(other); continue
            }
            var far = element, front = element
            var g = element.geometry ?? [:]
            g[paperKey] = paper; g[layerKey] = 0; far.geometry = g
            // Never below its own far pass: a system placed in front of the type keeps its near arcs on top.
            g[layerKey] = 1; front.geometry = g; front.zIndex = max(titleZ, element.zIndex ?? 0)
            let only = element.geometry?[onlyKey]
            if only != 1 { out.append(far) }
            if only != 0 { near.append(front) }
        }
        return out + near
    }
    /// Renders a scene with its orbits reduced to one pass (0 far arcs and subject, 1 near arcs), for checks and proofs.
    public static func render(_ genome: StyleGenome, onlyLayer layer: Int, width: Int) throws -> CGImage {
        var copy = genome
        for i in copy.elements.indices where copy.elements[i].shape == shape { copy.elements[i].geometry?[onlyKey] = Double(layer) }
        return try LibrarySceneRenderer.render(copy, width: width)
    }
    static func encode(_ hex: String) -> Double {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        return Double(UInt32(s.prefix(6), radix: 16) ?? 0xeeeae1)
    }
    static func decode(_ value: Double?) -> CGColor? {
        guard let value, value.isFinite, value >= 0 else { return nil }
        let n = UInt32(min(value, 16_777_215))
        return CGColor(srgbRed: Double((n >> 16) & 255) / 255, green: Double((n >> 8) & 255) / 255, blue: Double(n & 255) / 255, alpha: 1)
    }
    static func luma(_ color: CGColor) -> Double {
        let c = color.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil)?.components ?? [0, 0, 0]
        return c.count >= 3 ? 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] : 0
    }
    static func mix(_ a: CGColor, _ b: CGColor, _ t: Double) -> CGColor {
        let space = CGColorSpace(name: CGColorSpace.sRGB)!
        let x = a.converted(to: space, intent: .defaultIntent, options: nil)?.components ?? [0, 0, 0, 1]
        let y = b.converted(to: space, intent: .defaultIntent, options: nil)?.components ?? [0, 0, 0, 1]
        guard x.count >= 3, y.count >= 3 else { return a }
        let k = min(1, max(0, t))
        return CGColor(srgbRed: x[0] + (y[0] - x[0]) * k, green: x[1] + (y[1] - x[1]) * k, blue: x[2] + (y[2] - x[2]) * k, alpha: 1)
    }

    /// Radius of the solid of revolution at axis position s (−1 top, 1 bottom), as a share of the orbit radius.
    static func profile(_ kind: Int, _ s: Double) -> Double {
        switch kind {
        case 1: return max(0.08, (1 - s * s).squareRoot())
        case 2: return 0.12 + 0.88 * (s + 1) / 2
        case 3: return 0.38 + 0.62 * s * s
        case 4: return 0.62 + 0.38 * cos(s * Double.pi / 2)
        case 5: return 1 - 0.88 * (s + 1) / 2
        default: return 1
        }
    }
    /// Turn-spacing ramp: 0 keeps even spacing; positive crowds turns toward the bottom, negative toward the top.
    static func ramp(_ u: Double, _ k: Double) -> Double {
        if k == 0 { return u }
        let c = 3 * k
        return (1 - exp(-c * u)) / (1 - exp(-c))
    }
    /// The second winding number of a (p, q) torus knot, kept coprime with q so the strand closes once.
    static func knotP(_ q: Int) -> Double { q == 6 ? 5 : (q % 2 == 0 ? 3 : 2) }

    struct Vec { var x: Double; var y: Double; var z: Double
        static func + (a: Vec, b: Vec) -> Vec { Vec(x: a.x + b.x, y: a.y + b.y, z: a.z + b.z) }
        static func - (a: Vec, b: Vec) -> Vec { Vec(x: a.x - b.x, y: a.y - b.y, z: a.z - b.z) }
        static func * (a: Vec, k: Double) -> Vec { Vec(x: a.x * k, y: a.y * k, z: a.z * k) }
        var length: Double { (x * x + y * y + z * z).squareRoot() }
        var unit: Vec { let l = length; return l > 0 ? self * (1 / l) : Vec(x: 1, y: 0, z: 0) }
    }

    /// One closed ring, coil or strand. `point` is in field units: x across, y down the axis, z toward the viewer.
    /// Kinds follow the path control: 0 rings, 1 coil, 2 crossed orbits, 3 double coil, 4 Saturn, 5 gimbals,
    /// 6 torus knot, 7 crown, 8 swarm, 9 whirl.
    struct Orbit {
        var index: Int; var t0: Double; var t1: Double; var closed: Bool
        var kind: Int; var radius: Double; var half: Double; var s: Double; var wobble: Double
        var turn: Double; var phase: Double; var incline: Double; var stretch: Double; var profile: Int
        var spacing: Double = 0; var jitter: Double = 0; var n1: Double = 0; var n2: Double = 0
        var lobes: Int = 3; var wave: Double = 0; var offset: Vec = Vec(x: 0, y: 0, z: 0)
        /// Axis position of an open strand at t, from −1 (top) to 1 (bottom), through the spacing ramp.
        func along(_ t: Double) -> Double {
            let u = (t - t0) / max(0.0001, t1 - t0)
            return -1 + 2 * OrbitWrapGeometry.ramp(u, spacing)
        }
        func roughness(_ t: Double) -> Double {
            if jitter == 0 { return 1 }
            return 1 + jitter * 0.3 * (0.6 * sin(3.1 * t + n1) + 0.4 * sin(7.7 * t + n2))
        }
        func whirlY(_ t: Double) -> Double {
            let u = (t - t0) / max(0.0001, t1 - t0)
            return (s + (OrbitWrapGeometry.ramp(u, spacing) - 0.5) * 0.5) * half
        }
        func axisPoint(_ t: Double) -> Vec {
            switch kind {
            case 1, 3: return Vec(x: 0, y: along(t) * half, z: 0)
            case 2, 5: return Vec(x: 0, y: 0, z: 0)
            case 6: return Vec(x: 0, y: half * 0.45 * sin(Double(lobes) * t), z: 0)
            case 8: return offset
            case 9: return Vec(x: 0, y: whirlY(t), z: 0)
            default: return Vec(x: 0, y: s * half, z: 0)
            }
        }
        func point(_ t: Double) -> Vec {
            switch kind {
            case 1, 3:
                let s = along(t), rho = radius * OrbitWrapGeometry.profile(profile, s) * roughness(t), a = t + phase
                return Vec(x: rho * cos(a), y: s * half, z: rho * sin(a))
            case 2, 5, 8:
                // A tilted great circle, then turned about the vertical axis; vertical extent follows the axis length.
                let a = t + phase, x = radius * cos(a), y = radius * sin(a) * sin(incline) * stretch, z = radius * sin(a) * cos(incline)
                let turned = Vec(x: x * cos(turn) - z * sin(turn), y: y, z: x * sin(turn) + z * cos(turn))
                return kind == 8 ? turned + offset : turned
            case 4:
                let rho = radius * roughness(t), a = t + phase
                return Vec(x: rho * cos(a), y: s * half, z: rho * sin(a))
            case 6:
                let q = Double(lobes), r = radius * (0.72 + 0.28 * cos(q * t)), a = OrbitWrapGeometry.knotP(lobes) * t + phase
                return Vec(x: r * cos(a), y: half * 0.45 * sin(q * t), z: r * sin(a))
            case 7:
                let rho = radius * OrbitWrapGeometry.profile(profile, s) * roughness(t), a = t + phase
                return Vec(x: rho * cos(a), y: s * half + wave * half * 0.32 * sin(Double(lobes) * a), z: rho * sin(a))
            case 9:
                let u = (t - t0) / max(0.0001, t1 - t0), rho = radius * (0.15 + 0.85 * u) * roughness(t), a = t + phase
                return Vec(x: rho * cos(a), y: whirlY(t), z: rho * sin(a))
            default:
                let rho = radius * OrbitWrapGeometry.profile(profile, s) * roughness(t), a = t + phase
                return Vec(x: rho * cos(a), y: s * half + rho * sin(a) * sin(wobble), z: rho * sin(a) * cos(wobble))
            }
        }
    }

    struct Piece { var orbit: Int; var t0: Double; var t1: Double; var near: Bool; var face: Bool; var color: Int; var depth: Double; var startCap: Bool; var endCap: Bool }

    static func draw(_ operation: String, rect: CGRect, context: CGContext, values: [String: Double], inks given: [CGColor], text: String?, font: CTFont?, stage: ConstructionStage) -> Bool {
        guard operation == Self.operation else { return false }
        func n(_ key: String, _ fallback: Double, _ low: Double, _ high: Double) -> Double { ExtendedSurveyGeometry.value(values, key, fallback, low, high) }
        func count(_ key: String, _ fallback: Int, _ low: Int, _ high: Int) -> Int { Int(n(key, Double(fallback), Double(low), Double(high)).rounded()) }
        let layer = count(layerKey, 0, 0, 1), finished = stage != .blockout
        let paper = decode(values[paperKey]) ?? CGColor(srgbRed: 0.933, green: 0.918, blue: 0.882, alpha: 1)
        let black = CGColor(srgbRed: 0.05, green: 0.05, blue: 0.06, alpha: 1), white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
        let inks = given.isEmpty ? [black] : given
        let path = count("path", 1, 0, 9), turns = count("turns", 5, 1, 9), style = count("bandStyle", 0, 0, 9)
        let subject = count("subject", 1, 0, 7), inkMode = count("inkMode", 2, 0, 4), profileKind = count("profile", 0, 0, 5)
        let unit = min(rect.width, rect.height)
        let radius = n("radius", 0.56, 0.15, 0.8) * rect.width, half = n("height", 0.78, 0.1, 1) * rect.height / 2
        let camera = n("tilt", 0.16, -0.6, 0.6), lean = n("lean", -6, -40, 40) * Double.pi / 180
        let center = CGPoint(x: rect.minX + n("centerX", 0.5, 0.2, 0.8) * rect.width, y: rect.minY + n("centerY", 0.5, 0.2, 0.8) * rect.height)
        let band = n("band", 0.045, 0.004, 0.12) * unit, perspective = n("perspective", 0.2, 0, 1)
        let spin = n("spin", 0, 0, 1) * 2 * Double.pi, twist = n("twist", 1, 0, 4)
        let bend = n("bend", 0, -1, 1), taper = n("taper", 0, -1, 1)
        // Band styles that are flat tape in 3D (width along the axis, or radial for Saturn rings).
        let tapeLike = style == 1 || style == 2 || style == 9
        // Subjects and band inks: with three or more inks the last one belongs to the subject.
        let bandInks: [CGColor] = subject > 0 && inks.count >= 3 ? Array(inks.dropLast()) : inks
        let subjectInk: CGColor = inks.count >= 3 ? inks[inks.count - 1] : (inks.count == 2 ? inks[1] : mix(inks[0], black, 0.6))
        let cosL = cos(lean), sinL = sin(lean)

        /// Bending curls the axis along an arc in the page plane; depth is untouched, so near and far stay exact.
        let bendRadius = bend == 0 ? 0 : 2 * half / (bend * Double.pi * 0.75)
        func bent(_ v: Vec) -> Vec {
            if bend == 0 { return v }
            let phi = v.y / bendRadius, r = bendRadius - v.x
            return Vec(x: bendRadius - r * cos(phi), y: r * sin(phi), z: v.z)
        }
        func project(_ raw: Vec) -> CGPoint {
            let v = bent(raw), lx = v.x, ly = v.y + v.z * camera
            return CGPoint(x: center.x + lx * cosL - ly * sinL, y: center.y + lx * sinL + ly * cosL)
        }
        let axisDir = CGPoint(x: -sinL, y: cosL)

        // Orbits.
        var orbits: [Orbit] = []
        let seed = UInt64(n("shapeSeed", 817, 0, 9_000_000))
        var wobbleRandom = SeededRandom(seed: seed ^ 0x4f52_4249), jitterRandom = SeededRandom(seed: seed ^ 0x4a49_5454), swarmRandom = SeededRandom(seed: seed ^ 0x5357_524d)
        let wobble = n("wobble", 0, 0, 1), shift = n("shift", 0, -1, 1)
        var base = Orbit(index: 0, t0: 0, t1: 2 * Double.pi, closed: true, kind: path, radius: radius, half: half, s: 0, wobble: 0, turn: 0,
                         phase: spin, incline: n("incline", 0.95, 0.2, 1.5), stretch: min(2.4, max(0.2, half / max(radius, 0.0001))), profile: profileKind)
        base.spacing = n("spacing", 0, -1, 1); base.jitter = n("jitter", 0, 0, 1)
        switch path {
        case 1:
            var o = base; o.closed = false; o.t1 = 2 * Double.pi * Double(turns); orbits.append(o)
        case 3:
            for k in 0..<2 { var o = base; o.index = k; o.closed = false; o.t1 = 2 * Double.pi * Double(turns); o.phase = spin + Double(k) * Double.pi; orbits.append(o) }
        case 2:
            for i in 0..<turns { var o = base; o.index = i; o.turn = Double.pi * Double(i) / Double(turns); orbits.append(o) }
        case 4:
            // Saturn: flat rings at one height, stepping outward like a ring system.
            for i in 0..<turns {
                var o = base; o.index = i; o.s = shift
                o.radius = radius * (turns == 1 ? 1 : 0.55 + 0.45 * Double(i) / Double(turns - 1))
                orbits.append(o)
            }
        case 5:
            // Gimbals: nested great circles that alternate between almost flat and almost upright.
            for i in 0..<turns {
                var o = base; o.index = i; o.radius = radius * max(0.2, 1 - 0.15 * Double(i)); o.stretch = 1
                o.incline = i % 2 == 0 ? 0.28 : 1.32; o.turn = 0.45 + Double(i) * Double.pi / 3
                orbits.append(o)
            }
        case 6:
            var o = base; o.lobes = count("knotLobes", 3, 2, 7); orbits.append(o)
        case 8:
            // A swarm of small tilted orbits scattered through the subject's volume.
            for i in 0..<(turns * 3) {
                var o = base; o.index = i; o.stretch = 1
                o.radius = radius * 0.24 * swarmRandom.value(0.7, 1.3)
                o.offset = Vec(x: swarmRandom.value(-0.6, 0.6) * radius, y: swarmRandom.value(-0.85, 0.85) * half, z: swarmRandom.value(-0.6, 0.6) * radius)
                o.incline = swarmRandom.value(0.2, 1.4); o.turn = swarmRandom.value(0, Double.pi); o.phase = spin + swarmRandom.value(0, 2 * Double.pi)
                orbits.append(o)
            }
        case 9:
            var o = base; o.closed = false; o.t1 = 2 * Double.pi * Double(turns); o.s = shift; orbits.append(o)
        default:
            for i in 0..<turns {
                var o = base; o.index = i
                // Shift slides the rings along the axis; a single shifted ring floats like a halo.
                let spread = 1 - abs(shift)
                o.s = shift + (turns == 1 ? 0 : spread * (-1 + 2 * ramp((Double(i) + 0.5) / Double(turns), base.spacing)))
                o.wobble = wobble * wobbleRandom.value(-0.45, 0.45)
                if path == 7 { o.lobes = count("crownWaves", 5, 2, 9); o.wave = n("wave", 0.5, 0, 1) }
                orbits.append(o)
            }
        }
        if base.jitter > 0 { for i in orbits.indices { orbits[i].n1 = jitterRandom.value(0, 2 * Double.pi); orbits[i].n2 = jitterRandom.value(0, 2 * Double.pi) } }
        let openPath = path == 1 || path == 9
        let pieceCount = openPath ? turns : orbits.count
        func colorIndex(_ orbit: Orbit, _ t: Double) -> Int {
            guard openPath else { return orbit.index }
            return min(turns - 1, max(0, Int(floor((t - orbit.t0) / (2 * Double.pi)))))
        }
        func pieceColor(_ index: Int, near: Bool) -> CGColor {
            let k = bandInks.count
            switch inkMode {
            case 1: return near ? bandInks[0] : bandInks[min(1, k - 1)]
            case 2:
                let u = (Double(index) + 0.5) / Double(max(1, pieceCount))
                return bandInks[min(k - 1, Int(floor(u * Double(k))))]
            case 3:
                guard k > 1, pieceCount > 1 else { return bandInks[0] }
                let u = Double(index) / Double(pieceCount - 1) * Double(k - 1), i = min(k - 2, Int(floor(u)))
                return mix(bandInks[i], bandInks[i + 1], u - Double(i))
            case 4: return bandInks[index % k]
            default: return bandInks[0]
            }
        }

        // The band's 3D width vector: along the axis for tape (radial for Saturn rings), turning about the strand
        // for twisted ribbon.
        func widthVector(_ orbit: Orbit, _ t: Double) -> Vec {
            let p = orbit.point(t), radial = (p - orbit.axisPoint(t)).unit, axis = Vec(x: 0, y: 1, z: 0)
            let across = path == 4 ? radial : axis, other = path == 4 ? axis : radial
            if style == 2 {
                let tau = twist * (t - orbit.t0) / 2
                return (across * cos(tau) + other * sin(tau)) * band
            }
            return across * band
        }
        func depthScale(_ z: Double) -> Double { max(0.25, 1 + perspective * 0.6 * z / max(radius, 0.0001)) }
        /// Taper narrows or widens the band from the first turn (or ring) to the last.
        func widthScale(_ orbit: Orbit, _ t: Double) -> Double {
            if taper == 0 { return 1 }
            let u = orbit.closed ? Double(orbit.index) / Double(max(1, orbits.count - 1)) : (t - orbit.t0) / max(0.0001, orbit.t1 - orbit.t0)
            return max(0.12, 1 + taper * (2 * u - 1) * 0.85)
        }
        /// A point on the band: v runs from −0.5 to 0.5 across it.
        func surface(_ orbit: Orbit, _ t: Double, _ v: Double) -> CGPoint {
            let p = orbit.point(t)
            if !tapeLike {
                let dt = 0.002, a = project(orbit.point(t - dt)), b = project(orbit.point(t + dt)), c = project(p)
                let dx = b.x - a.x, dy = b.y - a.y, l = max(0.000001, hypot(dx, dy)), w = band * depthScale(p.z) * widthScale(orbit, t)
                return CGPoint(x: c.x - dy / l * w * v, y: c.y + dx / l * w * v)
            }
            let w = widthVector(orbit, t) * (depthScale(p.z) * widthScale(orbit, t))
            return project(p + w * v)
        }
        /// Whether a tape shows its outer face: its outward normal (width × tangent) turned toward the camera.
        let view = Vec(x: 0, y: -camera, z: 1)
        func faceOut(_ orbit: Orbit, _ t: Double) -> Bool {
            guard tapeLike else { return true }
            let w = widthVector(orbit, t), d = orbit.point(t + 0.001) - orbit.point(t - 0.001)
            let normal = Vec(x: w.y * d.z - w.z * d.y, y: w.z * d.x - w.x * d.z, z: w.x * d.y - w.y * d.x)
            return normal.x * view.x + normal.y * view.y + normal.z * view.z > 0
        }

        // Split every orbit where it crosses the axis plane, where a tape shows its other face, and between turns.
        // Self-crossing paths (gimbals, knot, swarm) are also cut into short slices so depth sorting stays local.
        var pieces: [Piece] = []
        let perTurn = stage == .finished ? 220 : 90
        let slice = [5, 6, 8].contains(path) ? 2 * Double.pi / 12 : 0
        for orbit in orbits {
            let span = orbit.t1 - orbit.t0, steps = max(48, Int(span / (2 * Double.pi) * Double(perTurn)))
            func key(_ t: Double) -> (Bool, Bool, Int, Int) {
                (orbit.point(t).z >= 0, faceOut(orbit, t), colorIndex(orbit, t), slice > 0 ? Int(floor((t - orbit.t0) / slice)) : 0)
            }
            // A closed ring is read from just past its seam, so a crossing that falls exactly on the seam is not missed.
            let start = orbit.closed ? orbit.t0 + 0.0137 : orbit.t0
            var cuts: [Double] = []
            var previous = key(start)
            for i in 1...steps {
                let t = start + span * Double(i) / Double(steps), current = key(t)
                if current != previous {
                    var lo = start + span * Double(i - 1) / Double(steps), hi = t
                    for _ in 0..<14 { let mid = (lo + hi) / 2; if key(mid) == previous { lo = mid } else { hi = mid } }
                    cuts.append((lo + hi) / 2)
                }
                previous = current
            }
            var bounds: [(Double, Double)] = []
            if orbit.closed && !cuts.isEmpty {
                for i in 0..<cuts.count { bounds.append((cuts[i], i + 1 < cuts.count ? cuts[i + 1] : cuts[0] + span)) }
            } else {
                let edges = [start] + cuts + [start + span]
                for i in 0..<(edges.count - 1) { bounds.append((edges[i], edges[i + 1])) }
            }
            for (a, b) in bounds where b - a > 0.00001 {
                let mid = (a + b) / 2, k = key(mid)
                var depth = 0.0
                for j in 0...6 { depth += orbit.point(a + (b - a) * Double(j) / 6).z }
                pieces.append(Piece(orbit: orbit.index, t0: a, t1: b, near: k.0, face: k.1, color: k.2, depth: depth / 7,
                                    startCap: !orbit.closed && abs(a - orbit.t0) < 0.00001, endCap: !orbit.closed && abs(b - orbit.t1) < 0.00001))
            }
        }
        func orbitOf(_ piece: Piece) -> Orbit { orbits.first { $0.index == piece.orbit } ?? orbits[0] }
        func stripRange(_ orbit: Orbit, _ ta: Double, _ tb: Double, _ v0: Double, _ v1: Double) -> CGPath {
            let steps = max(6, Int((tb - ta) / (2 * Double.pi) * Double(perTurn)))
            let out = CGMutablePath()
            for i in 0...steps { let t = ta + (tb - ta) * Double(i) / Double(steps), q = surface(orbit, t, v0); if i == 0 { out.move(to: q) } else { out.addLine(to: q) } }
            for i in stride(from: steps, through: 0, by: -1) { out.addLine(to: surface(orbit, ta + (tb - ta) * Double(i) / Double(steps), v1)) }
            out.closeSubpath()
            return out
        }
        func strip(_ piece: Piece, _ v0: Double, _ v1: Double) -> CGPath { stripRange(orbitOf(piece), piece.t0, piece.t1, v0, v1) }
        func centerline(_ piece: Piece) -> CGPath {
            let orbit = orbitOf(piece), steps = max(6, Int((piece.t1 - piece.t0) / (2 * Double.pi) * Double(perTurn)))
            let out = CGMutablePath()
            for i in 0...steps { let q = project(orbit.point(piece.t0 + (piece.t1 - piece.t0) * Double(i) / Double(steps))); if i == 0 { out.move(to: q) } else { out.addLine(to: q) } }
            return out
        }
        /// 3D arc length along an orbit, for dashes, chain links and zipper teeth that never restart at a cut.
        var arcTables: [Int: (ts: [Double], lengths: [Double])] = [:]
        func arcTable(_ orbit: Orbit) -> (ts: [Double], lengths: [Double]) {
            if let table = arcTables[orbit.index] { return table }
            let steps = 1200 * max(1, Int(((orbit.t1 - orbit.t0) / (2 * Double.pi)).rounded(.up)))
            var ts: [Double] = [orbit.t0], lengths: [Double] = [0], last = orbit.point(orbit.t0)
            for i in 1...steps {
                let t = orbit.t0 + (orbit.t1 - orbit.t0) * Double(i) / Double(steps), p = orbit.point(t)
                lengths.append(lengths[i - 1] + (p - last).length); ts.append(t); last = p
            }
            arcTables[orbit.index] = (ts, lengths)
            return (ts, lengths)
        }
        func lengthAt(_ orbit: Orbit, _ t: Double) -> Double {
            let table = arcTable(orbit), span = orbit.t1 - orbit.t0, total = table.lengths.last ?? 0
            var local = t - orbit.t0, laps = 0.0
            if orbit.closed { laps = floor(local / span); local -= laps * span }
            let u = min(1, max(0, local / span)) * Double(table.ts.count - 1), i = min(table.ts.count - 2, Int(floor(u)))
            return laps * total + table.lengths[i] + (table.lengths[i + 1] - table.lengths[i]) * (u - Double(i))
        }
        func tAtLength(_ orbit: Orbit, _ s: Double) -> Double {
            let table = arcTable(orbit), span = orbit.t1 - orbit.t0, total = max(0.000001, table.lengths.last ?? 0)
            var local = s, laps = 0.0
            if orbit.closed { laps = floor(local / total); local -= laps * total }
            var lo = 0, hi = table.lengths.count - 1
            while hi - lo > 1 { let mid = (lo + hi) / 2; if table.lengths[mid] < local { lo = mid } else { hi = mid } }
            let gap = max(0.000001, table.lengths[hi] - table.lengths[lo])
            return table.ts[lo] + (table.ts[hi] - table.ts[lo]) * min(1, max(0, (local - table.lengths[lo]) / gap)) + laps * span
        }

        context.saveGState(); defer { context.restoreGState() }
        context.setLineJoin(.round); context.setLineCap(.round)
        let glow = finished ? n("glow", 0, 0, 1) : 0, keyline = finished ? n("keyline", 0, 0, 1) : 0
        let fade = n("backFade", 0, 0, 1), shade = finished ? n("shade", 0, 0, 1) : 0, outline = count("outline", 0, 0, 1) == 1
        let printed = count("bandCopy", 0, 0, 1) == 1, showThrough = printed && count("backCopy", 0, 0, 1) == 1
        // Shadow and echo passes repaint the construction in one flat colour (override) or toned toward the paper.
        var override: CGColor? = nil, toneShift = 0.0
        func tone(_ c: CGColor) -> CGColor {
            if let override { return override }
            return toneShift > 0 ? mix(c, paper, toneShift) : c
        }
        let plainPass = { override == nil && toneShift == 0 }
        func glowing(_ color: CGColor) { if glow > 0 && plainPass() { context.setShadow(offset: .zero, blur: glow * unit * 0.07, color: color.copy(alpha: 0.95)) } else { context.setShadow(offset: .zero, blur: 0, color: nil) } }
        func colorFor(_ piece: Piece) -> CGColor {
            var c = pieceColor(piece.color, near: piece.near)
            // A tape shows its inside on the far arcs: a darker tone of the ink, or a lighter one for near-black inks.
            // A twisted ribbon in one ink shows the second ink on its other face.
            if style == 2 && !piece.face && inkMode == 0 && bandInks.count > 1 { c = bandInks[1] }
            else if tapeLike && !piece.face { c = luma(c) < 0.18 ? mix(c, paper, 0.32) : mix(c, black, 0.5) }
            if !piece.near && fade > 0 { c = mix(c, paper, fade * 0.72) }
            return tone(c)
        }
        func markColor(_ orbit: Orbit, _ t: Double, near: Bool) -> CGColor {
            var color = pieceColor(colorIndex(orbit, t), near: near)
            if !near && fade > 0 { color = mix(color, paper, fade * 0.72) }
            return tone(color)
        }
        /// Marks at even 3D arc-length spacing along every orbit, nearest last, in the pass their depth puts them in.
        func marks(near: Bool, spacing: Double) -> [(Orbit, Double, Int)] {
            var out: [(Orbit, Double, Int)] = []
            for orbit in orbits {
                let total = arcTable(orbit).lengths.last ?? 0
                guard spacing > 0, total > 0 else { continue }
                var k = 0, s = spacing * 0.5
                while s < total { let t = tAtLength(orbit, s); if (orbit.point(t).z >= 0) == near { out.append((orbit, t, k)) }; k += 1; s += spacing }
            }
            return out.sorted { $0.0.point($0.1).z < $1.0.point($1.1).z }
        }
        func tangent(_ orbit: Orbit, _ t: Double) -> CGPoint {
            let a = project(orbit.point(t - 0.002)), b = project(orbit.point(t + 0.002)), l = max(0.000001, hypot(b.x - a.x, b.y - a.y))
            return CGPoint(x: (b.x - a.x) / l, y: (b.y - a.y) / l)
        }
        func quad(_ c: CGPoint, _ d: CGPoint, along: Double, across: Double) -> CGPath {
            let nx = -d.y, ny = d.x, out = CGMutablePath()
            out.addLines(between: [CGPoint(x: c.x - d.x * along - nx * across, y: c.y - d.y * along - ny * across), CGPoint(x: c.x + d.x * along - nx * across, y: c.y + d.y * along - ny * across),
                                   CGPoint(x: c.x + d.x * along + nx * across, y: c.y + d.y * along + ny * across), CGPoint(x: c.x - d.x * along + nx * across, y: c.y - d.y * along + ny * across)])
            out.closeSubpath(); return out
        }
        /// Chain links (flat rings alternating with edge-on bars) or zipper teeth on alternating sides of the tape.
        func linksAndTeeth(near: Bool) {
            let teeth = style == 7
            for (orbit, t, k) in marks(near: near, spacing: teeth ? band * 0.55 : band * 1.75) {
                let p = orbit.point(t), c = project(p), d = tangent(orbit, t), size = band * depthScale(p.z) * widthScale(orbit, t)
                let color = markColor(orbit, t, near: near)
                glowing(color)
                if teeth {
                    let side = k % 2 == 0 ? 1.0 : -1.0, center = CGPoint(x: c.x - d.y * side * size * 0.26, y: c.y + d.x * side * size * 0.26)
                    context.setFillColor(color); context.addPath(quad(center, d, along: size * 0.17, across: size * 0.24)); context.fillPath()
                } else if k % 2 == 0 {
                    var transform = CGAffineTransform(translationX: c.x, y: c.y).rotated(by: atan2(d.y, d.x))
                    let ring = CGPath(ellipseIn: CGRect(x: -size * 1.05, y: -size * 0.52, width: size * 2.1, height: size * 1.04), transform: &transform)
                    context.setStrokeColor(color); context.setLineWidth(size * 0.3); context.addPath(ring); context.strokePath()
                } else {
                    context.setFillColor(color); context.addPath(quad(c, d, along: size * 1.05, across: size * 0.15)); context.fillPath()
                }
            }
            context.setShadow(offset: .zero, blur: 0, color: nil)
        }
        /// Ladder rungs between the two strands of a double coil, split where they cross the axis plane.
        func rungs(near: Bool) {
            let perTurnRungs = count("rungs", 0, 0, 12)
            guard path == 3, perTurnRungs > 0, orbits.count == 2 else { return }
            let a = orbits[0], b = orbits[1], total = perTurnRungs * turns
            for k in 0..<total {
                let t = a.t0 + (a.t1 - a.t0) * (Double(k) + 0.5) / Double(total), pa = a.point(t), pb = b.point(t)
                let nearEnd = pa.z >= pb.z ? pa : pb, farEnd = pa.z >= pb.z ? pb : pa
                var from = near ? nearEnd : farEnd, to = near ? farEnd : nearEnd
                if (nearEnd.z >= 0) != (farEnd.z >= 0) {
                    let lam = nearEnd.z / (nearEnd.z - farEnd.z), split = nearEnd + (farEnd - nearEnd) * lam
                    to = split
                } else if (nearEnd.z >= 0) != near { continue } else { from = nearEnd; to = farEnd }
                let color = tone(bandInks.count >= 3 ? bandInks[2] : mix(bandInks[0], paper, 0.45))
                context.setStrokeColor(color); context.setLineWidth(band * 0.34 * depthScale((from.z + to.z) / 2)); context.setLineCap(.round)
                context.move(to: project(from)); context.addLine(to: project(to)); context.strokePath()
            }
        }

        // Beads and satellites belong to an orbit, not a piece, so their spacing never restarts.
        func dots(near: Bool) {
            for orbit in orbits {
                var marks: [(Double, Double)] = []
                if style == 3 {
                    let spacing = band * 1.7, steps = 600 * max(1, Int((orbit.t1 - orbit.t0) / (2 * Double.pi)))
                    var travelled = 0.0, last = orbit.point(orbit.t0), next = 0.0
                    for i in 0...steps {
                        let t = orbit.t0 + (orbit.t1 - orbit.t0) * Double(i) / Double(steps), p = orbit.point(t)
                        travelled += (p - last).length; last = p
                        if travelled >= next { marks.append((t, 0.5)); next += spacing }
                    }
                } else if style == 4 {
                    let satellites = count("satellites", 2, 0, 6)
                    for k in 0..<satellites { marks.append((orbit.t0 + (orbit.t1 - orbit.t0) * (Double(k) + 0.5) / Double(satellites), 0.9)) }
                }
                for (t, size) in marks.sorted(by: { orbit.point($0.0).z < orbit.point($1.0).z }) {
                    let p = orbit.point(t)
                    guard (p.z >= 0) == near else { continue }
                    let r = band * size * depthScale(p.z) * widthScale(orbit, t), c = project(p)
                    let color = markColor(orbit, t, near: near)
                    context.setFillColor(color); glowing(color)
                    context.fillEllipse(in: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
                }
            }
            context.setShadow(offset: .zero, blur: 0, color: nil)
        }

        func paintPieces(near: Bool) {
            let chosen = pieces.filter { $0.near == near }.sorted { $0.depth < $1.depth }
            if near { rungs(near: true) }
            defer { if !near { rungs(near: false) } }
            if style == 3 { dots(near: near); return }
            if style == 6 { linksAndTeeth(near: near); return }
            for piece in chosen {
                let color = colorFor(piece)
                if style == 4 {
                    context.setShadow(offset: .zero, blur: 0, color: nil)
                    if near && keyline > 0 && plainPass() { context.setStrokeColor(paper); context.setLineWidth(max(unit * 0.002, band * 0.2) + keyline * unit * 0.016); context.addPath(centerline(piece)); context.strokePath() }
                    context.setStrokeColor(color); glowing(color); context.setLineWidth(max(unit * 0.0018, band * 0.2)); context.addPath(centerline(piece)); context.strokePath()
                    continue
                }
                if style == 5 {
                    // Dashes at even 3D spacing, phase-locked along the whole orbit.
                    // Short duty reads as barcode bars across the band, long duty as dashes.
                    let orbit = orbitOf(piece), period = band * 1.3, duty = n("dashDuty", 0.5, 0.15, 0.85)
                    let sa = lengthAt(orbit, piece.t0), sb = lengthAt(orbit, piece.t1)
                    var k = floor(sa / period)
                    glowing(color); context.setFillColor(color)
                    while k * period < sb {
                        let a = max(sa, k * period), b = min(sb, k * period + duty * period)
                        if b > a { context.addPath(stripRange(orbit, tAtLength(orbit, a), tAtLength(orbit, b), -0.5, 0.5)) }
                        k += 1
                    }
                    context.fillPath(); context.setShadow(offset: .zero, blur: 0, color: nil)
                    continue
                }
                if style == 7 {
                    // Zipper: a narrow tape; its teeth are drawn after the pieces of this pass.
                    glowing(color); context.setFillColor(color); context.addPath(strip(piece, -0.09, 0.09)); context.fillPath()
                    continue
                }
                if style == 8 {
                    // Double neon line: two rails along the band's edges.
                    glowing(color); context.setFillColor(color); context.addPath(strip(piece, -0.5, -0.36)); context.addPath(strip(piece, 0.36, 0.5)); context.fillPath()
                    continue
                }
                let body = strip(piece, -0.5, 0.5)
                let caps = CGMutablePath()
                if style == 0 {
                    let orbit = orbitOf(piece)
                    for (flag, t) in [(piece.startCap, piece.t0), (piece.endCap, piece.t1)] where flag {
                        let p = orbit.point(t), c = project(p), r = band * depthScale(p.z) * widthScale(orbit, t) / 2
                        caps.addEllipse(in: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
                    }
                }
                if near && keyline > 0 && plainPass() {
                    context.setShadow(offset: .zero, blur: 0, color: nil)
                    context.setStrokeColor(paper); context.setLineWidth(keyline * unit * 0.022)
                    context.addPath(body); context.addPath(caps); context.strokePath()
                }
                glowing(color)
                if outline {
                    context.setStrokeColor(color); context.setLineWidth(max(unit * 0.0022, band * 0.07))
                    context.addPath(body); context.addPath(caps); context.strokePath()
                    continue
                }
                context.setFillColor(color); context.addPath(body); context.addPath(caps); context.fillPath()
                context.setShadow(offset: .zero, blur: 0, color: nil)
                if style == 9 {
                    // Striped tape: a centre stripe in the second ink (or a light tone), darker on the inside face.
                    var stripe = bandInks.count > 1 && inkMode != 4 ? bandInks[1] : mix(pieceColor(piece.color, near: piece.near), white, 0.62)
                    if !piece.face { stripe = mix(stripe, black, 0.45) }
                    context.setFillColor(tone(stripe)); context.addPath(strip(piece, -0.17, 0.17)); context.fillPath()
                }
                if style == 0 && shade > 0 {
                    // A tube catches light along one edge and falls into shadow along the other.
                    context.setFillColor(tone(mix(colorFor(piece), white, 0.5 * shade))); context.addPath(strip(piece, -0.36, -0.06)); context.fillPath()
                    context.setFillColor(tone(mix(colorFor(piece), white, 0.85 * shade))); context.addPath(strip(piece, -0.28, -0.17)); context.fillPath()
                    context.setFillColor(tone(mix(colorFor(piece), black, 0.32 * shade))); context.addPath(strip(piece, 0.24, 0.5)); context.fillPath()
                }
                let copyStyle = style <= 2 || style == 9
                if copyStyle && finished && plainPass() && ((near && piece.face && printed) || (!near && showThrough)) {
                    // Specimens carry no brief: they print the specimen title. Far arcs show the copy through the band,
                    // mirrored, as if read from behind.
                    let face = font ?? FontLibrary.font(name: "HelveticaNeue-Bold")
                    let ink = luma(color) < 0.55 ? paper : black
                    context.setFillColor(near ? ink : ink.copy(alpha: 0.55)!)
                    context.addPath(copy(piece, title: text ?? "FORM & SPACE", font: face, mirrored: !near)); context.fillPath()
                }
            }
            context.setShadow(offset: .zero, blur: 0, color: nil)
            // Satellites ride the hairline, teeth ride the zipper, each in the pass its own depth puts it in.
            if style == 4 { dots(near: near) }
            if style == 7 { linksAndTeeth(near: near) }
        }

        /// The title wound onto the visible band: glyph outlines are mapped point by point onto the strip, so they
        /// foreshorten toward the silhouette like print on a turning surface. Mirrored copy runs the same way round
        /// the orbit as the near copy, so on the far arcs it reads back to front.
        func copy(_ piece: Piece, title: String, font: CTFont, mirrored: Bool = false) -> CGPath {
            let orbit = orbitOf(piece), out = CGMutablePath()
            // Arc length table in 3D along the piece.
            let steps = 400
            var ts: [Double] = [piece.t0], lengths: [Double] = [0], last = orbit.point(piece.t0)
            for i in 1...steps { let t = piece.t0 + (piece.t1 - piece.t0) * Double(i) / Double(steps), p = orbit.point(t); lengths.append(lengths[i - 1] + (p - last).length); ts.append(t); last = p }
            let total = lengths[steps]
            guard total > band else { return out }
            func tAt(_ s: Double) -> Double {
                var lo = 0, hi = steps
                while hi - lo > 1 { let mid = (lo + hi) / 2; if lengths[mid] < s { lo = mid } else { hi = mid } }
                let span = max(0.000001, lengths[hi] - lengths[lo])
                return ts[lo] + (ts[hi] - ts[lo]) * min(1, max(0, (s - lengths[lo]) / span))
            }
            // Read left to right on the page, letters upright against the axis.
            let forward = mirrored ? false : surface(orbit, piece.t0, 0).x <= surface(orbit, piece.t1, 0).x
            let mid = (piece.t0 + piece.t1) / 2, across = surface(orbit, mid, 0.5), back = surface(orbit, mid, -0.5)
            let downward = (across.x - back.x) * axisDir.x + (across.y - back.y) * axisDir.y > 0
            let em = band * 0.78, scale = em / CTFontGetSize(font), cap = CTFontGetCapHeight(font) * scale
            let line = CTLineCreateWithAttributedString(NSAttributedString(string: title.uppercased() + "  ·  ", attributes: [.font: font]))
            let width = CTLineGetTypographicBounds(line, nil, nil, nil) * scale
            guard width > 0 else { return out }
            var glyphs: [(CGPath, Double, Double)] = []
            for run in CTLineGetGlyphRuns(line) as! [CTRun] {
                let k = CTRunGetGlyphCount(run)
                var ids = [CGGlyph](repeating: 0, count: k), positions = [CGPoint](repeating: .zero, count: k), advances = [CGSize](repeating: .zero, count: k)
                CTRunGetGlyphs(run, CFRange(location: 0, length: k), &ids); CTRunGetPositions(run, CFRange(location: 0, length: k), &positions); CTRunGetAdvances(run, CFRange(location: 0, length: k), &advances)
                let runFont = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
                for i in 0..<k { if let g = CTFontCreatePathForGlyph(runFont, ids[i], nil) { glyphs.append((g, positions[i].x * scale, advances[i].width * scale)) } }
            }
            var offset = em * 0.4
            while offset + width * 0.2 < total {
                for (glyph, x, advance) in glyphs {
                    let start = offset + x
                    guard start + advance <= total - em * 0.2 else { break }
                    glyph.applyWithBlock { pointer in
                        let element = pointer.pointee
                        func map(_ p: CGPoint) -> CGPoint {
                            let along = start + p.x * scale, s = forward ? along : total - along
                            let v = (p.y * scale - cap / 2) / (band * 1.0)
                            return surface(orbit, tAt(s), downward ? -v : v)
                        }
                        switch element.type {
                        case .moveToPoint: out.move(to: map(element.points[0]))
                        case .addLineToPoint: out.addLine(to: map(element.points[0]))
                        case .addQuadCurveToPoint: out.addQuadCurve(to: map(element.points[1]), control: map(element.points[0]))
                        case .addCurveToPoint: out.addCurve(to: map(element.points[2]), control1: map(element.points[0]), control2: map(element.points[1]))
                        case .closeSubpath: out.closeSubpath()
                        @unknown default: break
                        }
                    }
                }
                offset += width
            }
            return out
        }

        func polygon(_ points: [Vec]) -> CGMutablePath {
            let out = CGMutablePath(); out.addLines(between: points.map(project)); out.closeSubpath(); return out
        }
        func paintSubject() {
            guard subject > 0 else { return }
            let scale = n("subjectScale", 0.5, 0.2, 0.95), shading = finished && plainPass() ? n("shadeSubject", 0.35, 0, 1) : 0
            let ink = tone(subjectInk)
            var silhouette: CGPath = CGMutablePath()
            let cap = CGMutablePath()
            switch subject {
            case 1:
                // A solid of revolution on the orbit's own profile (a sphere for crossed orbits), with its end caps.
                let kind = path == 2 ? 1 : profileKind, steps = 48
                var left: [CGPoint] = [], right: [CGPoint] = []
                for i in 0...steps {
                    let s = -0.96 + 1.92 * Double(i) / Double(steps), rho = radius * scale * profile(kind, s), y = s * half
                    left.append(project(Vec(x: -rho, y: y, z: 0))); right.append(project(Vec(x: rho, y: y, z: 0)))
                }
                let side = CGMutablePath(); side.addLines(between: left + right.reversed()); side.closeSubpath()
                silhouette = side
                for s in [-0.96, 0.96] {
                    let rho = radius * scale * profile(kind, s), ring = CGMutablePath()
                    for i in 0...72 { let a = Double(i) / 72 * 2 * Double.pi, q = project(Vec(x: rho * cos(a), y: s * half, z: rho * sin(a))); if i == 0 { ring.move(to: q) } else { ring.addLine(to: q) } }
                    ring.closeSubpath(); silhouette = silhouette.union(ring)
                    if (camera >= 0) == (s < 0) { cap.addPath(ring) }
                }
            case 2:
                let a = radius * scale * 0.62, d = radius * scale * 0.34, h = half * 0.98
                let front = polygon([Vec(x: -a, y: -h, z: d), Vec(x: a, y: -h, z: d), Vec(x: a, y: h, z: d), Vec(x: -a, y: h, z: d)])
                let y = camera >= 0 ? -h : h
                cap.addPath(polygon([Vec(x: -a, y: y, z: -d), Vec(x: a, y: y, z: -d), Vec(x: a, y: y, z: d), Vec(x: -a, y: y, z: d)]))
                silhouette = front.union(cap)
            case 4:
                // A torus lying round the axis: tube discs painted far to near, each lit from the upper left.
                let core = radius * scale * 0.82, tube = radius * scale * 0.22
                let discs = (0..<120).map { i -> Vec in let a = Double(i) / 120 * 2 * Double.pi; return Vec(x: core * cos(a), y: 0, z: core * sin(a)) }.sorted { $0.z < $1.z }
                for p in discs {
                    let c = project(p), r = tube * depthScale(p.z)
                    if shading > 0, let g = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [mix(ink, white, 0.45 * shading), ink, mix(ink, black, 0.35 * shading)] as CFArray, locations: [0, 0.55, 1]) {
                        context.saveGState(); context.addEllipse(in: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)); context.clip()
                        context.drawRadialGradient(g, startCenter: CGPoint(x: c.x - r * 0.35, y: c.y - r * 0.4), startRadius: 0, endCenter: c, endRadius: r * 1.05, options: [.drawsAfterEndLocation])
                        context.restoreGState()
                    } else { context.setFillColor(ink); context.fillEllipse(in: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)) }
                }
                return
            case 5:
                // An upright pill: two half circles joined by straight sides, facing the camera.
                let r = radius * scale * 0.55, h = max(r, half * 0.92), outline = CGMutablePath()
                var points: [Vec] = []
                for i in 0...24 { let a = Double.pi + Double.pi * Double(i) / 24; points.append(Vec(x: r * cos(a), y: -h + r + r * sin(a), z: 0)) }
                for i in 0...24 { let a = Double.pi * Double(i) / 24; points.append(Vec(x: r * cos(a), y: h - r + r * sin(a), z: 0)) }
                outline.addLines(between: points.map(project)); outline.closeSubpath()
                silhouette = outline
            case 6:
                // A faceted five-point star facing the camera; each arm folds into a light and a dark facet.
                let outer = radius * scale * 1.1, inner = outer * 0.42, turn = -Double.pi / 2 + spin * 0.2
                func tip(_ k: Int, _ r: Double) -> Vec { let a = turn + Double(k) * Double.pi / 5; return Vec(x: r * cos(a), y: r * sin(a) * 1.0, z: 0) }
                let middle = Vec(x: 0, y: 0, z: 0), all = CGMutablePath()
                for k in 0..<10 {
                    let a = tip(k, k % 2 == 0 ? outer : inner), b = tip(k + 1, (k + 1) % 2 == 0 ? outer : inner)
                    let facet = polygon([middle, a, b]); all.addPath(facet)
                    context.setFillColor(shading > 0 ? (k % 2 == 0 ? mix(ink, white, 0.3 * shading) : mix(ink, black, 0.3 * shading)) : ink)
                    context.addPath(facet); context.fillPath()
                }
                return
            case 7:
                // A striped orb: latitude bands in two tones, foreshortened by the camera.
                let r = radius * scale * 0.9, bands = 7, outline = CGMutablePath()
                var rim: [CGPoint] = []
                for i in 0...96 { let a = Double(i) / 96 * 2 * Double.pi; rim.append(project(Vec(x: r * cos(a), y: r * sin(a) * (1 + camera * camera).squareRoot(), z: 0))) }
                outline.addLines(between: rim); outline.closeSubpath()
                context.setFillColor(ink); context.addPath(outline); context.fillPath()
                context.saveGState(); context.addPath(outline); context.clip()
                let light = mix(ink, white, 0.55)
                for k in stride(from: 0, to: bands, by: 2) {
                    let lower = -Double.pi / 2 + Double.pi * Double(k) / Double(bands), upper = -Double.pi / 2 + Double.pi * Double(k + 1) / Double(bands)
                    var points: [Vec] = []
                    for i in 0...36 { let a = Double.pi * Double(i) / 36; points.append(Vec(x: r * cos(lower) * cos(a), y: r * sin(lower), z: r * cos(lower) * sin(a))) }
                    for i in stride(from: 36, through: 0, by: -1) { let a = Double.pi * Double(i) / 36; points.append(Vec(x: r * cos(upper) * cos(a), y: r * sin(upper), z: r * cos(upper) * sin(a))) }
                    context.setFillColor(override ?? tone(light)); context.addPath(polygon(points)); context.fillPath()
                }
                context.restoreGState()
                silhouette = outline
                if shading > 0, let g = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [white.copy(alpha: 0.35 * shading)!, white.copy(alpha: 0)!, black.copy(alpha: 0.4 * shading)!] as CFArray, locations: [0, 0.45, 1]) {
                    let box = outline.boundingBoxOfPath
                    context.saveGState(); context.addPath(outline); context.clip()
                    context.drawRadialGradient(g, startCenter: CGPoint(x: box.midX - box.width * 0.2, y: box.midY - box.height * 0.22), startRadius: 0, endCenter: CGPoint(x: box.midX, y: box.midY), endRadius: max(box.width, box.height) * 0.62, options: [.drawsAfterEndLocation])
                    context.restoreGState()
                }
                return
            default:
                let r = radius * scale * 1.15
                guard plainPass() else { context.setFillColor(ink); context.fillEllipse(in: CGRect(x: center.x - r * 0.4, y: center.y - r * 0.4, width: r * 0.8, height: r * 0.8)); return }
                guard let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [subjectInk, subjectInk.copy(alpha: 0.5)!, subjectInk.copy(alpha: 0)!] as CFArray, locations: [0, 0.35, 1]) else { return }
                if finished { context.drawRadialGradient(gradient, startCenter: center, startRadius: 0, endCenter: center, endRadius: r, options: []) }
                else { context.setFillColor(subjectInk); context.fillEllipse(in: CGRect(x: center.x - r * 0.4, y: center.y - r * 0.4, width: r * 0.8, height: r * 0.8)) }
                return
            }
            context.setFillColor(ink); context.addPath(silhouette); context.fillPath(using: .winding)
            if !cap.isEmpty { context.setFillColor(override ?? tone(mix(subjectInk, paper, 0.22))); context.addPath(cap); context.fillPath() }
            if shading > 0, let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [white.copy(alpha: 0.3 * shading)!, white.copy(alpha: 0)!, black.copy(alpha: 0)!, black.copy(alpha: 0.42 * shading)!] as CFArray, locations: [0, 0.38, 0.6, 1]) {
                context.saveGState(); context.addPath(silhouette); context.clip()
                let box = silhouette.boundingBoxOfPath
                context.drawLinearGradient(gradient, start: CGPoint(x: box.minX, y: box.midY), end: CGPoint(x: box.maxX, y: box.midY), options: [])
                context.restoreGState()
            }
        }

        /// Repeats a drawing at a golden-angle spread of small offsets, so it reads as softly blurred.
        func soft(radius spread: Double, coverage: Double, _ body: () -> Void) {
            let samples = 12, alpha = 1 - pow(1 - coverage, 1 / Double(samples))
            context.saveGState(); context.setAlpha(alpha)
            for k in 0..<samples {
                let a = Double(k) * 2.399963, r = spread * ((Double(k) + 0.5) / Double(samples)).squareRoot()
                context.saveGState(); context.translateBy(x: cos(a) * r, y: sin(a) * r); body(); context.restoreGState()
            }
            context.restoreGState()
        }

        if layer == 0 {
            let shadow = finished ? n("shadow", 0, 0, 1) : 0, echoes = count("echo", 0, 0, 5), blur = finished ? n("depthBlur", 0, 0, 1) : 0
            if shadow > 0 {
                // A soft drop shadow of the whole construction on the paper, below every pass.
                override = black
                context.saveGState(); context.translateBy(x: unit * 0.028 * shadow, y: unit * 0.05 * shadow)
                soft(radius: unit * 0.04 * shadow, coverage: 0.42 * shadow) { paintPieces(near: false); paintSubject(); paintPieces(near: true) }
                context.restoreGState(); override = nil
            }
            if echoes > 0 {
                // Echo trail: earlier positions of the whole construction, fading toward the paper.
                for e in stride(from: echoes, through: 1, by: -1) {
                    toneShift = 0.3 + 0.55 * Double(e) / Double(echoes + 1)
                    context.saveGState(); context.translateBy(x: unit * 0.024 * Double(e), y: unit * 0.032 * Double(e))
                    paintPieces(near: false); paintSubject(); paintPieces(near: true)
                    context.restoreGState()
                }
                toneShift = 0
            }
            if blur > 0 { soft(radius: unit * 0.03 * blur, coverage: 0.97) { paintPieces(near: false) } } else { paintPieces(near: false) }
            paintSubject()
        } else { paintPieces(near: true) }
        return true
    }
}
