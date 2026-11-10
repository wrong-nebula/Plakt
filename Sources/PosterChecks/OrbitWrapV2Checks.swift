import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    /// Orbit wrap v2: new paths, bands, subjects and finishing keys, and the v1 fallback when they are absent.
    static func checkOrbitWrapV2(_ recipe: PosterShapeRecipe, scene: ([String: Double]) throws -> StyleGenome,
                                 ink: (CGImage, String) throws -> (share: Double, y: Double, luma: Double)) throws {
        let v2Defaults: [String: Double] = ["knotLobes": 3, "crownWaves": 5, "wave": 0.5, "rungs": 0, "dashDuty": 0.5, "bend": 0, "taper": 0,
                                            "jitter": 0, "spacing": 0, "echo": 0, "shadow": 0, "depthBlur": 0, "backCopy": 0]
        try require(v2Defaults.keys.allSatisfy { key in recipe.parameters.contains { $0.id == key && $0.value == v2Defaults[key] } }, "Orbit wrap v2 controls are missing or not neutral by default")
        let looks = recipe.looks ?? []

        // v1 looks: genomes saved without the v2 keys draw exactly as with them at their neutral defaults.
        for look in looks.prefix(11) {
            var saved = try scene(look.parameters.merging(v2Defaults) { $1 })
            let current = try rgba(LibrarySceneRenderer.render(saved, width: 200))
            saved.elements[0].geometry = saved.elements[0].geometry?.filter { v2Defaults[$0.key] == nil }
            let legacy = try rgba(LibrarySceneRenderer.render(saved, width: 200))
            try require(current == legacy, "\(look.name): a v1 genome no longer draws as before")
        }

        // Every path, band and subject draws something of its own.
        func distinct(_ key: String, _ range: ClosedRange<Int>, base: [String: Double]) throws {
            var seen = Set<Data>()
            for v in range {
                let s = try scene(base.merging([key: Double(v)]) { $1 })
                let image = try LibrarySceneRenderer.render(s, width: 200)
                let share = try ink(image, s.background).share, bytes = Data(try rgba(image))
                try require(share > 0.003, "Orbit \(key) \(v) draws nothing")
                try require(seen.insert(bytes).inserted, "Orbit \(key) \(v) draws the same as another \(key)")
            }
        }
        try distinct("path", 0...9, base: [:])
        try distinct("bandStyle", 0...9, base: ["subject": 0])
        try distinct("subject", 0...7, base: [:])

        // Each layer keeps to its pass: copy shows through only on the far arcs; shadow, echo and blur stay below.
        let tape: [String: Double] = ["path": 0, "turns": 3, "bandStyle": 1, "band": 0.09, "tilt": 0.3, "subject": 0, "bandCopy": 1]
        for (key, value, base) in [("backCopy", 1.0, tape), ("shadow", 1.0, [String: Double]()), ("echo", 3.0, [:]), ("depthBlur", 1.0, [:])] {
            let plain = try scene(base), changed = try scene(base.merging([key: value]) { $1 })
            let farPlain = try rgba(OrbitWrapGeometry.render(plain, onlyLayer: 0, width: 200)), farChanged = try rgba(OrbitWrapGeometry.render(changed, onlyLayer: 0, width: 200))
            let nearPlain = try rgba(OrbitWrapGeometry.render(plain, onlyLayer: 1, width: 200)), nearChanged = try rgba(OrbitWrapGeometry.render(changed, onlyLayer: 1, width: 200))
            try require(farPlain != farChanged, "Orbit \(key) did not change the far pass")
            try require(nearPlain == nearChanged, "Orbit \(key) leaked into the near pass")
        }

        // Ladder rungs reach into both passes; a bent axis carries the strand sideways.
        let ladder: [String: Double] = ["path": 3, "turns": 3, "subject": 0, "lean": 0]
        for layer in [0, 1] {
            let plain = try rgba(OrbitWrapGeometry.render(try scene(ladder), onlyLayer: layer, width: 200))
            let rungs = try rgba(OrbitWrapGeometry.render(try scene(ladder.merging(["rungs": 8]) { $1 }), onlyLayer: layer, width: 200))
            try require(plain != rungs, "Ladder rungs missing from pass \(layer)")
        }
        func centroidX(_ s: StyleGenome) throws -> Double {
            let image = try LibrarySceneRenderer.render(s, width: 200), bytes = try rgba(image), w = image.width
            let paper = Int(s.background.dropFirst(), radix: 16) ?? 0
            var n = 0.0, sx = 0.0
            for i in stride(from: 0, to: bytes.count, by: 4) {
                let d = abs(Int(bytes[i]) - (paper >> 16 & 255)) + abs(Int(bytes[i + 1]) - (paper >> 8 & 255)) + abs(Int(bytes[i + 2]) - (paper & 255))
                if d > 60 { n += 1; sx += Double((i / 4) % w) }
            }
            return n > 0 ? sx / n / Double(w) : 0.5
        }
        let straight: [String: Double] = ["subject": 0, "lean": 0, "radius": 0.3]
        let bentX = try centroidX(scene(straight.merging(["bend": 0.8]) { $1 })), straightX = try centroidX(scene(straight))
        try require(bentX > straightX + 0.02, "A positive bend did not carry the strand to the right")

        // A self-crossing knot has near and far arcs.
        let knot = try scene(["path": 6, "subject": 0])
        let knotFar = try ink(OrbitWrapGeometry.render(knot, onlyLayer: 0, width: 200), knot.background).share
        let knotNear = try ink(OrbitWrapGeometry.render(knot, onlyLayer: 1, width: 200), knot.background).share
        try require(knotFar > 0.003 && knotNear > 0.003, "The torus knot lost a pass")
        print("PASS: orbit wrap v2 (\(looks.count) looks, v1 fallback, 10 paths, 10 bands, 8 subjects, pass isolation, rungs, bend)")
    }
}
