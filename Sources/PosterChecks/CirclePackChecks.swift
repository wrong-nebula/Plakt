import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkCirclePack() throws {
        guard let recipe = PosterShapeLibrary.recipe("survey-circle-pack") else { throw PosterError.invalid("Circle packing recipe is missing") }
        let looks = recipe.looks ?? []
        try require(looks.count >= 30 && looks.first?.name == "Spektakuli", "Circle packing looks are missing or the source look is not first")
        func preset(_ values: [String: Double], inks: [String]? = nil, paper: String? = nil, edits: [CirclePackEdits.Item] = [], typed: Bool = false) -> PosterShapePreset {
            var p = PosterShapePreset(recipe: recipe, seed: 817, parameters: values)
            p.inks = inks; p.paper = paper
            if !edits.isEmpty { p.circlePack = CirclePackEdits(items: edits) }
            if typed { p.placement = TypePlacementSettings() }
            return p
        }
        func scene(_ values: [String: Double], inks: [String]? = nil, paper: String? = nil, edits: [CirclePackEdits.Item] = [], typed: Bool = false) throws -> StyleGenome {
            try PosterShapeLibrary.scene(preset(values, inks: inks, paper: paper, edits: edits, typed: typed), pairing: typed)
        }
        func render(_ s: StyleGenome) throws -> CGImage { try LibrarySceneRenderer.render(s, width: 220) }
        func rgb(_ hex: String) -> (Int, Int, Int) { let v = Int(hex.dropFirst(), radix: 16) ?? 0; return ((v >> 16) & 255, (v >> 8) & 255, v & 255) }
        func share(_ s: StyleGenome) throws -> Double {
            let bytes = try rgba(render(s)), p = rgb(s.background)
            var n = 0
            for i in stride(from: 0, to: bytes.count, by: 4) {
                let distance: Int = abs(Int(bytes[i]) - p.0) + abs(Int(bytes[i + 1]) - p.1) + abs(Int(bytes[i + 2]) - p.2)
                if distance > 60 { n += 1 }
            }
            return Double(n) / Double(bytes.count / 4)
        }
        func shapes(_ s: StyleGenome) -> (shapes: [CirclePackShape], w: Double, h: Double) {
            let e = s.elements.first { $0.shape == CirclePackGeometry.shape }!, size = CirclePackGeometry.fieldSize(e, aspect: s.aspect)
            return (CirclePackGeometry.shapes(e, aspect: s.aspect), size.width, size.height)
        }
        /// Circles overlapping each other or a placed shape, in units of the field's short side.
        func overlaps(_ s: StyleGenome, tolerance: Double = 0.004) -> Int {
            let (all, w, h) = shapes(s), circles = all.filter { $0.kind != .letter }
            var n = 0
            for i in circles.indices { for j in (i + 1)..<circles.count {
                let a = circles[i], b = circles[j]
                if hypot((a.x - b.x) * w, (a.y - b.y) * h) < a.r + b.r - tolerance { n += 1 }
            } }
            return n
        }

        // Every look renders a visible construction that does not swallow the page.
        for look in looks {
            _ = try recipe.values(look.parameters)
            let s = try scene(look.parameters, inks: look.inks, paper: look.paper)
            let ink = try share(s)
            try require(ink > 0.01 && ink < 0.97, "Circle packing look \(look.name) draws \(Int(ink * 100))% ink")
        }

        // The source packs a dozen circles that kiss without overlapping, inside the field, with wedges between them.
        let source = try scene([:])
        let sourceShapes = shapes(source), packed = sourceShapes.shapes, w = sourceShapes.w, h = sourceShapes.h
        try require(packed.count >= 10 && overlaps(source) == 0, "The source packing overlaps or is sparse (\(packed.count) circles)")
        try require(packed.allSatisfy { $0.x * w >= $0.r - 0.004 && (1 - $0.x) * w >= $0.r - 0.004 && $0.y * h >= $0.r - 0.004 && (1 - $0.y) * h >= $0.r - 0.004 }, "A circle leaves the field")
        var kisses = 0
        for i in packed.indices { for j in (i + 1)..<packed.count { let a = packed[i], b = packed[j]; if abs(hypot((a.x - b.x) * w, (a.y - b.y) * h) - a.r - b.r) < 0.01 { kisses += 1 } } }
        try require(kisses >= 8, "Source circles do not kiss (\(kisses) tangencies)")
        let withWedges = try rgba(render(source)), withoutWedges = try rgba(render(scene(["wedges": 0])))
        try require(withWedges != withoutWedges, "Wedges are not drawn")

        // Every layout packs without overlap and draws its own arrangement.
        var layouts = Set<[UInt8]>()
        for layout in 0...4 {
            let s = try scene(["layout": Double(layout), "count": 80, "minSize": 0.02, "falloff": 0.6])
            try require(overlaps(s) == 0 && shapes(s).shapes.count >= 5, "Layout \(layout) overlaps or is empty")
            layouts.insert(try rgba(render(s)))
        }
        try require(layouts.count == 5, "Two layouts draw the same packing")
        // A gasket fills its circle: tangent circles of falling size, many of them.
        let gasket = try scene(["layout": 1, "count": 400, "minSize": 0.004])
        try require(shapes(gasket).shapes.count >= 150, "The gasket does not recurse (\(shapes(gasket).shapes.count) circles)")

        // Letters: packed alone they fill the field from the title; mixed, the title comes first and circles follow.
        let lettersScene = try scene(["letters": 3, "count": 30, "minSize": 0.03]), lettersOnly = shapes(lettersScene).shapes
        try require(lettersOnly.count >= 9 && lettersOnly.allSatisfy { $0.kind == .letter }, "Letters only does not pack letters")
        var titled = try scene(["letters": 2, "count": 30, "minSize": 0.03])
        titled.posterCopy = PosterCopy(title: "OPEN AIR"); PosterShapeLibrary.resolveSurveyContent(in: &titled)
        let mixed = shapes(titled).shapes
        try require(mixed.prefix(7).map { $0.character ?? "" }.joined() == "OPENAIR" && mixed.dropFirst(7).contains { $0.kind == .circle }, "Packed letters do not take the title before the circles")
        try require(overlaps(titled) == 0, "Circles overlap after packing letters")

        // Editing: a placed circle stays where it was put and the packing makes room; a removed circle leaves a gap.
        let pinned = try scene([:], edits: [CirclePackEdits.Item(kind: .circle, x: 0.5, y: 0.5, r: 0.2)])
        let pin = shapes(pinned).shapes.first { $0.pin == 0 }
        try require(pin.map { abs($0.x - 0.5) < 1e-9 && abs($0.r - 0.2) < 1e-9 } == true && overlaps(pinned) == 0, "A placed circle moved or overlaps the packing")
        let largest = packed.max { $0.r < $1.r }!
        let removed = try scene([:], edits: [CirclePackEdits.Item(kind: .void, x: largest.x, y: largest.y, r: largest.r)])
        let after = shapes(removed)
        try require(!after.shapes.contains { $0.kind == .circle && hypot(($0.x - largest.x) * after.w, ($0.y - largest.y) * after.h) < $0.r + largest.r - 0.004 }, "A removed circle's space was refilled")
        let removedPixels = try rgba(render(removed)), sourcePixels = try rgba(render(source))
        try require(removedPixels != sourcePixels, "Removing a circle did not change the drawing")
        let letteredScene = try scene([:], edits: [CirclePackEdits.Item(kind: .letter, x: 0.3, y: 0.7, r: 0.18, character: "K", turn: 20)])
        let lettered = shapes(letteredScene).shapes
        try require(lettered.contains { $0.pin == 0 && $0.kind == .letter && $0.character == "K" }, "A placed letter is missing")
        // Fixed layouts keep their geometry; placed shapes take the circles they cover.
        let editedLattice = try scene(["layout": 4, "count": 120, "falloff": 0.5], edits: [CirclePackEdits.Item(kind: .circle, x: 0.5, y: 0.4, r: 0.25)])
        try require(overlaps(editedLattice) == 0, "A placed circle overlaps a lattice")
        let twoCharacters = try? scene([:], edits: [CirclePackEdits.Item(kind: .letter, x: 0.5, y: 0.5, r: 0.2, character: "AB")])
        try require(twoCharacters == nil, "A letter with two characters was accepted")

        // Holes: the largest circle's centre shows the paper, not the field.
        let punched = try scene(["holes": 1], inks: ["#d8362e", "#d8362e", "#e9e8e3"], paper: "#e9e8e3")
        let image = try render(punched), bytes = try rgba(image), e = punched.elements[0]
        let big = shapes(punched).shapes.max { $0.r < $1.r }!
        let px = Int((e.bounds.x + big.x * e.bounds.width) * Double(image.width)), py = Int((e.bounds.y + big.y * e.bounds.height) * Double(image.height)), o = (py * image.width + px) * 4
        try require(bytes[o] > 200 && bytes[o + 1] > 200, "Holes do not punch the field")

        // Type sits in the largest circles; packed letters carry the title themselves.
        let typed = try scene([:], typed: true)
        try require((typed.typeAnchors ?? []).contains { $0.id.hasSuffix("pack-0") && $0.role == "title" && $0.onShape }, "No title anchor in the largest circle")
        let typedLetters = try scene(["letters": 3], typed: true)
        try require(!(typedLetters.typeAnchors ?? []).contains { $0.id.contains("pack-") }, "Packed letters still offer circle anchors")

        // Saved presets and scenes, edits included, replay exactly.
        let edited = preset(looks[1].parameters, inks: looks[1].inks, edits: [CirclePackEdits.Item(kind: .circle, x: 0.2, y: 0.3, r: 0.1), CirclePackEdits.Item(kind: .void, x: 0.7, y: 0.7, r: 0.15)])
        let reloaded = try JSONDecoder().decode(PosterShapePreset.self, from: JSONEncoder().encode(edited))
        let a = try rgba(render(PosterShapeLibrary.scene(edited))), b = try rgba(render(PosterShapeLibrary.scene(reloaded)))
        let saved = try scene(looks[2].parameters, inks: looks[2].inks, typed: true), replay = try JSONDecoder().decode(StyleGenome.self, from: JSONEncoder().encode(saved))
        let c = try rgba(render(replay)), d = try rgba(render(saved))
        try require(a == b && c == d, "Circle packing replay changed")
        print("PASS: circle packing (\(looks.count) looks, kissing source packing in the field, wedges, 5 layouts without overlap, recursive gasket, letters only and title letters before circles, placed circles and letters, removed space kept empty, lattice edits, holes, circle type anchors, replay with edits)")
    }
}
