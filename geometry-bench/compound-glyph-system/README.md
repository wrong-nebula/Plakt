# Compound-glyph silhouettes v2 — after Yamashiro, Fukuda, Aoba and Matsunaga

Type system 7, version 2. A silhouette is drawn by a field of small marks whose choice, size and turn carry the image: **Ryuichi Yamashiro’s** *Forest* (1954), where 木 → 林 → 森 follow the density of the wood; **Shigeo Fukuda’s** *No More* (1968), where shells pack around a skull left open; **Masuteru Aoba’s** written head (1993) and *Hiroshima Appeals* disc; **Shin Matsunaga’s** *Shiseido Sun Oil* (1971) crowd with one odd element. Open [the v2 editor](../../output/compound-glyph-study-v2/index.html) to set any word or silhouette in 17 styles, paint and place on the poster, and export SVG, PNG, a triptych, a saved rule or a set file.

It is a reusable system, not poster remakes. The source layouts survive only as five styles’ defaults.

## Versions

- **v1** is frozen: `output/compound-glyph-study-v1/` is not touched, and `v1/` holds the shipped v1 engine, editor, build, checks, fonts and README so it stays rebuildable (`node --expose-gc geometry-bench/compound-glyph-system/v1/build.mjs` would rewrite that folder).
- **v2** (`engine.mjs`, ENGINE `compound-glyph-v2`, output `output/compound-glyph-study-v2/`) is additive. Every v1 style, set, silhouette, control, option and layout is unchanged, and v2 options default to v1 behaviour, so **every saved v1 rule draws exactly as in v1**: `verify.mjs` re-renders all 147 v1 JSON rules and compares them with the v1 SVG files (per-render ids normalised; a sample also pixel by pixel). The v1 glyph outlines in `fonts.mjs` are byte-identical; v2 only adds glyphs. No motion: no animated previews, GIFs or video.
- A note on v1’s `validation.json`: its SVG-level control and option counts compared raw SVG strings, which always differ because each render’s id hash follows its state, so those counts were met trivially (its pixel checks on three styles and the browser checks were real). v2’s checks normalise the ids, and because v2 draws the v1 styles identically they re-test all ten v1 styles properly.

## What v2 adds

| Area | Additions |
| --- | --- |
| **Running text** | Packing `rows` (lines of text filling the silhouette, at the base angle), `contours` (concentric offset outlines of the shape, as Aoba’s written head), `streams` (evenly spaced flow lines). Marks are set one after another by their advance and turned along the line, so the escalation happens inside running text; the new set *The text, in reading order* keeps spaces as gaps. Line and letter spacing controls |
| **Lattices** | `grid`, `hex`, `spiral` (golden-angle phyllotaxis) alongside v1 blue noise; sparse ground still thins a lattice |
| **Driving fields** | `attract` (attractor points placed on the poster, with reach), `image` (a luminance grid drives density and level: darkness on paper, brightness on night grounds) with three images rendered procedurally here (moon, dunes, ripple) or an uploaded image kept as a 128 px grid in the rule, and painted density (brush strokes that add or erase) |
| **Layers and negative space** | A second silhouette (any shape or a second word) with its own size and offset that acts as its own set and ink 5, as a **hidden word** that lifts every mark inside it, or as a **void**; an outside set with ink 4 — up to three stacked regions with their own sets |
| **Escalation sets** | 17 more: 牛 犇, 金 鑫, 犬 猋, 馬 驫, 魚 鱻, 虫 蟲, 耳 聶, 子 孖 孨, 又 双 叒, 白 皛, 田 畾 (middle pairs composed), · • ● ◉, o O ◎, i l L, 1 10 100 1000, no NO NO!, ki き キ 木 林 森 (mixed scripts); **weighted custom chains** (`木*4 林 森*.4`) and a set library (save / open a set file) |
| **Narrative marks** | Odd ones and heroes placed by clicking; gradient maps top to bottom and edge to core; the region inks |
| **Composition** | Formats poster (728 × 1030), story 9:16 (608 × 1080), square (900 × 900), landscape (1030 × 728); macro zoom with crop; a `knockout` layout that cuts the title out of the field and sets it solid; `series()` and a triptych export (one silhouette, three sets; one set, three silhouettes; three finishes) |
| **Editor** | Pointer tools (paint denser, paint sparser, attractor, odd one, hero) with clear buttons, image upload, second word, set library, triptych; disabled controls follow the state |

## Seventeen styles

Ten from v1, unchanged: Forest ink, Alarm shells, Written head, Written disc, Beach crowd (after the posters), Electro swarm, Kanji in kanji, Dot halftone, Riso wave, Ember mountain. Seven new:

