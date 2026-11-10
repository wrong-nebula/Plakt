# PUNKT — joined capsule columns

A focused vector study of the PUNKT poster credited in the local archive to **Tanja Krebs, @va_bienne and Anna Tuena**. Open [the editor](../../output/punkt-capsule-study-v2/index.html) for a side-by-side source comparison, four construction steps, three column families, three arrangements and reusable SVG/PNG/JSON exports.

The default PUNKT composition is a **manual reconstruction from visible source proportions**. It has a solid P bowl, an offset deep U, a long K stem with two stacked bodies, and a hooked T. Source component coordinates live in a 477 × 714 construction field. The vector poster preserves that aspect at 668 × 1000. The reference image is cropped for comparison; the complete original photograph and its credit remain linked. Photographic perspective, paper wear, print texture and exact production outlines are not recovered.

The first palette uses median RGB samples from two regions of the photo, recorded in `source.json`. The **fluted** and **pinched** families use their own jade/teal and citron/slate palettes. They are new extensions, not source reproductions.

## Construction

Every letter is a real outline built by the polygon kernel in `geometry.mjs` (Clipper booleans and round offsets), so SVG exports are plain filled paths with no masks. The four passes are **column layout → capsule bodies → joins & counters → fillets & hairlines**:

1. Pieces are capsules with one physical cap radius, narrowed only where a piece is thinner than two radii.
2. Pieces and their bridges are united, then closed, which fills each concave corner with a fillet.
3. Counters are cut.
4. Each glyph keeps **one hairline** from the glyphs before it: its outline follows theirs in parallel. Slits are hairline strokes that open onto an edge or a void and end in a round terminal; their mouths keep the two caps' natural flare.

Lengths are poster units (the poster is 1000 tall): hairline width, fillet radius and cap radius are absolute, so they stay the same in every format. The **fluted** family cuts hairline grooves between rods of one width, so wide bodies get more flutes. The **pinched** family curves only the free sides of upright pieces, before joining, so joins never come loose.

`SOURCE_LAYERS` stores the measured PUNKT pieces with their authored slits. `RECIPES` is an experimental A–Z transfer alphabet for new copy. It does not claim to recover the original designers' complete typeface. Input supports A–Z, spaces, hyphens and `/`, up to 24 characters and four rows; accented Latin input decomposes to base letters. Unsupported input shows an error.

## Arrangements

- **Match source layout**: PUNKT keeps its measured layout; other copy falls back to rows.
- **Regular letter rows**: equal letter cells with small captions.
- **Fit the format**: letters stretch edge to edge into a format (poster, A series, square, story, 16:9, 3:1 billboard), as the source stretches its own. Rows come from `/` or spaces, otherwise from a balanced break whose letters come closest to square (PUNKT breaks PU / N / KT). Each row is justified by letter weight; a P or F that starts a row drops its stem into the row below and an L raises its stem into the row above, with the reached rows indented by the stem. `render(input, {width, height, margin})` fits any other box.

Dates and captions are outlined Barlow Condensed Medium (SIL Open Font License), generated into `type-outlines.mjs` by `make-type.mjs`.

## Rebuild and verify

```sh
node geometry-bench/punkt-capsule-system/make-type.mjs
node geometry-bench/punkt-capsule-system/build.mjs
python3 geometry-bench/punkt-capsule-system/contact-sheets.py
node geometry-bench/punkt-capsule-system/verify.mjs
node geometry-bench/punkt-capsule-system/browser-check.mjs
```

The build bundles the engine, kernel and type outlines into the editor with esbuild, so the editor works offline. A saved JSON names `punkt-capsule-v2`; v1 rules still open, but their hairline and join values fall back to the defaults because those controls changed meaning. The URL preserves the current variation across reloads.

`output/punkt-capsule-study-v2/` includes twenty SVG/PNG/JSON examples (three families, construction stages, rows and six fitted formats), three module kits, source/crop provenance, palette samples, component recipes and four boards: reference comparison, families, construction and fit formats. PNG proofs and browser exports have a 3000px long edge.

`validation.json` records same-machine Node/resvg checks: exact vector/pixel replay, three distinct families under one common palette, all twelve family/parameter changes, four distinct stages per family, A–Z transfer, source topology (joined and pinched letters are single pieces without holes, the P bowl is solid, flutes leave no specks), at least one hairline between every pair of glyphs, fitted frames inside and covering six formats with their stem drops and rises, v1 rule migration, invalid inputs and output dimensions.

`browser-validation.json` records isolated Chrome checks of the editor: text/geometry controls, stages, families, saved-rule and URL replay, the fit layout with its format picker, SVG/PNG downloads (including a 3000 × 1000 billboard), mobile overflow, page errors and offline operation. Browser evidence lives in `output/playwright/punkt-capsule-system-v2/`. The v1 study stays in `output/punkt-capsule-study-v1/` for comparison.

The source imagery remains attributed to its designers. The reconstruction, procedural rules and new extensions were created with AI assistance. No native library records, reviews, models or personal votes are changed.
