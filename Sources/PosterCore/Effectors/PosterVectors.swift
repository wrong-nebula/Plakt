import CoreGraphics
import Foundation

/// Reads the painted vector content of a PDF page and writes it as plain filled SVG paths, so effectors and
/// modifiers can act on a poster's real outlines. Fills keep their colour, alpha and fill rule; strokes become
/// filled outlines of their width, caps, joins and dashes; form XObjects are followed. PosterLab outlines its
/// type, so text already arrives as paths. Images, shadings, clipping and live text are reported, not converted.
public enum PosterVectors {
    public struct Conversion: Sendable {
        public let svg: String
        public let paths: Int
        public let skipped: [String]
        public let size: CGSize
    }

    public static func svg(pdf data: Data, page index: Int = 1) throws -> Conversion {
        guard let provider = CGDataProvider(data: data as CFData), let document = CGPDFDocument(provider),
              let page = document.page(at: index) else { throw PosterError.invalid("The PDF could not be read.") }
        return svg(page: page)
    }

    public static func svg(pdfAt url: URL) throws -> Conversion {
        guard let document = CGPDFDocument(url as CFURL), let page = document.page(at: 1) else {
            throw PosterError.invalid("\(url.lastPathComponent) is not a readable PDF.")
        }
        return svg(page: page)
    }

