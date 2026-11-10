import Foundation
import CoreGraphics

/// One poster's measured scores. Every value is 0–1; they are proxies, not aesthetic truth.
struct AgentScorecard: Sendable {
    var label: String
    var scores: [String: Double]
    var measurements: Measurements
    var preflight: [String]
    var unreadCopy: [String]
}

/// Owns the Vision/Core ML judges for a server's lifetime, so models compile once.
actor AgentJudge {
    private let judge: PosterJudge
    private let styles: StyleJudgeBank?
    private let taste: TasteJudgeBank?
    let tasteJudges: [String]
    let styleNote: String

    init(environment: AgentEnvironment) throws {
        judge = try PosterJudge(referenceURL: Resources.referenceURL, cropReference: true, cpuOnly: false)
        let bank = try? StyleJudgeBank()
        styles = bank; styleNote = bank?.note ?? "Style judges unavailable."
        let t = try? TasteJudgeBank(directory: environment.taste)
        taste = t; tasteJudges = t?.members.map { "Taste / " + $0.name } ?? []
    }

    /// Scores at the jury's own size: a 700 px wide render.
    func score(_ image: CGImage, scene: StyleGenome?, label: String) throws -> AgentScorecard {
        var genome = Genome.random(seed: 0); genome.repetition = 0.65
        let (m, quality, _) = try judge.evaluate(image, genome: genome)
        var scores: [String: Double] = ["Composition": quality, "Reference": m.reference,
                                        "Typography": m.readability * 0.65 + m.hierarchy * 0.35,
                                        "Rhythm": m.detail * 0.45 + m.balance * 0.30 + m.coverage * 0.25]
        var preflight: [String] = [], unread: [String] = []
        if let scene {
            let copy = scene.posterCopy ?? PosterCopy(title: scene.elements.first { $0.kind == "text" }?.text ?? "POSTER")
            scores.merge(CompositionJudges.evaluate(scene, measurements: m, copy: copy, style: scene.styleCategory)) { _, new in new }
            preflight = CompositionJudges.preflight(scene, copy: copy)
            if scene.posterCopy == nil { preflight.removeAll { $0 == "missing required copy" }; scores["Copy completeness"] = nil }
            let read = (m.recognizedText ?? "").uppercased().filter { $0.isLetter || $0.isNumber || $0.isWhitespace }
            let words = copy.title.uppercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init).filter { $0.count >= 3 }
            unread = words.filter { !read.contains($0) }
        }
        if let styles { scores.merge(try styles.scores(image)) { _, new in new } }
        if let taste { scores.merge(try taste.scores(image)) { _, new in new } }
        return AgentScorecard(label: label, scores: scores, measurements: m, preflight: preflight, unreadCopy: unread)
    }
}

enum AgentRanking {
    /// Default jury: personal taste ×2 when trained, plus the craft committee.
    static func defaultWeights(tasteJudges: [String]) -> [String: Double] {
        var w: [String: Double] = ["Composition": 1, "Typography": 1, "Rhythm": 1, "Legibility": 1, "Spacing": 1, "Hierarchy": 0.5, "Ink contrast": 0.5]
        for t in tasteJudges { w[t] = 2 }
        return w
    }

    /// Weighted Borda over the cards; judges that score everyone the same are skipped.
    static func borda(_ cards: [AgentScorecard], weights: [String: Double]) -> (order: [Int], consensus: [Double], used: [String]) {
        let n = cards.count
        var total = [Double](repeating: 0, count: n), weightSum = 0.0, used: [String] = []
        for (judge, w) in weights.sorted(by: { $0.key < $1.key }) where w > 0 {
            let values = cards.map { $0.scores[judge] }
            guard values.allSatisfy({ $0 != nil }) else { continue }
            let v = values.map { $0! }
            guard let lo = v.min(), let hi = v.max(), hi - lo > 1e-9 else { continue }
            for i in 0..<n {
                let better = v.filter { $0 > v[i] + 1e-12 }.count, ties = v.filter { abs($0 - v[i]) <= 1e-12 }.count - 1
                let rank = Double(better) + Double(ties) / 2
                total[i] += w * (n > 1 ? 1 - rank / Double(n - 1) : 1)
            }
            weightSum += w; used.append(judge)
        }
        let consensus = total.map { weightSum > 0 ? $0 / weightSum : 0 }
        return (Array(0..<n).sorted { consensus[$0] == consensus[$1] ? $0 < $1 : consensus[$0] > consensus[$1] }, consensus, used)
    }

