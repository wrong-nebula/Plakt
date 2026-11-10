import AppKit
import CoreText
import Foundation

/// Native implementation of Pretext's reuse strategy, with the existing wrap rules.
/// Measurements are exact Core Text ink bounds, not additive character estimates:
/// kerning, ligatures, fallback fonts and each candidate line's ink height matter.
public final class CoreTextWrappingCache: @unchecked Sendable {
    public static let shared = CoreTextWrappingCache()

    public struct Statistics: Sendable {
        public var paragraphs: Int = 0
        public var measurements: Int = 0
        public var measurementHits: Int = 0
        public var layoutHits: Int = 0
        public var layouts: Int = 0
        public var estimatedMeasurementBytes: Int = 0
    }

    private struct Key: Hashable {
        let text: String
        let font: String
    }

    private let lock = NSLock()
    private var paragraphs: [Key: Paragraph] = [:]
    private var insertionOrder: [Key] = []
    private let paragraphLimit: Int
    private let measurementBudget: Int
    private let layoutLimit: Int

    public init(paragraphLimit: Int = 32, measurementBudget: Int = 262_144, layoutLimit: Int = 32) {
        self.paragraphLimit = max(1, paragraphLimit)
        self.measurementBudget = max(0, measurementBudget)
        self.layoutLimit = max(1, layoutLimit)
    }

    public func lines(_ text: String, width: Double, height: Double, aspect: Double, font: String) -> [String] {
        // Avoid retaining oversized user copy, invalid floating-point keys, or unusual
        // degenerate dimensions. The previous method defines their existing behavior.
        guard width.isFinite, height.isFinite, aspect.isFinite,
              width > 0, height > 0, aspect > 0, text.utf16.count <= 8_192 else {
            return PreviousTextWrapping.lines(text, width: width, height: height, aspect: aspect, font: font)
        }
        let key = Key(text: text, font: font)
        let paragraph = lock.withLock {
            if let known = paragraphs[key] { return known }
            if paragraphs.count >= paragraphLimit {
                paragraphs.removeValue(forKey: insertionOrder.removeFirst())
            }
            let new = Paragraph(text: text, font: font, measurementBudget: measurementBudget, layoutLimit: layoutLimit)
            paragraphs[key] = new
            insertionOrder.append(key)
            return new
        }
        // Different paragraphs can shape concurrently. A paragraph owns its lock,
        // immutable font/tokens, measurement dictionary and completed layouts.
        return paragraph.lines(width: width, height: height, aspect: aspect)
    }

    /// Call after changing registered fonts. Existing active requests finish safely.
    public func removeAll() {
        lock.withLock {
            paragraphs.removeAll()
            insertionOrder.removeAll()
        }
    }

    /// Counters describe resident entries, and reset when those entries are evicted.
    public var statistics: Statistics {
        let resident = lock.withLock { Array(paragraphs.values) }
        var total = Statistics()
        total.paragraphs = resident.count
        for paragraph in resident {
            let s = paragraph.statistics
            total.measurements += s.measurements
            total.measurementHits += s.measurementHits
            total.layoutHits += s.layoutHits
            total.layouts += s.layouts
            total.estimatedMeasurementBytes += s.estimatedMeasurementBytes
        }
        return total
    }

    // Every mutable member is protected by this instance's lock. Core Text fonts
    // are immutable; this object never exposes its font or mutable storage.
    private final class Paragraph: @unchecked Sendable {
        private struct Dimensions: Hashable {
            let width: Double
            let height: Double
            let aspect: Double
        }
        private struct Word {
            let text: String
            let characters: [Character]
        }
        private struct Measurement {
            let ratio: Double
            let emptyHeight: Bool
        }

        private let lock = NSLock()
        private let face: CTFont
        private let words: [Word]
        private let measurementBudget: Int
        private let layoutLimit: Int
        private var measured: [String: Measurement] = [:]
        private var completed: [Dimensions: [String]] = [:]
        private var layoutOrder: [Dimensions] = []
        private var counters = Statistics()

        init(text: String, font: String, measurementBudget: Int, layoutLimit: Int) {
            face = CTFontCreateWithName(font as CFString, 100, nil)
            words = text.split(whereSeparator: { $0.isWhitespace }).map {
                Word(text: String($0), characters: Array($0))
            }
            self.measurementBudget = measurementBudget
            self.layoutLimit = layoutLimit
        }

        var statistics: Statistics { lock.withLock { counters } }

        func lines(width: Double, height: Double, aspect: Double) -> [String] {
            lock.withLock {
                let dimensions = Dimensions(width: width, height: height, aspect: aspect)
                if let known = completed[dimensions] {
                    counters.layoutHits += 1
                    return known
                }
                func fits(_ text: String) -> Bool {
                    let m: Measurement
                    if let known = measured[text] {
                        counters.measurementHits += 1
                        m = known
                    } else {
                        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.font: face]))
                        let bounds = CTLineGetBoundsWithOptions(line, [.useGlyphPathBounds])
                        m = Measurement(ratio: bounds.height <= 0 ? 0 : bounds.width / bounds.height, emptyHeight: bounds.height <= 0)
                        counters.measurements += 1
                        let cost = text.utf16.count * 2 + 64
                        if cost <= measurementBudget {
                            if counters.estimatedMeasurementBytes + cost > measurementBudget {
                                measured.removeAll(keepingCapacity: true)
                                counters.estimatedMeasurementBytes = 0
                            }
                            measured[text] = m
                            counters.estimatedMeasurementBytes += cost
                        }
                    }
                    // Preserve the original operation order at exact wrap thresholds.
                    return m.emptyHeight || m.ratio * height * aspect <= width
                }
                var result: [String] = [], current = ""
                for word in words {
                    let next = current.isEmpty ? word.text : current + " " + word.text
                    if fits(next) { current = next }
                    else {
                        if !current.isEmpty { result.append(current); current = "" }
                        for character in word.characters {
                            if !fits(current + String(character)), !current.isEmpty {
                                result.append(current); current = ""
                            }
                            current.append(character)
                        }
                    }
                }
                if !current.isEmpty { result.append(current) }
                if completed.count >= layoutLimit {
                    completed.removeValue(forKey: layoutOrder.removeFirst())
                }
                completed[dimensions] = result
                layoutOrder.append(dimensions)
                counters.layouts = completed.count
                return result
            }
        }
    }
}
