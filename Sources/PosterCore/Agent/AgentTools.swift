import Foundation
import CoreGraphics
import CoreText

public struct AgentToolSpec: Sendable {
    public var name: String
    public var title: String
    public var description: String
    public var inputSchema: JSONValue
    public var readOnly: Bool
    public var slow: Bool = false
}

public struct AgentImage: Sendable {
    public var url: URL
    public var caption: String
}

/// What a tool returns: one line for people, structured data for programs, and images to look at.
public struct AgentToolResult: Sendable {
    public var summary: String
    public var data: JSONValue
    public var images: [AgentImage] = []
    public var isError = false
    public static func failure(_ error: Error) -> AgentToolResult {
        let e = error as? AgentError
        let message = e?.message ?? error.localizedDescription
        var data: [String: JSONValue] = ["error": .string(message)]
        if let hint = e?.hint { data["hint"] = .string(hint) }
        return AgentToolResult(summary: "Error: " + (e?.errorDescription ?? message), data: .object(data), isError: true)
    }
}

/// PosterLab as a set of tools an LLM agent can call. One instance per server/process.
public actor PosterAgent {
    public nonisolated let environment: AgentEnvironment
    let store: AgentStore
    private var judgeCache: AgentJudge?
    private var recordsCache: [PosterRecord]?

    public init(environment: AgentEnvironment = .resolve()) {
        self.environment = environment
        store = AgentStore(environment: environment)
    }

    public static let version = "1.0.0"

    public func call(_ name: String, arguments: JSONValue?, progress: @escaping @Sendable (String) -> Void = { _ in }) async -> AgentToolResult {
        let a = AgentArguments(arguments)
        do {
            guard Self.tools.contains(where: { $0.name == name }) else {
                throw AgentError("Unknown tool '\(name)'.", hint: "Tools: " + Self.tools.map(\.name).joined(separator: ", "))
            }
            if let known = Self.tools.first(where: { $0.name == name })?.inputSchema["properties"]?.object {
                let unknown = a.values.keys.filter { known[$0] == nil }.sorted()
                if !unknown.isEmpty { throw AgentError("Unknown argument(s) for \(name): \(unknown.joined(separator: ", ")).", hint: "Accepted: " + known.keys.sorted().joined(separator: ", ")) }
            }
            switch name {
            case "guide": return try await guide()
            case "list_briefs": return try listBriefs(a)
            case "list_styles": return listStyles()
            case "list_shape_recipes": return try listRecipes(a)
            case "list_fonts": return try listFonts(a)
            case "list_judges": return try await listJudges()
            case "create_poster": return try await create(a, progress: progress)
            case "remake_poster": return try await remake(a, progress: progress)
            case "sketch_variations": return try await sketch(a, progress: progress)
            case "list_projects": return try listProjects(a)
            case "describe_poster": return try describe(a)
            case "edit_poster": return try edit(a)
            case "view_poster": return try view(a)
            case "critique_poster": return try await critique(a)
            case "rank_posters": return try await rank(a)
            case "poster_history": return try history(a)
            case "revert_poster": return try revert(a)
            case "export_poster": return try export(a)
            case "import_scene": return try importScene(a)
            case "run_study": return try await study(a, progress: progress)
            case "inspect_study": return try inspectStudy(a)
            case "open_in_studio": return try await openInStudio(a)
            case "studio_state": return try await studioStateTool(a)
            default: throw AgentError("Tool '\(name)' is listed but not implemented.")
            }
        } catch is CancellationError {
            return .failure(AgentError("Cancelled."))
        } catch {
            return .failure(error)
        }
    }

    // MARK: Shared

    private func judge() throws -> AgentJudge {
        if let judgeCache { return judgeCache }
        let j = try AgentJudge(environment: environment); judgeCache = j; return j
    }
    private func records(_ progress: @Sendable (String) -> Void) async throws -> [PosterRecord] {
        if let recordsCache { return recordsCache }
        guard FileManager.default.fileExists(atPath: environment.library.appending(path: "library.json").path) else {
            throw AgentError("No poster library at \(environment.library.path).", hint: "Set POSTERLAB_ROOT to the PosterLab project folder, or use mode=style / mode=shape, which need no library.")
        }
        progress("Loading the source library (first call only)…")
        let all = try await PosterLibraryEngine(directory: environment.library).records()
        let usable = all.filter { $0.reviewStatus != "rejected" && $0.genome.elements.filter { $0.kind == "text" }.count >= 2 }
        recordsCache = usable; return usable
    }
    private func previewWidth(_ a: AgentArguments) throws -> Int { try a.int("preview_width", range: 300...1600) ?? 700 }

    private func resolveCopy(_ a: AgentArguments, seed: UInt64) throws -> PosterCopy {
        var copy: PosterCopy
        if let id = try a.string("brief"), id != "random" {
            guard let brief = ContentBriefLibrary.brief(id) else { throw AgentError("Unknown brief '\(id)'.", hint: "Call list_briefs for real event copy ids, or pass 'random'.") }
            copy = brief.posterCopy
        } else { copy = ContentBriefLibrary.copy(seed: seed) }
        if let c = a.values["copy"]?.object {
            let fields = AgentArguments(.object(c))
            if c.keys.contains(where: { !["title", "subtitle", "institution", "footer"].contains($0) }) { throw AgentError("copy accepts title, subtitle, institution, footer.") }
            if let v = try fields.string("title") { copy.title = v.replacingOccurrences(of: "\\n", with: "\n") }
            if let v = try fields.string("subtitle") { copy.subtitle = v }
            if let v = try fields.string("institution") { copy.institution = v }
            if let v = try fields.string("footer") { copy.footer = v }
            copy.briefID = nil; copy.displayPhrases = nil
        }
        return try copy.validated()
    }

    private func projectSummary(_ p: AgentProject) -> JSONValue {
        let rev = p.currentRevision
        var o: [String: JSONValue] = ["project": .string(p.id), "title": .string(p.title), "revision": .number(Double(rev.number)),
                                      "revisions": .number(Double(p.revisions.count)), "mode": .string(p.origin.mode), "seed": .string(String(p.origin.seed)),
                                      "preview": .string(store.previewURL(p, rev).path), "scene": .string(store.folder(p.id).appending(path: rev.scene).path)]
        if let s = p.origin.style { o["style"] = .string(s) }
        if let r = p.origin.recipe { o["recipe"] = .string(r) }
        if let b = p.origin.briefID { o["brief"] = .string(b) }
        if let g = p.group { o["group"] = .string(g) }
        if let d = p.origin.donors { o["donors"] = .array(d.map { .string($0) }) }
        return .object(o)
    }

    private func preflight(_ scene: StyleGenome) -> [String] {
        var issues = CompositionJudges.preflight(scene, copy: scene.posterCopy ?? PosterCopy(title: scene.elements.first { $0.kind == "text" }?.text ?? "POSTER"))
        if scene.posterCopy == nil { issues.removeAll { $0 == "missing required copy" } }
        return issues
    }

    // MARK: Discovery

    private func guide() async throws -> AgentToolResult {
        let projects = store.all()
        let tasteReady = ((try? await TasteStore(directory: environment.taste).load().profiles) ?? []).filter(\.ready).map(\.name)
        let status: JSONValue = [
            "root": .string(environment.root.path), "projects": .string(environment.home.path), "projectCount": .number(Double(projects.count)),
            "library": .bool(FileManager.default.fileExists(atPath: environment.library.appending(path: "library.json").path)),
            "briefs": .number(Double(ContentBriefLibrary.briefs.count)), "styles": .number(Double(StyleCatalog.categories.count)),
            "shapeRecipes": .number(Double(PosterShapeLibrary.recipes.count)), "fontProfiles": .number(Double(FontLibrary.shared.profiles.count)),
            "tasteProfilesReady": .array(tasteReady.map { .string($0) }), "version": .string(Self.version),
        ]
        return AgentToolResult(summary: AgentGuide.text, data: ["status": status, "guide": .string(AgentGuide.text)])
    }

    private func listBriefs(_ a: AgentArguments) throws -> AgentToolResult {
        let q = try a.string("query")?.lowercased(), kind = try a.string("kind")?.lowercased(), limit = try a.int("limit", range: 1...200) ?? 40
        let hits = ContentBriefLibrary.briefs.filter { b in
            (kind == nil || b.kind.lowercased() == kind) &&
            (q == nil || [b.id, b.name, b.kind, b.title, b.subtitle, b.institution, b.city, b.footer].joined(separator: " ").lowercased().contains(q!))
        }
        let rows: [JSONValue] = hits.prefix(limit).map { b in
            ["id": .string(b.id), "name": .string(b.name), "kind": .string(b.kind), "title": .string(b.title), "subtitle": .string(b.subtitle),
             "institution": .string(b.institution), "footer": .string(b.footer), "dates": .string(b.dateLabel), "city": .string(b.city), "status": .string(b.status())]
        }
        let kinds = Array(Set(ContentBriefLibrary.briefs.map(\.kind))).sorted()
        return AgentToolResult(summary: "\(hits.count) brief(s) of \(ContentBriefLibrary.briefs.count). Kinds: \(kinds.joined(separator: ", ")).",
                               data: ["briefs": .array(rows), "kinds": .array(kinds.map { .string($0) }), "total": .number(Double(hits.count))])
    }

    private func listStyles() -> AgentToolResult {
        let rows: [JSONValue] = StyleCatalog.categories.map { ["id": .string($0.id), "name": .string($0.displayName), "group": .string($0.group), "definition": .string($0.definition)] }
        return AgentToolResult(summary: "\(rows.count) style directions: " + StyleCatalog.categories.map(\.id).joined(separator: ", "), data: ["styles": .array(rows)])
    }

    private func listRecipes(_ a: AgentArguments) throws -> AgentToolResult {
        let q = try a.string("query")?.lowercased(), group = try a.string("group")?.lowercased(), id = try a.string("id")
        let limit = try a.int("limit", range: 1...300) ?? 60, detailed = try a.bool("details") ?? (id != nil)
        let all = PosterShapeLibrary.recipes
        let hits = all.filter { r in
            (id == nil || r.id == id) && (group == nil || r.group.lowercased().contains(group!)) &&
            (q == nil || ([r.id, r.name, r.group, r.logic] + r.tags + r.styles).joined(separator: " ").lowercased().contains(q!))
        }
        if let id, hits.isEmpty { throw AgentError("No shape recipe '\(id)'.", hint: "Call list_shape_recipes with a query instead.") }
        let rows: [JSONValue] = hits.prefix(limit).map { r in
            var o: [String: JSONValue] = ["id": .string(r.id), "name": .string(r.name), "group": .string(r.group), "tags": .array(r.tags.prefix(8).map { .string($0) }),
                                          "looks": .array((r.looks ?? []).map { .string($0.name) })]
            o["logic"] = .string(detailed ? r.logic : String(r.logic.prefix(160)))
            if detailed {
                o["parameters"] = .array(r.parameters.map { p in ["id": .string(p.id), "label": .string(p.label), "default": .num(p.value), "min": .num(p.min), "max": .num(p.max), "step": .num(p.step)] })
                o["inks"] = .array((r.inks ?? []).map { .string($0) }); o["styles"] = .array(r.styles.map { .string($0) }); o["idealAspect"] = .num(r.idealAspect, 3)
                o["lookDetails"] = .array((r.looks ?? []).map { l in ["name": .string(l.name), "parameters": .object(l.parameters.mapValues { .num($0) }), "inks": .array((l.inks ?? []).map { .string($0) })] })
            }
            return .object(o)
        }
        let groups = Array(Set(all.map(\.group))).sorted()
        return AgentToolResult(summary: "\(hits.count) shape recipe(s) of \(all.count). Groups: \(groups.joined(separator: ", ")).\(detailed ? "" : " Pass id or details=true for parameters.")",
                               data: ["recipes": .array(rows), "groups": .array(groups.map { .string($0) })])
    }

    private func listFonts(_ a: AgentArguments) throws -> AgentToolResult {
        let q = try a.string("query")?.lowercased(), category = try a.string("category")?.lowercased(), limit = try a.int("limit", range: 1...300) ?? 60
        let all = FontLibrary.shared.profiles
        let hits = all.filter { p in (category == nil || p.category.lowercased().contains(category!)) && (q == nil || "\(p.id) \(p.family) \(p.label) \(p.category)".lowercased().contains(q!)) }
        let rows: [JSONValue] = hits.prefix(limit).map { ["id": .string($0.id), "label": .string($0.label), "family": .string($0.family), "category": .string($0.category), "weight": .num($0.weight, 0), "width": .num($0.width, 0), "italic": .bool($0.italic)] }
        let families = Array(Set(all.map(\.family))).sorted()
        return AgentToolResult(summary: "\(hits.count) font profile(s); \(families.count) families: \(families.joined(separator: ", ")).", data: ["fonts": .array(rows), "families": .array(families.map { .string($0) })])
    }

    private func listJudges() async throws -> AgentToolResult {
        let taste = (try? await TasteStore(directory: environment.taste).load().profiles) ?? []
        let data: JSONValue = [
            "craft": .array(StyleCatalog.qualityJudges.map { .string($0) }),
            "styles": .array(StyleCatalog.categories.map { .string($0.name) }),
            "designers": .array(DesignerCatalog.profiles.map { ["judge": .string($0.judgeName), "learned": .bool($0.usableForVoting)] }),
            "taste": .array(taste.map { ["judge": .string($0.judgeName), "ready": .bool($0.ready), "yes": .number(Double($0.positive)), "no": .number(Double($0.negative))] }),
            "defaultRankingWeights": .object(AgentRanking.defaultWeights(tasteJudges: taste.filter(\.ready).map(\.judgeName)).mapValues { .num($0) }),
        ]
        return AgentToolResult(summary: "Judges for rank_posters weights and run_study mix. Taste jurors are the user's own yes/no votes; prefer them for picking.", data: data)
    }

    // MARK: Making posters

    private struct Made { var scene: StyleGenome; var renderSeed: UInt64; var origin: AgentOrigin; var copy: PosterCopy?; var title: String; var notes: [String] }

    private func make(_ a: AgentArguments, seedOverride: UInt64? = nil, progress: @escaping @Sendable (String) -> Void) async throws -> Made {
        let mode = try a.string("mode") ?? (a.has("recipe") && !a.has("style") ? "shape" : "style")
        let seed = try seedOverride ?? a.seed() ?? UInt64.random(in: 1...999_999)
        var rng = SeededRandom(seed: seed ^ 0x5eed)
        let fontID = try a.string("font_profile")
        let font = try fontID.map { id -> FontStyleProfile in guard let p = FontLibrary.shared.profile(id) else { throw AgentError("Unknown font profile '\(id)'.", hint: "Call list_fonts.") }; return p }
        func style() throws -> String {
            if let s = try a.string("style") {
                guard StyleCatalog.categories.contains(where: { $0.id == s }) else { throw AgentError("Unknown style '\(s)'.", hint: "Styles: " + StyleCatalog.categories.map(\.id).joined(separator: ", ")) }
                return s
            }
            return StyleCatalog.categories[rng.int(StyleCatalog.categories.count)].id
        }
        func preset() throws -> PosterShapePreset? {
            guard let id = try a.string("recipe") else { return nil }
            guard let recipe = PosterShapeLibrary.recipe(id) else { throw AgentError("Unknown shape recipe '\(id)'.", hint: "Call list_shape_recipes.") }
            var values: [String: Double] = [:]
            var p = PosterShapePreset(recipe: recipe, seed: seed, parameters: [:], fontProfileID: font?.id)
            if let name = try a.string("look") {
                guard let look = recipe.look(name) else { throw AgentError("Recipe \(id) has no look '\(name)'.", hint: "Looks: " + (recipe.looks ?? []).map(\.name).joined(separator: ", ")) }
                values = look.parameters; p.inks = look.inks; p.paper = look.paper
            }
            for (k, v) in try a.numbers("shape_parameters") ?? [:] { values[k] = v }
            _ = try recipe.values(values)
            p.parameters = values
            if let inks = try a.strings("inks") { try ShapeMaterials.validate(inks); p.inks = inks }
            if let text = try a.string("text")?.replacingOccurrences(of: "\\n", with: "\n") {
                if recipe.renderer == PaperReliefSystems.shape { p.relief = PaperReliefCustomization(title: text); try p.relief?.validate() }
                else if recipe.renderer == GravityTypeSystems.shape { p.physics = GravityTypeCustomization(title: text); try p.physics?.validate() }
                else if ContourSystems.isContour(recipe.renderer) { var c = ContourCustomization(); c.text = text; try c.validate(); p.contour = c }
            }
            if let placement = try a.string("placement") {
                guard TypePlacementSettings.modes.contains(placement) else { throw AgentError("placement must be " + TypePlacementSettings.modes.joined(separator: ", ")) }
                let settings = TypePlacementSettings(mode: placement, contrast: "auto"); try settings.validate(); p.placement = settings
            }
            return p
        }
        let args = JSONValue.object(a.values)
        switch mode {
        case "style":
            let copy = try resolveCopy(a, seed: seed), s = try style()
            var scene = try StylePosterRenderer.genome(style: s, seed: seed, copy: copy)
            if let font { FontLibrary.apply(font, to: &scene) }
            scene.posterCopy = copy; scene.styleCategory = scene.styleCategory ?? s
            return Made(scene: scene, renderSeed: seed, origin: AgentOrigin(mode: mode, style: s, seed: seed, briefID: copy.briefID, fontProfileID: font?.id, arguments: args), copy: copy, title: copy.title, notes: [])
        case "source":
            let copy = try resolveCopy(a, seed: seed), s = try style(), shape = try preset()
            let pool = try await records(progress)
            guard pool.count >= 2 else { throw AgentError("The library has too few usable source posters.") }
            var donorA: PosterRecord, donorB: PosterRecord
            if let ids = try a.strings("donors") {
                guard ids.count == 2, let x = pool.first(where: { $0.id == ids[0] }), let y = pool.first(where: { $0.id == ids[1] }) else { throw AgentError("donors must be two source poster ids from the library.") }
                donorA = x; donorB = y
            } else {
                donorA = pool[rng.int(pool.count)]
                let others = (0..<min(48, pool.count)).map { _ in pool[rng.int(pool.count)] }.filter { $0.id != donorA.id && $0.source.postID != donorA.source.postID }
                donorB = others.max { SourceLayoutDNA.compatibility(donorA, $0) < SourceLayoutDNA.compatibility(donorA, $1) } ?? pool.first { $0.id != donorA.id }!
            }
            var issues: [String] = []
            for attempt in 0..<48 {
                try Task.checkCancellation()
                let itemSeed = seed &+ UInt64(attempt) &* 100003
                var scene = attempt % 2 == 0
                    ? SourceComposition.cross(SourceComposition.make(donorA, donorB, category: s, seed: itemSeed, copy: copy, id: "donor-a", fontProfileID: font?.id, shapePreset: shape),
                                              SourceComposition.make(donorB, donorA, category: s, seed: itemSeed ^ 0x444f4e4f52, copy: copy, id: "donor-b", fontProfileID: font?.id, shapePreset: shape), seed: itemSeed, id: "agent")
                    : SourceComposition.make(donorA, donorB, category: s, seed: itemSeed, copy: copy, id: "agent", fontProfileID: font?.id, shapePreset: shape)
                if let font { FontLibrary.apply(font, to: &scene); scene.composition = SourceLayoutDNA.plan(scene) }
                PaperReliefSystems.resolve(in: &scene); GravityTypeSystems.resolve(in: &scene)
                scene.posterCopy = copy; scene.styleCategory = scene.styleCategory ?? s
                issues = CompositionJudges.preflight(scene, copy: copy)
                if issues.isEmpty {
                    return Made(scene: scene, renderSeed: itemSeed, origin: AgentOrigin(mode: mode, style: s, recipe: shape?.recipe.id, seed: seed, briefID: copy.briefID, donors: [donorA.id, donorB.id], fontProfileID: font?.id, arguments: args),
                                copy: copy, title: copy.title, notes: attempt > 0 ? ["Took \(attempt + 1) layout attempts to pass preflight."] : [])
                }
            }
            throw AgentError("No layout from donors \(donorA.id) + \(donorB.id) passed preflight (\(issues.joined(separator: ", "))).", hint: "Try another seed, other donors, a shorter title, or mode=style.")
        case "shape":
            guard let p = try preset() else { throw AgentError("mode=shape needs a 'recipe'.", hint: "Call list_shape_recipes.") }
            var scene = try PosterShapeLibrary.scene(p, pairing: true)
            PaperReliefSystems.resolve(in: &scene); GravityTypeSystems.resolve(in: &scene)
            return Made(scene: scene, renderSeed: seed, origin: AgentOrigin(mode: mode, recipe: p.recipe.id, seed: seed, fontProfileID: font?.id, arguments: args), copy: nil, title: p.recipe.name,
                        notes: ["A shape specimen (the system on its own, with a font sample). For a complete poster with this shape, use mode=source with the same recipe."])
        default:
            throw AgentError("Unknown mode '\(mode)'.", hint: "style = procedural direction with real copy (fast); source = layout bred from two library posters (optionally with a shape recipe); shape = a shape-system specimen.")
        }
    }

    private func create(_ a: AgentArguments, progress: @escaping @Sendable (String) -> Void) async throws -> AgentToolResult {
        let made = try await make(a, progress: progress)
        var project = AgentProject(id: store.newID(title: try a.string("title") ?? made.title), title: try a.string("title") ?? made.title.replacingOccurrences(of: "\n", with: " "),
                                   created: Date(), origin: made.origin, copy: made.copy, revisions: [], current: 0)
        let (rev, _) = try store.commit(&project, scene: made.scene, renderSeed: made.renderSeed, note: "Created (\(made.origin.mode))", operations: nil, previewWidth: try previewWidth(a))
        let issues = preflight(made.scene)
        var data = projectSummary(project).object!
        data["preflight"] = .array(issues.map { .string($0) }); data["notes"] = .array(made.notes.map { .string($0) })
        data["elements"] = .number(Double(made.scene.elements.count))
        if let d = made.origin.donors { data["donors"] = .array(d.map { .string($0) }) }
        return AgentToolResult(summary: "Created \(project.id) r\(rev.number): \(made.origin.mode)\(made.origin.style.map { " · " + $0 } ?? "")\(made.origin.recipe.map { " · " + $0 } ?? "") · seed \(made.origin.seed)" + (issues.isEmpty ? " · preflight clean." : " · preflight: " + issues.joined(separator: ", ")),
                               data: .object(data), images: [AgentImage(url: store.previewURL(project, rev), caption: "\(project.id) r\(rev.number)")])
    }

    private func remake(_ a: AgentArguments, progress: @escaping @Sendable (String) -> Void) async throws -> AgentToolResult {
        var project = try store.load(try a.required("project"))
        var merged = project.origin.arguments?.object ?? [:]
        for (k, v) in a.values where !["project", "note"].contains(k) { merged[k] = v }
        merged["title"] = nil
        if !a.has("seed") { merged["seed"] = .string(String(project.origin.seed)) }
        let made = try await make(AgentArguments(.object(merged)), progress: progress)
        project.origin = made.origin; project.copy = made.copy
        let (rev, _) = try store.commit(&project, scene: made.scene, renderSeed: made.renderSeed, note: try a.string("note") ?? "Remade with " + a.values.keys.filter { $0 != "project" }.sorted().joined(separator: ", "), operations: .object(a.values), previewWidth: try previewWidth(a))
        let issues = preflight(made.scene)
        var data = projectSummary(project).object!; data["preflight"] = .array(issues.map { .string($0) })
        return AgentToolResult(summary: "Remade \(project.id) as r\(rev.number) (earlier revisions kept; manual edits are not carried over)." + (issues.isEmpty ? "" : " Preflight: " + issues.joined(separator: ", ")),
                               data: .object(data), images: [AgentImage(url: store.previewURL(project, rev), caption: "\(project.id) r\(rev.number)")])
    }

    private func sketch(_ a: AgentArguments, progress: @escaping @Sendable (String) -> Void) async throws -> AgentToolResult {
        let count = try a.int("count", range: 2...16) ?? 6
        let base = try a.seed() ?? UInt64.random(in: 1...999_999)
        let group = "sketch-" + String(format: "%06x", UInt32(truncatingIfNeeded: base &* 2654435761))
        var forward = a.values; forward["count"] = nil; forward["rank"] = nil
        let shared = AgentArguments(.object(forward))
        var projects: [AgentProject] = [], failures: [String] = []
        for i in 0..<count {
            try Task.checkCancellation()
            progress("Sketch \(i + 1)/\(count)…")
            do {
                let made = try await make(shared, seedOverride: base &+ UInt64(i) &* 7919, progress: progress)
                var p = AgentProject(id: store.newID(title: made.title), title: made.title.replacingOccurrences(of: "\n", with: " ") + " · \(i + 1)", created: Date(), origin: made.origin, copy: made.copy, revisions: [], current: 0, group: group)
                try store.commit(&p, scene: made.scene, renderSeed: made.renderSeed, note: "Sketch \(i + 1) of \(group)", operations: nil, previewWidth: 700)
                projects.append(p)
            } catch { failures.append("seed \(base &+ UInt64(i) &* 7919): \(error.localizedDescription)") }
        }
        guard !projects.isEmpty else { throw AgentError("Every sketch failed: " + failures.joined(separator: "; ")) }
        var order = Array(projects.indices), consensus: [Double] = projects.map { _ in 0 }, used: [String] = []
        if try a.bool("rank") ?? true, projects.count >= 2 {
            progress("Ranking with the jury…")
            let j = try judge()
            var cards: [AgentScorecard] = []
            for p in projects {
                let (scene, rev) = try store.scene(p)
                cards.append(try await j.score(try PosterRenderer.load(store.previewURL(p, rev)), scene: scene, label: p.id))
            }
            let r = AgentRanking.borda(cards, weights: AgentRanking.defaultWeights(tasteJudges: await j.tasteJudges))
            order = r.order; consensus = r.consensus; used = r.used
        }
        let sheet = environment.home.appending(path: "sheets/\(group).png")
        try AgentSheet.write(order.map { store.previewURL(projects[$0], projects[$0].currentRevision) }, labels: order.enumerated().map { "\($0.offset + 1) · \(projects[$0.element].id)" }, to: sheet)
        let rows: [JSONValue] = order.enumerated().map { rank, i in
            var o = projectSummary(projects[i]).object!; o["rank"] = .number(Double(rank + 1)); o["consensus"] = .num(consensus[i], 3)
            o["preflight"] = .array(((try? store.scene(projects[i]).0).map(preflight) ?? []).map { .string($0) }); return .object(o)
        }
        return AgentToolResult(summary: "\(projects.count) sketches in group \(group)\(used.isEmpty ? "" : ", ranked by " + used.joined(separator: ", ")). Sheet order = rank. Continue with edit_poster on the best project id." + (failures.isEmpty ? "" : " \(failures.count) failed."),
                               data: ["group": .string(group), "sheet": .string(sheet.path), "ranked": .array(rows), "failures": .array(failures.map { .string($0) })],
                               images: [AgentImage(url: sheet, caption: "\(group) ranked")])
    }

    // MARK: Projects

    private func listProjects(_ a: AgentArguments) throws -> AgentToolResult {
        let limit = try a.int("limit", range: 1...500) ?? 25, group = try a.string("group")
        let all = store.all().filter { group == nil || $0.group == group }
        return AgentToolResult(summary: "\(all.count) project(s) in \(environment.home.path).", data: ["projects": .array(all.prefix(limit).map(projectSummary))])
    }

    private func describe(_ a: AgentArguments) throws -> AgentToolResult {
        let p = try store.load(try a.required("project"))
        let (scene, rev) = try store.scene(p, revision: try a.int("revision"))
        var data = AgentScene.describe(scene, verbose: try a.bool("verbose") ?? false).object!
        data["project"] = .string(p.id); data["revision"] = .number(Double(rev.number)); data["preflight"] = .array(preflight(scene).map { .string($0) })
        data["operations"] = .array(AgentScene.operations.map { .string($0) })
        let roles = Dictionary(grouping: scene.elements, by: AgentScene.role).mapValues(\.count).sorted { $0.key < $1.key }.map { "\($0.key)×\($0.value)" }.joined(separator: ", ")
        return AgentToolResult(summary: "\(p.id) r\(rev.number): \(scene.elements.count) elements (\(roles)) on \(scene.background), aspect \(String(format: "%.3f", scene.aspect)).", data: .object(data))
    }

    private func edit(_ a: AgentArguments) throws -> AgentToolResult {
        var p = try store.load(try a.required("project"))
        guard let ops = a.values["ops"]?.array, !ops.isEmpty else { throw AgentError("edit_poster needs 'ops': a non-empty array of operations.", hint: "e.g. [{\"op\":\"set_color\",\"target\":\"role:title\",\"color\":\"#c8102e\"}]. Operations: " + AgentScene.operations.joined(separator: ", ")) }
        let (loaded, rev) = try store.scene(p)
        var scene = loaded
        let outcome = try AgentScene.apply(ops, to: &scene)
        if let origin = scene.composition?.description { scene.composition = CompositionPlan.scene(scene, origin: "agent-edit", style: scene.styleCategory); scene.composition?.description = origin }
        let note = try a.string("note") ?? ops.compactMap { $0["op"]?.string }.joined(separator: ", ")
        let (next, _) = try store.commit(&p, scene: scene, renderSeed: rev.renderSeed, note: note, operations: .array(ops), previewWidth: try previewWidth(a))
        let issues = preflight(scene), warnings = AgentScene.warnings(scene)
        let table = AgentScene.describe(scene)["elements"]?.array ?? []
        let changed: [JSONValue] = (outcome.changed.union(outcome.added)).sorted().compactMap { $0 < table.count ? table[$0] : nil }
        let data: JSONValue = ["project": .string(p.id), "revision": .number(Double(next.number)), "parent": .number(Double(rev.number)), "changed": .array(changed),
                               "added": .array(outcome.added.map { .number(Double($0)) }), "removed": .number(Double(outcome.removed)),
                               "preflight": .array(issues.map { .string($0) }), "warnings": .array(warnings.map { .string($0) }), "notes": .array(outcome.notes.map { .string($0) }),
                               "preview": .string(store.previewURL(p, next).path)]
        var tail: String = issues.isEmpty ? " Preflight clean." : " Preflight: " + issues.joined(separator: ", ") + "."
        if !warnings.isEmpty { tail += " Warnings: " + warnings.joined(separator: " ") }
        if !outcome.notes.isEmpty { tail += " " + outcome.notes.joined(separator: " ") }
        return AgentToolResult(summary: "\(p.id) r\(rev.number) → r\(next.number): \(ops.count) op(s), \(outcome.changed.count) changed, \(outcome.added.count) added, \(outcome.removed) removed." + tail,
                               data: data, images: [AgentImage(url: store.previewURL(p, next), caption: "\(p.id) r\(next.number)")])
    }

    func sceneFile(_ url: URL) throws -> (StyleGenome, UInt64) {
        let data = try Data(contentsOf: url), d = JSONDecoder()
        if let h = try? d.decode(HybridScene.self, from: data) { return (h.genome, h.seed) }
        if let v = try? d.decode(TypeSystemVariant.self, from: data) { return (try v.replay(), 0) }
        if let g = try? d.decode(StyleGenome.self, from: data) {
            // Exports keep their render seed beside the genome.
            let sibling = url.deletingLastPathComponent().appending(path: "reproduction.json")
            let seed = (try? JSONDecoder().decode([String: String].self, from: Data(contentsOf: sibling)))?["seed"].flatMap { UInt64($0) } ?? 0
            return (g, seed)
        }
        throw AgentError("\(url.lastPathComponent) is not a PosterLab scene.", hint: "Accepted: genome.json / winner.json / scene-rNNN.json (StyleGenome), source-study candidates (HybridScene), type-system variations. For a study's generation.json use inspect_study + import_scene with candidate.")
    }

    /// The image (and scene, when there is one) a view/critique call refers to.
    private func subject(_ a: AgentArguments, width: Int) throws -> (CGImage, StyleGenome?, String, URL?) {
        if let id = try a.string("project") {
            let p = try store.load(id); let (scene, rev) = try store.scene(p, revision: try a.int("revision"))
            guard let stage = ConstructionStage(rawValue: try a.string("stage") ?? "finished") else { throw AgentError("stage must be blockout, primary, secondary or finished.") }
            if width == 700, stage == .finished, let img = try? PosterRenderer.load(store.previewURL(p, rev)), img.width == 700 { return (img, scene, "\(p.id) r\(rev.number)", store.folder(p.id)) }
            return (try LibrarySceneRenderer.render(scene, width: width, seed: rev.renderSeed, stage: stage), scene, "\(p.id) r\(rev.number)", store.folder(p.id))
        }
        if let path = try a.string("path") {
            let url = environment.path(path)
            guard FileManager.default.fileExists(atPath: url.path) else { throw AgentError("No file at \(url.path).") }
            if url.pathExtension.lowercased() == "json" { let (scene, seed) = try sceneFile(url); return (try LibrarySceneRenderer.render(scene, width: width, seed: seed), scene, url.lastPathComponent, nil) }
            var image = try PosterRenderer.load(url)
            if image.width != width, let scaled = AgentSheet.scale(image, width: width) { image = scaled }
            return (image, nil, url.lastPathComponent, nil)
        }
        throw AgentError("Give 'project' (an agent project id) or 'path' (a PNG, or a scene JSON).")
    }

    private func view(_ a: AgentArguments) throws -> AgentToolResult {
        var width = try a.int("width", range: 200...4000) ?? 700
        let region = try a.values["region"].map { r -> UnitBox in
            let x = AgentArguments(r)
            let box = UnitBox(x: try x.double("x", range: 0...1) ?? 0, y: try x.double("y", range: 0...1) ?? 0, width: try x.double("width", range: 0.02...1) ?? 0.5, height: try x.double("height", range: 0.02...1) ?? 0.5)
            guard box.x + box.width <= 1.0001, box.y + box.height <= 1.0001 else { throw AgentError("region must lie inside the page (x+width ≤ 1, y+height ≤ 1).") }
            return box
        }
        if let region, !a.has("width") { width = min(4000, max(700, Int(900 / region.width))) }
        let (image, _, label, folder) = try subject(a, width: width)
        var out = image
        if let region {
            let rect = CGRect(x: region.x * Double(image.width), y: region.y * Double(image.height), width: region.width * Double(image.width), height: region.height * Double(image.height)).integral
            guard let crop = image.cropping(to: rect) else { throw AgentError("Could not crop that region.") }
            out = crop
        }
        let dir = (folder ?? environment.home).appending(path: "views")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appending(path: "view-\(Int(Date().timeIntervalSince1970 * 1000) % 100_000_000).png")
        try PosterRenderer.png(out, to: url)
        return AgentToolResult(summary: "\(label) at \(image.width)×\(image.height)\(region.map { String(format: ", region x %.2f y %.2f w %.2f h %.2f", $0.x, $0.y, $0.width, $0.height) } ?? ""). Phone-size check: the full poster at 700 px is roughly what a phone shows.",
                               data: ["image": .string(url.path), "width": .number(Double(out.width)), "height": .number(Double(out.height))], images: [AgentImage(url: url, caption: label)])
    }

    private func critique(_ a: AgentArguments) async throws -> AgentToolResult {
        let (image, scene, label, _) = try subject(a, width: 700)
        let card = try await judge().score(image, scene: scene, label: label)
        var data = AgentRanking.card(card, full: true, allAffinities: try a.bool("full") ?? false).object!
        let advice = AgentRanking.advice(card)
        data["advice"] = .array(advice.map { .string($0) })
        data["note"] = "Scores are 0–1 machine proxies (Vision, OCR, authored craft rules, style/designer affinity heads, and the user's own taste models when trained). Use them to find problems and to rank alternatives, not as proof of quality."
        return AgentToolResult(summary: "\(label): " + advice.joined(separator: " "), data: .object(data))
    }

    private func rank(_ a: AgentArguments) async throws -> AgentToolResult {
        var items: [(String, CGImage, StyleGenome?, URL)] = []
        for id in try a.strings("projects") ?? [] {
            let p = try store.load(id); let (scene, rev) = try store.scene(p)
            items.append(("\(p.id)", try PosterRenderer.load(store.previewURL(p, rev)), scene, store.previewURL(p, rev)))
        }
        if let group = try a.string("group") { for p in store.all() where p.group == group { let (scene, rev) = try store.scene(p); items.append((p.id, try PosterRenderer.load(store.previewURL(p, rev)), scene, store.previewURL(p, rev))) } }
        for path in try a.strings("paths") ?? [] {
            let url = environment.path(path)
            if url.pathExtension.lowercased() == "json" {
                let (scene, seed) = try sceneFile(url)
                let img = try LibrarySceneRenderer.render(scene, width: 700, seed: seed)
                let png = environment.home.appending(path: "views/rank-\(items.count)-\(url.deletingPathExtension().lastPathComponent).png")
                try FileManager.default.createDirectory(at: png.deletingLastPathComponent(), withIntermediateDirectories: true); try PosterRenderer.png(img, to: png)
                items.append((path, img, scene, png))
            } else {
                var img = try PosterRenderer.load(url); if img.width != 700, let s = AgentSheet.scale(img, width: 700) { img = s }
                items.append((path, img, nil, url))
            }
        }
        guard items.count >= 2 else { throw AgentError("rank_posters needs at least two posters.", hint: "Pass projects (ids), group (a sketch group), or paths (PNG or scene JSON).") }
        guard items.count <= 64 else { throw AgentError("Rank at most 64 posters at once.") }
        let j = try judge()
        var cards: [AgentScorecard] = []
        for item in items { cards.append(try await j.score(item.1, scene: item.2, label: item.0)) }
        let tasteJudges = await j.tasteJudges
        let weights = try a.numbers("weights") ?? AgentRanking.defaultWeights(tasteJudges: tasteJudges)
        let r = AgentRanking.borda(cards, weights: weights)
        guard !r.used.isEmpty else { throw AgentError("None of the weighted judges separated these posters.", hint: "Call list_judges for names; judges that score all posters the same are skipped.") }
        let sheet = environment.home.appending(path: "sheets/rank-\(Int(Date().timeIntervalSince1970)).png")
        try AgentSheet.write(r.order.map { items[$0].3 }, labels: r.order.enumerated().map { "\($0.offset + 1) · \(items[$0.element].0)" }, to: sheet)
        let rows: [JSONValue] = r.order.enumerated().map { rank, i in
            var o = AgentRanking.card(cards[i], full: false).object!; o["rank"] = .number(Double(rank + 1)); o["consensus"] = .num(r.consensus[i], 3); return .object(o)
        }
        return AgentToolResult(summary: "Ranked \(items.count): " + r.order.prefix(5).enumerated().map { "\($0.offset + 1). \(items[$0.element].0) (\(String(format: "%.2f", r.consensus[$0.element])))" }.joined(separator: ", ") + ". Judges: " + r.used.joined(separator: ", ") + ".",
                               data: ["ranking": .array(rows), "judgesUsed": .array(r.used.map { .string($0) }), "sheet": .string(sheet.path)], images: [AgentImage(url: sheet, caption: "ranked")])
    }

    private func history(_ a: AgentArguments) throws -> AgentToolResult {
        let p = try store.load(try a.required("project"))
        let rows: [JSONValue] = p.revisions.map { r in
            ["revision": .number(Double(r.number)), "parent": r.parent.map { .number(Double($0)) } ?? .null, "note": .string(r.note), "created": .string(ISO8601DateFormatter().string(from: r.created)),
             "operations": .number(Double(r.operations?.array?.count ?? 0)), "preview": .string(store.previewURL(p, r).path), "current": .bool(r.number == p.current)]
        }
        return AgentToolResult(summary: "\(p.id): \(p.revisions.count) revision(s), current r\(p.current).", data: ["project": projectSummary(p), "revisions": .array(rows), "origin": (try? JSONValue.from(p.origin)) ?? .null])
    }

    private func revert(_ a: AgentArguments) throws -> AgentToolResult {
        var p = try store.load(try a.required("project"))
        let number = try a.int("revision") ?? (p.currentRevision.parent ?? p.current)
        let (scene, rev) = try store.scene(p, revision: number)
        let (next, _) = try store.commit(&p, scene: scene, renderSeed: rev.renderSeed, note: "Revert to r\(rev.number)", operations: nil, previewWidth: 700)
        return AgentToolResult(summary: "\(p.id): r\(next.number) restores r\(rev.number). Nothing was deleted.", data: projectSummary(p), images: [AgentImage(url: store.previewURL(p, next), caption: "\(p.id) r\(next.number)")])
    }

    private func export(_ a: AgentArguments) throws -> AgentToolResult {
        let p = try store.load(try a.required("project"))
        let (scene, rev) = try store.scene(p, revision: try a.int("revision"))
        let width = try a.int("width", range: 600...4000) ?? 3508
        let out = try a.string("out").map { try environment.outputFolder($0) } ?? store.folder(p.id).appending(path: "export-r\(rev.number)-\(width)")
        guard !FileManager.default.fileExists(atPath: out.appending(path: "poster.png").path) else { throw AgentError("\(out.path) already has an export.", hint: "Choose another 'out' folder; exports are never overwritten.") }
        let image = try LibrarySceneRenderer.render(scene, width: width, seed: rev.renderSeed)
        try environment.startOutput(out)
        try PosterRenderer.png(image, to: out.appending(path: "poster.png"))
        try LibrarySceneRenderer.pdf(scene, to: out.appending(path: "poster.pdf"), seed: rev.renderSeed)
        try LibraryRaster.write(scene, to: out.appending(path: "genome.json"))
        try scene.composition?.write(to: out)
        try LibraryRaster.write(PosterColorAnalyzer().analyze(image), to: out.appending(path: "colors.json"))
        try LibraryRaster.write(["project": p.id, "revision": String(rev.number), "seed": String(rev.renderSeed), "width": String(width), "origin": p.origin.mode, "brief": p.origin.briefID ?? ""], to: out.appending(path: "reproduction.json"))
        let files = ((try? FileManager.default.contentsOfDirectory(atPath: out.path)) ?? []).sorted()
        return AgentToolResult(summary: "Exported \(p.id) r\(rev.number): \(width)×\(image.height) PNG, outlined vector PDF, editable genome, colours → \(out.path)",
                               data: ["folder": .string(out.path), "files": .array(files.map { .string(out.appending(path: $0).path) }), "png": .string(out.appending(path: "poster.png").path), "pdf": .string(out.appending(path: "poster.pdf").path)])
    }

    private func importScene(_ a: AgentArguments) throws -> AgentToolResult {
        let url = environment.path(try a.required("path", hint: "A scene JSON (genome.json, winner.json, a source-study candidate) or a study's generation.json with 'candidate'."))
        guard FileManager.default.fileExists(atPath: url.path) else { throw AgentError("No file at \(url.path).") }
        var scene: StyleGenome, seed: UInt64, title: String
        if url.lastPathComponent == "generation.json" {
            let g = try EvolutionEngine.load(url)
            let id = try a.required("candidate", hint: "Candidate ids are listed by inspect_study.")
            guard let c = g.candidates.first(where: { $0.id == id }) else { throw AgentError("No candidate '\(id)' in that generation.", hint: "Call inspect_study.") }
            guard c.genome.renderStyle != nil else { throw AgentError("Candidate \(id) is a procedural motif poster, not an editable scene.", hint: "export it with the CLI (poster render --resume … --pick \(id)), or run_study with 'styles' so candidates use style directions, which import as scenes.") }
            scene = SourceComposition.recipe(c.genome, copy: g.copy); scene.posterCopy = g.copy; seed = c.genome.seed; title = g.copy.title
        } else {
            (scene, seed) = try sceneFile(url); title = scene.posterCopy?.title ?? url.deletingLastPathComponent().lastPathComponent
        }
        let name = try a.string("title") ?? title.replacingOccurrences(of: "\n", with: " ")
        var p = AgentProject(id: store.newID(title: name), title: name, created: Date(), origin: AgentOrigin(mode: "import", seed: seed, briefID: scene.posterCopy?.briefID, source: url.path), copy: scene.posterCopy, revisions: [], current: 0)
        let (rev, _) = try store.commit(&p, scene: scene, renderSeed: seed, note: "Imported \(url.lastPathComponent)", operations: nil, previewWidth: 700)
        var data = projectSummary(p).object!; data["preflight"] = .array(preflight(scene).map { .string($0) })
        return AgentToolResult(summary: "Imported \(url.lastPathComponent) as \(p.id) (\(scene.elements.count) elements). It is now editable.", data: .object(data), images: [AgentImage(url: store.previewURL(p, rev), caption: p.id)])
    }

    // MARK: Studies

    private func study(_ a: AgentArguments, progress: @escaping @Sendable (String) -> Void) async throws -> AgentToolResult {
        let previous = try a.string("resume").map { try EvolutionEngine.load(environment.path($0)) }
        var settings = previous?.settings ?? EvolutionSettings()
        if let s = try a.seed() { settings.seed = s } else if previous == nil { settings.seed = UInt64.random(in: 1...999_999) }
        settings.count = try a.int("count", range: 4...32) ?? (previous == nil ? 8 : settings.count)
        settings.width = 700
        var weights = previous?.settings.judgeWeights ?? StyleCatalog.balancedWeights
        if let styles = try a.strings("styles") {
            for s in styles { guard let c = StyleCatalog.categories.first(where: { $0.id == s || $0.name == s }) else { throw AgentError("Unknown style '\(s)'.") }; weights[c.name] = 1 }
        } else if previous == nil { for c in StyleCatalog.categories { weights[c.name] = 0.5 } }
        for (k, v) in try a.numbers("mix") ?? [:] { weights[k] = v }
        let taste = try TasteJudgeBank(directory: environment.taste)
        if try a.bool("use_taste") ?? true { for m in taste.members where weights["Taste / " + m.name] == nil { weights["Taste / " + m.name] = 2 } }
        settings.judgeWeights = weights; settings.tasteDirectory = environment.taste
        try settings.validate()
        let rounds = try a.int("rounds", range: 1...10) ?? 1
        var copy = try previous?.copy ?? resolveCopy(a, seed: settings.seed)
        if previous != nil, a.has("brief") || a.has("copy") { copy = try resolveCopy(a, seed: settings.seed) }
        let chosen = try a.string("out").map { try environment.outputFolder($0) }
        let out = chosen ?? previous?.directory.deletingLastPathComponent() ?? environment.home.appending(path: "studies/study-\(settings.seed)")
        if let chosen { try environment.startOutput(chosen) }
        let engine = try EvolutionEngine(referenceURL: previous?.referenceURL ?? Resources.referenceURL, cropReference: previous?.cropReference ?? true)
        var current = previous
        let picks = Set(try a.strings("picks") ?? [])
        for round in 0..<rounds {
            try Task.checkCancellation()
            progress("Round \(round + 1)/\(rounds): rendering and judging \(settings.count) candidates…")
            current = try await engine.generate(copy: copy, settings: settings, previous: current, selectedIDs: round == 0 ? picks : [], output: out)
        }
        guard let g = current else { throw AgentError("The study produced no generation.") }
        return try studySummary(g, limit: try a.int("limit", range: 1...32) ?? 8, verb: "Study round \(g.number) done")
    }

    private func inspectStudy(_ a: AgentArguments) throws -> AgentToolResult {
        let url = environment.path(try a.required("path", hint: "A generation.json from run_study or the Studio."))
        return try studySummary(try EvolutionEngine.load(url), limit: try a.int("limit", range: 1...64) ?? 12, verb: "Generation \(url.deletingLastPathComponent().lastPathComponent)")
    }

    private func studySummary(_ g: Generation, limit: Int, verb: String) throws -> AgentToolResult {
        let file = g.directory.appending(path: "generation.json"), sheet = g.directory.appending(path: "contact-sheet.png")
        let rows: [JSONValue] = g.candidates.sorted { $0.rank < $1.rank }.prefix(limit).map { c in
            let top = c.scores.filter { !$0.key.hasPrefix("Designer / ") }.sorted { $0.value > $1.value }.prefix(6)
            return ["id": .string(c.id), "rank": .number(Double(c.rank)), "consensus": .num(c.consensus, 3), "style": .str(c.genome.renderStyle), "image": .string(c.imageURL.path),
                    "parent": .str(c.parentID), "editable": .bool(c.genome.renderStyle != nil), "topScores": .object(Dictionary(uniqueKeysWithValues: top.map { ($0.key, JSONValue.num($0.value, 3)) }))]
        }
        var images: [AgentImage] = []
        if FileManager.default.fileExists(atPath: sheet.path) { images.append(AgentImage(url: sheet, caption: "contact sheet")) }
        else if let best = g.candidates.min(by: { $0.rank < $1.rank }) { images.append(AgentImage(url: best.imageURL, caption: best.id)) }
        return AgentToolResult(summary: "\(verb): \(g.candidates.count) candidates; winner \(g.candidates.min { $0.rank < $1.rank }?.id ?? "?"). Evolve with run_study resume=\(file.path) picks=[ids]; make one editable with import_scene path=\(file.path) candidate=ID.",
                               data: ["generation": .string(file.path), "round": .number(Double(g.number)), "copy": (try? JSONValue.from(g.copy)) ?? .null, "candidates": .array(rows), "notes": .array(g.notes.prefix(4).map { .string($0) })],
                               images: images)
    }
}

