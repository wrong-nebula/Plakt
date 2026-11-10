# Contour-built letters and silhouettes

Two independent, source-linked recipes are in the Shape library. They share a native vector engine, and save their source outline and construction rules rather than a baked image.

| Recipe | Source construction | Explicit alternatives |
| --- | --- | --- |
| `contour-letter-channels` | Wide R above K/C; rectilinear authored blocks and mitered inward channels, inspired by RKC | Selected font outlines, editable text, whole-word lines by default for other titles, optional word/letter-grid layouts, glyph proportions or cell filling, rounded joins, outward expansion, second ink, imported outlines |
| `contour-profile-channels` | Two tall head profiles facing each other, nested affine copies and small inward-facing border profiles, inspired by Expérience Collective | Constant-distance channels with an open cut edge, imported silhouettes (SVG or JSON), convergence point and scale, same-direction copies, expansion, copies |

The source drawings are visual interpretations. Original fonts, vector files and exact transform values are unknown. In particular, recursive scaling and constant-distance offsetting are different operations; the silhouette preset keeps the distinction visible.

## Construction

Each outline is resolved with its own fill rule before any offsetting: font glyphs use nonzero filling, because variable fonts (Unbounded, Syne, Bricolage Grotesque, Newsreader, Cormorant Garamond, Bodoni Moda, Fraunces) overlap contours at stem joins and even-odd filling would punch those joins out as false counters. The authored RKC blocks and the built-in profile use even-odd; imported outlines use the rule they were saved with. A circular or mitered boundary stroke is unioned with the source for dilation, or subtracted for erosion. Each channel is the difference of successive offset regions. Calculations use a 1000-unit design domain before being transformed to the poster field, keeping channel pitch physical across the field's aspect ratio. There is no raster tracing stage in the generated paths or PDFs.

All glyphs of a title form one distance field, so outward channels of neighbouring letters merge like contour lines instead of overprinting each other's gaps. When expansion is positive, the layout gives way by the expansion distance so the outer channels stay on the paper.

Closed negative-space components become independent counter masks. With **Protect original counters** enabled, expansion moves only the exterior: rings stay anchored to each counter edge (region at depth *t* = exterior offset by expansion − *t*, minus the counters dilated by *t*), so counters keep their size and start with a full-width channel rather than a clipped sliver. Without expansion this is identical to plain inward offsetting. Aggressive inward offsets may remove narrow features; the requested channel count is a maximum, not an instruction to draw self-intersecting paths after those features vanish.

**Glyph proportions / fill cell** blends between keeping the font's proportions (0) and stretching each word or letter to its cell (1, the source look). The R-above-K/C arrangement belongs to the RKC title only; other three-letter titles keep whole-word lines.

Explicit line breaks set the lines. In the gallery, ⌥Return starts a new line; on the command line, `--text 'DARK\nCURRENTS NOW'` works. Generated posters keep the line breaks typed into the title. The word layout gives each typed line its own row instead of one row per word. The single-line layout sets every line at one shared type size, centred on the widest line with an even gap, rather than running the lines together. The letter grid uses one row per typed line, with columns following the longest line. Without breaks, all three layouts behave as before.

The profile's source mode recursively scales the same outline about a convergence point (height and offset are editable; mirrored copies mirror the offset). If that point falls on open paper outside an imported outline, the deepest interior point is used; a point inside a counter is kept, so copies converge into it. Scaling about a point nests copies only for outlines that are star-shaped around it; otherwise each copy is clipped to its parent, so layers never cross. Counters scale with their copies: each copy's own counter opens a window through it and through every smaller copy stacked on it. Concentric counters therefore stay clean, and off-centre ones trail toward the convergence point like a tunnel, rather than being hidden by the next layer or fixed at the original size. Each band is the part of one copy not covered by the next. Transparent mode inks alternate bands; a second ink paints the others. Parallel mode uses the vector offset engine. A straight lower edge (the neck, or any straight base on an imported outline) is treated as a cut by the paper: the adjoining sides continue past it before offsetting and the result is clipped there, so channels run off the edge instead of turning along it. Outlines sharing a cut line share one distance field. **Facing pairs** mirrors every silhouette right of centre, as the reference heads look at each other. Controls that belong to the other mode are disabled in the gallery.

## Reuse

The gallery supports editable letters, font selection, a second ink, outline import, preset saving/reopening, PDF export, and use in image areas or whole-poster silhouette compositions. Blank contour text follows the generated poster's actual title. Explicit text overrides are preserved. An imported silhouette replaces the profile inside the same composition (large copies, border copies, facing); set copies to 1 and border silhouettes to 0 for a single figure. Imported outlines keep their proportions; one with a straight base stands on the bottom margin. The border slots take the imported outline's own aspect, rather than the profile's narrow calibrated slot, and the border band widens to as much as 15% of the width to fit them.

**Import outline…** and `--outline` accept SVG files: `path` (all commands, including arcs and relative forms), `polygon`, `polyline`, `rect` (with rounded corners), `circle` and `ellipse`, with nested `transform`s, `fill-rule` and `fill="none"`. Strokes, text, images, `<use>` references and `<defs>` content are not traced. Shapes with mixed fill rules are merged into one even-odd region.

`PosterShapePreset.contour` and `SceneElement.contour` carry a versioned `ContourCustomization`: optional text, secondary ink and original outline. Outlines use normalized top-left coordinates, a height/width aspect, M/L/Q/C/Z commands and an optional `fillRule` (`nonzero` or `evenodd`; files without it keep their original even-odd filling). Quadratic and cubic curves remain editable. Example:

```json
{"version":"contour-outline-v1","aspect":1,"fillRule":"nonzero","commands":[
  {"kind":"M","points":[{"x":0.1,"y":0.1}]},
  {"kind":"L","points":[{"x":0.9,"y":0.1}]},
  {"kind":"L","points":[{"x":0.5,"y":0.9}]},
  {"kind":"Z","points":[]}
]}
```

CLI examples:

```sh
poster shape-library render --id contour-letter-channels --text B8O --set construction=0,layout=1,expansion=0.06 --out output/my-contour-type
poster shape-library render --id contour-letter-channels --text 'DARK CURRENTS' --set construction=0,stretch=0 --out output/my-contour-words
poster shape-library render --id contour-profile-channels --outline silhouette.svg --set mode=0,expansion=0.03 --out output/my-contour-profile
poster shape-library render --id contour-profile-channels --outline silhouette.json --secondary-ink '#eeeae1' --set facing=0 --out output/my-contour-profile-2
poster shape-library index --id contour-letter-channels,contour-profile-channels --out output/my-contour-index
```

`ContourSystems.construction(_:aspect:)` exposes the cached bands, counters and resolved sources for inspection. `poster-checks --contours-only` covers counter-anchored expansion, glyph fill rules, the shared field, facing, nesting containment, counters that follow nested copies, typed and title line breaks, proportional border slots, open cut edges and SVG import.

Tags, authored descriptors, native Vision embeddings, source checksums and construction logic are saved with the systems. Generation studies use actual library compositions and existing judge models; diagnostic ranks do not create user taste votes or training labels. This feature does not modify the separate SigLIP/segmentation work. Renders archived in `output/contour-systems-v1/` predate these construction changes; expanded type, facing silhouettes and parallel necks render differently now.
