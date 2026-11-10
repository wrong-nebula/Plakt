# Primitive kit figures v2 — after Ikko Tanaka and Koji Kato

A shape system after **Ikko Tanaka’s** cell-primitive figures — *Nihon Buyo* (1981), *Kanze Noh* (1973), *Hanae Mori* (1977), *Sharaku 200th Anniversary* (c. 1995) — and **Koji Kato’s** cut-paper bird for Mino Shigyo (c. 1960), from the local Japanese poster archive. Open [the v2 editor](../../output/primitive-kit-study-v2/index.html) to paint figures cell by cell, layer eyes, lips, crests and kumadori over them, set a mood for every face, turn a picture into a figure, generate families, deform the shared construction, set the result in six layouts and sixteen styles, and export SVG, PNG, a saved JSON rule or a series sheet.

The Nihon Buyo face is a 3 × 4 grid where every cell holds one primitive in a flat colour. This system is that kit, generalised: any figure, any grid, one construction. The source figures are presets, not the goal.

**v1 is frozen.** Its sources are in `v1/` and its study in `output/primitive-kit-study-v1/` (never modified by v2). v2 is additive: every v1 figure, style, control, option and layout is still here, and every saved v1 rule renders exactly as it did — `verify.mjs` re-renders all 137 v1 rules from the v1 study and compares SVG and pixels.

## Calm defaults

After review, the v2 defaults were redesigned toward Tanaka’s restraint. The editor opens on **Sumi and vermilion**: one abstract face of eleven cells, cropped by the page, in ink and paper with one vermilion dot and a small vertical column.

- **Showcase styles** — five after the sources (Buyo flat, Gold Noh, Confetti wings, Nine discs, Cut paper) and eight calm ones: Sumi and vermilion (Ichi, cropped), Ivory and cobalt (the 1977 wings in navy), Sage and forest (a calm okame, cropped), Stone mosaic (a heron in slate tesserae), Paper cut (Kato’s bird in forest and cream), Gold relief (Sharaku in bevelled gold), Kabuki red, Sashiko quilt. One figure, large or cropped, ink and paper with one accent, small tracked type.
- **Legacy styles** — Riso cast, Neon masks, Pop stickers, Indigo repeat, Bauhaus family, Newsprint crowd, Acid wallpaper and Mosaic tiles stay selectable in a Legacy group so every saved rule replays; they are not in the showcase.
- **Generator** — calm by default: neutral features (dot, slit or almond eyes; a small bud mouth), no brows, cheeks, kumadori, fangs, noses, whiskers, blush, horns or pupils, and at most three cell colours (`calm:kind:seed:size`, `calmfam:kind:seed:member:size`). The expressive generator stays opt-in (“Expressive features”; `gen:` and `fam:` references are unchanged).
- **Typography** — two restrained copy modes: a small tracked small-caps caption, and a Tanaka-style vertical column. The heavy display band stays for legacy styles.
- **Row layout** — a quiet row of figures at one common scale on a shared baseline, without captions (captions remain only on the cast specimen layout).
- **Presets** — Ichi (an abstract face of eleven cells) and Heron (a few large merged cells, one vermilion crown).

The personal taste model and the craft judge informed the choices (posters scored 700 px wide; before and after judged in one batch). Mean taste: 16 old defaults **0.40** → 13 showcase styles **0.68**; the six replaced styles **0.31** → the eight calm styles **0.86**. Mean craft consensus: **48.6** → **51.7**. The taste model’s balanced accuracy is 0.64, so single scores are noisy; per-poster numbers are in `jury.json` in the study folder.

## What v2 adds

| Addition | What it is |
| --- | --- |
| Six primitives | Crescent `M`, cross `X`, stairs `Z`, stripes `E`, dots `G`, petal `Y` — twenty in all, with three new vocabularies (full kit + v2, textile cells, moons and petals). The v1 vocabularies are unchanged |
| Merged cells | `Q31*2` draws one primitive across 2 × 2 cells (up to 4 × 4), like Tanaka’s big quarter discs; covered cells are written `+`. Blocks survive resolution, vocabularies, warp, jitter and every symmetry (a block on the axis is refitted as a self-symmetric block) |
| Feature library | Eyes closed, side glance, wide, sleepy; flick brows; open, grinning and frowning mouths; cheeks (blush, swirl, lines); hair ornaments (bun, kanzashi pin, comb, topknot); crests (tomoe, flower, wheel, diamond); kumadori lines (sweep, flame, tear) — 46 overlay variants |
| Mood | One control — happy, sad, angry, surprised, sleepy, wink — rewrites the eyes, brows and mouths of every face in every figure; beaks stay |
| Picture → figure | Any picture becomes a grid: each sample takes the nearest palette colour (OKLab) of the picture’s mean colour, the ground colour reads as empty, and the quantiser fits every cell. Optional mirror. The build demonstrates it on four scenes drawn for this study |
| Generator | Eight new kinds — hannya, okame, crane, rabbit, lantern, fan (round or folding), fox, daruma (with none, one or both eyes painted) — thirteen in all; and **families**: members of one seed share palette and proportions and vary hair, eyes, mouths, markings or patterns |
| Finishes | Cut paper (cast shadows), mosaic (grout joints), quilt (running stitches), emboss (bevelled plates), glow fill (electro) — ten paints in all |
| Layouts | Wallpaper (full bleed, any pattern, new half drop), crowd (overlapping rows, back rows smaller) and row (one scale, no captions); series mode makes 2–6 posters from one rule; story 9:16 and banner 5:2 formats; caption and column copy |
| Styles | Calm: sumi and vermilion, ivory and cobalt, sage and forest, stone mosaic, paper cut, gold relief, kabuki red, sashiko quilt; legacy: Bauhaus family, newsprint crowd, acid wallpaper, mosaic tiles (plus the v1 riso, neon, sticker and indigo styles) — twenty-one in all |
| Presets | Kumadori, Big-cell Buyo (merged 2 × 2 primitives), Ichi and Heron — sixteen in all |
| Editor | Fill, region select (flip, half turn, shuffle turns, recolour, clear, copy, paste), mirror brush, merged brush (2 × 2 to 4 × 4), mood, picture import, family generator, figure library export/import, series preview and sheet export |