/// Contact sheets with numbered labels, for comparing posters in one image.
enum AgentSheet {
    static func scale(_ image: CGImage, width: Int) -> CGImage? {
        let height = max(1, Int(Double(image.height) * Double(width) / Double(image.width)))
        guard let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        ctx.interpolationQuality = .high; ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height)); return ctx.makeImage()
    }
    static func write(_ urls: [URL], labels: [String], to url: URL) throws {
        let images = try urls.map { try PosterRenderer.load($0) }
        guard !images.isEmpty else { throw AgentError("Nothing to put on a sheet.") }
        let columns = images.count <= 4 ? images.count : images.count <= 9 ? 3 : 4
        let rows = (images.count + columns - 1) / columns
        let cell = 360, label = 26, gap = 14
        let heights = images.map { Int(Double(cell) * Double($0.height) / Double($0.width)) }
        let rowHeights = (0..<rows).map { r in heights[(r * columns)..<min(heights.count, (r + 1) * columns)].max() ?? cell }
        let w = columns * cell + (columns + 1) * gap, h = rowHeights.reduce(0, +) + rows * label + (rows + 1) * gap
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw PosterError.render }
        ctx.setFillColor(CGColor(red: 0.12, green: 0.12, blue: 0.12, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
        ctx.interpolationQuality = .high
        let font = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, 15, nil)
        for (i, image) in images.enumerated() {
            let col = i % columns, row = i / columns
            let cellHeight = rowHeights[row]
            let x = gap + col * (cell + gap), top = gap + rowHeights[..<row].reduce(0, +) + row * (label + gap)
            let ih = Int(Double(cell) * Double(image.height) / Double(image.width))
            ctx.draw(image, in: CGRect(x: x, y: h - top - ih, width: cell, height: ih))
            let text = NSAttributedString(string: i < labels.count ? labels[i] : "\(i + 1)", attributes: [.font: font, .foregroundColor: CGColor(red: 0.92, green: 0.91, blue: 0.88, alpha: 1)])
            ctx.textPosition = CGPoint(x: x, y: h - top - cellHeight - 18)
            CTLineDraw(CTLineCreateWithAttributedString(text), ctx)
        }
        guard let out = ctx.makeImage() else { throw PosterError.render }
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try PosterRenderer.png(out, to: url)
    }
}
