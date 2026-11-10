import Foundation
import CoreGraphics

/// Reads a scene as a compact element table, and applies edit operations to it.
///
/// Coordinates are fractions of the poster: x/y from the top-left, width/height of the page.
/// `aspect` is height / width (A-series portrait ≈ 1.414). Rotation is in degrees.
enum AgentScene {
    static func role(_ e: SceneElement) -> String {
        let id = e.sourceElementID
        return id.split(separator: ":").first.map(String.init) ?? id
    }

    static func describe(_ scene: StyleGenome, verbose: Bool = false) -> JSONValue {
        let order = scene.elements.indices.sorted { (scene.elements[$0].zIndex ?? 0, $0) < (scene.elements[$1].zIndex ?? 0, $1) }
        var rows: [JSONValue] = []
        for i in scene.elements.indices {
            let e = scene.elements[i]
            var row: [String: JSONValue] = [
                "index": .number(Double(i)), "id": .string(e.sourceElementID), "role": .string(role(e)), "kind": .string(e.kind),
                "x": .num(e.bounds.x, 3), "y": .num(e.bounds.y, 3), "width": .num(e.bounds.width, 3), "height": .num(e.bounds.height, 3),
                "color": .string(e.color),
            ]
            if let t = e.text { row["text"] = .string(t) }
            if e.kind != "text" { row["shape"] = .string(e.shape) }
            if e.rotation != 0 { row["rotation"] = .num(e.rotation, 2) }
            if let z = e.zIndex, z != 0 { row["z"] = .number(Double(z)) }
            if let f = e.fontProfileID ?? e.fontName, e.kind == "text" || e.text != nil { row["font"] = .string(f) }
            if let a = e.textAlignment { row["align"] = .string(a) }
            if let t = e.tracking, t != 0 { row["tracking"] = .num(t, 2) }
            if e.outline { row["outline"] = true }
            if e.copies > 1 { row["copies"] = .number(Double(e.copies)) }
            if let inks = e.inks, !inks.isEmpty { row["inks"] = .array(inks.map { .string($0) }) }
            if let b = e.blendMode { row["blend"] = .string(b) }
            if verbose, let g = e.geometry, !g.isEmpty { row["geometry"] = .object(g.mapValues { .num($0, 4) }) }
            if e.physics != nil { row["physics"] = true }
            rows.append(.object(row))
        }
        var result: [String: JSONValue] = [
            "aspect": .num(scene.aspect, 4), "background": .string(scene.background), "font": .string(scene.font),
            "elementCount": .number(Double(scene.elements.count)), "elements": .array(rows),
            "drawOrder": .array(order.map { .number(Double($0)) }),
            "coordinates": "x,y = top-left corner as a fraction of the page width/height; width/height likewise. aspect = height/width.",
        ]
        if let s = scene.styleCategory { result["style"] = .string(s) }
        if let c = scene.posterCopy { result["copy"] = (try? JSONValue.from(c)) ?? .null }
        if let d = scene.composition?.description, !d.isEmpty { result["logic"] = .string(String(d.prefix(600))) }
        let palette = Array(Set(scene.elements.map(\.color) + scene.elements.flatMap { $0.inks ?? [] })).sorted()
        result["palette"] = .array(([scene.background] + palette.filter { $0 != scene.background }).map { .string($0) })
        return .object(result)
    }

    // MARK: Targets

