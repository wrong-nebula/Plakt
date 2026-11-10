# Source-first shape and type systems

The 1,130-poster census now yields **14 executable survey recipes** (17 with Orbit wrap, Sawtooth and spring and Circle packing, below). Six previously proposed families are implemented: folded chevron spires, shaded wireframe volumes with optional slice displacement, gravity-fed pigment trails, soft four-lobed crosses, projective type portals, and glyph/symbol/image module fields.

The user's reference review established the default policy: **match the canonical reference's shape, topology and proportions as closely as the grammar supports. Creative departures are explicit variations.** The canonical reference is first in each recipe's `references`, with its source image checksum. `output/library-shape-survey-v2/canonical-defaults.json` freezes the selected values and explanations. These are visual calibrations and procedural interpretations, not recovered original designer algorithms.

Two interpretation corrections are preserved in the study history:

- The FUBU wireframe reference supports stacked, broad shaded volumes. It does not literally show separated, laterally displaced slices. Its default now has one central volume and neighboring partial volumes, zero gap and zero displacement; slicing remains an explicit variation.
- The purple/black scalloped poster reads **F U / B U**. It is a modular letter system as well as a shape field, rather than a generic decorative frame. The implementation now uses editable Core Text glyph outlines in a 2×2 default grid, scallops both exterior contours and counters, and alternates figure/ground. Other editable words reuse the same rule.

Other source-aligned defaults use a shallow, thick molecular branch structure, open shared-anchor fans, evenly inset rectangular tunnels, a rounded-square light-grid module, outlined brackets, three folded chevron tiers and a narrow seven-shaped echo stack. Neutral and paired previews retain each source field's preferred physical aspect rather than flattening every recipe into a square. Fonts and palettes remain independently editable.

## Implementation

- `SurveyShapeGeometry.swift`: the first geometric families and their deformation controls.
- `ExtendedSurveyGeometry.swift`: folded concave silhouettes, clipped and displaced shaded volumes, connected gravity trails and lobe/stem materials.
- `SurveyTypeGeometry.swift`: glyph outlines, projective homographies, counter-preserving scallops, ink-area module normalization, geometric symbols and optional checksum-bound image modules.
- `PosterShapeLibrary.swift`: recipes, presets, canonical aspect previews, font/style/field matching and semantic defaults.
- `SurveySystemStudy.swift`: source-region, source-dominant and supplied-image generation contexts; incumbent retention, parameter mutation, fresh source compositions, per-round ballots and exports.

The three spatial typography recipes retain editable text and font metadata in their scene elements. Actual generated poster copy replaces specimen text. The 11 geometric recipes also work with the existing large-shape system, including offset, cropped and front/behind/weave placements. Scalloped text and portal text are treated as typography, rather than background shape masks.

Gradients and glyph outlines are native Core Graphics/Core Text PDF content. Module fields using a supplied image embed that raster; other geometry and typography remain vector. Image modules use the existing immutable asset URL, crop and SHA-256 checks. No source crop is shown in the galleries.

## Testing and judging

The first pilot has 112 candidate instances (14 systems × 2 rounds × 4). The main study uses 672 (14 × 8 × 6), plus a focused eight-round echo-stack refinement. These are coverage tests, so the selected recipe is deliberately present. This does not change the app's optional shape frequency, default-off experiments or personal taste votes.

The study compares each rendered candidate with its art-removed counterpart to measure changed pixel share. A study-only **System presence** ballot helps prevent an attractive base photograph from winning while the system being tested is hidden. This is a soft diagnostic, with no hard ban on pale overlays. Other ballots include typography, copy completeness, hierarchy, type integrity, style affinities, diversity and enabled explicit-vote personal jurors. Borda ranks are relative to their own batch, not objective aesthetic grades.

Completed artifacts, exact counts, verification scope and limitations are recorded in `output/library-shape-survey-v2/validation.json`. The first prototypes and pilot are retained for comparison. Raw poster records, semantic indexes, segmentation outputs, learned model weights and personal votes are not modified.

## Materials and geometry

Six systems gained source materials. New presets default to the canonical source look; genomes saved before these controls existed have no such keys and render exactly as before.

