import AppKit
import CoreText
import ImageIO
import UniformTypeIdentifiers

/// Seeded geometry in a 1000 × 1414 coordinate system. Type is drawn as vector outlines.
public enum PosterRenderer {
    public static let aspect = 1.414
    public static func render(_ genome: Genome, copy: PosterCopy, width: Int = 900, stage: ConstructionStage = .finished) throws -> CGImage {
        guard (200...8000).contains(width) else { throw PosterError.invalid("Image width must be between 200 and 8000 pixels.") }
        let height = Int((Double(width) * aspect).rounded())
        guard let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw PosterError.render }
        ctx.translateBy(x: 0, y: Double(height)); ctx.scaleBy(x: Double(width) / 1000, y: -Double(height) / 1414)
        draw(genome, copy: copy, stage: stage, in: ctx)
        guard let image = ctx.makeImage() else { throw PosterError.render }
        return image
    }
    public static func png(_ image: CGImage, to url: URL) throws {
        guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { throw PosterError.image("Cannot write \(url.path).") }
        CGImageDestinationAddImage(dest, image, [kCGImagePropertyDPIWidth: 300, kCGImagePropertyDPIHeight: 300] as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { throw PosterError.image("PNG export failed.") }
    }
    public static func pdf(_ genome: Genome, copy: PosterCopy, to url: URL) throws {
        var box = CGRect(x: 0, y: 0, width: 595.28, height: 841.89)
        guard let ctx = CGContext(url as CFURL, mediaBox: &box, nil) else { throw PosterError.image("Cannot create PDF.") }
        ctx.beginPDFPage(nil); ctx.translateBy(x: 0, y: box.height); ctx.scaleBy(x: box.width / 1000, y: -box.height / 1414)
        draw(genome, copy: copy, stage: .finished, in: ctx); ctx.endPDFPage(); ctx.closePDF()
    }
    /// The same vector PDF in memory, for tools that read the poster's outlines back.
    public static func pdfData(_ genome: Genome, copy: PosterCopy) throws -> Data {
        var box = CGRect(x: 0, y: 0, width: 595.28, height: 841.89)
        let data = NSMutableData()
        guard let consumer = CGDataConsumer(data: data as CFMutableData), let ctx = CGContext(consumer: consumer, mediaBox: &box, nil) else { throw PosterError.image("Cannot create PDF.") }
        ctx.beginPDFPage(nil); ctx.translateBy(x: 0, y: box.height); ctx.scaleBy(x: box.width / 1000, y: -box.height / 1414)
        draw(genome, copy: copy, stage: .finished, in: ctx); ctx.endPDFPage(); ctx.closePDF()
        return data as Data
    }
    public static func load(_ url: URL) throws -> CGImage {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw PosterError.image("Cannot read image at \(url.path).") }
        return image
    }
    private static func draw(_ g: Genome, copy: PosterCopy, stage: ConstructionStage, in ctx: CGContext) {
        if g.renderStyle != nil {StylePosterRenderer.draw(g,copy:copy,stage:stage,in:ctx);return}
        let ink = CGColor(gray: 0.035, alpha: 1), paper = CGColor(gray: 0.94, alpha: 1)
        ctx.setFillColor(ink); ctx.fill(CGRect(x: 0, y: 0, width: 1000, height: 1414))
        let p = Pen(ctx: ctx, fg: paper, bg: ink, copy: copy, genome: g)
        if stage == .finished {
        p.text(copy.institution, CGRect(x: 22, y: 19, width: 415, height: 14), font: "HelveticaNeue-Medium")
        p.text(copy.briefID==nil ? "TYPE / STUDIES     № \(g.seed % 10000)":copy.footer, CGRect(x: 700, y: 19, width: 278, height: 14))
        }
        let plan = BlockoutPlan.make(g)
        var r = SeededRandom(seed: g.seed ^ 0x4c41594f5554)
        let split = 435 + plan.scale * 115, top = 330 + plan.distortion * 60
        var zones: [(CGRect, Int)] = []
        if g.layout % 2 == 0 {
            zones += [(CGRect(x: 14, y: 58, width: split - 22, height: top), 0), (CGRect(x: split, y: 58, width: 986 - split, height: top), 1)]
        } else {
            zones += [(CGRect(x: 14, y: 58, width: 576, height: top), 1), (CGRect(x: 602, y: 58, width: 384, height: top), 0)]
        }
        let midY = 68 + top, midH = 440 + plan.scale * 65
        zones += [(CGRect(x: 14, y: midY, width: 462, height: midH), 2),
                  (CGRect(x: 488, y: midY, width: 242, height: midH * 0.61), 3),
                  (CGRect(x: 742, y: midY, width: 244, height: midH), 4),
                  (CGRect(x: 488, y: midY + midH * 0.61 + 8, width: 242, height: midH * 0.39 - 8), 5)]
        let bandY = midY + midH + 10
        zones.append((CGRect(x: 14, y: bandY, width: 972, height: 91 + g.density * 30), 6))
        let bottomY = bandY + 103 + g.density * 30, bottomH = 1370 - bottomY, cut = 330 + plan.scale * 90
        zones += [(CGRect(x: 14, y: bottomY, width: cut - 20, height: bottomH), 7),
                  (CGRect(x: cut + 6, y: bottomY, width: 360, height: bottomH), 8),
                  (CGRect(x: cut + 378, y: bottomY, width: 608 - cut, height: bottomH * 0.57), 9),
                  (CGRect(x: cut + 378, y: bottomY + bottomH * 0.57 + 8, width: 608 - cut, height: bottomH * 0.43 - 8), 10)]
        for (rect, i) in zones {
            ctx.saveGState(); ctx.clip(to: rect); ctx.translateBy(x: rect.minX, y: rect.minY)
            let local = CGRect(origin: .zero, size: rect.size), inverted = r.unit() < g.inversion
            let q = Pen(ctx: ctx, fg: inverted ? ink : paper, bg: inverted ? paper : ink, copy: copy, genome: g)
            if inverted { ctx.setFillColor(paper); ctx.fill(local) }
            let anchors = [0, 1, 2, 5, 4, 9, 6, 7, 3, 8, 10]
            let motif = (g.layout < 2 || i == 1 || i == 6 || i == 8) ? anchors[i] : g.motifs[i]
            var motifRng = SeededRandom(seed: g.seed ^ (UInt64(i + 1) &* 0xa0761d6478bd642f))
            let order = [1, 2, 7].contains(motif) ? 1 : ([0, 4, 5, 9, 11].contains(motif) ? 2 : 3)
            let ready = stage == .finished || (stage == .primary && order == 1) || (stage == .secondary && order <= 2)
            if ready {
                q.motif(motif, in: local.insetBy(dx: 2, dy: 2), rng: &motifRng, details: stage == .finished)
            } else {
                let color = stage == .blockout ? (inverted ? ink : paper) : CGColor(gray: inverted ? 0.77 : 0.15, alpha: 1)
                let scaffold = Pen(ctx: ctx, fg: color, bg: inverted ? paper : ink, copy: copy, genome: g)
                scaffold.blockout(motif, in: local.insetBy(dx: 2, dy: 2))
            }
            ctx.restoreGState()
        }
        if stage == .finished {
        p.text(copy.footer, CGRect(x: 22, y: 1388, width: 650, height: 11))
        p.text("\(g.seed) / \(g.layout + 1)", CGRect(x: 820, y: 1388, width: 158, height: 11))
        }
    }
}