    /// `target` may be an index (3 or "#3"), an element id ("title:0"), "role:title", "text:WORD", "kind:shape", "all", or an array of these.
    static func resolve(_ target: JSONValue?, in scene: StyleGenome) throws -> [Int] {
        guard let target, !target.isNull else { throw AgentError("This operation needs a 'target'.", hint: "Use an index from describe_poster (e.g. 3), an id (\"title:0\"), \"role:title\", \"text:WORD\", \"kind:shape\" or \"all\".") }
        if let list = target.array { return Array(Set(try list.flatMap { try resolve($0, in: scene) })).sorted() }
        let n = scene.elements.count
        if let i = target.int {
            guard (0..<n).contains(i) else { throw AgentError("Element index \(i) is out of range (0–\(n - 1)).") }
            return [i]
        }
        guard var s = target.string?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { throw AgentError("Unreadable target.") }
        if s.hasPrefix("#"), let i = Int(s.dropFirst()) { guard (0..<n).contains(i) else { throw AgentError("Element index \(i) is out of range (0–\(n - 1)).") }; return [i] }
        if s == "all" { return Array(0..<n) }
        if s == "all-text" { s = "kind:text" }
        let matches: [Int]
        if s.hasPrefix("role:") { let r = String(s.dropFirst(5)); matches = scene.elements.indices.filter { role(scene.elements[$0]) == r } }
        else if s.hasPrefix("kind:") { let k = String(s.dropFirst(5)); matches = scene.elements.indices.filter { scene.elements[$0].kind == k } }
        else if s.hasPrefix("text:") { let t = String(s.dropFirst(5)); matches = scene.elements.indices.filter { scene.elements[$0].text?.localizedCaseInsensitiveContains(t) == true } }
        else if s.hasPrefix("color:") { let c = String(s.dropFirst(6)).lowercased(); matches = scene.elements.indices.filter { scene.elements[$0].color.lowercased() == c } }
        else { matches = scene.elements.indices.filter { scene.elements[$0].sourceElementID == s } }
        guard !matches.isEmpty else {
            let roles = Set(scene.elements.map(role)).sorted().joined(separator: ", ")
            throw AgentError("No element matches '\(s)'.", hint: "Roles here: \(roles). Call describe_poster for indices and ids.")
        }
        return matches
    }

    // MARK: Operations

    static let operations = ["set_text", "replace_text", "set_copy", "set_color", "recolor", "set_background", "move", "resize", "set_bounds", "rotate", "set_font", "set_tracking", "set_alignment", "set_z", "set_outline", "delete", "duplicate", "add_text", "add_shape", "set_field", "set_scene_field"]
    static let simpleShapes = ["rectangle", "ellipse", "disc", "triangle", "quarter-disc", "quarter-ring", "crescent", "ellipse-outline", "capsule-outline", "ribbon"]

    struct Outcome { var changed: Set<Int> = []; var added: [Int] = []; var removed = 0; var notes: [String] = [] }

    static func apply(_ ops: [JSONValue], to scene: inout StyleGenome) throws -> Outcome {
        var outcome = Outcome()
        for (n, op) in ops.enumerated() {
            let a = AgentArguments(op)
            guard let name = try a.string("op") else { throw AgentError("Operation \(n) has no 'op'.", hint: "One of: " + operations.joined(separator: ", ")) }
            do { try apply(name, a, op, to: &scene, outcome: &outcome) }
            catch let e as AgentError { throw AgentError("Operation \(n) (\(name)): \(e.message)", hint: e.hint) }
            catch { throw AgentError("Operation \(n) (\(name)): \(error.localizedDescription)") }
        }
        return outcome
    }

    private static func hex(_ value: String?) throws -> String? {
        guard var v = value?.trimmingCharacters(in: .whitespaces) else { return nil }
        if !v.hasPrefix("#") { v = "#" + v }
        if v.count == 4 { v = "#" + v.dropFirst().map { "\($0)\($0)" }.joined() }
        guard v.count == 7, Int(v.dropFirst(), radix: 16) != nil else { throw AgentError("'\(value!)' is not a #rrggbb colour.") }
        return v.lowercased()
    }