    public static func svg(page: CGPDFPage) -> Conversion {
        let box = page.getBoxRect(.cropBox)
        let reader = VectorReader(output: CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: -box.minX, ty: box.maxY))
        let stream = CGPDFContentStreamCreateWithPage(page)
        reader.scan(stream)
        CGPDFContentStreamRelease(stream)
        let w = format(box.width), h = format(box.height)
        let svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\(w)\" height=\"\(h)\" viewBox=\"0 0 \(w) \(h)\">"
            + reader.paths.joined() + "</svg>"
        return Conversion(svg: svg, paths: reader.paths.count, skipped: reader.skipped.sorted(), size: box.size)
    }

    /// Draws an SVG made only of a background rect and M/L/Z paths (the effector editor's export) as a vector PDF.
    /// The page is A4 wide in points and keeps the SVG's proportions.
    public static func pdf(fromSVG svg: String) throws -> Data {
        guard let viewBox = attribute("viewBox", in: svg)?.split(whereSeparator: { $0 == " " || $0 == "," }).compactMap({ Double($0) }),
              viewBox.count == 4, viewBox[2] > 0, viewBox[3] > 0 else { throw PosterError.invalid("The SVG has no viewBox.") }
        let scale = 595.28 / viewBox[2]
        var box = CGRect(x: 0, y: 0, width: 595.28, height: viewBox[3] * scale)
        let data = NSMutableData()
        guard let consumer = CGDataConsumer(data: data as CFMutableData),
              let ctx = CGContext(consumer: consumer, mediaBox: &box, nil) else { throw PosterError.render }
        ctx.beginPDFPage(nil)
        ctx.translateBy(x: 0, y: box.height); ctx.scaleBy(x: scale, y: -scale); ctx.translateBy(x: -viewBox[0], y: -viewBox[1])
        var drawn = 0, gradients: [String: Gradient] = [:], building: Gradient?
        for tag in elements(in: svg) {
            // Colour modifiers write each gradient just before the path that uses it.
            if tag.hasPrefix("<linearGradient") || tag.hasPrefix("<radialGradient") { building = Gradient(tag: tag); continue }
            if tag.hasPrefix("<stop") { building?.add(stop: tag); continue }
            if tag.hasPrefix("</") { if let g = building, let id = g.id { gradients[id] = g }; building = nil; continue }
            let alpha = attribute("fill-opacity", in: tag).flatMap(Double.init) ?? 1
            if let url = attribute("fill", in: tag), url.hasPrefix("url(#"), let g = gradients[String(url.dropFirst(5).dropLast())],
               let d = attribute("d", in: tag) {
                if g.fill(path(d), rule: attribute("fill-rule", in: tag) == "evenodd" ? .evenOdd : .winding, alpha: alpha, in: ctx) { drawn += 1 }
                continue
            }
            guard let fill = attribute("fill", in: tag).flatMap(color) else { continue }
            ctx.setFillColor(red: fill.r, green: fill.g, blue: fill.b, alpha: alpha)
            if tag.hasPrefix("<rect") {
                let n = { (k: String) in attribute(k, in: tag).flatMap(Double.init) ?? 0 }
                ctx.fill(CGRect(x: n("x"), y: n("y"), width: n("width"), height: n("height")))
            } else if let d = attribute("d", in: tag) {
                ctx.addPath(path(d)); ctx.fillPath(using: attribute("fill-rule", in: tag) == "evenodd" ? .evenOdd : .winding)
            }
            drawn += 1
        }
        ctx.endPDFPage(); ctx.closePDF()
        guard drawn > 0 else { throw PosterError.invalid("The SVG contains no filled shapes.") }
        return data as Data
    }

    // MARK: SVG helpers for the effector editor's own output

    private static func elements(in svg: String) -> [String] {
        var out: [String] = [], rest = svg[...]
        while let start = rest.range(of: "<"), let end = rest[start.lowerBound...].range(of: ">") {
            let tag = String(rest[start.lowerBound..<end.upperBound])
            if ["<path", "<rect", "<linearGradient", "<radialGradient", "<stop", "</linearGradient", "</radialGradient"].contains(where: tag.hasPrefix) { out.append(tag) }
            rest = rest[end.upperBound...]
        }
        return out
    }

    private static func attribute(_ name: String, in tag: String) -> String? {
        guard let start = tag.range(of: " \(name)=\"") else { return nil }
        let value = tag[start.upperBound...]
        guard let end = value.firstIndex(of: "\"") else { return nil }
        return String(value[..<end])
    }

    /// A linear or radial gradient in page units (userSpaceOnUse), padded past both ends like SVG's default spread.
    private struct Gradient {
        let id: String?, radial: Bool, geometry: [Double]
        var stops: [(offset: Double, r: Double, g: Double, b: Double, a: Double)] = []

        init(tag: String) {
            id = attribute("id", in: tag); radial = tag.hasPrefix("<radial")
            geometry = (radial ? ["cx", "cy", "r"] : ["x1", "y1", "x2", "y2"]).map { attribute($0, in: tag).flatMap(Double.init) ?? 0 }
        }

        mutating func add(stop tag: String) {
            guard let c = attribute("stop-color", in: tag).flatMap(color) else { return }
            let offset = min(max(attribute("offset", in: tag).flatMap(Double.init) ?? 0, stops.last?.offset ?? 0), 1)
            stops.append((offset, c.r, c.g, c.b, attribute("stop-opacity", in: tag).flatMap(Double.init) ?? 1))
        }

        func fill(_ path: CGPath, rule: CGPathFillRule, alpha: Double, in ctx: CGContext) -> Bool {
            guard stops.count >= 2, let space = CGColorSpace(name: CGColorSpace.sRGB),
                  let gradient = CGGradient(colorSpace: space, colorComponents: stops.flatMap { [$0.r, $0.g, $0.b, 1].map { CGFloat($0) } },
                                            locations: stops.map { CGFloat($0.offset) }, count: stops.count) else { return false }
            ctx.saveGState(); defer { ctx.restoreGState() }
            ctx.addPath(path); ctx.clip(using: rule); ctx.setAlpha(alpha)
            // A PDF shading carries no per-stop opacity, so fading stops become a soft mask over the shape's bounds,
            // and the colours stay a vector shading.
            let box = path.boundingBox
            if stops.contains(where: { $0.a < 0.999 }), let mask = opacityMask(over: box) { ctx.clip(to: box, mask: mask) }
            let g = geometry.map { CGFloat($0) }, ends: CGGradientDrawingOptions = [.drawsBeforeStartLocation, .drawsAfterEndLocation]
            if radial {
                let c = CGPoint(x: g[0], y: g[1])
                ctx.drawRadialGradient(gradient, startCenter: c, startRadius: 0, endCenter: c, endRadius: max(g[2], 1e-6), options: ends)
            } else {
                ctx.drawLinearGradient(gradient, start: CGPoint(x: g[0], y: g[1]), end: CGPoint(x: g[2], y: g[3]), options: ends)
            }
            return true
        }

        /// The stops' opacity along the gradient, sampled at about one pixel per unit (at most 1024 a side), padded past
        /// both ends. Image rows run from the box's far edge in y, as an image lands in this flipped page space.
        private func opacityMask(over box: CGRect) -> CGImage? {
            guard box.width > 0, box.height > 0 else { return nil }
            let k = min(1, 1024 / max(box.width, box.height)), w = max(2, Int((box.width * k).rounded(.up))), h = max(2, Int((box.height * k).rounded(.up)))
            let g = geometry, dx = radial ? 0 : g[2] - g[0], dy = radial ? 0 : g[3] - g[1], len2 = max(dx * dx + dy * dy, 1e-12)
            func opacity(_ t: Double) -> Double {
                guard t > stops[0].offset else { return stops[0].a }
                for i in 1..<stops.count where t <= stops[i].offset {
                    let a = stops[i - 1], b = stops[i], span = b.offset - a.offset
                    return span < 1e-9 ? b.a : a.a + (b.a - a.a) * (t - a.offset) / span
                }
                return stops[stops.count - 1].a
            }
            var bytes = [UInt8](repeating: 0, count: w * h)
            for row in 0..<h {
                let y = Double(box.maxY) - (Double(row) + 0.5) * Double(box.height) / Double(h)
                for col in 0..<w {
                    let x = Double(box.minX) + (Double(col) + 0.5) * Double(box.width) / Double(w)
                    let t = radial ? hypot(x - g[0], y - g[1]) / max(g[2], 1e-9) : ((x - g[0]) * dx + (y - g[1]) * dy) / len2
                    bytes[row * w + col] = UInt8((min(max(opacity(min(max(t, 0), 1)), 0), 1) * 255).rounded())
                }
            }
            // A plain grey image (not an image mask) clips as opacity: white paints, black hides.
            guard let provider = CGDataProvider(data: Data(bytes) as CFData) else { return nil }
            return CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 8, bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(),
                           bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue), provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)
        }
    }

    private static func color(_ hex: String) -> (r: Double, g: Double, b: Double)? {
        guard hex.count == 7, hex.hasPrefix("#"), let v = UInt32(hex.dropFirst(), radix: 16) else { return nil }
        return (Double(v >> 16 & 255) / 255, Double(v >> 8 & 255) / 255, Double(v & 255) / 255)
    }

    private static func path(_ d: String) -> CGPath {
        let path = CGMutablePath()
        var numbers: [Double] = [], command: Character = "M", token = ""
        func flushNumber() { if !token.isEmpty, let v = Double(token) { numbers.append(v) }; token = "" }
        func flushCommand() {
            var i = 0
            while i + 1 < numbers.count {
                let p = CGPoint(x: numbers[i], y: numbers[i + 1])
                if command == "M" && i == 0 { path.move(to: p) } else { path.addLine(to: p) }
                i += 2
            }
            numbers.removeAll(keepingCapacity: true)
        }
        for ch in d {
            if ch == "M" || ch == "L" || ch == "Z" {
                flushNumber(); flushCommand()
                if ch == "Z" { path.closeSubpath() } else { command = ch }
            } else if ch == " " || ch == "," { flushNumber() }
            else if ch == "-" && !token.isEmpty && token.last != "e" { flushNumber(); token.append(ch) }
            else { token.append(ch) }
        }
        flushNumber(); flushCommand()
        return path
    }

    static func format(_ v: CGFloat) -> String {
        let r = (Double(v) * 100).rounded() / 100
        if r == r.rounded() { return String(Int(r)) }
        return String(r)
    }
}

