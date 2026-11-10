# Primitive kit figures v1 (frozen) — after Ikko Tanaka and Koji Kato

This folder keeps the v1 sources exactly as shipped, so `output/primitive-kit-study-v1/` stays rebuildable. Run the scripts from this folder (`node --expose-gc geometry-bench/primitive-kit-system/v1/v1/build.mjs`); the v1 build rewrites its files and never deletes the folder. The current system is v2 in the parent folder.

A shape system after **Ikko Tanaka’s** cell-primitive figures — *Nihon Buyo* (1981), *Kanze Noh* (1973), *Hanae Mori* (1977), *Sharaku 200th Anniversary* (c. 1995) — and **Koji Kato’s** cut-paper bird for Mino Shigyo (c. 1960), from the local Japanese poster archive. Open [the editor](../../../output/primitive-kit-study-v1/index.html) to paint figures cell by cell, layer eyes and lips over them, deform the shared construction, set them in four layouts and nine styles, and export SVG, PNG or a saved JSON rule.

The Nihon Buyo face is a 3 × 4 grid where every cell holds one primitive in a flat colour. This system is that kit, generalised: any figure, any grid, one construction. The five source figures are presets, not the goal.

## A figure is text

```
name: Nihon Buyo
grid:
.    S01    .
S01  B28/2  S01
T21  S02    T11
T34  T35/2  S03
over:
disc 2.46 .57 r.45 c7
band 1.5 1.83 w1 h.19 c9
eye.kabuki 1.113 1.592 r.104 c3 d1 m
lip.bud 1.5 2.47 r.088 c3
```

**Cells** — a primitive letter, a clockwise quarter turn 0–3 and a colour 0–9, with an optional `/background`. `.` is empty; `./3` is an empty cell filled with colour 3. `S3` is shorthand for `S03`.

| Letter | Primitive | Turn names | Letter | Primitive | Turn names |
| --- | --- | --- | --- | --- | --- |
| `S` | Square | — | `D` | Disc | — |
| `T` | Half-square triangle | corner (0 bottom-left, 1 top-left, 2 top-right, 3 bottom-right) | `O` | Ring | — |
| `Q` | Quarter disc | corner of its centre | `L` | Leaf (lens) | diagonal |
| `C` | Cove (square minus quarter disc) | corner | `K` | Diamond | — |
| `H` | Half disc | edge (0 bottom, 1 left, 2 top, 3 right) | `W` | Wedge | base edge |
| `N` | Arch (square minus half disc) | edge | `A` | Quarter ring | corner |
| `B` | Half square | edge | `P` | Dot | — |

**Overlays** — free primitives over the grid, one per line: `kind x y` in cell units, then options `r` radius, `w h` size, `a` angle, `i` inner ratio, `t` thickness, `n` count, `e x,y` line end, `c d` colours, `m` to add the mirror image. Kinds: `disc ring half quarter tri rect band stripes spike lens line`, and `eye.kabuki|almond|round|dot|slit`, `brow.arc|moth|line`, `lip.bud|noh|bow|smile|beak`.

**Colours** are roles, so every figure works in every palette: 0 ground · 1 ink · 2 light · 3 red · 4 blue · 5 green · 6 yellow · 7 sky · 8 violet · 9 pink.

## One construction

Every figure passes through the same steps, each a control:

| Step | Controls |
| --- | --- |
| Resolution | ×1, ×2, ×4: the drawn figure is re-quantised on a finer grid (square, triangle, half square, diamond, disc, ring, half disc and arch split exactly at ×2; curves are approximated at ×4) |
| Vocabulary | Full kit, Tanaka four (square, half square, triangle, quarter, disc), angles only, curves only, pixels; missing primitives become their best-fitting substitute |
| Turn noise | Seeded extra quarter turns |
| Symmetry | As drawn, mirror left or right half, mirror top half, four-way, half-turn. Cells on an axis become their best self-symmetric primitive; overlays are mirrored too |
| Cell geometry | Cell height (aspect), gap, corner rounding, seeded jitter, lattice warp (Kato’s cut paper). Warp and jitter mirror with the figure |
| Overlays | Overlay size |
| Paint | Flat fill, outline, sticker (fill + ink line), neon glow, riso overprint (per-ink misregistration); line weight |

The **quantiser** behind resolution and vocabulary fits each cell with the two-colour primitive that reproduces the most samples of a painter (x, y → colour). It also turns any silhouette into kit cells, which is how the **seeded generator** works: faces, masks, butterflies, birds and flowers are symmetric silhouettes (head and hair ellipses, shield masks with horns or ears, triangle or round wings, feather bands, petal rings) quantised into cells, then given eyes, brows, lips, fangs, antennae, beaks or stems. The same kind, seed and grid size always return the same figure.