## A figure is text

```
name: Big-cell Buyo
grid:
Q31*2  +    Q01*2  +
+      +    +      +
S01    S02  S02    S01
T21    S02  S02    T11
T34*2  +    T05*2  +
+      +    +      +
over:
eye.kabuki 1.35 2.42 r.14 c3 d1 m
band 2 2.66 w1.8 h.2 c9
lip.bud 2 3.45 r.11 c3
hair.pin 3.15 .95 r.4 c6 d3
```

**Cells** — a primitive letter, a clockwise quarter turn 0–3, a colour 0–9, an optional `/background`, an optional `*k` span. `.` is empty, `+` lies under a merged cell.

| Letter | Primitive | Letter | Primitive | Letter | Primitive | Letter | Primitive |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `S` | Square | `H` | Half disc | `L` | Leaf | `M` | Crescent (v2) |
| `T` | Half-square triangle | `N` | Arch | `K` | Diamond | `X` | Cross (v2) |
| `Q` | Quarter disc | `B` | Half square | `W` | Wedge | `Z` | Stairs (v2) |
| `C` | Cove | `D` | Disc | `A` | Quarter ring | `E` | Stripes (v2) |
| | | `O` | Ring | `P` | Dot | `G`, `Y` | Dots, petal (v2) |

Turns name a corner (0 bottom-left, 1 top-left, 2 top-right, 3 bottom-right) or an edge (0 bottom, 1 left, 2 top, 3 right).

**Overlays** — `kind x y` in cell units, then `r` radius, `w h` size, `a` angle, `i` inner ratio, `t` thickness, `n` count, `e x,y` line end, `c d` colours, `m` to add the mirror image. Kinds: `disc ring half quarter tri rect band stripes spike lens line`, `eye.kabuki|almond|round|dot|slit|closed|side|wide|sleepy`, `brow.arc|moth|line|flick`, `lip.bud|noh|bow|smile|beak|open|grin|frown`, `cheek.blush|swirl|lines`, `hair.bun|pin|comb|knot`, `mon.tomoe|flower|wheel|diamond`, `kuma.sweep|flame|tear`.

**Colours** are roles: 0 ground · 1 ink · 2 light · 3 red · 4 blue · 5 green · 6 yellow · 7 sky · 8 violet · 9 pink. Figure references in rules can also be `gen:kind:seed:size` or `fam:kind:seed:member:size`; saved rules store the expanded figure text.

## One construction

resolution (×1, ×2, ×4 re-quantisation) → vocabulary (best-fitting substitutes) → turn noise → symmetry (mirror left/right, top half, four-way, half-turn) → lattice warp, gap, rounding, jitter, cell height → overlays (size, mood) → paint → layout (hero, field, wallpaper, cast, crowd, cropped giant) → copy. The four passes are **grid & tokens → kit cells → figure + overlays → poster**.

## Files

```sh
node --expose-gc geometry-bench/primitive-kit-system/build.mjs
python3 geometry-bench/primitive-kit-system/contact-sheets.py
node --expose-gc geometry-bench/primitive-kit-system/verify.mjs
node geometry-bench/primitive-kit-system/browser-check.mjs
```

`engine.mjs` holds the kit, quantiser, generator, moods, picture conversion, styles and renderer (no dependencies); `figures.mjs` the preset texts; `workshop.mjs` the editor. `v1/` keeps the frozen v1 sources.

`output/primitive-kit-study-v2/` contains the editor, twenty-one style posters (SVG, PNG, saved rule), passes per style (`stages/`), presets (`figures/`), thirteen generator kinds (`generator/`), six families (`families/`), four faces in seven moods (`moods/`), the feature library (`features/`), picture → figure with its source scenes (`image/`), ten finishes (`finishes/`), sixteen layouts and formats (`layouts/`), three series of four with sheets (`series/`), twenty deformations (`variations/`), three 4240 × 6000 prints of v1 variations (`hires/`), the kit specimen, `catalog.json` and references with provenance. Boards: `comparison.png`, `styles.png` (showcase), `legacy.png`, `figures.png`, `generator.png` (calm), `generator-expressive.png`, `families.png`, `moods.png`, `features.png`, `image-figures.png`, `finishes.png`, `layouts.png`, `series.png`, `variations.png`, `construction.png`, `kit.png`, `phone.png` (showcase posters at 390 px wide).

`validation.json` records same-machine Node/resvg checks: v1 replay (all 137 v1 rules, SVG and pixels), styles distinct, every control and option value visible, passes, exact replay, figure-text round trips, mirror tables for twenty primitives, refinement, merged cells under symmetry and deformations, symmetry to the pixel, the generator and families, moods, picture → figure recovery, series, region operations, margins in five formats and input bounds. `browser-validation.json` records isolated Chrome checks of the editor; evidence is in `output/playwright/primitive-kit-system-v2/`.

New vector interpretations created with AI assistance; nothing is traced. The original designs remain credited to Ikko Tanaka and Koji Kato. Reference images are copyrighted and kept locally for study only.
