import CoreGraphics
import Foundation

/// Vector posters given as PDF: PosterLab's own vector exports, or any PDF a designer opens.
public enum GlassPosterPDF {
    public static func isPDF(_ data: Data) -> Bool { data.starts(with: Array("%PDF".utf8)) }

    /// Draws the first page on white, at `maxSide` pixels along its longer side.
    public static func rasterize(_ data: Data, maxSide: Int) throws -> CGImage {
        guard let page = firstPage(data) else { throw PosterError.invalid("This PDF has no readable page.") }
        let box = page.getBoxRect(.mediaBox)
        guard box.width > 0, box.height > 0 else { throw PosterError.invalid("This PDF page is empty.") }
        let scale = Double(maxSide) / max(box.width, box.height)
        let width = max(1, Int((box.width * scale).rounded())), height = max(1, Int((box.height * scale).rounded()))
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw PosterError.render }
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.interpolationQuality = .high
        context.scaleBy(x: Double(width) / box.width, y: Double(height) / box.height)
        context.translateBy(x: -box.minX, y: -box.minY)
        context.drawPDFPage(page)
        guard let image = context.makeImage() else { throw PosterError.render }
        return image
    }

    static func firstPage(_ data: Data) -> CGPDFPage? {
        guard let provider = CGDataProvider(data: data as CFData) else { return nil }
        return CGPDFDocument(provider)?.page(at: 1)
    }
}

/// A PDF page's vector artwork in SVG coordinates (y downward), read operator by operator: transforms,
/// paths, fills, strokes, clipping, gray, RGB and CMYK colors (device, ICC-based or calibrated), transparency and blend modes. The same shapes
/// are written to SVG and drawn with Core Graphics, so a drawn preview shows exactly what the SVG holds.
/// Pages with text, images, gradients or patterns are rejected; those would need fonts or bitmaps.
struct GlassPosterVectors {
    struct Paint {
        var rgb: SIMD3<Double>
        var alpha: Double
    }
    struct Stroke {
        var paint: Paint
        var width: Double
        var cap: Int
        var join: Int
        var miterLimit: Double
        var dash: [Double]
        var phase: Double
    }
    struct Shape {
        var path: CGPath
        var fill: Paint?
        var evenOdd: Bool
        var stroke: Stroke?
        var blend: String?
        /// Indices into `clips`, outermost first; the shape is visible where all of them overlap.
        var clips: [Int]
    }
    struct Clip {
        var path: CGPath
        var evenOdd: Bool
    }

    /// A drawing feature the converter does not reproduce; the export then traces the whole poster.
    struct Unsupported: Error { let feature: String }

    let shapes: [Shape]
    let clips: [Clip]

    init(pdf: Data, width: Double, height: Double) throws {
        guard let page = GlassPosterPDF.firstPage(pdf) else { throw PosterError.invalid("The poster PDF could not be read.") }
        guard page.rotationAngle % 360 == 0 else { throw Unsupported(feature: "a rotated page") }
        let box = page.getBoxRect(.mediaBox)
        let reader = PDFReader(toSVG: CGAffineTransform(a: width / box.width, b: 0, c: 0, d: -height / box.height,
                                                        tx: -box.minX * width / box.width, ty: box.maxY * height / box.height))
        let table = CGPDFOperatorTableCreate()!
        PDFReader.register(table)
        let content = CGPDFContentStreamCreateWithPage(page)
        let scanner = CGPDFScannerCreate(content, table, Unmanaged.passUnretained(reader).toOpaque())
        CGPDFScannerScan(scanner)
        CGPDFScannerRelease(scanner)
        CGPDFContentStreamRelease(content)
        CGPDFOperatorTableRelease(table)
        if let unsupported = reader.unsupported { throw Unsupported(feature: unsupported) }
        shapes = reader.shapes
        clips = reader.clips
    }

    /// Opaque colors the poster paints with normal blending; flat areas of the render show exactly these.
    var inks: [SIMD3<Double>] {
        var result: [SIMD3<Double>] = []
        for shape in shapes where shape.blend == nil {
            for paint in [shape.fill, shape.stroke?.paint].compactMap({ $0 }) where paint.alpha >= 1 && !result.contains(paint.rgb) {
                result.append(paint.rgb)
            }
        }
        return result
    }

    // MARK: SVG

