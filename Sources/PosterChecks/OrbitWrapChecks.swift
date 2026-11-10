import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkOrbitWrap() throws {
        guard let recipe = PosterShapeLibrary.recipe("survey-orbit-wrap") else { throw PosterError.invalid("Orbit wrap recipe is missing") }
        let looks = recipe.looks ?? []
        try require(looks.count >= 25 && looks.first?.name == "Coil round a figure", "Orbit wrap looks are missing or the source look is not first")
        func scene(_ values: [String: Double], inks: [String]? = nil, paper: String? = nil, typed: Bool = false) throws -> StyleGenome {
            var p = PosterShapePreset(recipe: recipe, seed: 817, parameters: values)
            p.inks = inks; p.paper = paper
            if typed { p.placement = TypePlacementSettings() }
            return try PosterShapeLibrary.scene(p, pairing: typed)
        }
        func rgb(_ hex: String) -> (Int, Int, Int) { let v = Int(hex.dropFirst(), radix: 16) ?? 0; return ((v >> 16) & 255, (v >> 8) & 255, v & 255) }
        /// Pixels that differ from the paper: their share, mean height (0 top) and mean luminance.
        func ink(_ image: CGImage, paper: String) throws -> (share: Double, y: Double, luma: Double) {
            let bytes = try rgba(image), w = image.width, p = rgb(paper)
            var n = 0, sy = 0.0, sl = 0.0
            for i in stride(from: 0, to: bytes.count, by: 4) {
                let r = Int(bytes[i]), g = Int(bytes[i + 1]), b = Int(bytes[i + 2])
                guard abs(r - p.0) + abs(g - p.1) + abs(b - p.2) > 60 else { continue }
                n += 1; sy += Double((i / 4) / w); sl += 0.2126 * Double(r) + 0.7152 * Double(g) + 0.0722 * Double(b)
            }
            return (Double(n) / Double(bytes.count / 4), n > 0 ? sy / Double(n) / Double(image.height) : 0, n > 0 ? sl / Double(n) : 0)
        }

        // Every look is a valid parameter set and draws a visible, not overwhelming, construction.
        for look in looks {
            _ = try recipe.values(look.parameters)
            let s = try scene(look.parameters, inks: look.inks, paper: look.paper)
            let share = try ink(LibrarySceneRenderer.render(s, width: 200), paper: s.background).share
            try require(share > 0.002 && share < 0.85, "Orbit look \(look.name) draws \(Int(share * 100))% ink")
        }

        // The near half of a ring is lower on the page when the camera is raised, higher when it looks up.
        let ring: [String: Double] = ["path": 0, "turns": 1, "subject": 0, "lean": 0, "radius": 0.4, "band": 0.04]
        for camera in [0.4, -0.4] {
            let s = try scene(ring.merging(["tilt": camera]) { $1 })
            let far = try ink(OrbitWrapGeometry.render(s, onlyLayer: 0, width: 240), paper: s.background)
            let near = try ink(OrbitWrapGeometry.render(s, onlyLayer: 1, width: 240), paper: s.background)
            try require(far.share > 0.005 && near.share > 0.005, "An orbit pass draws nothing")
            try require(camera > 0 ? near.y > far.y + 0.03 : near.y < far.y - 0.03, "Near arcs are on the wrong side for camera \(camera)")
        }

        // Copy on the band lives only on the near arcs, even when the ring's seam falls on its silhouette.
        for spin in [0.0, 0.25, 0.5] {
            let plain = try scene(ring.merging(["tilt": 0.35, "spin": spin, "band": 0.06]) { $1 })
            let printed = try scene(ring.merging(["tilt": 0.35, "spin": spin, "band": 0.06, "bandCopy": 1]) { $1 })
            let farPlain = try rgba(OrbitWrapGeometry.render(plain, onlyLayer: 0, width: 240)), farPrinted = try rgba(OrbitWrapGeometry.render(printed, onlyLayer: 0, width: 240))
            let nearPlain = try rgba(OrbitWrapGeometry.render(plain, onlyLayer: 1, width: 240)), nearPrinted = try rgba(OrbitWrapGeometry.render(printed, onlyLayer: 1, width: 240))
            try require(farPlain == farPrinted, "Band copy reached the far arcs (spin \(spin))")
            try require(nearPlain != nearPrinted, "Band copy did not print on the near arcs (spin \(spin))")
        }

        // A tape shows its darker inside on the far arcs.
        let tape = try scene(ring.merging(["tilt": 0.4, "bandStyle": 1, "band": 0.08, "inkMode": 0]) { $1 }, inks: ["#e04030"])
        let outside = try ink(OrbitWrapGeometry.render(tape, onlyLayer: 1, width: 240), paper: tape.background)
        let inside = try ink(OrbitWrapGeometry.render(tape, onlyLayer: 0, width: 240), paper: tape.background)
        try require(inside.luma < outside.luma - 20, "The tape's inside is not darker than its outside")

        // Type: the title takes the core between the passes; the near pass sits right above it, other type above that.
        let typed = try scene([:], typed: true)
        let anchors = typed.typeAnchors ?? []
        try require(anchors.contains { $0.id.hasSuffix("orbit-core") && $0.onShape }, "Orbit wrap offers no core anchor for the title")
        let title = typed.elements.filter { $0.kind == "text" }.max { $0.bounds.area < $1.bounds.area }!
        try require(title.typeAnchorID?.hasSuffix("orbit-core") == true, "The title did not take the orbit core")
        let drawn = OrbitWrapGeometry.passes(typed)
        try require(drawn.count == typed.elements.count + 1, "The orbit did not gain exactly one near pass")
        let near = drawn.last!, titleZ = title.zIndex ?? 100
        try require(near.shape == OrbitWrapGeometry.shape && near.zIndex == titleZ, "The near pass is not level with the title")
        try require(drawn.filter { $0.kind == "text" && $0.sourceElementID != title.sourceElementID }.allSatisfy { ($0.zIndex ?? 100) > titleZ }, "Information type is not above the near arcs")
        try require(typed.elements.allSatisfy { $0.geometry?["orbitLayer"] == nil && $0.geometry?["orbitPaper"] == nil }, "Draw-time orbit keys were saved in the scene")
        let replay = try JSONDecoder().decode(StyleGenome.self, from: JSONEncoder().encode(typed))
        let replayed = try rgba(LibrarySceneRenderer.render(replay, width: 240)), original = try rgba(LibrarySceneRenderer.render(typed, width: 240))
        try require(replayed == original, "Orbit scene replay changed")
        let banded = try scene(["bandCopy": 1], typed: true)
        try require(!(banded.typeAnchors ?? []).contains { $0.id.hasSuffix("orbit-core") }, "With copy on the band, the core still takes the title")
        if let halo = recipe.look("Halo") {
            let s = try scene(halo.parameters, typed: true)
            let core = (s.typeAnchors ?? []).first { $0.id.hasSuffix("orbit-core") }
            try require(core.map { $0.y > 0.4 } == true, "The halo's title is not below the ring")
        }

        // A system placed in front of the type keeps its near arcs above its own subject.
        var raised = typed
        for i in raised.elements.indices where raised.elements[i].shape == OrbitWrapGeometry.shape { raised.elements[i].zIndex = 500 }
        try require(OrbitWrapGeometry.passes(raised).last?.zIndex == 500, "A front-placed orbit drew its near arcs below its subject")

        // Scenes without an orbit draw exactly as before.
        let other = try PosterShapeLibrary.scene(PosterShapePreset(recipe: PosterShapeLibrary.recipe("survey-sliced-orb")!, seed: 817), pairing: true)
        let otherDrawn = OrbitWrapGeometry.passes(other)
        try require(otherDrawn.map(\.sourceElementID) == other.elements.map(\.sourceElementID) && otherDrawn.map(\.zIndex) == other.elements.map(\.zIndex), "Scenes without orbits changed their draw order")

        try checkOrbitWrapV2(recipe, scene: { try scene($0) }, ink: { try ink($0, paper: $1) })

        // Specimen paper follows the look and is validated.
        let dark = try scene([:], paper: "#0b0c10")
        try require(dark.background == "#0b0c10", "Specimen paper was ignored")
        try require(rejected { _ = try scene([:], paper: "#zzz") }, "Invalid specimen paper accepted")
        print("PASS: orbit wrap (\(looks.count) looks, near/far passes, band copy, tape faces, title core, replay)")
    }
}
