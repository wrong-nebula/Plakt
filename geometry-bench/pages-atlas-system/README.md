# P.A.G.E.S. — shape kit

A shape construction system after **Neo Neo’s 2023 P.A.G.E.S. book-fair design**. [Open the editor](../../output/pages-shapes-study-v2/index.html) to build a sequence of items, give each its own construction, turn or mirror, and set them as an atlas, specimen, composition or patterned field in any module set, palette and format. Exports are SVG, PNG and JSON.

The source poster sets each letter with a different construction. This kit takes those constructions and applies them to shapes. It is a shape system, not a typeface. The reference letters appear in one arrangement only, the source atlas, as the evidence for each method.

## The parts

The system is five independent axes. Any combination works:

| Axis | Choices | Where |
| --- | --- | --- |
| Shape | 20 parametric centerline shapes, with a shared **detail** control | `shapes.mjs` |
| Construction | 8 methods from the source letters, global or per item | `constructions.mjs` |
| Module set | Discs, lozenges, soft squares: node shape, caps, joins, curve facets | `catalog.mjs` |
| Palette | 6 ground/ink pairs, independent of the module set; custom colors override | `catalog.mjs` |
| Arrangement | Shape atlas, specimen, composition, field (4 patterns), source atlas; 6 formats | `arrangements.mjs` |

`geometry.mjs` is the skeleton and outline kernel (Clipper booleans, offsets and sweeps). `lettering.mjs` sets the supporting type in the atlases and labels. `engine.mjs` resolves a state, renders it and exposes the API. The editor (`workshop.mjs`) and build bundle all of it with esbuild.

## Shapes and items

Twenty shapes in three groups. **Shape detail** (−2 … +2) changes the count each shape has. Serpent, arc, drop and loop have no count and ignore it:

| Group | Shapes (detail changes) |
| --- | --- |
| Lines and curves | wave (humps), serpent, arc, arch (nested arches), spiral (turns), zigzag (peaks), stairs (steps), meander (inward turns) |
| Closed forms | ring (nested rings), petal (1, 3 or 5 petals), drop, diamond (sides), triangle (sides, flat base), loop, knot (3 or 5 lobes) |
| Crossings | cross (arms), star (arms), chevron (nested chevrons), lattice (lines), bars (bars) |

Counts stop where the heaviest constructions would fill the gaps between strokes. The densest forms also declare a lighter stroke weight, which every construction applies, so spirals, nested rings and arches, nested chevrons, lattices, bars and five-lobed knots keep their gaps at +1 and +2.

An arrangement draws a sequence of up to 24 **items**. Each item is a shape with:

- its own construction, or **Follow the arrangement**
- a quarter-turn (0–270°) and a mirror; a turned frame is rescaled to 100 units tall, and the lighting stays upper-left

Items can repeat, be reordered, duplicated or removed. The picker adds an item per shape and removes it on a second press. Presets, **Shuffle order** and **Surprise** (3–6 random items with random turns and occasional own constructions) build sequences quickly.

## Constructions

Every item is a centerline skeleton in a 100-unit frame. All eight constructions read the same skeleton:

| Construction | From | Rule |
| --- | --- | --- |
| Contour bands | P | Alternate ink and ground strokes along the centerline |
| Faceted blades | A | Each straight piece becomes a two-faced blade lit from the upper left, with wire edges; curves are faceted first |
| Overlap lenses | G | Every stroke is a closed shape. Where two cross at an open angle, the ground shows through. Strokes meeting at acute or tangent angles, or too short to carry a lens, join instead |
| Perforated grid | E | The centerline is walked across a dot grid and each step switches on its nearest module, so lines stay one module thick; horizontal runs drip tails |
| Linked modules | S | Modules repeat along the centerline at one spacing, set by the source S, with small size variation |
| Folded planes | P | A gradient front face is swept down-left into solid side planes |
| Separate rails | E | Straight or faceted rails stop short of every joint |
| Squeezed heavy | S | A heavy stroke is squeezed sideways, so verticals thin and curves stay heavy |

Skeletons split at corners for constructions that work stroke by stroke (lenses, blades, rails, folds). Stroked constructions draw the unsplit outline, so corners keep their joins. The source letters keep their authored drawings: the ribbed serif P, the organic g, the eighteen-node S, the perforated E, the folded P, the lit A, the split-rail E and the tall S.

## Arrangements

