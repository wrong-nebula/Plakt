import Foundation

enum AgentGuide {
    static let text = """
    # PosterLab for agents

    PosterLab makes posters as editable vector scenes: a list of elements (text lines, shapes, images) on a page.
    You can create a poster, read it as a table, change it with small operations, look at it, have it judged, and export it for print.
    Everything runs locally. Every edit makes a new revision; nothing is ever overwritten.

    ## The loop
    1. Content: `list_briefs` — real events with title, venue, dates, organiser. Use a brief id, or pass real copy yourself. Never invent events, dates or venues.
    2. Direction: `list_styles` (14 procedural directions) and `list_shape_recipes` (generative shape systems). `list_fonts` for type.
    3. Explore: `sketch_variations` makes several candidates (different seeds) and ranks them with the jury. Or `create_poster` for one.
    4. Look: every create/edit returns a preview image. `view_poster` with `region` zooms into details (the loupe).
    5. Read: `describe_poster` lists every element with index, id, role, text, bounds, colour, font.
    6. Change: `edit_poster` with an `ops` array, e.g.
       [{"op":"set_color","target":"role:title","color":"#c8102e"}, {"op":"move","target":3,"dy":-0.05}]
    7. Check: `critique_poster` (measured problems + plain advice), `rank_posters` to choose between alternatives.
    8. Ship: `export_poster` writes a 3508 px PNG (A4 at 300 dpi), an outlined vector PDF and the editable genome.

    ## Modes for create_poster
    - `style`: a full poster in one of the 14 directions, with your copy. Fast, needs nothing else.
    - `source`: a layout bred from two real posters in the user's library (like the Studio's source studies); add `recipe` to put a shape system in it.
    - `shape`: a specimen of one shape recipe with a font sample; for exploring parameters and looks before using it in `source`.
    `remake_poster` reruns a project's recipe with changes (new seed, other style, shape parameters) as a new revision.

    ## Coordinates and targets
    - x, y = top-left corner; width, height — all as fractions of the page (0–1). aspect = height / width (A4 ≈ 1.414). Rotation in degrees.
    - Roles come from element ids: `title` (display type), `meta` (supporting information — checked for size, contrast and margins), `art`/`glyph`/`ring` (decorative type), shapes have their own roles.
    - A `target` is an index (3), an id ("title:0"), "role:meta", "text:BIENNALE", "kind:shape", "color:#1d1d1b", "all", or a list of these.
    - Index numbers shift after `delete`; call `describe_poster` again after deleting.

    ## Edit operations
    set_text, replace_text, set_copy (updates the poster's stored copy and the text that shows it), set_color, recolor (swap one ink everywhere),
    set_background, move (x/y absolute or dx/dy relative), resize (scale, or width/height; anchor center|topleft), set_bounds, rotate (degrees, or by),
    set_font (font_profile from list_fonts, or font_name), set_tracking, set_alignment, set_z, set_outline, delete, duplicate,
    add_text (text, x, y, width, height, role title|meta|art, colour, font), add_shape (rectangle, ellipse, disc, triangle, quarter-disc, quarter-ring, crescent, …),
    set_field (any element property by name — the escape hatch), set_scene_field (aspect, background, font, tracking, textScale).

    ## Taste and judging
    - The jury is mechanical: Vision feature prints, OCR, authored craft rules (legibility, spacing, hierarchy, margins, contrast, palette discipline),
      style and designer affinity heads, and — most important — the user's own taste models (`Taste / …`, trained on their yes/no votes) when they exist.
    - Use `rank_posters` / `sketch_variations` to pick between alternatives; don't pick by your own eye alone. Scores are relative proxies, not proof.
    - House taste: posters are read at phone size first; calm print palettes (2–4 inks, paper grounds); no neon or "electro" colours on posters.

    ## Studies
    `run_study` runs the Studio's evolution (render → judge → evolve) for 1–10 rounds and returns the contact sheet. `inspect_study` reads any
    generation.json; `import_scene` turns a study candidate, a curated genome.json or a source-study scene into an editable project.

    ## The Studio, live
    The user may have PosterLab Agent Studio open (built by scripts/build-agent-studio.sh). `open_in_studio` shows a project there in a poster window
    that follows every revision you make, or opens the shape library on the project's recipe
    (view=shape_library) or a study (path=…/generation.json). It starts the app if needed and returns a PNG of the window.
    `studio_state` tells you what the user has open and selected: in a poster window the selected element indices come with their
    describe_poster rows, so "make this bigger" means those targets. It never steals a sheet the user is using unless you pass replace=true.

    ## Files
    Projects live in the agent folder (see `guide` status → projects): one folder per poster with project.json, scene-rNNN.json and preview-rNNN.png.
    Paths you pass may be absolute or relative to the PosterLab root.
    """
}