| Style | What it shows |
| --- | --- |
| Contour script | WRITE THE HEAD runs round a head on concentric outlines in Hershey script tubes |
| Typeset silhouette | Rows of running text fill MO / RI; along each line ki → き → キ → 木 → 林 → 森 by depth |
| Flow lines | Dashes end to end on flow lines that follow a wave; neon on near-black |
| Moon halftone | A moon rendered here drives density and level of · • ● ◉ on a hex grid |
| Hidden word | A disc of 木 and 林 with MORI hidden in it, readable by its 森 |
| Three layers | A mountain of 石 砳 磊, a sun of 火 炎 焱 and water of 水 沝 淼 around them |
| Phyllotaxis sun | 日 昌 晶 on a golden-angle spiral, turned outward; the title SUN knocked out of the field |

## The construction (four passes)

1. **Silhouette and field.** The silhouette — an authored shape or the word in a heavy face — becomes a signed distance field (nonzero scanline fill, exact Euclidean distance transform). Inside / outside densities, edge softness and halo (both measured against the silhouette’s own depth), a field (now also attractors, an image and painted strokes) and the second silhouette make a density map; a flow sets each mark’s turn. The pass draws outlines, density contours, flow ticks, attractors, brush dabs and pins.
2. **Samples.** Placed odd ones and heroes, then found ones, edge rows, and the packing: blue noise, a lattice, or running text along rows, contours or flow lines. Every mark is a chain of discs checked against a spatial hash; sparse ground adds a keep-out disc (not on running text, where spacing is the advance).
3. **Escalated marks.** Each mark takes a level from its region’s set by density, depth, size, chance or in turn, with optional weights; compounds a face lacks are composed from their radical.
4. **Poster.** Colour by level, density, random, gradient map or region ink; finish (fill, outlined tubes, glow, cast shadows); the type, including the knocked-out title.

## Controls

v1’s 26 controls plus line spacing, letter spacing, macro zoom, crop across / down, attractor reach, second-silhouette size / across / down (35). New selects: packing, format, image, second silhouette, its role, its set, the outside set. Placed points, strokes and images are stored in the rule as fractions of the page, so they survive format changes.

## Rebuild and verify

```sh
node --expose-gc geometry-bench/compound-glyph-system/build.mjs
python3 geometry-bench/compound-glyph-system/contact-sheets.py
node --expose-gc --max-old-space-size=1024 geometry-bench/compound-glyph-system/verify.mjs
node --expose-gc geometry-bench/compound-glyph-system/browser-check.mjs
```

`prepare-fonts.mjs` re-extracts the bounded glyph set (433 KB `fonts.mjs`; Hiragino from this Mac, local study only; Archivo Black and Anton under OFL; Hershey script; provenance in `font-provenance.json`).

`output/compound-glyph-study-v2/` holds the editor, all 17 styles, `type/` (every style with TYPE / WITH / TYPE and 水), `stages/` (v2 styles), `packings/`, `fields/`, `layers/`, `sets/`, `formats/`, `crops/`, `narrative/`, `series/`, `images/` (the rendered field images), specimens, references with provenance and boards: `shape-systems.png`, `v2-styles.png`, `phone-check.png`, `packings.png`, `fields.png`, `layers.png`, `sets.png`, `formats.png`, `narrative.png`, `series.png`, `text-transfer.png`, `construction.png`, `specimens.png`, `images.png`, `comparison.png`.

`validation.json` records: the 147 v1 rules redrawn identically; 17 distinct styles under one palette; all 35 controls changing every style’s SVG (pixels in three); every option value distinct; four passes; replay; every style in every format; packing without overlaps in every packing and outside the knocked-out title; running text in reading order on rows, contours and flow lines; escalation per style; the image, attractor, brush, hidden-word, void, layer, pin, weight, series and zoom behaviours; phone-size contrast for each style’s silhouette, type boxes and knocked-out titles excluded (≥ 3, or a colour difference for layered styles) and for TYPE / WITH / TYPE and 水 in every style (≥ 5); every set token in four faces; inputs; 3000 px exports in four formats. `browser-validation.json` records isolated Chrome checks, including opening v1 rules, the pointer tools, image upload, the set library and the triptych; captures are in `output/playwright/compound-glyph-system-v2/`.

## Known limitations

Running text on contours reads upside down on the lower half of a loop, as circular type does. A knocked-out title sits across the middle of the field by design, so with a word as the silhouette it covers part of that word (the phone check leaves type out of its measurement). Word silhouettes need marks smaller than their strokes. Composed compounds are squeezed copies, not designed glyphs. An uploaded image is reduced to a 128 px luminance grid. Header and information lines use system fonts (titles use the bundled outlines). References are copyrighted and kept locally; nothing is published.

New vector interpretations, created with AI assistance. The original designs remain credited to Ryuichi Yamashiro, Shigeo Fukuda, Masuteru Aoba and Shin Matsunaga.