| System | New controls (default) | Inks |
| --- | --- | --- |
| Folded chevron spire | Edge prongs (1): deeper tiers' wing tips reach the edge at rising heights and flatten; Metallic sheen (0.6): light along the fold, reversed on the far face | One |
| Wireframe volume stack | Volume overscale (1.35): cropped at the field edge; Mirrored halves (on); Light on dark volume (on): solid dark volumes lit by the lighter ink, so dark posters get FUBU's black-on-black | Two |
| Gravity-fed pigment trails | Streams per pool (6), Pool softness (0.6), Pigment inks (5), Pool scatter (0.6): sprayed pools in side-by-side colour fields, thin streams from each lower rim with long-tailed lengths | Five |
| Soft four-lobed cross | Centre ink glow (1): hot core to cooler lobe tips; Centre block (0.32): rounded block and stem in a third ink | Three |
| Projective type portal | Natural word repeats (on): each wall repeats its word at natural proportions with even spacing; all four walls run along their length | One |
| Glyph and image density field | Dense-row fusion (1): tight rows gain columns until glyphs touch and fuse into a band | One |

`PosterShapeRecipe.inks` records the source inks (shape colour first) and `SceneElement.inks` the inks after `color`. In generated posters, `ShapeMaterials.palette` keeps the source's hue relationships but turns them toward the layout's shape colour (neutral shape colours keep the source hues with a small seeded turn) and lifts or darkens inks just enough to stay visible on the paper. The orb's second ink is the paper when it reads well against the shape colour. **Custom inks** in Shape library, `PosterShapePreset.inks` or `--inks '#rrggbb,…'` use exact colours instead. Overlap contrast now checks every ink that fills area, so type over any drip colour or the cross's core is handled.

## Variations

Each system also has variation axes beyond its source. Defaults keep the canonical construction, and saved genomes without these keys render pixel-identically (checked).