- **Shape atlas** (default): the 2023 collage, with the first five items in the P, A, G, E and S positions. Fewer items repeat. The supporting serif, heavy and condensed letters become monolines at those three weights. Exhibition metadata stays tied to 2023.
- **Shape specimen**: every item through all eight constructions. The table turns to keep its cells squarest.
- **Composition**: the items at one common height, in the row count that makes that height largest. **Spacing** sets the gaps.
- **Shape field**: the items repeat across a grid, with **Field density** and **Shape size** (above 1 the shapes overlap). The pattern is **Repeat**, **Quarter turns** (each diagonal turns 90° more), **Mirror tiles** (alternate columns mirror, alternate rows flip) or **Scatter** (a fixed pseudo-random turn and mirror per cell).
- **Source atlas**: the reference letters rebuilt with each construction. Items do not apply.

Composition and field take one construction or **Mixed**, which rotates through all eight; an item's own construction always wins. Formats are Poster 2:3, A series, Square, Story 9:16, Landscape 16:9 and Billboard 3:1. `render(input, {width, height, margin})` fits any other box.

## Module sets, palettes and controls

| Module set | Shape changes | Default palette |
| --- | --- | --- |
| Disc constructions | Round nodes, round caps and joins, smooth curves | Mint / pine |
| Lozenge constructions | Equal-area diamonds, mitred joins, every curve in three facets | Lavender / aubergine |
| Soft square constructions | Rounded square nodes, softened square ends, round ribbon ends | Ice / burgundy |

The other palettes are Newsprint / black, Black / signal orange and Cobalt / pale lime. Changing the module set keeps the palette.

Geometry controls are shape detail, module weight, contour-band count, perforation-tail length, fold depth and linked-module count. Spacing, field density and shape size appear only with their arrangement. Band count is enabled only when the final grooves are visible. The four passes are **components → overlaps → shapes → finished**.

Supporting type in the atlases uses vector outlines prepared from locally installed Times New Roman, Arial Narrow Bold and Arial Black (provenance in `font-provenance.json`). Font binaries are not embedded, and the editor runs offline.

## API

```js
import {render, resolve, normalizeItems, kit, thumbnail, glyphSVG} from './engine.mjs';
render({layout: 'field', format: 'square', pattern: 'mirror', palette: 'signal',
  items: ['arc', {shape: 'chevron', construction: 'heavy', turn: 1, flip: true}],
  params: {detail: 1, density: 1.4}});        // → {svg, state, width, height, features}
glyphSVG('overlap', {shape: 'star', turn: 1}, {family: 'lozenges'}, {x: 0, y: 0, w: 90, h: 100});
```

A saved rule names `pages-shapes-v2`. Earlier rules with a plain `shapes` list open as items. v1 rules (`pages-atlas-v1`) open as the source atlas with their module set, parameters and colors.

## Rebuild and verify

```sh
node geometry-bench/pages-atlas-system/build.mjs
python3 geometry-bench/pages-atlas-system/contact-sheets.py
node geometry-bench/pages-atlas-system/verify.mjs
node geometry-bench/pages-atlas-system/browser-check.mjs
```

Run `node geometry-bench/pages-atlas-system/prepare-fonts.mjs` first only if the supporting outlines need regeneration.

`output/pages-shapes-study-v2/` holds the editor and 25 SVG/PNG/JSON examples, plus kit strips, shape grids, detail grids, provenance and palette measurements. Nine boards: `comparison.png`, `module-systems.png`, `closed-forms.png`, `construction.png`, `shape-constructions.png`, `shape-detail.png`, `arrangements.png`, `patterns.png` and `formats.png`. PNG proofs and browser exports have a 3000px long edge.

`validation.json` records same-machine Node/resvg checks:
- every shape × construction × module set at detail −2, 0 and +2 (the extremes turned and mirrored), with finite geometry and visible ink
- lens parity from independently rasterized parts
- a visible change for every control in its arrangement
- four distinct passes
- detail, orientation, perforation, pattern, per-item construction and palette rules
- ink clear of the page edge in every non-atlas arrangement and format
- exact replay, input bounds and both migrations

`browser-validation.json` records isolated Chrome checks of the editor: picking, item editing, arrangement-dependent controls, patterns, palettes, passes, downloads, saved-rule and URL replay (including the selected item), gallery rules, mobile width and offline operation. Evidence is in `output/playwright/pages-shapes-system/`. These checks do not score reconstruction accuracy or aesthetic quality.

## v1

The first study, a five-letter specimen atlas, is archived in `v1/` with its own build and checks. Its outputs remain in `output/pages-atlas-study-v1/`.

New vector interpretations, the shape catalog, construction rules, module sets and palettes were created with AI assistance. Original source design remains credited to Neo Neo. Native archive records were not modified.