    static func card(_ c: AgentScorecard, full: Bool, allAffinities: Bool = false) -> JSONValue {
        let craft = ["Composition", "Typography", "Rhythm", "Reference", "Legibility", "Hierarchy", "Spacing", "Type integrity", "Alignment", "Margins", "Negative space", "Palette discipline", "Ink contrast", "Optical balance", "Copy completeness"]
        var o: [String: JSONValue] = ["label": .string(c.label)]
        o["craft"] = .object(Dictionary(uniqueKeysWithValues: craft.compactMap { k in c.scores[k].map { (k, JSONValue.num($0, 3)) } }))
        let taste = c.scores.filter { $0.key.hasPrefix("Taste / ") }
        if !taste.isEmpty { o["taste"] = .object(taste.mapValues { .num($0, 3) }) }
        let styleNames = Set(StyleCatalog.categories.map(\.name))
        let style = c.scores.filter { styleNames.contains($0.key) }.sorted { $0.value > $1.value }
        let designers = c.scores.filter { $0.key.hasPrefix("Designer / ") }.sorted { $0.value > $1.value }
        o["styleAffinity"] = .array(style.prefix(allAffinities ? 14 : 3).map { ["style": .string($0.key), "score": .num($0.value, 3)] })
        o["designerAffinity"] = .array(designers.prefix(allAffinities ? 27 : 3).map { ["designer": .string(String($0.key.dropFirst(11))), "score": .num($0.value, 3)] })
        o["preflight"] = .array(c.preflight.map { .string($0) })
        if full {
            let m = c.measurements
            o["measurements"] = ["coverage": .num(m.coverage, 3), "detail": .num(m.detail, 3), "balance": .num(m.balance, 3), "contrast": .num(m.contrast, 3),
                                 "readability": .num(m.readability, 3), "hierarchy": .num(m.hierarchy, 3), "recognizedWords": .number(Double(m.recognizedWords))]
            o["ocrText"] = .str(m.recognizedText.map { String($0.prefix(400)) })
            if !c.unreadCopy.isEmpty { o["titleWordsOCRMissed"] = .array(c.unreadCopy.map { .string($0) }) }
        }
        return .object(o)
    }

    /// Plain-language next steps from the numbers.
    static func advice(_ c: AgentScorecard) -> [String] {
        var out: [String] = []
        let s = c.scores
        for p in c.preflight {
            switch p {
            case "protected glyph collisions": out.append("Type collides with other type. Move or shrink the overlapping lines (see Spacing).")
            case "insufficient type contrast": out.append("Some type is too close in value to what is behind it. Darken/lighten the ink, or set_background.")
            case "supporting copy outside safe margins": out.append("Supporting copy is in the outer margin. Move meta lines inward (≥0.04 from each edge).")
            case "missing required copy": out.append("Part of the copy (title, venue, dates, organiser) is not on the poster. Add it with add_text or set_copy.")
            case "supporting glyphs too small": out.append("Supporting copy is too small to read at phone size. Resize meta lines up.")
            default: out.append("Preflight: \(p).")
            }
        }
        if !c.unreadCopy.isEmpty { out.append("OCR could not read: \(c.unreadCopy.joined(separator: ", ")). Fine for expressive display type; otherwise raise contrast or simplify.") }
        if let v = s["Hierarchy"], v < 0.5 { out.append("Weak hierarchy: make the headline larger relative to the supporting copy.") }
        if let v = s["Palette discipline"], v < 0.6 { out.append("Many inks in use. Reduce to 2–4 with recolor.") }
        if let v = s["Negative space"], v < 0.35 { out.append("Negative space is far from target: the page is either crowded or empty.") }
        if let v = s["Optical balance"], v < 0.45 { out.append("Visual weight sits off-centre; check it is deliberate.") }
        if out.isEmpty { out.append("No mechanical problems. Judge the rest by eye: view_poster at phone size, and zoom into details.") }
        return out
    }
}
