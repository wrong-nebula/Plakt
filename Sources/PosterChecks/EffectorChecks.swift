import Foundation
import CoreGraphics
import PosterCore
extension PosterChecks {
    static func checkEffectors() throws {
        // A generated poster read back from its own vector PDF: many filled shapes, in the poster's colours, in page coordinates.
        let poster = try PosterVectors.svg(pdf: PosterRenderer.pdfData(Genome.random(seed: 101), copy: PosterCopy()))
        try require(poster.paths > 40, "Poster PDF converted to only \(poster.paths) shapes")
        try require(abs(poster.size.width - 595.28) < 0.01 && abs(poster.size.height - 841.89) < 0.01, "Unexpected poster page size \(poster.size)")
        try require(poster.svg.hasPrefix("<svg") && poster.svg.contains("viewBox=\"0 0 595.28 841.89\""), "Converted poster has no viewBox")
        try require(Set(poster.svg.components(separatedBy: "fill=\"").dropFirst().map { String($0.prefix(7)) }).count >= 2, "Converted poster lost its colours")
        try require(!poster.svg.contains("nan") && !poster.svg.contains("inf"), "Converted poster has invalid numbers")

        // Fills, strokes and forms: a hand-made PDF with a filled square, a stroked line, a dashed line and half-transparent fill.
        var box = CGRect(x: 0, y: 0, width: 200, height: 100)
        let data = NSMutableData()
        guard let consumer = CGDataConsumer(data: data as CFMutableData), let ctx = CGContext(consumer: consumer, mediaBox: &box, nil) else { throw CheckFailure("PDF context") }
        ctx.beginPDFPage(nil)
        ctx.setFillColor(red: 1, green: 0, blue: 0, alpha: 1); ctx.fill(CGRect(x: 10, y: 10, width: 40, height: 40))
        ctx.setStrokeColor(red: 0, green: 0, blue: 1, alpha: 1); ctx.setLineWidth(6); ctx.strokeLineSegments(between: [CGPoint(x: 60, y: 50), CGPoint(x: 190, y: 50)])
        ctx.setLineDash(phase: 0, lengths: [10, 10]); ctx.strokeLineSegments(between: [CGPoint(x: 60, y: 80), CGPoint(x: 190, y: 80)]); ctx.setLineDash(phase: 0, lengths: [])
        ctx.setFillColor(red: 0, green: 0.5, blue: 0, alpha: 0.5); ctx.fillEllipse(in: CGRect(x: 100, y: 5, width: 30, height: 30))
        ctx.endPDFPage(); ctx.closePDF()
        let shapes = try PosterVectors.svg(pdf: data as Data)
        try require(shapes.paths == 4, "Expected 4 converted shapes, got \(shapes.paths)")
        try require(shapes.svg.contains("fill=\"#ff0000\"") && shapes.svg.contains("fill=\"#0000ff\""), "Fill and stroke colours were not kept")
        try require(shapes.svg.contains("fill-opacity=\"0.5\""), "Fill alpha was not kept")
        // The square sits at the top-left after the flip: PDF y 10…50 becomes SVG y 50…90.
        try require(shapes.svg.contains("M10 90") || shapes.svg.contains("M10 50"), "Square was not flipped into SVG coordinates")
        // A dashed 130-unit line with 10/10 dashes becomes seven separate outlines in one path.
        let dashed = shapes.svg.components(separatedBy: "<path").dropFirst()[3]
        try require(dashed.components(separatedBy: "M").count - 1 == 7, "Dashed stroke did not become 7 dashes")

        // The editor's export (background rect plus M/L/Z paths) becomes a vector PDF of the same shapes.
        let exported = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"1414\" viewBox=\"0 0 1000 1414\"><rect width=\"1000\" height=\"1414\" fill=\"#07070a\"/><path d=\"M100 100L300 100 300 300 100 300ZM400 400L500 400 500 500Z\" fill=\"#d7ff3a\"/><path d=\"M600 600L900 600 900 900Z\" fill=\"#f1f0ea\" fill-opacity=\"0.5\"/></svg>"
        let pdf = try PosterVectors.pdf(fromSVG: exported)
        let back = try PosterVectors.svg(pdf: pdf)
        try require(back.paths == 3, "Exported PDF should hold 3 shapes, got \(back.paths)")
        try require(abs(back.size.width - 595.28) < 0.01 && abs(back.size.height - 595.28 * 1.414) < 0.05, "Exported PDF page \(back.size)")
        try require(back.svg.contains("#d7ff3a") && back.svg.contains("fill-opacity=\"0.5\""), "Exported PDF lost a colour or its alpha")

        // Colour modifiers export gradients: a linear one with a hard stop, padded past both ends, and a radial one
        // fading to transparent. The PDF is drawn to pixels at one pixel per unit and sampled.
        let graded = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"100\" viewBox=\"0 0 200 100\"><rect width=\"200\" height=\"100\" fill=\"#ffffff\"/>"
            + "<defs><linearGradient id=\"p0\" gradientUnits=\"userSpaceOnUse\" x1=\"20\" y1=\"0\" x2=\"80\" y2=\"0\"><stop offset=\"0\" stop-color=\"#ff0000\"/><stop offset=\"0.5\" stop-color=\"#ff0000\"/><stop offset=\"0.5\" stop-color=\"#0000ff\"/><stop offset=\"1\" stop-color=\"#0000ff\"/></linearGradient></defs>"
            + "<path d=\"M0 0L100 0 100 100 0 100Z\" fill=\"url(#p0)\"/>"
            + "<defs><radialGradient id=\"p1\" gradientUnits=\"userSpaceOnUse\" cx=\"150\" cy=\"50\" r=\"40\"><stop offset=\"0\" stop-color=\"#00ff00\"/><stop offset=\"1\" stop-color=\"#000000\" stop-opacity=\"0\"/></radialGradient></defs>"
            + "<path d=\"M110 10L190 10 190 90 110 90Z\" fill=\"url(#p1)\" fill-opacity=\"0.8\"/>"
            + "<defs><linearGradient id=\"p2\" gradientUnits=\"userSpaceOnUse\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"100\"><stop offset=\"0\" stop-color=\"#000000\"/><stop offset=\"1\" stop-color=\"#000000\" stop-opacity=\"0\"/></linearGradient></defs>"
            + "<path d=\"M192 0L200 0 200 100 192 100Z\" fill=\"url(#p2)\"/></svg>"
        let (px, width) = try pixels(of: PosterVectors.pdf(fromSVG: graded), width: 200)
        let at = { (x: Int, y: Int) -> (Double, Double, Double) in let i = (y * width + x) * 4; return (Double(px[i]) / 255, Double(px[i + 1]) / 255, Double(px[i + 2]) / 255) }
        let near = { (c: (Double, Double, Double), r: Double, g: Double, b: Double) in abs(c.0 - r) < 0.08 && abs(c.1 - g) < 0.08 && abs(c.2 - b) < 0.08 }
        try require(near(at(5, 50), 1, 0, 0) && near(at(95, 50), 0, 0, 1), "Linear gradient is not padded past its ends: \(at(5, 50)) \(at(95, 50))")
        try require(near(at(48, 50), 1, 0, 0) && near(at(52, 50), 0, 0, 1), "Hard gradient stop was smoothed: \(at(48, 50)) \(at(52, 50))")
        try require(near(at(150, 50), 0.2, 1, 0.2) && near(at(112, 12), 1, 1, 1), "Radial gradient or its opacity is wrong: \(at(150, 50)) \(at(112, 12))")
        // PDF shadings carry no per-stop opacity; fading stops go through a soft mask, which must not be upside down.
        try require(at(196, 8).0 < 0.15 && at(196, 92).0 > 0.85, "Fading gradient lost its opacity or is flipped: \(at(196, 8)) \(at(196, 92))")

        // The bundled editor is present and speaks to the app.
        guard let entry = EffectorResources.entryURL, let html = try? String(contentsOf: entry, encoding: .utf8) else { throw CheckFailure("Effector editor resource is missing") }
        try require(html.contains("effectorStudio") && html.contains("const APP=true"), "Effector editor is not the app build")
        try require(!html.contains("MediaRecorder") && !html.contains("webm"), "Effector editor still records video")
        print("PASS effectors: poster \(poster.paths) shapes; fill, stroke, dash and alpha conversion; SVG→PDF export with gradients; app editor \(html.utf8.count / 1024) KB")
    }

    /// RGBA bytes of a PDF's first page on white, scaled to `width` pixels, top row first.
    private static func pixels(of pdf: Data, width: Int) throws -> ([UInt8], Int) {
        guard let provider = CGDataProvider(data: pdf as CFData), let document = CGPDFDocument(provider), let page = document.page(at: 1),
              let space = CGColorSpace(name: CGColorSpace.sRGB) else { throw CheckFailure("Gradient PDF could not be read") }
        let box = page.getBoxRect(.mediaBox), k = CGFloat(width) / box.width, height = Int((box.height * k).rounded())
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        try bytes.withUnsafeMutableBytes { buffer in
            guard let ctx = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                      space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw CheckFailure("Bitmap context") }
            ctx.setFillColor(red: 1, green: 1, blue: 1, alpha: 1); ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
            ctx.scaleBy(x: k, y: k); ctx.drawPDFPage(page)
        }
        return (bytes, width)
    }
}