private struct Pen {
    let ctx: CGContext
    let fg: CGColor
    let bg: CGColor
    let copy: PosterCopy
    let genome: Genome
    var initials: [String] { copy.initials }
    func glyphPath(_ string: String, font: String) -> CGPath? {
        let f = CTFontCreateWithName(font as CFString, 100, nil)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: string, attributes: [.font: f]))
        let path = CGMutablePath()
        for run in CTLineGetGlyphRuns(line) as! [CTRun] {
            let n = CTRunGetGlyphCount(run)
            var glyphs = [CGGlyph](repeating: 0, count: n), positions = [CGPoint](repeating: .zero, count: n)
            CTRunGetGlyphs(run, CFRange(location: 0, length: n), &glyphs)
            CTRunGetPositions(run, CFRange(location: 0, length: n), &positions)
            let runFont = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
            for i in 0..<n {
                if let glyph = CTFontCreatePathForGlyph(runFont, glyphs[i], nil) {
                    path.addPath(glyph, transform: CGAffineTransform(translationX: positions[i].x, y: positions[i].y))
                }
            }
        }
        return path.isEmpty ? nil : path
    }
    func text(_ s: String, _ rect: CGRect, font: String = "HelveticaNeue-Bold", outline: Bool = false, color: CGColor? = nil) {
        guard rect.width > 0, rect.height > 0, let path = glyphPath(s, font: font) else { return }
        var rect = rect
        let b = path.boundingBoxOfPath
        if s == "I" || s == "i" || s == "l" {
            let naturalWidth = min(rect.width, rect.height * b.width / max(1, b.height) * 1.3)
            rect = CGRect(x: rect.midX - naturalWidth / 2, y: rect.minY, width: naturalWidth, height: rect.height)
        }
        guard b.width > 0, b.height > 0 else { return }
        ctx.saveGState(); ctx.translateBy(x: rect.minX, y: rect.maxY)
        ctx.scaleBy(x: rect.width / b.width, y: -rect.height / b.height); ctx.translateBy(x: -b.minX, y: -b.minY); ctx.addPath(path)
        if outline { ctx.setStrokeColor(color ?? fg); ctx.setLineWidth(1.15); ctx.strokePath() }
        else { ctx.setFillColor(color ?? fg); ctx.fillPath() }
        ctx.restoreGState()
    }
    func ellipse(_ rect: CGRect, filled: Bool = false) {
        ctx.setLineWidth(1.65); ctx.setStrokeColor(fg); ctx.setFillColor(fg)
        if filled { ctx.fillEllipse(in: rect) } else { ctx.strokeEllipse(in: rect) }
    }
    func line(_ a: CGPoint, _ b: CGPoint, width: Double = 1.5) {
        ctx.setStrokeColor(fg); ctx.setLineWidth(width); ctx.move(to: a); ctx.addLine(to: b); ctx.strokePath()
    }
    func ring(_ string: String, center: CGPoint, radius: Double, start: Double, size: Double) {
        let chars = Array(string)
        for (i, ch) in chars.enumerated() {
            let angle = start + Double(i) / Double(chars.count) * .pi * 2
            ctx.saveGState(); ctx.translateBy(x: Double(center.x) + cos(angle) * radius, y: Double(center.y) + sin(angle) * radius); ctx.rotate(by: angle + .pi / 2)
            text(String(ch), CGRect(x: -size * 0.29, y: -size, width: size * 0.58, height: size)); ctx.restoreGState()
        }
    }
    func blockout(_ kind: Int, in b: CGRect) {
        let w = Double(b.width), h = Double(b.height)
        ctx.saveGState(); ctx.translateBy(x: b.minX, y: b.minY); ctx.setFillColor(fg); ctx.setStrokeColor(fg)
        switch kind % 12 {
        case 0, 5, 11:
            let count = kind == 5 ? 3 : 1
            for i in 0..<count {
                let rh = h / Double(count), d = min(w * 0.88, rh * 0.88)
                ctx.setLineWidth(d * 0.14)
                ctx.strokeEllipse(in: CGRect(x: (w - d) / 2, y: Double(i) * rh + (rh - d) / 2, width: d, height: d))
            }
        case 1, 8, 9:
            let n = kind == 1 ? 5 : 7, rh = h / Double(kind == 1 ? 5 : 7)
            for i in 0..<n {
                let width = kind == 9 ? w * Double(i + 1) / Double(n) : w * (i % 2 == 0 ? 0.94 : 0.78)
                ctx.fill(CGRect(x: 0, y: Double(i) * rh, width: width, height: rh * 0.7))
            }
        case 2:
            ctx.move(to: CGPoint(x: 0, y: 0)); ctx.addLine(to: CGPoint(x: w * 0.40, y: h * 0.70)); ctx.addLine(to: CGPoint(x: w * 0.90, y: 0)); ctx.addLine(to: CGPoint(x: w * 0.52, y: h * 0.94)); ctx.closePath(); ctx.fillPath()
            ctx.fill(CGRect(x: 0, y: h * 0.77, width: w, height: h * 0.20))
        case 3, 4:
            let rows = 5, rh = h / 5
            for i in 0..<rows {
                let d = min(rh * 0.92, w * 0.75)
                ctx.fillEllipse(in: CGRect(x: i % 2 == 0 ? 0 : w - d, y: Double(i) * rh, width: d, height: rh * 0.92))
            }
        case 6, 10:
            let cols = kind == 6 ? 7 : 3, rows = kind == 6 ? 1 : 3
            let cw = w / Double(cols), rh = h / Double(rows)
            for i in 0..<rows { for j in 0..<cols {
                ctx.move(to: CGPoint(x: Double(j) * cw, y: Double(i) * rh))
                ctx.addLine(to: CGPoint(x: Double(j + 1) * cw - 4, y: Double(i) * rh))
                ctx.addLine(to: CGPoint(x: (Double(j) + 0.5) * cw, y: Double(i + 1) * rh - 4)); ctx.closePath(); ctx.fillPath()
            } }
        default:
            ctx.fill(CGRect(x: 0, y: 0, width: w, height: h * 0.17))
            ctx.fill(CGRect(x: 0, y: 0, width: w * 0.16, height: h))
            ctx.fill(CGRect(x: 0, y: h * 0.84, width: w, height: h * 0.16))
        }
        ctx.restoreGState()
    }
    func motif(_ kind: Int, in b: CGRect, rng r: inout SeededRandom, details: Bool) {
        let w = Double(b.width), h = Double(b.height)
        ctx.saveGState(); ctx.translateBy(x: b.minX, y: b.minY)
        switch kind % 12 {
        case 0:
            let radius = min(w * 0.34, h * 0.39)
            ring(copy.institution + " • ", center: CGPoint(x: w * 0.39, y: h * 0.49), radius: radius, start: -2.6 + genome.distortion, size: radius * 0.24)
            text(initials[0], CGRect(x: w * 0.26, y: h * 0.30, width: w * 0.26, height: h * 0.34))
            ring(copy.subtitle + " • ", center: CGPoint(x: w * 0.84, y: h * 0.76), radius: radius * 0.34, start: 0.4, size: radius * 0.09)
            text(copy.briefID==nil ? "TYPE":copy.words.first!, CGRect(x: w * 0.1, y: h * 0.87, width: w * 0.28, height: h * 0.09))
        case 1:
            let words = copy.words + copy.subtitle.uppercased().split(separator: " ").map(String.init)
            let rows = min(5, max(3, words.count)), rowH = h / Double(min(5, max(3, words.count)))
            for i in 0..<rows {
                text(words[i % words.count], CGRect(x: i % 2 == 0 ? 0 : -w * 0.015, y: Double(i) * rowH, width: w * (i == 1 ? 1.04 : 0.99), height: rowH * 0.94), font: "HelveticaNeue-CondensedBlack")
            }
        case 2:
            text(initials[0].lowercased(), CGRect(x: -w * 0.05, y: -h * 0.09, width: w * 0.70, height: h * 0.68), font: "BodoniSvtyTwoITCTT-Bold")
            ctx.saveGState(); ctx.translateBy(x: w * 0.65, y: h * 0.2); ctx.rotate(by: .pi * 0.14)
            text(initials[1 % initials.count], CGRect(x: -w * 0.15, y: 0, width: w * 0.46, height: h * 0.7)); ctx.restoreGState()
            text(initials[2 % initials.count], CGRect(x: 0, y: h * 0.66, width: w * 0.99, height: h * 0.33), font: "HelveticaNeue-CondensedBlack")
            if details { for i in 0..<4 { text(copy.subtitle, CGRect(x: w * 0.02, y: h * (0.49 + Double(i) * 0.037), width: w * 0.62, height: h * 0.032)) } }
        case 3:
            let rows = max(3, min(6, initials.count + 1)), rowH = h / Double(max(3, min(6, initials.count + 1)))
            let diameter = min(rowH * 1.12, w * 0.46), count = Int(8 + genome.repetition * 18)
            for row in 0..<rows {
                for i in 0..<count {
                    let t = Double(i) / Double(count - 1), xx = (row % 2 == 0 ? t : 1 - t) * (w - diameter)
                    let rect = CGRect(x: xx, y: Double(row) * rowH, width: diameter, height: rowH * 0.99)
                    ctx.setFillColor(fg); ctx.fillEllipse(in: rect); ctx.setStrokeColor(bg); ctx.setLineWidth(1.5); ctx.strokeEllipse(in: rect)
                    if i == count - 1 { text(initials[row % initials.count], rect.insetBy(dx: diameter * 0.23, dy: rowH * 0.20), color: bg) }
                }
            }
        case 4:
            let step = h / 5
            for i in 0..<5 {
                let diameter = min(w * 0.50, step * 0.96)
                let rect = CGRect(x: 0, y: Double(i) * step, width: diameter, height: step * 0.97)
                ellipse(rect, filled: true); text(initials[i % initials.count], rect.insetBy(dx: diameter * 0.23, dy: step * 0.2), color: bg)
                let small = CGRect(x: w * 0.55, y: Double(i) * step + step * 0.03, width: w * 0.43, height: step * 0.86)
                ellipse(small); text(initials[(i + 1) % initials.count], small.insetBy(dx: w * 0.1, dy: step * 0.17))
            }
        case 5:
            for i in 0..<3 {
                let rect = CGRect(x: 0, y: Double(i) * h / 3, width: w * 0.99, height: h / 3 * 1.04)
                ellipse(rect); text(initials[i % initials.count], rect.insetBy(dx: w * 0.23, dy: h * 0.06))
            }
        case 6:
            let cols = 5 + Int(genome.density * 4)
            for i in 0..<cols {
                let cw = w / Double(cols)
                ctx.saveGState(); ctx.translateBy(x: Double(i) * cw, y: 0)
                if i % 2 == 0 {
                    ctx.setStrokeColor(fg); ctx.setLineWidth(1.5); ctx.move(to: CGPoint(x: 2, y: 2)); ctx.addLine(to: CGPoint(x: cw / 2, y: h * 0.96)); ctx.addLine(to: CGPoint(x: cw - 3, y: 2)); ctx.strokePath()
                    ellipse(CGRect(x: cw * 0.23, y: 3, width: cw * 0.54, height: h * 0.52))
                } else {
                    text(initials[0], CGRect(x: 0, y: 0, width: cw * 0.92, height: h * 0.66), font: "HelveticaNeue-CondensedBlack")
                    text(copy.briefID==nil ? "DESIGN":copy.words.last!, CGRect(x: 1, y: h * 0.76, width: cw * 0.9, height: h * 0.14))
                }
                ctx.restoreGState()
            }
        case 7:
            let stroke = min(w, h) * 0.155
            ctx.setFillColor(fg); ctx.fill(CGRect(x: 0, y: 0, width: w, height: stroke))
            text(copy.words[0], CGRect(x: 4, y: 4, width: w - 8, height: stroke - 8), color: bg)
            ctx.saveGState(); ctx.translateBy(x: stroke, y: stroke + 5); ctx.rotate(by: .pi / 2)
            text(copy.words.last ?? "DESIGN", CGRect(x: 0, y: 0, width: h - stroke - 8, height: stroke * 0.9)); ctx.restoreGState()
            text(initials[0], CGRect(x: stroke * 1.2, y: stroke * 1.4, width: w - stroke * 1.4, height: h * 0.47), font: "HelveticaNeue-CondensedBlack", outline: genome.distortion > 0.4)
            text(copy.subtitle, CGRect(x: stroke * 1.1, y: h * 0.75, width: w - stroke * 1.2, height: h * 0.08))
            text(copy.briefID==nil ? "INSTITUTE":copy.institution, CGRect(x: stroke * 1.1, y: h * 0.86, width: w - stroke * 1.2, height: h * 0.12))
        case 8:
            let rows = max(4, Int(h / 55)), parts = copy.subtitle.split(separator: " ").map(String.init) + (copy.briefID==nil ? ["Visual", "Design"]:copy.words)
            for i in 0..<rows {
                let rh = h / Double(rows), ww = w * r.value(0.56, 0.97), xx = (w - ww) * (i % 2 == 0 ? 0 : 1)
                let rect = CGRect(x: xx, y: Double(i) * rh + 1, width: ww, height: rh - 4)
                ctx.setStrokeColor(fg); ctx.setLineWidth(1.4); ctx.addPath(CGPath(roundedRect: rect, cornerWidth: rh / 2, cornerHeight: rh / 2, transform: nil)); ctx.strokePath()
                text(parts[i % parts.count], rect.insetBy(dx: rh * 0.25, dy: rh * 0.18))
            }
        case 9:
            let word = copy.words.joined(separator: " "), n = 10 + Int(genome.repetition * 10)
            for i in 0..<n {
                let prefix = String(word.prefix(max(1, (i + 1) * word.count / n))), rowH = h / Double(n)
                text(prefix, CGRect(x: 0, y: Double(i) * rowH, width: w * (0.18 + Double(i) / Double(n) * 0.82), height: rowH * 0.86), font: "HelveticaNeue-Medium")
            }
        case 10:
            let cw = w / 3, rh = h / 3
            for i in 0..<3 { for j in 0..<3 {
                let rect = CGRect(x: Double(j) * cw, y: Double(i) * rh, width: cw * 0.97, height: rh * 0.97)
                if (i + j) % 2 == 0 {
                    ellipse(rect, filled: true); ctx.setFillColor(bg); ctx.fillEllipse(in: rect.insetBy(dx: rect.width * 0.35, dy: rect.height * 0.35))
                    ctx.fill(CGRect(x: rect.midX, y: rect.minY + rect.height * 0.4, width: rect.width * 0.6, height: rect.height * 0.2))
                } else {
                    ctx.setFillColor(fg); ctx.move(to: CGPoint(x: rect.minX, y: rect.minY)); ctx.addLine(to: CGPoint(x: rect.maxX, y: rect.minY)); ctx.addLine(to: CGPoint(x: rect.midX, y: rect.maxY)); ctx.closePath(); ctx.fillPath()
                }
            } }
        default:
            ellipse(CGRect(x: 0, y: 0, width: w * 0.98, height: h * 0.98))
            line(CGPoint(x: 0, y: 0), CGPoint(x: w, y: h), width: 3); line(CGPoint(x: w * 0.65, y: 0), CGPoint(x: w * 0.65, y: h), width: 3)
            text(initials[0], CGRect(x: 0, y: h * 0.05, width: w, height: h * 0.9), outline: true)
        }
        ctx.restoreGState()
    }
}