## Presets, styles and layouts

**Twelve presets**: Nihon Buyo, Noh mask, Hanae Mori butterfly, Sharaku and Kato’s cut-paper bird (source figures, hand-written); owl, cat, oni, kitsune, flower, koi and daruma (new; several began as quantised silhouettes, then were edited by hand).

| Style | After | Default |
| --- | --- | --- |
| Buyo flat | Nihon Buyo, 1981 | The source grid bleeding to the page, corner copy |
| Gold Noh | Kanze Noh, 1973 | Cropped giant mask, paper grain, vertical copy |
| Confetti wings | Hanae Mori, 1977 | Triangle wings in taller cells, serif title |
| Nine discs | Sharaku, c. 1995 | A few face cells under large discs |
| Cut paper | Koji Kato, c. 1960 | Warped lattice, a bird on a wire stand |
| Riso cast | new | Six generated faces and masks, misregistered over grain |
| Neon masks | new, electro | Masks repeated on near-black, one neon colourway per tile |
| Pop stickers | new | Generated figures with soft corners, gaps and an ink line |
| Indigo repeat | new | A flower in line only, mirrored tile by tile |

**Layouts**: a hero figure (optionally bleeding the grid to the page), a patterned field (repeat, mirror tiles, brick, quarter turns, seeded scatter, colourways), a cast of up to nine different figures with names, and a cropped giant that bleeds off three sides and keeps the copy side clear. Formats: poster B 728 × 1030 (PNG 2120 × 3000), square, landscape. Copy (title and information lines, system fonts) sits in a corner block, serif title, vertical column or bottom band; layouts keep figures inside the content box.

The four passes are **grid & tokens → kit cells → figure + overlays → poster**.

## The editor

Paint directly on the figure canvas: a brush (primitive, turn, colour, background), or tools that cycle a cell’s shape, turn, colour or background, erase, or pick. Drag to paint across cells. With a symmetry mode on, painting a cell also paints its mirror, and derived cells are shaded. Overlays can be selected, dragged by their handles or tapped into place, edited (kind, position, size, angle, colours, mirror), added, duplicated and deleted. The figure is also shown as editable text. Every edit — painting, overlays, text, presets, generator, cast, grid size, sliders, options — goes on an undo stack (buttons or ⌘/Ctrl-Z, ⇧⌘Z). The cast holds up to nine figures; presets and the generator fill the selected slot. The state lives in the URL, so a reload replays it.

## Files

```sh
node --expose-gc geometry-bench/primitive-kit-system/v1/build.mjs
python3 geometry-bench/primitive-kit-system/v1/contact-sheets.py
node --expose-gc geometry-bench/primitive-kit-system/v1/verify.mjs
node geometry-bench/primitive-kit-system/v1/browser-check.mjs
```

`engine.mjs` holds the kit, quantiser, generator, styles and renderer (no dependencies); `figures.mjs` holds the preset texts; `workshop.mjs` the editor. The build bundles the engine into the offline editor.

`output/primitive-kit-study-v1/` contains the editor, the nine style posters (SVG, PNG, saved rule), four passes per style (`stages/`), every preset (`figures/`), generated figures for five kinds and six seeds plus grid sizes (`generator/`), sixteen layouts and formats (`layouts/`), twenty-four deformations (`variations/`), the kit specimen, `catalog.json` (primitives, overlays, palettes with OKLCH and contrast, controls, preset texts) and the references with provenance (`references/`, `source.json`). Boards: `comparison.png`, `styles.png`, `figures.png`, `generator.png`, `layouts.png`, `variations.png`, `construction.png`, `kit.png` and `phone.png` (showcase posters at 390 px wide).

`validation.json` records same-machine Node/resvg checks: styles distinct (also under one palette), every control and option value visible, four passes, exact replay, figure text round trips, geometric mirror tables for every primitive and turn, exact ×2 refinement where the kit allows it, symmetry to the pixel (also with jitter, warp and resolution), a deterministic, distinct and symmetric generator, vocabularies, figures clear of the copy, editing operations and input bounds. `browser-validation.json` records isolated Chrome checks of the editor, with evidence in `output/playwright/primitive-kit-system/`.

Saved rules name `primitive-kit-v1` and store every figure as text, so a rule replays even if presets change.

New vector interpretations created with AI assistance; nothing is traced. The original designs remain credited to Ikko Tanaka and Koji Kato. Reference images are copyrighted and kept locally for study only.