    private static func apply(_ name: String, _ a: AgentArguments, _ raw: JSONValue, to scene: inout StyleGenome, outcome: inout Outcome) throws {
        func targets() throws -> [Int] { try resolve(raw["target"], in: scene) }
        func each(_ body: (inout SceneElement) throws -> Void) throws {
            for i in try targets() { try body(&scene.elements[i]); outcome.changed.insert(i) }
        }
        switch name {
        case "set_text":
            let text = try singleLine(try a.required("text").replacingOccurrences(of: "\\n", with: "\n"))
            let fill = try a.string("fit") == "box", snapshot = scene
            try each { e in
                guard e.text != nil || e.kind == "text" else { throw AgentError("Element \(e.sourceElementID) is not text.") }
                let em = fill ? nil : emSize(e, snapshot)
                e.text = text
                if let em { hug(&e, snapshot, em: em) }
            }
        case "replace_text":
            let find = try a.required("find"), replace = try a.string("replace") ?? ""
            let indices = raw["target"] == nil ? Array(scene.elements.indices) : try targets()
            var hits = 0
            _ = try singleLine(replace)
            let snapshot = scene
            for i in indices {
                guard let t = scene.elements[i].text, t.contains(find) else { continue }
                let em = emSize(scene.elements[i], snapshot)
                scene.elements[i].text = t.replacingOccurrences(of: find, with: replace)
                if let em { hug(&scene.elements[i], snapshot, em: em) }
                outcome.changed.insert(i); hits += 1
            }
            if var copy = scene.posterCopy {
                copy.title = copy.title.replacingOccurrences(of: find, with: replace); copy.subtitle = copy.subtitle.replacingOccurrences(of: find, with: replace)
                copy.institution = copy.institution.replacingOccurrences(of: find, with: replace); copy.footer = copy.footer.replacingOccurrences(of: find, with: replace)
                copy.displayPhrases = copy.displayPhrases?.map { $0.replacingOccurrences(of: find, with: replace) }
                scene.posterCopy = copy
            }
            if hits == 0 { outcome.notes.append("replace_text: '\(find)' was not found in any text element.") }
        case "set_copy":
            var copy = scene.posterCopy ?? PosterCopy()
            let fields: [(String, WritableKeyPath<PosterCopy, String>)] = [("title", \.title), ("subtitle", \.subtitle), ("institution", \.institution), ("footer", \.footer)]
            for (key, path) in fields {
                guard let value = try a.string(key)?.replacingOccurrences(of: "\\n", with: "\n") else { continue }
                let old = copy[keyPath: path]; copy[keyPath: path] = value
                guard !old.isEmpty, old != value else { continue }
                var hits = 0
                let snapshot = scene
                let oldParts = old.split(whereSeparator: \.isNewline).map(String.init), newParts = value.split(whereSeparator: \.isNewline).map(String.init)
                for i in scene.elements.indices {
                    guard let t = scene.elements[i].text else { continue }
                    let em = emSize(scene.elements[i], snapshot)
                    defer { if outcome.changed.contains(i), let em { hug(&scene.elements[i], snapshot, em: em) } }
                    if t == old || t.replacingOccurrences(of: "\n", with: " ") == old.replacingOccurrences(of: "\n", with: " ") { scene.elements[i].text = value.replacingOccurrences(of: "\n", with: " "); hits += 1 }
                    else if t.contains(old) { scene.elements[i].text = t.replacingOccurrences(of: old, with: value); hits += 1 }
                    else if oldParts.count > 1, oldParts.count == newParts.count, let k = oldParts.firstIndex(of: t) { scene.elements[i].text = newParts[k]; hits += 1 }
                    else { continue }
                    outcome.changed.insert(i)
                }
                if hits == 0 { outcome.notes.append("set_copy: no element showed the old \(key) '\(old)'; only the stored copy changed. Use set_text on the right element.") }
            }
            copy.displayPhrases = nil; copy.briefID = nil
            scene.posterCopy = copy
        case "set_color":
            let c = try hex(try a.required("color"))!
            try each { $0.color = c }
        case "recolor":
            let from = try hex(try a.required("from"))!, to = try hex(try a.required("to"))!
            var hits = 0
            if scene.background.lowercased() == from { scene.background = to; hits += 1 }
            for i in scene.elements.indices {
                var hit = false
                if scene.elements[i].color.lowercased() == from { scene.elements[i].color = to; hit = true }
                if let inks = scene.elements[i].inks, inks.contains(where: { $0.lowercased() == from }) { scene.elements[i].inks = inks.map { $0.lowercased() == from ? to : $0 }; hit = true }
                if hit { outcome.changed.insert(i); hits += 1 }
            }
            if hits == 0 { outcome.notes.append("recolor: \(from) is not used. The palette is listed by describe_poster.") }
        case "set_background":
            scene.background = try hex(try a.required("color"))!
        case "move":
            let x = try a.double("x"), y = try a.double("y"), dx = try a.double("dx") ?? 0, dy = try a.double("dy") ?? 0
            guard x != nil || y != nil || dx != 0 || dy != 0 else { throw AgentError("Give x/y (absolute) or dx/dy (relative).") }
            try each { e in e.bounds.x = (x ?? e.bounds.x) + dx; e.bounds.y = (y ?? e.bounds.y) + dy; shiftClip(&e, dx: dx, dy: dy) }
        case "resize":
            let scale = try a.double("scale", range: 0.05...20), w = try a.double("width", range: 0.001...4), h = try a.double("height", range: 0.001...4)
            let anchor = try a.string("anchor") ?? "center"
            guard scale != nil || w != nil || h != nil else { throw AgentError("Give scale, or width and/or height.") }
            try each { e in
                let old = e.bounds
                var nw = w ?? old.width * (scale ?? 1), nh = h ?? old.height * (scale ?? 1)
                if scale == nil, w != nil, h == nil, e.kind == "text" { nh = old.height * nw / old.width }
                if scale == nil, h != nil, w == nil, e.kind == "text" { nw = old.width * nh / old.height }
                e.bounds.width = nw; e.bounds.height = nh
                if anchor == "center" { e.bounds.x = old.x + (old.width - nw) / 2; e.bounds.y = old.y + (old.height - nh) / 2 }
                e.typeEmSize = e.typeEmSize.map { $0 * nh / max(0.0001, old.height) }
            }
        case "set_bounds":
            let x = try a.double("x"), y = try a.double("y"), w = try a.double("width", range: 0.001...4), h = try a.double("height", range: 0.001...4)
            try each { e in e.bounds = UnitBox(x: x ?? e.bounds.x, y: y ?? e.bounds.y, width: w ?? e.bounds.width, height: h ?? e.bounds.height) }
        case "rotate":
            let d = try a.double("degrees", range: -360...360) ?? 0, by = try a.double("by", range: -360...360)
            try each { e in e.rotation = by.map { e.rotation + $0 } ?? d }
        case "set_font":
            if let id = try a.string("font_profile") {
                guard let p = FontLibrary.shared.profile(id) else { throw AgentError("Unknown font profile '\(id)'.", hint: "Call list_fonts for ids.") }
                let snapshot = scene
                try each { e in let em = emSize(e, snapshot); e.fontName = p.postscriptName; e.fontVariations = p.variations; e.fontProfileID = p.id; e.fontAssetID = p.assetID; e.fontAssetSHA256 = p.assetSHA256; if let em { hug(&e, snapshot, em: em) } }
            } else {
                let ps = try a.required("font_name", hint: "Give font_profile (from list_fonts) or a PostScript font_name such as HelveticaNeue-Bold.")
                let snapshot = scene
                try each { e in let em = emSize(e, snapshot); e.fontName = ps; e.fontVariations = nil; e.fontProfileID = nil; e.fontAssetID = nil; e.fontAssetSHA256 = nil; if let em { hug(&e, snapshot, em: em) } }
            }
        case "set_tracking":
            let v = try a.double("value", range: -50...200) ?? 0
            let snapshot = scene
            try each { e in let em = emSize(e, snapshot); e.tracking = v; if let em { hug(&e, snapshot, em: em) } }
        case "set_alignment":
            let v = try a.required("align"); guard ["left", "center", "right"].contains(v) else { throw AgentError("align must be left, center or right.") }
            try each { $0.textAlignment = v }
        case "set_z":
            let z = try a.int("z", range: -1000...1000) ?? 0
            try each { $0.zIndex = z }
        case "set_outline":
            let on = try a.bool("outline") ?? true, width = try a.double("width", range: 0...0.2)
            try each { e in e.outline = on; if let width { e.outlineWidth = width } }
        case "delete":
            let doomed = Set(try targets())
            scene.elements = scene.elements.enumerated().filter { !doomed.contains($0.offset) }.map(\.element)
            outcome.removed += doomed.count; outcome.changed = []; outcome.added = []
            outcome.notes.append("Deleted \(doomed.count) element(s); indices after them shifted down.")
        case "duplicate":
            let dx = try a.double("dx") ?? 0.02, dy = try a.double("dy") ?? 0.02
            for i in try targets() {
                var copy = scene.elements[i]; copy.bounds.x += dx; copy.bounds.y += dy; shiftClip(&copy, dx: dx, dy: dy)
                copy.sourceElementID = uniqueID(copy.sourceElementID + "-copy", in: scene)
                scene.elements.append(copy); outcome.added.append(scene.elements.count - 1)
            }
        case "add_text":
            let text = try a.required("text").replacingOccurrences(of: "\\n", with: "\n")
            let box = try box(a, default: UnitBox(x: 0.07, y: 0.85, width: 0.86, height: 0.03))
            let roleName = try a.string("role") ?? "meta"
            guard ["title", "meta", "art", "agent"].contains(roleName) else { throw AgentError("role must be title, meta, art or agent.", hint: "title = display type, meta = supporting information (checked for size and margins), art = decorative type.") }
            let dark = LibrarySceneRenderer.luminance(scene.background) < 110
            var e = SceneElement(sourceElementID: uniqueID("\(roleName):agent", in: scene), kind: "text", bounds: box, rotation: try a.double("rotation") ?? 0, text: text,
                                 color: try hex(try a.string("color")) ?? (dark ? "#f2efe8" : "#1d1d1b"), shape: "rectangle", outline: false, shadow: false, offsetX: 0, offsetY: 0, copies: 1,
                                 preserveTypeProportions: true, fontName: scene.font, textAlignment: try a.string("align") ?? "left")
            if let id = try a.string("font_profile") {
                guard let p = FontLibrary.shared.profile(id) else { throw AgentError("Unknown font profile '\(id)'.", hint: "Call list_fonts.") }
                e.fontName = p.postscriptName; e.fontVariations = p.variations; e.fontProfileID = p.id; e.fontAssetID = p.assetID; e.fontAssetSHA256 = p.assetSHA256
            } else if let ps = try a.string("font_name") { e.fontName = ps }
            else if let typeElement = scene.elements.first(where: { $0.kind == "text" && role($0) == (roleName == "title" ? "title" : "meta") }) ?? scene.elements.first(where: { $0.kind == "text" }) {
                e.fontName = typeElement.fontName; e.fontVariations = typeElement.fontVariations; e.fontProfileID = typeElement.fontProfileID; e.fontAssetID = typeElement.fontAssetID; e.fontAssetSHA256 = typeElement.fontAssetSHA256
            }
            e.zIndex = (scene.elements.compactMap(\.zIndex).max() ?? 0) + 1
            let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
            let leading = try a.double("line_spacing", range: 0.8...3) ?? 1.25
            var em: Double?
            for (k, line) in lines.enumerated() {
                var item = e
                item.text = line.isEmpty ? " " : line
                item.bounds.y = box.y + Double(k) * box.height * leading
                if k > 0 { item.sourceElementID = uniqueID(e.sourceElementID, in: scene) }
                if em == nil { em = emSize(item, scene) }
                if let em { hug(&item, scene, em: em) }
                scene.elements.append(item); outcome.added.append(scene.elements.count - 1)
            }
        case "add_shape":
            let shape = try a.string("shape") ?? "rectangle"
            guard simpleShapes.contains(shape) else { throw AgentError("Unknown shape '\(shape)'.", hint: "Shapes: " + simpleShapes.joined(separator: ", ") + ". For generative shapes start from a shape recipe with create_poster mode=shape.") }
            var e = SceneElement(sourceElementID: uniqueID("agent-shape", in: scene), kind: "shape", bounds: try box(a, default: UnitBox(x: 0.3, y: 0.3, width: 0.4, height: 0.4 / max(0.25, scene.aspect))),
                                 rotation: try a.double("rotation") ?? 0, text: nil, color: try hex(try a.string("color")) ?? "#1d1d1b", shape: shape,
                                 outline: try a.bool("outline") ?? false, shadow: false, offsetX: 0, offsetY: 0, copies: 1)
            if let b = try a.string("blend") { guard ["multiply", "difference"].contains(b) else { throw AgentError("blend must be multiply or difference.") }; e.blendMode = b }
            e.zIndex = try a.int("z") ?? (scene.elements.compactMap(\.zIndex).min() ?? 0) - 1
            scene.elements.append(e); outcome.added.append(scene.elements.count - 1)
        case "set_field":
            let field = try a.required("field", hint: "Any SceneElement property, e.g. copies, offsetX, blendMode, geometry, inks, typeTransform.")
            guard let value = raw["value"] else { throw AgentError("set_field needs a 'value' (use null to clear).") }
            try each { e in
                var object = try JSONValue.from(e).object ?? [:]
                guard field != "sourceElementID" else { throw AgentError("Element ids are fixed; duplicate the element instead.") }
                object[field] = value
                do { e = try JSONValue.object(object).decode(SceneElement.self) }
                catch { throw AgentError("'\(field)' = \(value.text()) does not fit a scene element: \(error.localizedDescription)") }
            }
        case "set_scene_field":
            let field = try a.required("field", hint: "e.g. aspect, background, font, tracking, textScale.")
            guard let value = raw["value"] else { throw AgentError("set_scene_field needs a 'value'.") }
            guard field != "elements" else { throw AgentError("Edit elements with element operations.") }
            var object = try JSONValue.from(scene).object ?? [:]
            object[field] = value
            do { scene = try JSONValue.object(object).decode(StyleGenome.self) }
            catch { throw AgentError("'\(field)' = \(value.text()) does not fit the scene: \(error.localizedDescription)") }
        default:
            throw AgentError("Unknown operation '\(name)'.", hint: "One of: " + operations.joined(separator: ", "))
        }
    }

