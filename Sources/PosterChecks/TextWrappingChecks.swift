import Foundation
import PosterCore

extension PosterChecks {
    static func checkTextWrapping() async throws {
        let cache = CoreTextWrappingCache()
        let texts = [
            "NEW PERSPECTIVES ON THE FUTURE OF VISUAL COMMUNICATION AND PUBLIC SPACE",
            "Saturday 21 November, 10:00–19:30. Talks, screenings and workshops. Tickets ¥2,500 / students ¥1,200. Booking: designforum.example/reservations.",
            "文字と都市のあいだ——視覚表現の未来を考える。\n東京デザインフォーラム2026「公共空間とコミュニケーション」\n11月21日（土）10:00〜19:30。お問い合わせ：info@designforum.example",
            "", " \n\t ", "A\tB\r\nC  D", "👩🏽‍🚀 e\u{301} 👨‍👩‍👧‍👦 🇯🇵", "مرحبا بالعالم العربية English", "ภาษาไทยไม่มีช่องว่าง", "AVATAR office affinity ffi WAVE"
        ]
        let fonts = ["HelveticaNeue-Bold", "HelveticaNeue-Medium", "HiraginoSans-W3"]
        var comparisons = 0
        for text in texts {
            for font in fonts {
                for aspect in [1.0, 1.414] {
                    for width in [1.0, 18, 75, 180, 260, 410, 540] {
                        let previous = PreviousTextWrapping.lines(text, width: width, height: 18, aspect: aspect, font: font)
                        let cached = cache.lines(text, width: width, height: 18, aspect: aspect, font: font)
                        try require(previous == cached, "Cached wrap changed content or line breaks at \(width), \(font), \(aspect)")
                        try require(cached == cache.lines(text, width: width, height: 18, aspect: aspect, font: font), "Cached replay changed")
                        comparisons += 1
                    }
                }
            }
        }
        // Probe either side of an exact native wrap threshold; arithmetic reordering
        // or width rounding must not move a character to another line.
        for width in stride(from: 100.0, through: 102.0, by: 0.03125) {
            try require(cache.lines("AVATAR office affinity ffi", width: width, height: 17.675, aspect: 1.414, font: fonts[0]) == PreviousTextWrapping.lines("AVATAR office affinity ffi", width: width, height: 17.675, aspect: 1.414, font: fonts[0]), "Fractional-width threshold drifted")
        }
        for (width, height, aspect) in [(0.0,18.0,1.0),(-1,18,1),(Double.nan,18,1),(100,0,1),(100,18,Double.infinity)] {
            try require(cache.lines("A B C", width: width, height: height, aspect: aspect, font: fonts[0]) == PreviousTextWrapping.lines("A B C", width: width, height: height, aspect: aspect, font: fonts[0]), "Degenerate-input fallback changed")
        }
        let bounded = CoreTextWrappingCache(paragraphLimit: 2, measurementBudget: 512, layoutLimit: 2)
        for i in 0..<10 {
            for width in [30.0,60,90] {
                _ = bounded.lines("\(i) alphabet typography WORD", width: width, height: 18, aspect: 1, font: fonts[0])
            }
        }
        try require(bounded.statistics.paragraphs <= 2 && bounded.statistics.layouts <= 4 && bounded.statistics.estimatedMeasurementBytes <= 1_024, "Cache capacity exceeded")
        bounded.removeAll()
        try require(bounded.statistics.paragraphs == 0, "Font-change invalidation did not clear the cache")

        let concurrent = CoreTextWrappingCache()
        try await withThrowingTaskGroup(of: Void.self) { group in
            for i in 0..<96 {
                group.addTask {
                    let text = texts[i % texts.count], font = fonts[i % fonts.count]
                    let width = Double(180 + i % 16 * 13)
                    let expected = PreviousTextWrapping.lines(text, width: width, height: 18, aspect: 1.414, font: font)
                    for _ in 0..<4 {
                        try require(concurrent.lines(text, width: width, height: 18, aspect: 1.414, font: font) == expected, "Concurrent cache contamination")
                    }
                }
            }
            try await group.waitForAll()
        }
        let suite = "posterlab-pretext-checks-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suite) else { throw CheckFailure("Cannot create isolated preference suite") }
        defer { defaults.removePersistentDomain(forName: suite) }
        try require(TextWrappingPreferences.method(in: defaults) == .pretext, "Pretext default is disabled")
        defaults.set(false, forKey: TextWrappingPreferences.pretextEnabledKey)
        try require(TextWrappingPreferences.method(in: defaults) == .previous, "Explicit disabled preference was lost")
        let measurementsBefore = CoreTextWrappingCache.shared.statistics.measurements
        _ = TextWrapping.lines("Fallback must bypass cache", width: 100, height: 18, aspect: 1, font: fonts[0], method: TextWrappingPreferences.method(in: defaults))
        try require(CoreTextWrappingCache.shared.statistics.measurements == measurementsBefore, "Disabled Pretext still used the cache")
        defaults.set(true, forKey: TextWrappingPreferences.pretextEnabledKey)
        try require(TextWrappingPreferences.method(in: defaults) == .pretext, "Re-enabling Pretext failed")
        print("PASS: \(comparisons) native wrap comparisons; fractional thresholds, Unicode, bounded storage, concurrent calls and preference fallback")
        try checkTextWrappingSceneEquivalence()
    }

