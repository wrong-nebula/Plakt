import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkSawtoothSpring() throws {
        guard let recipe = PosterShapeLibrary.recipe("survey-sawtooth-spring") else { throw PosterError.invalid("Sawtooth and spring recipe is missing") }
        let looks = recipe.looks ?? []
        try require(looks.count >= 25 && looks.first?.name == "Compressed spring", "Sawtooth looks are missing or the source look is not first")
        func scene(_ values: [String: Double], inks: [String]? = nil, paper: String? = nil, typed: Bool = false) throws -> StyleGenome {
            var p = PosterShapePreset(recipe: recipe, seed: 817, parameters: values)
            p.inks = inks; p.paper = paper
            if typed { p.placement = TypePlacementSettings() }
            return try PosterShapeLibrary.scene(p, pairing: typed)
        }
        func rgb(_ hex: String) -> (Int, Int, Int) { let v = Int(hex.dropFirst(), radix: 16) ?? 0; return ((v >> 16) & 255, (v >> 8) & 255, v & 255) }
        /// Ink share of the image, and how much of that ink lies in its lower and its right half.
        func ink(_ image: CGImage, paper: String) throws -> (share: Double, low: Double, right: Double) {
            let bytes = try rgba(image), w = image.width, h = image.height, p = rgb(paper)
            var n = 0, low = 0, right = 0
            for i in stride(from: 0, to: bytes.count, by: 4) {
                guard abs(Int(bytes[i]) - p.0) + abs(Int(bytes[i + 1]) - p.1) + abs(Int(bytes[i + 2]) - p.2) > 60 else { continue }
                n += 1; if (i / 4) / w > h / 2 { low += 1 }; if (i / 4) % w > w / 2 { right += 1 }
            }
            return (Double(n) / Double(bytes.count / 4), n > 0 ? Double(low) / Double(n) : 0, n > 0 ? Double(right) / Double(n) : 0)
        }
        func render(_ s: StyleGenome) throws -> CGImage { try LibrarySceneRenderer.render(s, width: 220) }

        // Every look renders a visible construction that does not swallow the page.
        for look in looks {
            _ = try recipe.values(look.parameters)
            let s = try scene(look.parameters, inks: look.inks, paper: look.paper)
            let share = try ink(render(s), paper: s.background).share
            try require(share > 0.01 && share < 0.97, "Sawtooth look \(look.name) draws \(Int(share * 100))% ink")
        }

        // Compression packs the turns, and so the ink, toward the end of the run; negative compression toward its start.
        let plain: [String: Double] = ["teeth": 14, "amplitude": 0.9, "weight": 0.03]
        let toEnd = try ink(render(scene(plain.merging(["compression": 1]) { $1 })), paper: "#eeeae1")
        let toStart = try ink(render(scene(plain.merging(["compression": -1]) { $1 })), paper: "#eeeae1")
        try require(toEnd.low > 0.56 && toStart.low < 0.44, "Compression does not pack the spring toward the chosen end")
        // The run direction turns the construction: a run to the right packs its turns on the right.
        let sideways = try ink(render(scene(plain.merging(["compression": 1, "angle": 90]) { $1 })), paper: "#eeeae1")
        try require(sideways.right > 0.56, "A rightward run does not end on the right")

        // Stripes tile the field exactly at full depth: no paper shows inside it. The specimen field is 86% × 86% of the page.
        let tiled = try scene(["layout": 1, "copies": 6, "fill": 1, "inkMode": 1, "compression": 0], inks: ["#e0402a", "#1b1b1b"])
        let tiledShare = try ink(render(tiled), paper: tiled.background).share
        try require(tiledShare > 0.86 * 0.86 * 0.97, "Full-depth stripes leave paper inside the field")
        let gapped = try scene(["layout": 1, "copies": 6, "fill": 0.4, "inkMode": 1, "compression": 0], inks: ["#e0402a", "#1b1b1b"])
        let gappedShare = try ink(render(gapped), paper: gapped.background).share
        try require(gappedShare < 0.86 * 0.86 * 0.6, "Shallow stripes do not leave paper between them")

        // Folded faces alternate two tones of one ink; without fold the band is one flat tone.
        func tones(_ s: StyleGenome) throws -> Int {
            let bytes = try rgba(render(s)), p = rgb(s.background)
            var seen = Set<Int>()
            for i in stride(from: 0, to: bytes.count, by: 4) {
                let r = Int(bytes[i]), g = Int(bytes[i + 1]), b = Int(bytes[i + 2])
                let distance: Int = abs(r - p.0) + abs(g - p.1) + abs(b - p.2)
                if distance > 120 { seen.insert((r / 24) * 1000 + g / 24) }
            }
            return seen.count
        }
        let flat = try tones(scene(["weight": 0.12, "teeth": 6], inks: ["#ff6a00"])), folded = try tones(scene(["weight": 0.12, "teeth": 6, "fold": 1], inks: ["#ff6a00"]))
        try require(folded > flat, "Folded faces did not add a second tone")

        // Type: stripes and fins offer a title band across the field; the band copy needs the title.
        let striped = try scene(["layout": 1, "copies": 8], typed: true)
        try require((striped.typeAnchors ?? []).contains { $0.id.hasSuffix("saw-band") && $0.onShape }, "Stripes offer no title band")
        var copy = try scene(["bandCopy": 1, "weight": 0.08])
        let specimen = try rgba(render(copy))
        copy.posterCopy = PosterCopy(title: "NEW WORDS"); PosterShapeLibrary.resolveSurveyContent(in: &copy)
        try require(copy.elements[0].text == "NEW WORDS", "Band copy did not take the brief's title")
        let titled = try rgba(render(copy))
        try require(titled != specimen, "Band copy did not draw the title")

        // Every wave draws its own shape: pulse, stairs, bounce and noise differ from the zigzag and from each other.
        var waves = Set<[UInt8]>()
        for wave in 0...8 { waves.insert(try rgba(render(scene(["wave": Double(wave), "teeth": 6, "compression": 0])))) }
        try require(waves.count == 9, "Two waves draw the same shape")

        // A solid ring sits centred: its ink balances left/right and top/bottom.
        let blade = try ink(render(scene(["layout": 3, "teeth": 18, "fill": 1, "compression": 0])), paper: "#eeeae1")
        try require(abs(blade.low - 0.5) < 0.05 && abs(blade.right - 0.5) < 0.05 && blade.share > 0.15, "The ring is not a centred blade")
        // Controls shared by several layouts are active exactly where they apply.
        let radius = recipe.parameters.first { $0.id == "radius" }!, skew = recipe.parameters.first { $0.id == "skew" }!
        try require(!radius.isActive(in: ["layout": 0]) && radius.isActive(in: ["layout": 3]) && radius.isActive(in: ["layout": 4]), "Ring size is active outside rings and spirals")
        try require(skew.isActive(in: ["wave": 0]) && !skew.isActive(in: ["wave": 1]), "Zigzag lean is active for other waves")

        // Effects: extrusion adds depth ink, the second printing adds its own ink, glitch is seeded and visible.
        let base = try ink(render(scene(["weight": 0.05])), paper: "#eeeae1").share
        let extruded = try ink(render(scene(["weight": 0.05, "extrude": 1])), paper: "#eeeae1").share
        try require(extruded > base * 1.25, "Extrusion adds no depth")
        func pink(_ s: StyleGenome) throws -> Int {
            let bytes = try rgba(render(s)); var n = 0
            for i in stride(from: 0, to: bytes.count, by: 4) where bytes[i] > 200 && bytes[i + 1] < 140 && bytes[i + 2] > 120 { n += 1 }
            return n
        }
        let plainPink = try pink(scene(["weight": 0.05], inks: ["#111111", "#ff2bd6"])), misprinted = try pink(scene(["weight": 0.05, "misregister": 1], inks: ["#111111", "#ff2bd6"]))
        try require(plainPink == 0 && misprinted > 200, "The second ink is not printed out of register")
        let calm = try rgba(render(scene(["weight": 0.05]))), glitchA = try rgba(render(scene(["weight": 0.05, "glitch": 1]))), glitchB = try rgba(render(scene(["weight": 0.05, "glitch": 1])))
        try require(glitchA != calm && glitchA == glitchB, "Glitch slices are invisible or not repeatable")

        // Saved scenes replay exactly.
        let typed = try scene(looks[2].parameters, inks: looks[2].inks, typed: true)
        let replay = try JSONDecoder().decode(StyleGenome.self, from: JSONEncoder().encode(typed))
        let a = try rgba(render(replay)), b = try rgba(render(typed))
        try require(a == b, "Sawtooth scene replay changed")
        print("PASS: sawtooth and spring (\(looks.count) looks, 9 distinct waves, compression ends, run direction, exact stripe tiling, centred ring, multi-mode controls, extrusion, misregistration, seeded glitch, folded faces, title band and band copy, replay)")
    }
}