    /// `<clipPath>` definitions and the shapes, grouped by the clips they share.
    func svg() -> (defs: String, body: String) {
        var defs = "", body = "", open: [Int] = []
        for (index, clip) in clips.enumerated() {
            defs += "<clipPath id=\"poster-clip-\(index)\"><path d=\"\(Self.pathData(clip.path))\"\(clip.evenOdd ? " clip-rule=\"evenodd\"" : "")/></clipPath>"
        }
        for shape in shapes {
            var shared = 0
            while shared < min(open.count, shape.clips.count) && open[shared] == shape.clips[shared] { shared += 1 }
            for _ in shared..<open.count { body += "</g>" }
            for clip in shape.clips[shared...] { body += "<g clip-path=\"url(#poster-clip-\(clip))\">" }
            open = shape.clips
            body += "<path d=\"\(Self.pathData(shape.path))\"" + Self.attributes(shape) + "/>\n"
        }
        for _ in open { body += "</g>" }
        return (defs, body)
    }

    private static func attributes(_ shape: Shape) -> String {
        var text = ""
        if let fill = shape.fill {
            text += " fill=\"\(hex(fill.rgb))\""
            if fill.alpha < 1 { text += " fill-opacity=\"\(number(fill.alpha))\"" }
            if shape.evenOdd { text += " fill-rule=\"evenodd\"" }
        } else {
            text += " fill=\"none\""
        }
        if let stroke = shape.stroke {
            text += " stroke=\"\(hex(stroke.paint.rgb))\" stroke-width=\"\(number(stroke.width))\""
            if stroke.paint.alpha < 1 { text += " stroke-opacity=\"\(number(stroke.paint.alpha))\"" }
            if stroke.cap != 0 { text += " stroke-linecap=\"\(stroke.cap == 1 ? "round" : "square")\"" }
            if stroke.join != 0 { text += " stroke-linejoin=\"\(stroke.join == 1 ? "round" : "bevel")\"" }
            if stroke.join == 0 && stroke.miterLimit != 4 { text += " stroke-miterlimit=\"\(number(stroke.miterLimit))\"" }
            if !stroke.dash.isEmpty {
                text += " stroke-dasharray=\"\(stroke.dash.map(number).joined(separator: " "))\""
                if stroke.phase != 0 { text += " stroke-dashoffset=\"\(number(stroke.phase))\"" }
            }
        }
        if let blend = shape.blend { text += " style=\"mix-blend-mode:\(blend)\"" }
        return text
    }

    static func pathData(_ path: CGPath) -> String {
        var data = ""
        path.applyWithBlock { pointer in
            let element = pointer.pointee, points = element.points
            func point(_ index: Int) -> String { number(points[index].x) + " " + number(points[index].y) }
            switch element.type {
            case .moveToPoint: data += "M" + point(0)
            case .addLineToPoint: data += "L" + point(0)
            case .addQuadCurveToPoint: data += "Q" + point(0) + " " + point(1)
            case .addCurveToPoint: data += "C" + point(0) + " " + point(1) + " " + point(2)
            case .closeSubpath: data += "Z"
            @unknown default: break
            }
        }
        return data
    }

    // MARK: Core Graphics

    /// Draws the shapes into a context whose coordinates are already the SVG's (y downward).
    func draw(in context: CGContext) {
        let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!
        func color(_ paint: Paint) -> CGColor {
            CGColor(colorSpace: sRGB, components: [paint.rgb.x / 255, paint.rgb.y / 255, paint.rgb.z / 255, paint.alpha])!
        }
        for shape in shapes {
            context.saveGState()
            for index in shape.clips {
                context.addPath(clips[index].path)
                context.clip(using: clips[index].evenOdd ? .evenOdd : .winding)
            }
            if let blend = shape.blend, let mode = Self.blendModes[blend] { context.setBlendMode(mode) }
            if let fill = shape.fill {
                context.setFillColor(color(fill))
                context.addPath(shape.path)
                context.fillPath(using: shape.evenOdd ? .evenOdd : .winding)
            }
            if let stroke = shape.stroke {
                context.setStrokeColor(color(stroke.paint))
                context.setLineWidth(stroke.width)
                context.setLineCap(CGLineCap(rawValue: Int32(stroke.cap)) ?? .butt)
                context.setLineJoin(CGLineJoin(rawValue: Int32(stroke.join)) ?? .miter)
                context.setMiterLimit(stroke.miterLimit)
                context.setLineDash(phase: stroke.phase, lengths: stroke.dash.map { CGFloat($0) })
                context.addPath(shape.path)
                context.strokePath()
            }
            context.restoreGState()
        }
    }

    // MARK: Shared

    /// PDF blend mode names and their SVG (CSS) names.
    static let pdfBlendModes = ["Multiply": "multiply", "Screen": "screen", "Overlay": "overlay", "Darken": "darken",
        "Lighten": "lighten", "ColorDodge": "color-dodge", "ColorBurn": "color-burn", "HardLight": "hard-light",
        "SoftLight": "soft-light", "Difference": "difference", "Exclusion": "exclusion", "Hue": "hue",
        "Saturation": "saturation", "Color": "color", "Luminosity": "luminosity"]
    static let blendModes: [String: CGBlendMode] = ["multiply": .multiply, "screen": .screen, "overlay": .overlay,
        "darken": .darken, "lighten": .lighten, "color-dodge": .colorDodge, "color-burn": .colorBurn,
        "hard-light": .hardLight, "soft-light": .softLight, "difference": .difference, "exclusion": .exclusion,
        "hue": .hue, "saturation": .saturation, "color": .color, "luminosity": .luminosity]

    /// Hundredths of an SVG unit, trailing zeros trimmed.
    static func number(_ value: Double) -> String {
        let hundredths = Int((value * 100).rounded())
        let sign = hundredths < 0 ? "-" : "", magnitude = abs(hundredths)
        let whole = magnitude / 100, fraction = magnitude % 100
        if fraction == 0 { return sign + String(whole) }
        if fraction % 10 == 0 { return sign + String(whole) + "." + String(fraction / 10) }
        return sign + String(whole) + (fraction < 10 ? ".0" : ".") + String(fraction)
    }

    static func hex(_ rgb: SIMD3<Double>) -> String {
        String(format: "#%02x%02x%02x", min(255, max(0, Int(rgb.x.rounded()))), min(255, max(0, Int(rgb.y.rounded()))),
               min(255, max(0, Int(rgb.z.rounded()))))
    }
}