    /// Glyph-outline bounds of a text element at the renderer's 100-unit size.
    static func glyphBounds(_ e: SceneElement, _ scene: StyleGenome) -> CGRect? {
        guard e.kind == "text", let t = e.text, !t.isEmpty else { return nil }
        let b = LibrarySceneRenderer.textPath(e, string: t, genome: scene).boundingBoxOfPath
        return b.isNull || b.width <= 0 || b.height <= 0 ? nil : b
    }
    /// The element's type size as the renderer's typeEmSize (fraction of page height per 100 font units).
    static func emSize(_ e: SceneElement, _ scene: StyleGenome) -> Double? {
        if let em = e.typeEmSize { return em }
        guard e.preserveTypeProportions == true, let b = glyphBounds(e, scene) else { return nil }
        return 100 * min(e.bounds.width / (b.width * scene.aspect), e.bounds.height / b.height)
    }
    /// Fixes the type size and fits the box to the text, keeping the aligned edge (left, centre or right) in place.
    static func hug(_ e: inout SceneElement, _ scene: StyleGenome, em: Double) {
        e.typeEmSize = em
        guard let b = glyphBounds(e, scene) else { return }
        let w = em * scene.aspect * b.width / 100, h = em * b.height / 100, old = e.bounds
        let x = e.textAlignment == "center" ? old.x + (old.width - w) / 2 : e.textAlignment == "right" ? old.x + old.width - w : old.x
        e.bounds = UnitBox(x: x, y: old.y, width: w, height: h)
    }
    private static func singleLine(_ text: String) throws -> String {
        guard !text.contains("\n") else { throw AgentError("Text elements hold one line each.", hint: "Put each line in its own element: duplicate the element with dy ≈ its height × 1.2 and set_text on the copy. add_text accepts several lines and stacks them for you.") }
        return text
    }