/// One PDF content-stream walk. Path construction happens in user space; painting maps through the CTM
/// and the output flip, so strokes keep their exact width under any transform.
private final class VectorReader {
    struct GraphicsState {
        var ctm = CGAffineTransform.identity
        var fill: (CGFloat, CGFloat, CGFloat) = (0, 0, 0)
        var stroke: (CGFloat, CGFloat, CGFloat) = (0, 0, 0)
        var fillAlpha: CGFloat = 1, strokeAlpha: CGFloat = 1
        // Numbers an sc/scn colour takes in the current colour space; DeviceGray until cs or CS changes it.
        var fillComponents = 1, strokeComponents = 1
        var lineWidth: CGFloat = 1, miterLimit: CGFloat = 10
        var cap = CGLineCap.butt, join = CGLineJoin.miter
        var dash: [CGFloat] = [], dashPhase: CGFloat = 0
    }

    let output: CGAffineTransform
    var state = GraphicsState(), saved: [GraphicsState] = []
    var path = CGMutablePath()
    var paths: [String] = [], skipped = Set<String>()
    private var depth = 0

    init(output: CGAffineTransform) { self.output = output }

    func scan(_ stream: CGPDFContentStreamRef) {
        guard depth < 12, let table = CGPDFOperatorTableCreate() else { return }
        depth += 1; defer { depth -= 1 }
        VectorReader.install(in: table)
        let scanner = CGPDFScannerCreate(stream, table, Unmanaged.passUnretained(self).toOpaque())
        CGPDFScannerScan(scanner)
        CGPDFScannerRelease(scanner); CGPDFOperatorTableRelease(table)
    }

