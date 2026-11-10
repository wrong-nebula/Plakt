# Compound-glyph silhouettes — after Yamashiro, Fukuda, Aoba and Matsunaga

Type system 7. A silhouette is drawn by a field of small marks whose choice, size and turn carry the image: **Ryuichi Yamashiro’s** *Forest* (1954), where 木 → 林 → 森 follow the density of the wood; **Shigeo Fukuda’s** *No More* (1968), where shells pack around a skull left open; **Masuteru Aoba’s** written head (1993) and *Hiroshima Appeals* disc; **Shin Matsunaga’s** *Shiseido Sun Oil* (1971) crowd with one odd element. Open [the editor](../../output/compound-glyph-study-v1/index.html) to set any word or silhouette in ten styles, follow the four construction passes, and export SVG, PNG or a saved JSON rule.

It is a reusable system, not poster remakes: one sampler, one set of silhouettes and escalation sets, and every style, field, flow and finish as a control. Five styles follow the posters; five are new. The source layouts survive only as each style’s default.

## How it extends the existing recipe

The Swift shape library already has **Glyph and image density field** (`survey-module-substitution` in `Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json`, drawn in `Sources/PosterCore/Library/SurveyTypeGeometry.swift`): modules on a grid of rows whose pitch follows a density exponent (down, across or radial), one brief glyph per module normalised to equal ink area, an optional mask of the title’s first letter, and a size field. This study keeps that recipe’s ideas — density drives the field, a letter can be the mask, equal-ink normalisation — and adds what the grid cannot do:

| Glyph and image density field (Swift) | Compound-glyph silhouettes (this study) |
| --- | --- |
| Grid rows, pitch from a density exponent | Seeded blue noise (random sequential adsorption) inside any silhouette, with variable spacing |
| One glyph per module, cycled from the brief | **Escalation sets**: the glyph itself climbs 木 → 林 → 森 by density, depth, size, chance or in turn |
| Mask: inside / outside the first letter | Signed distance field of an authored shape **or the whole word** in a heavy face; inside and outside densities, soft edges |
| Fixed module rotation | **Orientation flow**: along or across the outline, radial, swirl, curl noise, blended with a base angle |
| Equal ink area always on | **Ink balance** slider from equal em (0) to the recipe’s equal ink area (1) |
| — | Heroes, edge rows, odd ones out, tube / glow / shadow finishes |

The Swift code is unchanged; this is a JavaScript study in `geometry-bench`.

## The construction (four passes)

1. **Silhouette and field.** The silhouette — an authored shape (crown, tree, conifers, head, skull, disc, hand, wave, mountain, whole page) or the word set in Archivo Black, Anton or Hiragino Sans W9 — is filled with a nonzero scanline rasteriser on a 2-unit grid and turned into a signed distance field with an exact Euclidean distance transform (Felzenszwalb). Inside and outside densities, an edge softness and a field (core, edge, radial, vertical, noise groves, contour rings, with strength and curve) make a density map. Softness and a sparser outside halo are measured against the silhouette’s own depth (the half-width of its thickest part): a disc 25 marks deep keeps its wide fade and halo, while a word’s thin strokes get a narrow fade and a quiet halo, so the word still reads; a flow sets each mark’s turn. The pass draws the outline, density contours and flow ticks.
2. **Blue-noise samples.** Odd ones and heroes first (largest first, deep on the dense side), then rows on iso-distance lines just inside the edge so the outline reads crisply, then a shuffled jittered grid. Every mark is a chain of discs along its long axis checked against a spatial hash, so long shells pack as tightly as dots; sparse ground adds one wider keep-out disc, so long marks thin out too. The pass draws every disc, coloured by level.
3. **Escalated marks.** Each sample takes a level and an alternative from its set and a glyph or primitive is placed, sized (size follows density, jitter, heroes, ink balance) and turned (flow, base angle, rotation jitter). Faces that lack a compound build it from its radical — 沝 = 水 水, 众 = 人 over 人 人 — the way the compounds were made.
4. **Poster.** Colour (by level, one ink, random inks, density gradient; soft edges fade tone with density), finish (filled, outlined tubes, neon glow, cast shadows), the odd one out and the type.

## Ten styles

| Style | After | Silhouette / set / finish |
| --- | --- | --- |
| Forest ink | Yamashiro, *Forest*, 1954 | Crown; 木 林 森 in Mincho by noise-grove density; large 森 and 林 heroes; sumi on paper |
| Alarm shells | Fukuda, *No More*, 1968 | Skull, inside sparse and outside dense; shells short → long following the outline; black on signal red |
| Written head | Aoba, *Tategumi Yokogumi*, 1993 | Head profile; squiggles, Hershey script letters and capitals as outlined tubes, turned at random |
| Written disc | Aoba, *Hiroshima Appeals* | Disc fading into the paper; every mark is the word, built up (pe → peac → peace); stamp box layout |
| Beach crowd | Matsunaga, *Shiseido Sun Oil*, 1971 | Whole page; figure → pair → group, random turns and inks, cast shadows, one sun |
| Electro swarm | new — neon | The word RA/VE; dots → crosses → stars denser toward the edges, on curl noise, cyan → violet → magenta glow on near-black |
| Kanji in kanji | new — type with type | 森 written with 木 林 森: one tree at the edges, a forest at the core; three greens and one red 人 |
| Dot halftone | new | Open hand; . → : → ∴ by depth, turned to face the outline; process blue on newsprint; vertical title |
| Riso wave | new | Breaking wave; kana by stroke count (し つ く → い こ り → あ お ぬ) following the outline; fluorescent riso inks |
| Ember mountain | new — neon | Mountain; 火 → 炎 → 焱 rising toward the summit, ember gradient glow on night |

