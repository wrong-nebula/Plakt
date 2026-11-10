import AppKit
import CoreText

public enum ContactSheet {
    public static func writeProcess(_ urls: [URL], seed: UInt64, to folder: URL) throws {
        guard urls.count == 4 else { return }
        let width = 1280, height = 520
        guard let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw PosterError.render }
        ctx.setFillColor(CGColor(gray: 0.94, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        func label(_ text: String, x: Int, y: Int, size: Double) {
            let font = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, size, nil)
            let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: NSColor.black]))
            ctx.textMatrix = .identity; ctx.textPosition = CGPoint(x: x, y: height - y); CTLineDraw(line, ctx)
        }
        label("FORM / LAB    SEED \(seed)    COIN TOSS: STAGED CONSTRUCTION", x: 20, y: 25, size: 14)
        for (i, url) in urls.enumerated() {
            let image = try PosterRenderer.load(url)
            let x = 20 + i * 316
            ctx.draw(image, in: CGRect(x: x, y: 55, width: 292, height: 413))
            label(ConstructionStage.allCases[i].label.uppercased(), x: x, y: 490, size: 11)
        }
        guard let image = ctx.makeImage() else { throw PosterError.render }
        try PosterRenderer.png(image, to: folder.appending(path: "process-strip.png"))
    }
    public static func write(_ generation: Generation) throws {
        let cols = min(4, generation.candidates.count), tileW = 280, tileH = 446
        let rows = (generation.candidates.count + cols - 1) / cols
        let width = cols * tileW + 40, height = rows * tileH + 80
        guard let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw PosterError.render }
        ctx.setFillColor(CGColor(gray: 0.94, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        func label(_ text: String, x: Int, y: Int, size: Double) {
            let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.font: CTFontCreateWithName("HelveticaNeue-Medium" as CFString, size, nil), .foregroundColor: NSColor.black]))
            ctx.saveGState(); ctx.textMatrix = .identity; ctx.textPosition = CGPoint(x: x, y: height - y); CTLineDraw(line, ctx); ctx.restoreGState()
        }
        label("FORM / LAB     GENERATION \(generation.number)     \(generation.candidates.count) CANDIDATES", x: 24, y: 30, size: 15)
        for (i, candidate) in generation.candidates.enumerated() {
            let x = 24 + (i % cols) * tileW, y = 55 + (i / cols) * tileH
            let image = try PosterRenderer.load(candidate.imageURL)
            let rect = CGRect(x: x, y: height - y - 368, width: 260, height: 368)
            ctx.draw(image, in: rect)
            label("#\(candidate.rank)   \(candidate.genome.usesStagedConstruction ? "STAGED" : "DIRECT")   \(candidate.genome.seed)", x: x, y: y + 389, size: 11)
            label("CONSENSUS \(candidate.consensus.formatted(.number.precision(.fractionLength(1))))   /   OCR \(candidate.measurements.recognizedWords) WORDS", x: x, y: y + 407, size: 10)
        }
        guard let image = ctx.makeImage() else { throw PosterError.render }
        try PosterRenderer.png(image, to: generation.directory.appending(path: "contact-sheet.png"))
    }
}