    static func checkTextWrappingSceneEquivalence() throws {
        let embedding: [String: Any] = ["model":"test","revision":1,"dimensions":0,"scalar":"float32-le","data":"","preprocessing":"test"]
        let statistics: [String: Any] = ["meanLuminance":0.5,"contrast":0.5,"saturation":0,"edgeDensity":0.1,"palette":[["hex":"#17191d","proportion":1]]]
        let image = "file:///private/tmp/posterlab-pretext-fixture.png"
        let anchors = [[0.04,0.06,0.82,0.16],[0.24,0.32,0.72,0.19],[0.04,0.65,0.87,0.22]]
        let elements: [[String: Any]] = anchors.enumerated().map { i,b in
            ["id":"anchor-\(i)","parentID":"fixture","kind":"text-line","bounds":["x":b[0],"y":b[1],"width":b[2],"height":b[3]],"rotation":0,"text":["SOURCE","WORD","STACK"][i],"confidence":1,"reviewStatus":"proposed","imageURL":image,"embedding":embedding,"statistics":statistics,"tags":[],"relatedIDs":[]]
        }
        let json: [String: Any] = ["id":"fixture","sourceID":"fixture","source":["sourceURL":image,"account":"fixture","postID":"fixture","caption":"","contentHash":"fixture"],"surfaceIndex":0,"sourceQuad":[[0,0],[1,0],[1,1],[0,1]],"surfaceConfidence":1,"reviewStatus":"proposed","warnings":[],"imageURL":image,"width":1000,"height":1414,"embedding":embedding,"textIndex":"SOURCE WORD STACK","statistics":statistics,"tags":[],"elements":elements,"genome":["version":"layout-genome-v1","posterID":"fixture","aspect":1.414,"background":"#f5f3e9","font":"HelveticaNeue-Bold","textScale":1,"tracking":0,"elements":[],"fittingStatus":"fixture","sourceEmbeddingModel":"test"]]
        let record = try JSONDecoder().decode(PosterRecord.self, from: JSONSerialization.data(withJSONObject: json))
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        for seed: UInt64 in [1,7,71] {
            let copy = PosterCopy()
            let previous = SourceLayoutDNA.make(record,record,category:"swiss",seed:seed,copy:copy,id:"cache-check",wrappingMethod:.previous)
            let cached = SourceLayoutDNA.make(record,record,category:"swiss",seed:seed,copy:copy,id:"cache-check",wrappingMethod:.pretext)
            let previousJSON = try encoder.encode(previous), cachedJSON = try encoder.encode(cached)
            try require(previousJSON == cachedJSON, "Pretext changed source geometry or genome")
            let before = try rgba(LibrarySceneRenderer.render(previous,width:320))
            let after = try rgba(LibrarySceneRenderer.render(cached,width:320))
            try require(before == after, "Pretext changed rendered poster pixels")
        }
        print("PASS: cached and previous source layouts produce identical genomes and pixels (3 seeds)")
    }
}