## Escalation sets

Compounds by repetition: 木 林 森 · 口 吕 品 · 日 昌 晶 · 火 炎 焱 · 水 沝 淼 · 人 从 众 · 土 圭 垚 · 石 砳 磊 · 車 䡛 轟 · 一 二 三. Kana by stroke count. Latin o → oo → ooo. Primitives: . → : → ∴, · → + → ✳, — → = → ≡, shells short → long, figure → pair → group, squiggle → letter → capital. From the word: its letters, the word built up, and **repeat** (x → xx → x over xx, the compound rule applied to any character). **Custom**: levels separated by spaces, alternatives by `|`, glyphs, `x2:` `x3:` `v2:` compositions or `@primitives`.

## Controls

| Group | Controls |
| --- | --- |
| Silhouette | Silhouette (11), word face (3), layout (poster, full bleed, banner, column, stamp); size, offset, inside density, outside density, edge softness, edge rows |
| Density field | Field (7); strength, curve, noise scale |
| Marks | Escalation set (22), mark face (Mincho, Kaku Gothic, Maru Gothic, Hershey script); size, spacing, size follows density, size jitter, heroes, hero scale, ink balance |
| Escalation | Escalate by (density, depth, size, chance, cycle); bias, level noise |
| Flow | Flow (6); strength, base angle, rotation jitter |
| Finish | Finish (4), colour mode (4), odd one out (5); odd ones, odd scale, ink weight, glow / ink bleed, seed; six colours |

Controls without a visible effect in the current state are disabled in the editor (`activeControls`).

## Fonts

`prepare-fonts.mjs` pre-extracts a bounded set of outlines into `fonts.mjs` (342 KB; no font files are bundled): Latin, the compounds above, 16 more kanji and 24 kana from Hiragino Mincho W6, Kaku Gothic W6 and Maru Gothic W4 (macOS, local study only; Hiragino Sans GB W6 fills 吕 沝 众 砳 䡛 in the gothic); Latin, kanji and all kana from Hiragino Sans W9 for word silhouettes; Archivo Black and Anton (OFL) for Latin word silhouettes; the Hershey script single-stroke centrelines (hersheytext, MIT port of the public Hershey fonts). Provenance with SHA-256 hashes is in `font-provenance.json` (copied to `fonts.json` in the output).

## Rebuild and verify

```sh
node geometry-bench/compound-glyph-system/prepare-fonts.mjs   # only if the bounded glyph set changes
node --expose-gc geometry-bench/compound-glyph-system/build.mjs
python3 geometry-bench/compound-glyph-system/contact-sheets.py
node --expose-gc --max-old-space-size=1024 geometry-bench/compound-glyph-system/verify.mjs   # frees resvg buffers as it goes
node geometry-bench/compound-glyph-system/browser-check.mjs
```

`engine.mjs` holds the sets, silhouettes, sampler and renderer (its only import is `fonts.mjs`); the build bundles both into the offline editor. Posters are 728 × 1030 (B-series proportion); PNG exports are 2120 × 3000.

`output/compound-glyph-study-v1/` contains the editor, every style as a poster, `type/` (every style with TYPE / WITH / TYPE and 水 as the silhouette), `stages/` (four passes per style), `masks/`, `sets/` (all 22 sets on one tree), `layouts/`, `options/` (flows, fields, finishes, level rules, odd ones), `variations/` (twelve new combinations), ten specimens, the references with provenance (`source.json`) and review boards: `comparison.png`, `shape-systems.png`, `phone-check.png`, `text-transfer.png`, `masks.png`, `sets.png`, `layouts.png`, `options.png`, `variations.png`, `construction.png`, `specimens.png`.

`validation.json` records same-machine Node/resvg checks: ten distinct styles under one palette; all 26 controls change every style’s SVG, and its pixels in three styles (in a context where they are active); every option value distinct in every style (SVG) and in pixels for two; four distinct passes; exact replay; packing (no two marks’ discs overlap, centres inside the field and outside type boxes); escalation (every level used, its driver rising with the level); a phone-size contrast check (mean ink inside vs outside the silhouette at 300 px tall, type boxes excluded) for every style’s own silhouette (≥ 3) and for every style with TYPE / WITH / TYPE and 水 as the silhouette (≥ 5; words have thinner parts); every set token in every mark face; text and custom-level input handling. `browser-validation.json` records isolated Chrome checks of the editor; captures are in `output/playwright/compound-glyph-system/`.

## Known limitations

Word silhouettes need marks smaller than their strokes; large-mark styles lose thin letters unless the mark size comes down. Composed compounds (沝, 众 … in Mincho and Maru) are squeezed copies, not designed glyphs. Header and information lines use system fonts (titles use the bundled outlines). Silhouettes are new drawings, not traced; references are copyrighted and kept locally.

New vector interpretations, created with AI assistance. The original designs remain credited to Ryuichi Yamashiro, Shigeo Fukuda, Masuteru Aoba and Shin Matsunaga.