| System | Axes |
| --- | --- |
| Folded chevron spire | Points up / down / left / right; 1–3 spires side by side; fin curvature |
| Wireframe volume stack | Ellipsoid / barrel / lens; stacked vertically or side by side; wireframe twist |
| Gravity-fed pigment trails | Flow down / up / right / left; pools in a row, around one dominant pool, in two rows or as a cloud; stream meander |
| Soft four-lobed cross | 3–8 lobes; lobe squareness; lobe rotation (diagonal X to upright plus); centre block roundness up to a disc |
| Projective type portal | 3–8-sided frames; one word per wall or the whole title as continuous text round the corridor; wall shading toward the vanishing point |
| Glyph and image density field | Density down, across or radial; letter mask (keep modules inside or outside the title's first letter); glyphs, symbols or soft rounded squares |

### Type as material

Four systems can set the poster title themselves instead of leaving it to the layout. Generation resolves the brief's title into the system element (it stays a shape and keeps its `text` and font); specimens spell FORM SPACE.

| System | Type mode |
| --- | --- |
| Gravity-fed pigment trails | Pools from the title letters: the title (on one line or two, whichever is larger) becomes the pigment band, each letter in its own ink, bleeding streams as thick as its strokes from points along its lower silhouette. Letters stay upright; with upward flow they sit at the foot and bleed upward |
| Wireframe volume stack | Title printed round the volumes: one line per slice, wrapped over the visible half and foreshortened toward the rims, on globes, barrels or lenses |
| Soft four-lobed cross | Title round the outline: set clockwise just outside the silhouette, tops outward, in the lobe ink |
| Folded chevron spire | Title engraved along the fins: up the left outer edge and down the right, inside the metal in a lighter or darker tone |

Placement treats a title the system already carries like the portal's and module field's: echo words are dropped in anchored mode, the drip pool band and the orb's slice rules stop offering anchors, and any recipe anchor the rendered system covers (outline type, prongs, streams) is withdrawn. `PathType.along` sets glyphs along any polyline for these modes.

[`output/survey-typography-v1/index.html`](output/survey-typography-v1/index.html) shows each mode on its specimen and the four type modes on three inherited layouts each, in every placement mode.

Two finishing fields complete the set: **Depth fade** lets deeper portal rings recede toward the paper, and the glyph field's **Module size** scales modules by a photo's darkness (a glyph halftone of the image modules' photo) or by a radial or diagonal ramp.

Turned and transposed systems keep working type anchors: anchors are authored for the upright construction and carried through the renderer's own transform, so boxes stay boxes and lines turn with the system. Survey studies draw discrete modes from their full range 30% of the time, since small nudges would never leave a mode's default. [`output/survey-variations-v1/index.html`](output/survey-variations-v1/index.html) shows each axis per system and a two-round study across all six.

## Type anchors and overlap contrast

Each of the six newer systems now declares where type belongs, computed from the same parameters its renderer draws with:

| System | Anchors |
| --- | --- |
| Folded chevron spire | Flank fields above each outer wing (title left, display right), lines along both wings, a vertical line up the spine |
| Wireframe volume stack | Every slice boundary, left and right, as a rule group for information; space above, below and beside the stack |
| Gravity-fed pigment trails | Title across the pool band, display in the run-out below the median drip, information at the foot |
| Soft four-lobed cross | Inside each lobe (two-column, as in the Victoria Hall source), the top waist, the feet beside the stem, headroom |
| Projective type portal | The unprinted aperture: display above, information below |
| Glyph and image density field | Title across the fused dense rows, display/information in the gaps between sparse rows |

Every shape also contributes up to four measured quiet zones: the largest empty rectangles left by shapes, images and any type that stays put. Anchors are saved in `genome.typeAnchors`; each placed element names its anchor in `typeAnchorID`.

`PosterShapePreset.placement` chooses the mode:

- **Anchored**: every text block moves into the best-fitting anchor. A wrapped headline shares one em size; information keeps its field breaks and can run one field per rule along a group (the orb's slices). Words already carried by an anchored headline are dropped instead of stacking around it.
- **Title + info** (`mixed`): only the headline and information move; other type stays where the inherited layout put it, and anchors under it are withdrawn.
- **Free**: nothing moves. Anchors are still measured for comparison.

Blocks are placed headline first, then information, then display type by size. A block with no fitting anchor stays where it was and becomes a fixed obstacle; placement then re-runs so nothing lands on it. Survey studies cycle all three modes across candidates, so the jury compares them.

Overlap contrast is independent of the mode. Where type crosses a shape of similar color (contrast ratio under 3:1), the glyphs are repainted inside that shape's ink only, preferring the paper color, so the type reads as cut out of the shape. `auto` respects shapes drawn above the type; `interlock` also cuts through them, including whole-poster weave windows. Type stays vector in PDFs; the overlap edge follows a 2480 px mask. Presets saved before this change have no `placement` and render exactly as before.

```sh
poster shape-library render --id survey-bilateral-soft-cross --placement anchored --contrast auto --out output/my-cross   # also writes anchors.png
poster shape-library placement-proof --library library --out output/my-placement-proof --count 3
poster shape-library placement-proof --library library --out output/my-type-proof --set letters=1,surfaceType=1,outlineType=1,finType=1   # any recipe control, where a recipe has it
poster shape-library survey-study --library library --out output/my-survey --placement anchored,mixed,free
```

[`output/type-placement-proof-v1/index.html`](output/type-placement-proof-v1/index.html) shows three inherited layouts per system before placement and in each mode, with anchor overlays. [`output/survey-materials-v1/index.html`](output/survey-materials-v1/index.html) repeats that proof with the materials, and its `specimens.jpg` shows all six defaults. `poster-checks --placement-only` covers anchors for all six systems, replay, free/legacy equivalence, inline and interlock contrast, PDF export and whole-poster placement.

## Orbit wrap and Sawtooth and spring

Two systems from the archive census (`ARCHIVE-CANDIDATES.md`, rows 15 and 17), built in app copies and merged here on 8 November 2026. Each has 29 named **looks** in the shape library: buttons that set every parameter, the inks and, for dark looks, the specimen paper. The first look follows the source poster. `--look NAME` does the same on the command line.

- **Orbit wrap** (`OrbitWrapGeometry`, source 0277):
  - Rings, coils, knots, gimbals, swarms and other orbits wound round a subject or the title itself.
  - The renderer draws the far arcs and the subject below the type, and the near arcs right above the title. Other type stays on top, so it remains readable.
  - Type placement offers an orbit core, so the title sits inside the rings.
  - Details: [README](workspaces/orbit-wrap/README.md).
- **Sawtooth and spring** (`SawtoothSpringGeometry`, source 0255):
  - Nine waves along a straight or bent run, a ring or a spiral, drawn as a compressing spring, tiled stripes, fins, a sawblade or a mirrored waveform.
  - Faces fold, shade, screen or hatch; extrusion, misregistration and glitch stack on top.
  - Details: [README](workspaces/sawtooth-spring/README.md).

The merge also brought shared changes:
- `PosterShapeLook` and `PosterShapeRecipe.looks`.
- `PosterShapePreset.paper`, used for the specimen only.
- `PosterShapeParameter.activeIn`, so a control can be active for several values of another control. The pixel check honours it.
- A sawtooth-only branch in `ShapeMaterials.palette` that keeps the system readable on dark layouts.
- A placement fix: a line set into a tall rotated anchor used to vanish when its unrotated box left the page. It now draws.

Older presets and genomes decode unchanged, and scenes without these systems draw exactly as before.

```sh
poster shape-library render --id survey-orbit-wrap --look "Trefoil knot" --placement anchored --out output/my-orbit
poster shape-library render --id survey-sawtooth-spring --look "Sawblade" --placement anchored --out output/my-saw
zsh scripts/orbit-looks.sh output/my-orbit-looks
zsh scripts/saw-looks.sh output/my-saw-looks
poster-checks --orbit-only
poster-checks --sawtooth-only
```

## Circle packing

Built in an app copy from a user-supplied poster (*Spektakuli*, Miller's Zürich 2017, not in the library) and merged here on 9 November 2026. It has 32 looks; the first follows the source.

- **Circle packing** (`CirclePackGeometry`):
  - Circles (and letters) packed until they kiss, with wedges from the kissing points out to the field edge.
  - Five packings: largest gap first (along the diagonal, centre, edges or foot), Apollonian gasket, rolling rows, sunflower, size-field lattice. Five field shapes; ten marks per circle; holes, cut-paper shadow, misregistration, outlines.
  - Letters pack by their real outlines, so circles settle into counters. The title can be set one letter per circle, packed among the circles, or packed alone.
  - Hand editing: in the shape library, click the preview to place circles or letters, remove shapes (a packed shape leaves a kept-empty void), or drag one to pin it. The rest repacks as you edit.
  - Details: [README](workspaces/circle-pack/README.md).

The merge also brought shared changes:
- `PosterShapePreset.circlePack` and `PosterShapeChoice.circlePack`: placed shapes, validated, and written into the element's geometry as `pack.*` keys, so drawing, type anchors and saved scenes all see them.
- The **Place shapes** controls and a click/drag overlay on the shape-library preview, which redraws after 8 ms rather than 100 ms for this recipe.

Older presets and genomes decode unchanged.

```sh
poster shape-library render --id survey-circle-pack --look "Paper cut" --placement anchored --out output/my-pack
zsh scripts/pack-looks.sh output/my-pack-looks
poster-checks --circle-pack-only
```

## Reproduce

```sh
python3 scripts/define-extended-survey-shapes.py
python3 scripts/align-survey-defaults.py
python3 scripts/add-survey-materials.py
python3 scripts/add-survey-variations.py
python3 scripts/add-survey-typography.py
python3 -I scripts/add-orbit-wrap.py "$PWD"
python3 -I scripts/add-sawtooth-spring.py "$PWD"
python3 -I scripts/add-circle-pack.py "$PWD"
python3 scripts/render-extended-survey.py
.build/image-library/release/poster shape-library survey-study --library library --image-scenes output/image-run-queue-v1 --out output/new-survey-run --rounds 8 --count 6 --seed 261109
.build/image-library/release/poster shape-library survey-study --library library --image-scenes output/image-run-queue-v1 --out output/new-echo-run --rounds 8 --count 6 --seed 261109 --id survey-chevron-stack
```

The CLI requires a fresh output directory. The separate signed preview is `dist/shape-systems-preview/PosterLab Shape Systems.app`; it preserves the main app and other running previews. The stable preview snapshot intentionally excludes the ongoing SAM/SigLIP additions, while the shared source merges the new survey recipes without rewriting their discovery catalog.