    // MARK: painting

    func paint(fill: Bool, stroke: Bool, evenOdd: Bool = false, close: Bool = false) {
        if close { path.closeSubpath() }
        defer { path = CGMutablePath() }
        guard !path.isEmpty else { return }
        var place = state.ctm.concatenating(output)
        if fill, let placed = path.copy(using: &place) {
            add(placed, color: state.fill, alpha: state.fillAlpha, evenOdd: evenOdd)
        }
        if stroke {
            let source: CGPath = state.dash.contains(where: { $0 > 0 }) ? path.copy(dashingWithPhase: state.dashPhase, lengths: state.dash) : path
            // A zero line width means the thinnest line a device can draw; keep it visible as a hairline.
            // The minimum is a quarter of a page unit, so it is measured through the current transform.
            let scale = max(sqrt(abs(place.a * place.d - place.b * place.c)), 1e-9)
            let outline = source.copy(strokingWithWidth: max(state.lineWidth, 0.25 / scale), lineCap: state.cap, lineJoin: state.join, miterLimit: state.miterLimit)
            if let placed = outline.copy(using: &place) { add(placed, color: state.stroke, alpha: state.strokeAlpha, evenOdd: false) }
        }
    }

    private func add(_ p: CGPath, color c: (CGFloat, CGFloat, CGFloat), alpha: CGFloat, evenOdd: Bool) {
        guard alpha > 0.002 else { return }
        var d = ""
        let f = PosterVectors.format
        p.applyWithBlock { element in
            let pts = element.pointee.points
            switch element.pointee.type {
            case .moveToPoint: d += "M\(f(pts[0].x)) \(f(pts[0].y))"
            case .addLineToPoint: d += "L\(f(pts[0].x)) \(f(pts[0].y))"
            case .addQuadCurveToPoint: d += "Q\(f(pts[0].x)) \(f(pts[0].y)) \(f(pts[1].x)) \(f(pts[1].y))"
            case .addCurveToPoint: d += "C\(f(pts[0].x)) \(f(pts[0].y)) \(f(pts[1].x)) \(f(pts[1].y)) \(f(pts[2].x)) \(f(pts[2].y))"
            case .closeSubpath: d += "Z"
            @unknown default: break
            }
        }
        guard !d.isEmpty else { return }
        let hex = String(format: "#%02x%02x%02x", Int((min(max(c.0, 0), 1) * 255).rounded()), Int((min(max(c.1, 0), 1) * 255).rounded()), Int((min(max(c.2, 0), 1) * 255).rounded()))
        paths.append("<path d=\"\(d)\" fill=\"\(hex)\"\(alpha < 1 ? " fill-opacity=\"\(PosterVectors.format(alpha))\"" : "")\(evenOdd ? " fill-rule=\"evenodd\"" : "")/>")
    }

    // MARK: operands

    static func reader(_ info: UnsafeMutableRawPointer?) -> VectorReader { Unmanaged<VectorReader>.fromOpaque(info!).takeUnretainedValue() }

