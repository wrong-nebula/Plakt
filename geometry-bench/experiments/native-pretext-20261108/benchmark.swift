import AppKit
import CoreText
import Foundation

@main struct NativeWrappingBenchmark {
    struct Fixture: Decodable {
        let id: String, text: String, fontName: String, calibration: String
        let fontSize: Double, width: Double, widths: [Double]
    }
    static func now() -> Double { Double(DispatchTime.now().uptimeNanoseconds) / 1e6 }
    static func median(_ values: [Double]) -> Double { values.sorted()[values.count / 2] }
    static func measure(_ methods: [(String, () -> Int)]) -> [String: Any] {
        var checksum = 0, iterations: [String: Int] = [:], samples: [String: [Double]] = [:]
        for (name, fn) in methods {
            var repeats = 1, elapsed = 0.0
            repeat {
                let start = now()
                for _ in 0..<repeats { checksum &+= fn() }
                elapsed = now() - start
                if elapsed < 5 { repeats *= 2 }
            } while elapsed < 5 && repeats < 2_048
            let measuredRepeats = elapsed < 5 ? repeats / 2 : repeats
            iterations[name] = min(10_000, max(1, Int(15 / max(0.00001, elapsed / Double(measuredRepeats)))))
            samples[name] = []
        }
        // Rotate order to spread interference from the two other active sessions.
        for trial in 0..<21 {
            for i in methods.indices {
                let (name, fn) = methods[(i + trial) % methods.count]
                let count = iterations[name] ?? 1
                let start = now()
                for _ in 0..<count { autoreleasepool { checksum &+= fn() } }
                samples[name, default: []].append((now() - start) / Double(count))
            }
        }
        var output: [String: Any] = ["checksum": checksum]
        for (name, _) in methods {
            let values = samples[name] ?? [], sorted = values.sorted()
            output[name] = ["medianMs":median(values), "samplesMs":values, "iterations":iterations[name] ?? 1,
                            "p10Ms":sorted[2], "p90Ms":sorted[18]]
        }
        return output
    }

    static func main() throws {
        let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        var output: [String: Any] = [:]
        for f in fixtures {
            let face = CTFontCreateWithName(f.fontName as CFString, f.fontSize, nil)
            let line = CTLineCreateWithAttributedString(NSAttributedString(string:f.calibration,attributes:[.font:face]))
            let inkHeight = CTLineGetBoundsWithOptions(line,[.useGlyphPathBounds]).height
            let measured = CoreTextWrappingCache(layoutLimit:1), completed = CoreTextWrappingCache()
            var exactMatches = 0, lines: [[String: Any]] = []
            for width in f.widths {
                let previous = PreviousTextWrapping.lines(f.text,width:width,height:inkHeight,aspect:1,font:f.fontName)
                let cached = completed.lines(f.text,width:width,height:inkHeight,aspect:1,font:f.fontName)
                if cached == previous { exactMatches += 1 }
                lines.append(["width":width,"lines":cached])
                _ = measured.lines(f.text,width:width,height:inkHeight,aspect:1,font:f.fontName)
            }
            guard exactMatches == f.widths.count else { throw NSError(domain:"NativeWrapping",code:1,userInfo:[NSLocalizedDescriptionKey:"Native wrapping mismatch for \(f.id)"]) }
            let measurementsBefore = measured.statistics.measurements
            let methods: [(String, () -> Int)] = [
                ("previousSweep", { f.widths.reduce(0) { $0 + PreviousTextWrapping.lines(f.text,width:$1,height:inkHeight,aspect:1,font:f.fontName).count } }),
                ("coldSweep", {
                    let cache = CoreTextWrappingCache()
                    return f.widths.reduce(0) { $0 + cache.lines(f.text,width:$1,height:inkHeight,aspect:1,font:f.fontName).count }
                }),
                ("measurementWarmSweep", { f.widths.reduce(0) { $0 + measured.lines(f.text,width:$1,height:inkHeight,aspect:1,font:f.fontName).count } }),
                ("layoutWarmSweep", { f.widths.reduce(0) { $0 + completed.lines(f.text,width:$1,height:inkHeight,aspect:1,font:f.fontName).count } }),
                ("previousSingle", { PreviousTextWrapping.lines(f.text,width:f.width,height:inkHeight,aspect:1,font:f.fontName).count }),
                ("coldSingle", { CoreTextWrappingCache().lines(f.text,width:f.width,height:inkHeight,aspect:1,font:f.fontName).count })
            ]
            let timing = measure(methods)
            output[f.id] = ["timings":timing,"exactMatches":exactMatches,"widths":lines,"inkHeight":inkHeight,
                            "warmMeasurementCallsBefore":measurementsBefore,"warmMeasurementCallsAfter":measured.statistics.measurements,
                            "warmMeasurementLayoutHits":measured.statistics.layoutHits,
                            "completedLayoutHits":completed.statistics.layoutHits,
                            "estimatedMeasurementBytes":completed.statistics.estimatedMeasurementBytes]
        }
        let data = try JSONSerialization.data(withJSONObject:output,options:[.prettyPrinted,.sortedKeys])
        FileHandle.standardOutput.write(data)
    }
}
