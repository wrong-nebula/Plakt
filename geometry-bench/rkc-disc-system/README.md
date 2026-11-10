# RKC — disc field

A procedural type system after the **RKC December** poster credited in the local library to **Giliane Cachin + Viltė Jurgutytė**. Open [the editor](../../output/rkc-disc-study-v2/index.html) to compare the source photograph with the live field, step through the four construction passes, and set any copy in any format.

The source is one 5 × 7 field of modules. Each cell holds a cream or bronze shape, and fluorescent red shows only in the gaps. v2 reads that as **one module rule** that draws letters and their counters alike. It replaces v1's kit of six hand-placed tiles, whose quarter, bite and split pieces produced visible glitches. The cell alphabet and every outline are new. Nothing is traced from the poster.

## The module rule

Every lattice cell holds one module: letter ink (cream) for glyph cells, counter ink (bronze) for all others.

| Condition | Result |
| --- | --- |
| Neighbour of the same ink, on an axis that ink bonds | The shared side is flat and the two modules merge |
| Any other corner | Rounded (discs), smaller arc (soft squares) or 45° cut (octagons) |
| Inside corner of a bonded L | Concave fillet, up to the corner radius |
| Two letter cells touching diagonally, with counter ink on the other diagonal | A neck: fillet arcs tangent to both corners, at most tangent to the counters |
| Backing on | The letter cells joined both ways, filleted and necked, drawn in counter ink behind the letter and grown by the rim |
| Hairline | Each merged shape is inset by half a hairline, so the inks never touch |

The letter and the counter field each choose their bonds: **loose**, **across**, **down** or **both ways**. A loose disc field is the source's dot texture. Letters joined both ways become one filleted outline per glyph. Mixed bonds give two grains in one field. Red appears only where both inks round off, which yields the source's four-point stars. Necks and fillets are capped at the corner radius, so they never cross into the other ink.

The four passes are **lattice → two-ink field → bonds → fillets & necks** (backing included). Under the December rule nothing bonds, so its bond pass matches the ink field.

## Letters, rules and layouts

- **Alphabet**: the hand-authored 5 × 7 cell map from `letter-shape-systems`, plus `: ! ? + ' & ,` for programme copy. Glyphs keep only their occupied columns, so `1 . : !` are narrower than letters. Input accepts up to 24 characters and four rows (`/`); accented Latin decomposes to its base letters.
- **Shape families**: discs & half-discs (corner radius ½ cell, the source vocabulary), soft squares (0.28) and octagons (45° cuts, including fillets and necks).
- **Named rules** (`PRESETS`): *December* (loose letter discs on a backing ribbon, loose counters), *Ribbon*, *Woven*, *Solid* and *Night*. Applying a rule keeps the text, layout and format.
- **Fit a format**: December 5:7, poster 2:3, A series, square, story 9:16, 16:9 and 3:1. The modules stay square, and the field fills the format with whole counter modules, leaving a paper border of between one border and half a module more. Without `/`, the break with the largest modules wins. Words stay whole, numbers are never split, punctuation never starts a row, and no row holds fewer than half the letters of the longest. Fewer rows are kept unless the letters grow by more than 5% (DECEMBER stays on one billboard row, PUNKT becomes PU / N / KT in a story). `render(input, {width, height})` fits any other box.
- **Natural field**: rows from `/` on a fixed 100-unit pitch, with the field margin as a ring of counter modules.
- **Inks**: the December palette is the median of sunlit areas of the photograph (`source.json` records the sample rectangles). *Night* is a neon variant. *Indigo* and *Rose* come from the v1 colour study.

## Print: riso and separations

The editor's **Riso and separations** panel comes from the shared print kit (`geometry-bench/print-kit.mjs`; see `geometry-bench/print-kit-readme.md`):
- it splits the poster on screen into one black-on-white sheet per ink, with later shapes knocking out earlier ones;
- paper prints as an ink on white stock when it is dark or lighter inks sit on it;
- it previews the riso print with adjustable misregistration and grain, and saves the sheets and the preview.

The build writes the same for every style to `print/` (sheets, riso SVG and PNG, `print/index.json`). `node geometry-bench/print-kit-check.mjs` checks them.

## Files and replay

```sh
node geometry-bench/rkc-disc-system/build.mjs
python3 geometry-bench/rkc-disc-system/contact-sheets.py
node geometry-bench/rkc-disc-system/verify.mjs
node geometry-bench/rkc-disc-system/browser-check.mjs
```

Geometry uses the Clipper polygon kernel shared with the PUNKT system (`../punkt-capsule-system/geometry.mjs`). Loose modules are written as exact SVG arcs, and merged shapes as filled outlines without masks. The build bundles engine, kernel and glyph maps into the editor with esbuild, so the editor works offline. Saved rules name `rkc-disc-field-v2`. v1 rules still open and keep their letters, kernel, inks, inversion and hairline.

`output/rkc-disc-study-v2/` contains the five rules on the source field, RKC, FU / BU, TY / PE, the full alphabet and figures, four construction stages, three family proofs, seven fitted formats and the 16-field bond matrix (`bonds/`). Each is an SVG, a PNG with a 3000px long edge, and a JSON rule. It also holds three module kits, the source photograph, crop and provenance, and `catalog.json`. The boards are `comparison`, `presets`, `families`, `construction`, `bonds` and `fit-formats`.

`validation.json` records Node/resvg checks on this Mac:

- exact SVG and pixel replay;
- three families, four stages each, and sixteen distinct bond fields per family;
- the letter and counter inks never overlap and stay one hairline apart, across every bond pair with and without backing, every rule, tangent extremes and 42 fitted renders;
- every lattice cell is drawn once, with one letter module per glyph cell for all supported characters;
- joined letters are single outlines with the right counters (O, R and A have one; B and 8 have two);
- fit borders, field placement and row breaks;
- v1 migration, invalid inputs and a 2160 × 3000 export.

`browser-validation.json` records isolated Chrome checks of the editor:

- text, sliders, stages, families, bonds, backing and rules;
- saved-rule and URL replay;
- the field and fit layouts, including a 3000 × 1000 billboard PNG;
- SVG/PNG downloads;
- phone-width overflow;
- zero page errors and zero network requests.

Browser evidence lives in `output/playwright/rkc-disc-system-v2/`.

## v1

`engine-v1.mjs` keeps the v1 tile-kit engine unchanged, so `color-study.mjs` and the v1 editor in `output/rkc-disc-study-v1/` still replay exactly. v1's outputs remain for comparison.

Source imagery remains attributed to its designers. The cell alphabet, module rule and every study were made with AI assistance. No native library records, review annotations, models or personal votes are changed.