extension PosterAgent {
    public static let tools: [AgentToolSpec] = {
        let project = Schema.string("Agent project id, e.g. p-biennale-3fa2 (from create_poster or list_projects).")
        let revision = Schema.integer("Revision number; default is the current one.", min: 1)
        let previewWidth = Schema.integer("Preview width in px (default 700, phone-size).", min: 300, max: 1600)
        let copy = Schema.object(["title": Schema.string("Headline; \\n for a line break."), "subtitle": Schema.string("Programme / subtitle."),
                                  "institution": Schema.string("Venue or organiser."), "footer": Schema.string("Dates and info line.")])
        let make: [String: JSONValue] = [
            "mode": Schema.string("style = full poster in a direction (default); source = layout bred from two library posters; shape = a shape-recipe specimen.", options: ["style", "source", "shape"]),
            "style": Schema.string("Style direction id from list_styles (random if omitted)."),
            "recipe": Schema.string("Shape recipe id from list_shape_recipes (mode=shape, or the shape inside mode=source)."),
            "look": Schema.string("A named look of the recipe (sets parameters and inks)."),
            "shape_parameters": Schema.numberMap("Recipe parameter overrides, id → value (ranges from list_shape_recipes with id)."),
            "inks": Schema.strings("Shape inks, #rrggbb, shape colour first."),
            "text": Schema.string("Text for type-driven shape recipes (contour, paper relief, fallen letters)."),
            "placement": Schema.string("How type sits on the shape system.", options: ["anchored", "mixed", "free"]),
            "brief": Schema.string("Content brief id from list_briefs, or 'random' (a real brief chosen by seed)."),
            "copy": copy,
            "seed": Schema.integer("Seed; same arguments + seed = same poster.", min: 0),
            "font_profile": Schema.string("Font profile id from list_fonts."),
            "donors": Schema.strings("mode=source: two library poster ids to breed from (random compatible pair if omitted)."),
            "preview_width": previewWidth,
        ]
        var create = make; create["title"] = Schema.string("Project title (default: the poster's headline).")
        var sketch = make
        sketch["count"] = Schema.integer("How many variations (2–16, default 6).", min: 2, max: 16)
        sketch["rank"] = Schema.boolean("Rank them with the jury (default true).")
        sketch["preview_width"] = nil
        var remake = make; remake["project"] = project; remake["note"] = Schema.string("Revision note.")
        let subject: [String: JSONValue] = ["project": project, "revision": revision, "path": Schema.string("Instead of a project: a PNG, or a scene JSON (genome.json, winner.json…).")]
        var view = subject
        view["width"] = Schema.integer("Render width in px (default 700; larger when zooming).", min: 200, max: 4000)
        view["region"] = Schema.object(["x": Schema.number("Left, 0–1"), "y": Schema.number("Top, 0–1"), "width": Schema.number("0.02–1"), "height": Schema.number("0.02–1")])
        view["stage"] = Schema.string("Construction pass to show.", options: ["blockout", "primary", "secondary", "finished"])
        var critique = subject; critique["full"] = Schema.boolean("Include every style and designer affinity.")
        let op = Schema.object([
            "op": Schema.string("Operation.", options: AgentScene.operations),
            "target": Schema.any("Element(s): index, id, 'role:title', 'text:WORD', 'kind:shape', 'color:#hex', 'all', or a list."),
        ], additional: true)

        return [
            AgentToolSpec(name: "guide", title: "How to use PosterLab", description: "Read first. The workflow, concepts (scenes, roles, coordinates), edit operations, house taste, and where files live. Returns live status: library, taste profiles, project count.", inputSchema: Schema.object([:]), readOnly: true),
            AgentToolSpec(name: "list_briefs", title: "List real event copy", description: "Real exhibitions, concerts and programmes with title, subtitle, venue, dates and footer. Use a brief id in create_poster so the poster carries believable, sourced copy.",
                          inputSchema: Schema.object(["query": Schema.string("Search text (venue, city, title…)."), "kind": Schema.string("Filter by kind."), "limit": Schema.integer("Max rows (default 40).", min: 1, max: 200)]), readOnly: true),
            AgentToolSpec(name: "list_styles", title: "List style directions", description: "The 14 procedural poster directions (Swiss, Bauhaus, kinetic type, halftone, guilloche…) with definitions.", inputSchema: Schema.object([:]), readOnly: true),
            AgentToolSpec(name: "list_shape_recipes", title: "List shape systems", description: "Generative shape recipes (contours, physics letters, packing, relief…). Pass id or details=true for parameter ranges and named looks.",
                          inputSchema: Schema.object(["query": Schema.string("Search name, tags, logic."), "group": Schema.string("Filter by group."), "id": Schema.string("One recipe, with full details."), "details": Schema.boolean("Include parameters and looks."), "limit": Schema.integer("Max rows (default 60).", min: 1, max: 300)]), readOnly: true),
            AgentToolSpec(name: "list_fonts", title: "List fonts", description: "Local font profiles (family · weight · width) usable in create_poster and set_font.",
                          inputSchema: Schema.object(["query": Schema.string("Search family or id."), "category": Schema.string("e.g. sans, serif, display."), "limit": Schema.integer("Max rows (default 60).", min: 1, max: 300)]), readOnly: true),
            AgentToolSpec(name: "list_judges", title: "List judges", description: "Judge names for rank_posters weights and run_study mix: craft rules, style heads, designer affinities, and the user's taste jurors with vote counts.", inputSchema: Schema.object([:]), readOnly: true),
            AgentToolSpec(name: "create_poster", title: "Create a poster", description: "Makes a new poster project and returns its preview, id and preflight issues. Default mode=style with a real brief. Same arguments + seed reproduce the poster.",
                          inputSchema: Schema.object(create), readOnly: false),
            AgentToolSpec(name: "sketch_variations", title: "Sketch and rank variations", description: "Makes 2–16 posters from the same arguments with different seeds, ranks them with the jury (the user's taste first), and returns one labelled contact sheet in rank order. Each sketch is its own project.",
                          inputSchema: Schema.object(sketch), readOnly: false, slow: true),
            AgentToolSpec(name: "remake_poster", title: "Remake with changes", description: "Reruns a project's creation with some arguments changed (seed, style, recipe parameters, look, brief…) as a new revision. Manual edits are not carried over; earlier revisions stay.",
                          inputSchema: Schema.object(remake, required: ["project"]), readOnly: false),
            AgentToolSpec(name: "list_projects", title: "List projects", description: "Agent poster projects, newest first, with current revision and preview path.",
                          inputSchema: Schema.object(["limit": Schema.integer("Max rows (default 25).", min: 1, max: 500), "group": Schema.string("Only one sketch group.")]), readOnly: true),
            AgentToolSpec(name: "describe_poster", title: "Read a poster's elements", description: "The poster as a table: every element's index, id, role, kind, text, bounds (fractions, top-left origin), colour, font, rotation, z; plus background, palette, copy and preflight.",
                          inputSchema: Schema.object(["project": project, "revision": revision, "verbose": Schema.boolean("Include procedural geometry parameters.")], required: ["project"]), readOnly: true),
            AgentToolSpec(name: "edit_poster", title: "Edit a poster", description: "Applies a list of operations to the current revision, saves a new revision and returns its preview, the changed elements, preflight and warnings. All operations apply or none do. See guide for the operation list.",
                          inputSchema: Schema.object(["project": project, "ops": ["type": "array", "items": op, "description": "Operations in order, e.g. [{\"op\":\"set_text\",\"target\":\"role:title\",\"text\":\"NEW\"}]"], "note": Schema.string("Revision note."), "preview_width": previewWidth], required: ["project", "ops"]), readOnly: false),
            AgentToolSpec(name: "view_poster", title: "Look at a poster", description: "Renders a project revision, a scene JSON or a PNG. Use region to zoom into a detail at full resolution (a loupe for type, edges and overlaps).",
                          inputSchema: Schema.object(view), readOnly: true),
            AgentToolSpec(name: "critique_poster", title: "Critique a poster", description: "Measures a poster: craft scores, OCR read-back, preflight problems, style/designer affinity, the user's taste score, and plain-language advice on what to fix.",
                          inputSchema: Schema.object(critique), readOnly: true),
            AgentToolSpec(name: "rank_posters", title: "Rank posters", description: "Ranks 2–64 posters with a weighted Borda jury (default: the user's taste ×2 plus craft judges) and returns a contact sheet in rank order.",
                          inputSchema: Schema.object(["projects": Schema.strings("Project ids."), "group": Schema.string("A sketch group."), "paths": Schema.strings("PNG files or scene JSONs."), "weights": Schema.numberMap("Judge → weight (see list_judges).")]), readOnly: true),
            AgentToolSpec(name: "poster_history", title: "Revision history", description: "A project's revisions with notes, operation counts and previews, plus how it was first made.",
                          inputSchema: Schema.object(["project": project], required: ["project"]), readOnly: true),
            AgentToolSpec(name: "revert_poster", title: "Revert", description: "Makes a new revision equal to an earlier one (default: the current revision's parent). Nothing is deleted.",
                          inputSchema: Schema.object(["project": project, "revision": revision], required: ["project"]), readOnly: false),
            AgentToolSpec(name: "export_poster", title: "Export for print", description: "Writes a print PNG (default 3508 px wide, A4 at 300 dpi), an A4 vector PDF with outlined type, the editable genome, composition rules and measured colours. Never overwrites.",
                          inputSchema: Schema.object(["project": project, "revision": revision, "width": Schema.integer("PNG width (600–4000, default 3508).", min: 600, max: 4000), "out": Schema.string("New folder (default inside the project). Inside PosterLab only output/<new name> is accepted.")], required: ["project"]), readOnly: false),
            AgentToolSpec(name: "import_scene", title: "Import a scene", description: "Turns an existing PosterLab scene into an editable project: a curated genome.json, a source-study candidate or winner, a type-system variation, or a study candidate (generation.json + candidate).",
                          inputSchema: Schema.object(["path": Schema.string("Scene JSON or generation.json."), "candidate": Schema.string("Candidate id when path is a generation.json."), "title": Schema.string("Project title.")], required: ["path"]), readOnly: false),
            AgentToolSpec(name: "run_study", title: "Run an evolution study", description: "The Studio's Generate/Evolve: renders a batch, judges it with the committee (and the user's taste), and evolves for 1–10 rounds. Returns the contact sheet and top candidates. Takes minutes.",
                          inputSchema: Schema.object(["brief": Schema.string("Brief id or 'random'."), "copy": copy, "seed": Schema.integer("Seed.", min: 0), "count": Schema.integer("Candidates per round (4–32, default 8).", min: 4, max: 32),
                                                      "rounds": Schema.integer("Rounds (1–10, default 1).", min: 1, max: 10), "styles": Schema.strings("Style ids to draw from (default: all)."), "mix": Schema.numberMap("Judge weight overrides."),
                                                      "use_taste": Schema.boolean("Add the user's trained taste jurors at weight 2 (default true)."), "resume": Schema.string("A generation.json to evolve from."), "picks": Schema.strings("Candidate ids to breed from when resuming."),
                                                      "out": Schema.string("Study folder (default in the agent folder). Inside PosterLab only output/<new name> is accepted."), "limit": Schema.integer("Candidates to list.", min: 1, max: 32)]), readOnly: false, slow: true),
            AgentToolSpec(name: "inspect_study", title: "Read a study", description: "Lists a generation.json's candidates by rank, with scores, style and whether each can be imported as an editable scene.",
                          inputSchema: Schema.object(["path": Schema.string("generation.json path."), "limit": Schema.integer("Max rows.", min: 1, max: 64)], required: ["path"]), readOnly: true),
        ] + studioTools
    }()
}