    static func numbers(_ scanner: CGPDFScannerRef, _ count: Int) -> [CGFloat]? {
        var values = [CGFloat](repeating: 0, count: count)
        for i in stride(from: count - 1, through: 0, by: -1) {
            var v: CGPDFReal = 0
            guard CGPDFScannerPopNumber(scanner, &v) else { return nil }
            values[i] = v
        }
        return values
    }

    /// Colour operands: one component is grey, three RGB, four CMYK. Exactly `count` numbers are popped, so the
    /// scanner never underflows; zero means the colour space has no RGB reading here and the colour is kept.
    static func colour(_ scanner: CGPDFScannerRef, _ count: Int) -> (CGFloat, CGFloat, CGFloat)? {
        guard count > 0, let values = numbers(scanner, count) else { return nil }
        switch values.count {
        case 1: return (values[0], values[0], values[0])
        case 3: return (values[0], values[1], values[2])
        case 4: let k = 1 - values[3]; return ((1 - values[0]) * k, (1 - values[1]) * k, (1 - values[2]) * k)
        default: return nil
        }
    }

    /// A device operator (g, rg, k) passes its count and switches to that space; sc and scn use the current space.
    static func setColour(_ scanner: CGPDFScannerRef, _ info: UnsafeMutableRawPointer?, _ device: Int?, fill: Bool) {
        let r = reader(info)
        guard let c = colour(scanner, device ?? (fill ? r.state.fillComponents : r.state.strokeComponents)) else { return }
        if fill { r.state.fill = c; if let device { r.state.fillComponents = device } }
        else { r.state.stroke = c; if let device { r.state.strokeComponents = device } }
    }

    static func name(_ scanner: CGPDFScannerRef) -> String? {
        var raw: UnsafePointer<CChar>?
        guard CGPDFScannerPopName(scanner, &raw), let raw else { return nil }
        return String(cString: raw)
    }

    /// Components of the colour space a cs/CS operator names: device spaces by name, the rest from the page's
    /// ColorSpace resources (ICC profiles by their N). Patterns, separations, indexed and Lab colours give zero.
    static func components(_ scanner: CGPDFScannerRef) -> Int {
        guard let key = name(scanner) else { return 0 }
        func device(_ name: String) -> Int? { ["DeviceGray": 1, "CalGray": 1, "DeviceRGB": 3, "CalRGB": 3, "DeviceCMYK": 4][name] }
        if let n = device(key) { return n }
        guard let object = CGPDFContentStreamGetResource(CGPDFScannerGetContentStream(scanner), "ColorSpace", key) else { return 0 }
        var alias: UnsafePointer<CChar>?, array: CGPDFArrayRef?, family: UnsafePointer<CChar>?
        if CGPDFObjectGetValue(object, .name, &alias), let alias { return device(String(cString: alias)) ?? 0 }
        guard CGPDFObjectGetValue(object, .array, &array), let array, CGPDFArrayGetName(array, 0, &family), let family else { return 0 }
        let kind = String(cString: family)
        if let n = device(kind) { return n }
        var stream: CGPDFStreamRef?, n: CGPDFInteger = 0
        guard kind == "ICCBased", CGPDFArrayGetStream(array, 1, &stream), let stream, let dict = CGPDFStreamGetDictionary(stream),
              CGPDFDictionaryGetInteger(dict, "N", &n), [1, 3, 4].contains(n) else { return 0 }
        return n
    }

    // MARK: operator table