    private static func box(_ a: AgentArguments, default d: UnitBox) throws -> UnitBox {
        UnitBox(x: try a.double("x") ?? d.x, y: try a.double("y") ?? d.y, width: try a.double("width", range: 0.001...4) ?? d.width, height: try a.double("height", range: 0.001...4) ?? d.height)
    }
    private static func shiftClip(_ e: inout SceneElement, dx: Double, dy: Double) {
        guard var c = e.clipBounds else { return }
        c.x = min(max(0, c.x + dx), 1 - c.width); c.y = min(max(0, c.y + dy), 1 - c.height); e.clipBounds = c
    }
    private static func uniqueID(_ base: String, in scene: StyleGenome) -> String {
        let used = Set(scene.elements.map(\.sourceElementID))
        if !used.contains(base) { return base }
        var n = 2; while used.contains("\(base)-\(n)") { n += 1 }
        return "\(base)-\(n)"
    }

    /// Mechanical warnings an agent should see after an edit.
    static func warnings(_ scene: StyleGenome) -> [String] {
        var out: [String] = []
        for (i, e) in scene.elements.enumerated() {
            let b = e.bounds
            if ![b.x, b.y, b.width, b.height].allSatisfy(\.isFinite) { out.append("#\(i) has non-finite bounds."); continue }
            if b.x > 1 || b.y > 1 || b.x + b.width < 0 || b.y + b.height < 0 { out.append("#\(i) (\(e.sourceElementID)) is entirely off the page.") }
            else if e.kind == "text", role(e) == "meta", b.x < 0.03 || b.y < 0.02 || b.x + b.width > 0.97 || b.y + b.height > 0.98 { out.append("#\(i) supporting text sits in the outer margin.") }
            if e.kind == "text", (e.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { out.append("#\(i) is an empty text element.") }
        }
        return out
    }
}