/// Collects shapes while `CGPDFScanner` walks a content stream. Colors are converted from their PDF color
/// space (device, ICC-based or calibrated) to 0–255 sRGB the way Core Graphics draws them.
private final class PDFReader {
    struct State {
        var ctm = CGAffineTransform.identity
        var fillSpace = CGColorSpaceCreateDeviceGray(), strokeSpace = CGColorSpaceCreateDeviceGray()
        var fill = SIMD3<Double>(0, 0, 0), stroke = SIMD3<Double>(0, 0, 0)
        var fillAlpha = 1.0, strokeAlpha = 1.0
        var blend: String?
        var lineWidth = 1.0, cap = 0, join = 0, miterLimit = 10.0
        var dash: [Double] = [], phase = 0.0
        var clips: [Int] = []
    }

    let toSVG: CGAffineTransform
    var state = State()
    var saved: [State] = []
    var path = CGMutablePath()
    var current = CGPoint.zero
    var pendingClip: Bool?
    var shapes: [GlassPosterVectors.Shape] = []
    var clips: [GlassPosterVectors.Clip] = []
    var unsupported: String?

    init(toSVG: CGAffineTransform) { self.toSVG = toSVG }

    private var transform: CGAffineTransform { state.ctm.concatenating(toSVG) }
    private func svgPoint(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x, y: y).applying(transform) }
    /// User-space lengths in SVG units; PDF strokes scale with the transform.
    private var lengthScale: Double {
        let t = transform
        return abs(Double(t.a * t.d - t.b * t.c)).squareRoot()
    }

    func refuse(_ reason: String) { if unsupported == nil { unsupported = reason } }

    func numbers(_ scanner: CGPDFScannerRef, _ count: Int) -> [Double]? {
        var values = [Double](repeating: 0, count: count)
        for index in stride(from: count - 1, through: 0, by: -1) {
            var value: CGPDFReal = 0
            guard CGPDFScannerPopNumber(scanner, &value) else { return nil }
            values[index] = Double(value)
        }
        return values
    }

    private let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!

    func srgb(_ components: [Double], in space: CGColorSpace) -> SIMD3<Double> {
        guard let color = CGColor(colorSpace: space, components: components.map { CGFloat($0) } + [1])?
                .converted(to: sRGB, intent: .defaultIntent, options: nil),
              let rgb = color.components, rgb.count >= 3 else { return .zero }
        return SIMD3(Double(rgb[0]), Double(rgb[1]), Double(rgb[2])) * 255
    }

    /// Sets the color space (when given) and pops exactly as many components as it has, so the scanner's
    /// operand stack never underflows.
    func setColor(_ scanner: CGPDFScannerRef, stroke: Bool, space: CGColorSpace? = nil) {
        if let space { if stroke { state.strokeSpace = space } else { state.fillSpace = space } }
        let current = stroke ? state.strokeSpace : state.fillSpace
        guard let components = numbers(scanner, current.numberOfComponents) else { return }
        let rgb = srgb(components, in: current)
        if stroke { state.stroke = rgb } else { state.fill = rgb }
    }

    /// `cs` / `CS`: a named color space, which starts out black.
    func setColorSpace(_ scanner: CGPDFScannerRef, stroke: Bool) {
        var name: UnsafePointer<CChar>?
        guard CGPDFScannerPopName(scanner, &name), let name else { return }
        guard let space = colorSpace(named: String(cString: name), scanner: scanner) else { return }
        let black = srgb(space.model == .cmyk ? [0, 0, 0, 1] : [Double](repeating: 0, count: space.numberOfComponents), in: space)
        if stroke { state.strokeSpace = space; state.stroke = black } else { state.fillSpace = space; state.fill = black }
    }

    func colorSpace(named name: String, scanner: CGPDFScannerRef) -> CGColorSpace? {
        switch name {
        case "DeviceGray", "G": return CGColorSpaceCreateDeviceGray()
        case "DeviceRGB", "RGB": return CGColorSpaceCreateDeviceRGB()
        case "DeviceCMYK", "CMYK": return CGColorSpaceCreateDeviceCMYK()
        case "Pattern": refuse("patterns"); return nil
        default: break
        }
        guard let object = CGPDFContentStreamGetResource(CGPDFScannerGetContentStream(scanner), "ColorSpace", name) else {
            refuse("an unknown color space"); return nil
        }
        var array: CGPDFArrayRef?, family: UnsafePointer<CChar>?
        guard CGPDFObjectGetValue(object, .array, &array), let array, CGPDFArrayGetName(array, 0, &family), let family else {
            var alias: UnsafePointer<CChar>?
            if CGPDFObjectGetValue(object, .name, &alias), let alias { return colorSpace(named: String(cString: alias), scanner: scanner) }
            refuse("an unknown color space"); return nil
        }
        switch String(cString: family) {
        case "ICCBased":
            var stream: CGPDFStreamRef?
            guard CGPDFArrayGetStream(array, 1, &stream), let stream else { refuse("an unreadable color profile"); return nil }
            var format = CGPDFDataFormat.raw
            if let profile = CGPDFStreamCopyData(stream, &format), format == .raw, let space = CGColorSpace(iccData: profile) { return space }
            var count: CGPDFInteger = 0
            _ = CGPDFDictionaryGetInteger(CGPDFStreamGetDictionary(stream)!, "N", &count)
            switch count {
            case 1: return CGColorSpaceCreateDeviceGray()
            case 3: return CGColorSpaceCreateDeviceRGB()
            case 4: return CGColorSpaceCreateDeviceCMYK()
            default: refuse("an unreadable color profile"); return nil
            }
        case "CalGray": return CGColorSpaceCreateDeviceGray()
        case "CalRGB": return CGColorSpaceCreateDeviceRGB()
        case "Lab": refuse("Lab colors"); return nil
        case "Indexed": refuse("indexed colors"); return nil
        case "Separation", "DeviceN": refuse("spot colors"); return nil
        default: refuse("patterns"); return nil
        }
    }

    func paint(fill: Bool, evenOdd: Bool, stroke: Bool, close: Bool) {
        if close && !path.isEmpty { path.closeSubpath() }
        if (fill || stroke) && !path.isEmpty {
            let scale = lengthScale
            shapes.append(GlassPosterVectors.Shape(
                path: path.copy()!,
                fill: fill ? GlassPosterVectors.Paint(rgb: state.fill, alpha: state.fillAlpha) : nil,
                evenOdd: evenOdd,
                stroke: stroke ? GlassPosterVectors.Stroke(paint: GlassPosterVectors.Paint(rgb: state.stroke, alpha: state.strokeAlpha),
                    // A zero-width PDF line is the thinnest visible line.
                    width: state.lineWidth > 0 ? state.lineWidth * scale : 0.25, cap: state.cap, join: state.join,
                    miterLimit: state.miterLimit, dash: state.dash.map { $0 * scale }, phase: state.phase * scale) : nil,
                blend: state.blend, clips: state.clips))
        }
        if let evenOddClip = pendingClip, !path.isEmpty {
            clips.append(GlassPosterVectors.Clip(path: path.copy()!, evenOdd: evenOddClip))
            state.clips.append(clips.count - 1)
        }
        pendingClip = nil
        path = CGMutablePath()
    }

    func graphicsState(_ scanner: CGPDFScannerRef) {
        var name: UnsafePointer<CChar>?
        guard CGPDFScannerPopName(scanner, &name), let name,
              let object = CGPDFContentStreamGetResource(CGPDFScannerGetContentStream(scanner), "ExtGState", name) else { return }
        var dictionary: CGPDFDictionaryRef?
        guard CGPDFObjectGetValue(object, .dictionary, &dictionary), let dictionary else { return }
        var value: CGPDFReal = 0
        if CGPDFDictionaryGetNumber(dictionary, "ca", &value) { state.fillAlpha = Double(value) }
        if CGPDFDictionaryGetNumber(dictionary, "CA", &value) { state.strokeAlpha = Double(value) }
        if CGPDFDictionaryGetNumber(dictionary, "LW", &value) { state.lineWidth = Double(value) }
        var blend: UnsafePointer<CChar>?
        if CGPDFDictionaryGetName(dictionary, "BM", &blend), let blend {
            let name = String(cString: blend)
            state.blend = GlassPosterVectors.pdfBlendModes[name]
        }
        var mask: UnsafePointer<CChar>?
        var maskObject: CGPDFObjectRef?
        if CGPDFDictionaryGetObject(dictionary, "SMask", &maskObject),
           !(CGPDFDictionaryGetName(dictionary, "SMask", &mask) && mask.map { String(cString: $0) } == "None") {
            refuse("soft masks")
        }
    }

    static func register(_ table: CGPDFOperatorTableRef) {
        func on(_ name: String, _ callback: @escaping CGPDFOperatorCallback) { CGPDFOperatorTableSetCallback(table, name, callback) }
        on("q") { _, info in let r = reader(info); r.saved.append(r.state) }
        on("Q") { _, info in let r = reader(info); if let state = r.saved.popLast() { r.state = state } }
        on("cm") { scanner, info in
            let r = reader(info)
            guard let m = r.numbers(scanner, 6) else { return }
            r.state.ctm = CGAffineTransform(a: m[0], b: m[1], c: m[2], d: m[3], tx: m[4], ty: m[5]).concatenating(r.state.ctm)
        }
        on("m") { scanner, info in
            let r = reader(info)
            guard let p = r.numbers(scanner, 2) else { return }
            r.path.move(to: r.svgPoint(p[0], p[1])); r.current = CGPoint(x: p[0], y: p[1])
        }
        on("l") { scanner, info in
            let r = reader(info)
            guard let p = r.numbers(scanner, 2) else { return }
            r.path.addLine(to: r.svgPoint(p[0], p[1])); r.current = CGPoint(x: p[0], y: p[1])
        }
        on("c") { scanner, info in
            let r = reader(info)
            guard let p = r.numbers(scanner, 6) else { return }
            r.path.addCurve(to: r.svgPoint(p[4], p[5]), control1: r.svgPoint(p[0], p[1]), control2: r.svgPoint(p[2], p[3]))
            r.current = CGPoint(x: p[4], y: p[5])
        }
        on("v") { scanner, info in
            let r = reader(info)
            guard let p = r.numbers(scanner, 4) else { return }
            r.path.addCurve(to: r.svgPoint(p[2], p[3]), control1: r.svgPoint(r.current.x, r.current.y), control2: r.svgPoint(p[0], p[1]))
            r.current = CGPoint(x: p[2], y: p[3])
        }
        on("y") { scanner, info in
            let r = reader(info)
            guard let p = r.numbers(scanner, 4) else { return }
            r.path.addCurve(to: r.svgPoint(p[2], p[3]), control1: r.svgPoint(p[0], p[1]), control2: r.svgPoint(p[2], p[3]))
            r.current = CGPoint(x: p[2], y: p[3])
        }
        on("h") { _, info in let r = reader(info); if !r.path.isEmpty { r.path.closeSubpath() } }
        on("re") { scanner, info in
            let r = reader(info)
            guard let p = r.numbers(scanner, 4) else { return }
            r.path.move(to: r.svgPoint(p[0], p[1]))
            r.path.addLine(to: r.svgPoint(p[0] + p[2], p[1]))
            r.path.addLine(to: r.svgPoint(p[0] + p[2], p[1] + p[3]))
            r.path.addLine(to: r.svgPoint(p[0], p[1] + p[3]))
            r.path.closeSubpath()
            r.current = CGPoint(x: p[0], y: p[1])
        }
        on("f") { _, info in reader(info).paint(fill: true, evenOdd: false, stroke: false, close: false) }
        on("F") { _, info in reader(info).paint(fill: true, evenOdd: false, stroke: false, close: false) }
        on("f*") { _, info in reader(info).paint(fill: true, evenOdd: true, stroke: false, close: false) }
        on("S") { _, info in reader(info).paint(fill: false, evenOdd: false, stroke: true, close: false) }
        on("s") { _, info in reader(info).paint(fill: false, evenOdd: false, stroke: true, close: true) }
        on("B") { _, info in reader(info).paint(fill: true, evenOdd: false, stroke: true, close: false) }
        on("B*") { _, info in reader(info).paint(fill: true, evenOdd: true, stroke: true, close: false) }
        on("b") { _, info in reader(info).paint(fill: true, evenOdd: false, stroke: true, close: true) }
        on("b*") { _, info in reader(info).paint(fill: true, evenOdd: true, stroke: true, close: true) }
        on("n") { _, info in reader(info).paint(fill: false, evenOdd: false, stroke: false, close: false) }
        on("W") { _, info in reader(info).pendingClip = false }
        on("W*") { _, info in reader(info).pendingClip = true }
        on("g") { scanner, info in reader(info).setColor(scanner, stroke: false, space: CGColorSpaceCreateDeviceGray()) }
        on("G") { scanner, info in reader(info).setColor(scanner, stroke: true, space: CGColorSpaceCreateDeviceGray()) }
        on("rg") { scanner, info in reader(info).setColor(scanner, stroke: false, space: CGColorSpaceCreateDeviceRGB()) }
        on("RG") { scanner, info in reader(info).setColor(scanner, stroke: true, space: CGColorSpaceCreateDeviceRGB()) }
        on("k") { scanner, info in reader(info).setColor(scanner, stroke: false, space: CGColorSpaceCreateDeviceCMYK()) }
        on("K") { scanner, info in reader(info).setColor(scanner, stroke: true, space: CGColorSpaceCreateDeviceCMYK()) }
        on("cs") { scanner, info in reader(info).setColorSpace(scanner, stroke: false) }
        on("CS") { scanner, info in reader(info).setColorSpace(scanner, stroke: true) }
        on("sc") { scanner, info in reader(info).setColor(scanner, stroke: false) }
        on("scn") { scanner, info in reader(info).setColor(scanner, stroke: false) }
        on("SC") { scanner, info in reader(info).setColor(scanner, stroke: true) }
        on("SCN") { scanner, info in reader(info).setColor(scanner, stroke: true) }
        on("w") { scanner, info in let r = reader(info); if let w = r.numbers(scanner, 1) { r.state.lineWidth = w[0] } }
        on("J") { scanner, info in let r = reader(info); if let v = r.numbers(scanner, 1) { r.state.cap = Int(v[0]) } }
        on("j") { scanner, info in let r = reader(info); if let v = r.numbers(scanner, 1) { r.state.join = Int(v[0]) } }
        on("M") { scanner, info in let r = reader(info); if let v = r.numbers(scanner, 1) { r.state.miterLimit = v[0] } }
        on("d") { scanner, info in
            let r = reader(info)
            var phase: CGPDFReal = 0, array: CGPDFArrayRef?
            guard CGPDFScannerPopNumber(scanner, &phase), CGPDFScannerPopArray(scanner, &array), let array else { return }
            r.state.dash = (0..<CGPDFArrayGetCount(array)).compactMap { index in
                var value: CGPDFReal = 0
                return CGPDFArrayGetNumber(array, index, &value) ? Double(value) : nil
            }
            r.state.phase = Double(phase)
        }
        on("gs") { scanner, info in reader(info).graphicsState(scanner) }
        on("BT") { _, info in reader(info).refuse("text") }
        on("Do") { _, info in reader(info).refuse("images or embedded graphics") }
        on("BI") { _, info in reader(info).refuse("images") }
        on("sh") { _, info in reader(info).refuse("gradients") }
        on("d0") { _, info in reader(info).refuse("text") }
        on("d1") { _, info in reader(info).refuse("text") }
    }
}

private func reader(_ info: UnsafeMutableRawPointer?) -> PDFReader { Unmanaged<PDFReader>.fromOpaque(info!).takeUnretainedValue() }