    static func install(in t: CGPDFOperatorTableRef) {
        func on(_ op: String, _ fn: @escaping CGPDFOperatorCallback) { CGPDFOperatorTableSetCallback(t, op, fn) }
        on("q") { _, i in let r = VectorReader.reader(i); r.saved.append(r.state) }
        on("Q") { _, i in let r = VectorReader.reader(i); if let s = r.saved.popLast() { r.state = s } }
        on("cm") { s, i in guard let m = VectorReader.numbers(s, 6) else { return }; let r = VectorReader.reader(i)
            r.state.ctm = CGAffineTransform(a: m[0], b: m[1], c: m[2], d: m[3], tx: m[4], ty: m[5]).concatenating(r.state.ctm) }
        on("w") { s, i in if let v = VectorReader.numbers(s, 1) { VectorReader.reader(i).state.lineWidth = v[0] } }
        on("J") { s, i in if let v = VectorReader.numbers(s, 1) { VectorReader.reader(i).state.cap = [CGLineCap.butt, .round, .square][min(2, max(0, Int(v[0])))] } }
        on("j") { s, i in if let v = VectorReader.numbers(s, 1) { VectorReader.reader(i).state.join = [CGLineJoin.miter, .round, .bevel][min(2, max(0, Int(v[0])))] } }
        on("M") { s, i in if let v = VectorReader.numbers(s, 1) { VectorReader.reader(i).state.miterLimit = v[0] } }
        on("d") { s, i in
            var phase: CGPDFReal = 0, array: CGPDFArrayRef?
            guard CGPDFScannerPopNumber(s, &phase), CGPDFScannerPopArray(s, &array), let array else { return }
            var lengths: [CGFloat] = []
            for k in 0..<CGPDFArrayGetCount(array) { var v: CGPDFReal = 0; if CGPDFArrayGetNumber(array, k, &v) { lengths.append(v) } }
            let r = VectorReader.reader(i); r.state.dash = lengths; r.state.dashPhase = phase }
        on("gs") { s, i in
            guard let key = VectorReader.name(s), let object = CGPDFContentStreamGetResource(CGPDFScannerGetContentStream(s), "ExtGState", key) else { return }
            var dict: CGPDFDictionaryRef?
            guard CGPDFObjectGetValue(object, .dictionary, &dict), let dict else { return }
            let r = VectorReader.reader(i); var v: CGPDFReal = 0
            if CGPDFDictionaryGetNumber(dict, "ca", &v) { r.state.fillAlpha = v }
            if CGPDFDictionaryGetNumber(dict, "CA", &v) { r.state.strokeAlpha = v }
            if CGPDFDictionaryGetNumber(dict, "LW", &v) { r.state.lineWidth = v } }
        // g, rg and k also switch to their device space; cs and CS start a new space at its initial colour, black.
        on("cs") { s, i in let r = VectorReader.reader(i); r.state.fillComponents = VectorReader.components(s); r.state.fill = (0, 0, 0) }
        on("CS") { s, i in let r = VectorReader.reader(i); r.state.strokeComponents = VectorReader.components(s); r.state.stroke = (0, 0, 0) }
        on("g") { s, i in VectorReader.setColour(s, i, 1, fill: true) }
        on("rg") { s, i in VectorReader.setColour(s, i, 3, fill: true) }
        on("k") { s, i in VectorReader.setColour(s, i, 4, fill: true) }
        on("G") { s, i in VectorReader.setColour(s, i, 1, fill: false) }
        on("RG") { s, i in VectorReader.setColour(s, i, 3, fill: false) }
        on("K") { s, i in VectorReader.setColour(s, i, 4, fill: false) }
        for op in ["sc", "scn"] { on(op) { s, i in VectorReader.setColour(s, i, nil, fill: true) } }
        for op in ["SC", "SCN"] { on(op) { s, i in VectorReader.setColour(s, i, nil, fill: false) } }
        on("m") { s, i in if let p = VectorReader.numbers(s, 2) { VectorReader.reader(i).path.move(to: CGPoint(x: p[0], y: p[1])) } }
        on("l") { s, i in let r = VectorReader.reader(i); if let p = VectorReader.numbers(s, 2), !r.path.isEmpty { r.path.addLine(to: CGPoint(x: p[0], y: p[1])) } }
        on("c") { s, i in let r = VectorReader.reader(i); if let p = VectorReader.numbers(s, 6), !r.path.isEmpty {
            r.path.addCurve(to: CGPoint(x: p[4], y: p[5]), control1: CGPoint(x: p[0], y: p[1]), control2: CGPoint(x: p[2], y: p[3])) } }
        on("v") { s, i in let r = VectorReader.reader(i); if let p = VectorReader.numbers(s, 4), !r.path.isEmpty {
            r.path.addCurve(to: CGPoint(x: p[2], y: p[3]), control1: r.path.currentPoint, control2: CGPoint(x: p[0], y: p[1])) } }
        on("y") { s, i in let r = VectorReader.reader(i); if let p = VectorReader.numbers(s, 4), !r.path.isEmpty {
            r.path.addCurve(to: CGPoint(x: p[2], y: p[3]), control1: CGPoint(x: p[0], y: p[1]), control2: CGPoint(x: p[2], y: p[3])) } }
        on("h") { _, i in let r = VectorReader.reader(i); if !r.path.isEmpty { r.path.closeSubpath() } }
        on("re") { s, i in if let p = VectorReader.numbers(s, 4) { VectorReader.reader(i).path.addRect(CGRect(x: p[0], y: p[1], width: p[2], height: p[3])) } }
        on("f") { _, i in VectorReader.reader(i).paint(fill: true, stroke: false) }
        on("F") { _, i in VectorReader.reader(i).paint(fill: true, stroke: false) }
        on("f*") { _, i in VectorReader.reader(i).paint(fill: true, stroke: false, evenOdd: true) }
        on("B") { _, i in VectorReader.reader(i).paint(fill: true, stroke: true) }
        on("B*") { _, i in VectorReader.reader(i).paint(fill: true, stroke: true, evenOdd: true) }
        on("b") { _, i in VectorReader.reader(i).paint(fill: true, stroke: true, close: true) }
        on("b*") { _, i in VectorReader.reader(i).paint(fill: true, stroke: true, evenOdd: true, close: true) }
        on("S") { _, i in VectorReader.reader(i).paint(fill: false, stroke: true) }
        on("s") { _, i in VectorReader.reader(i).paint(fill: false, stroke: true, close: true) }
        on("n") { _, i in VectorReader.reader(i).path = CGMutablePath() }
        on("W") { _, i in VectorReader.reader(i).skipped.insert("clipping") }
        on("W*") { _, i in VectorReader.reader(i).skipped.insert("clipping") }
        on("sh") { _, i in VectorReader.reader(i).skipped.insert("shadings") }
        on("BI") { _, i in VectorReader.reader(i).skipped.insert("images") }
        for op in ["Tj", "TJ", "'", "\""] { on(op) { _, i in VectorReader.reader(i).skipped.insert("live text") } }
        on("Do") { s, i in
            let parent = CGPDFScannerGetContentStream(s)
            guard let key = VectorReader.name(s), let object = CGPDFContentStreamGetResource(parent, "XObject", key) else { return }
            var stream: CGPDFStreamRef?
            guard CGPDFObjectGetValue(object, .stream, &stream), let stream, let dict = CGPDFStreamGetDictionary(stream) else { return }
            var subtype: UnsafePointer<CChar>?
            let r = VectorReader.reader(i)
            guard CGPDFDictionaryGetName(dict, "Subtype", &subtype), let subtype, String(cString: subtype) == "Form" else { r.skipped.insert("images"); return }
            // A form draws in its own matrix and resources, inside a saved graphics state.
            r.saved.append(r.state)
            var matrix: CGPDFArrayRef?
            if CGPDFDictionaryGetArray(dict, "Matrix", &matrix), let matrix, CGPDFArrayGetCount(matrix) == 6 {
                var m = [CGFloat](repeating: 0, count: 6)
                for k in 0..<6 { var v: CGPDFReal = 0; _ = CGPDFArrayGetNumber(matrix, k, &v); m[k] = v }
                r.state.ctm = CGAffineTransform(a: m[0], b: m[1], c: m[2], d: m[3], tx: m[4], ty: m[5]).concatenating(r.state.ctm)
            }
            var resources: CGPDFDictionaryRef?
            _ = CGPDFDictionaryGetDictionary(dict, "Resources", &resources)
            let form = CGPDFContentStreamCreateWithStream(stream, resources ?? dict, parent)
            let path = r.path; r.path = CGMutablePath()
            r.scan(form)
            CGPDFContentStreamRelease(form)
            r.path = path
            if let s = r.saved.popLast() { r.state = s }
        }
    }
}
