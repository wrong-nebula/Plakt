# Tategaki colour columns — type system 5

Vertical Japanese setting as a compositional type system, after posters in the local archive: Ikko Tanaka’s *Kanze Noh Play* (1961), Shigeo Fukuda’s *On Children’s Day* (1955), Hisui Sugiura’s Honkyo Subway poster (1927), a Shochiku film poster and a Matsuyama Ballet poster (both 1983, V&A), Katsumi Asaba’s *Dream Road* (1980) and Yoshio Hayakawa’s *Kimono Store* (1951). Open [the editor](../../output/tategaki-study-v1/index.html) to set any text in ten styles, follow the four construction passes and export SVG, PNG or a saved JSON rule.

The goal is a reusable system, not poster remakes: one vertical line model, one renderer, and every style, alignment, rhythm and colour rule as a control. Each reference survives only as one style’s preset.

## Text

Text is entered as columns.

| Mark | Meaning |
| --- | --- |
| `/` or a new line | next column |
| `\|` or a blank line | next group (wider gap, optional rule) |
| `\|\|` | next group stacks below the previous one (two or three tiers share a slot) |
| `*` at a column’s start | title column (Title ×) |
| `-` at a column’s start | note column (Note ×) |
| `漢字《かんじ》` | ruby on the run of kanji before 《; `｜base《ruby》` marks the base explicitly (Aozora Bunko notation) |

Separate fields hold **header rows** (read right to left, prewar style, `/` between up to three rows) and the **Latin band** (Latin only, `/` between up to three bands). Full-width Latin and digits become ASCII, half-width katakana become full width, and ASCII punctuation between Japanese characters becomes its full-width form (`(日)` → `（日）`). Anything outside the prepared set is rejected with a message that names the character.

## The construction

1. **Column grid.** Every column is a line of square cells, one em of its size. Columns run top to bottom and stack right to left. Rows (the *direction* option) run right to left and stack downward — the same line model with the axes swapped.
2. **Vertical forms.** Kana and kanji stand upright. Punctuation, brackets, ー, 〜, …, ‥, ＝, → and small kana take the vertical alternates the font substitutes through OpenType `vert` (60–63 per face). Latin runs turn a quarter clockwise with letter tops to the right, or stand upright one per cell. Numbers can stand upright, sit **tate-chū-yoko** (two half-width `hwid` digits side by side in one cell) or run sideways. In right-to-left rows, brackets and stops are mirrored so they open toward the reading direction, and Latin and numbers stay readable runs.
3. **Colour and rules.** Sizes follow role (title, note), a step per column and a kana scale; colour follows characters (a seeded cycle that never repeats the character above or beside), columns, groups or roles; hairline rules separate groups.
4. **Poster.** Ground (manuscript grid, band and picture field, picture panels, stripes, haze) and fill (solid, outline, gradient with halo, cast shadow, neon glow, riso overprint).

The largest unit size whose block fits the frame is found by bisection; *Size* scales it down. Alignment works along each column (top, bottom, centre, cascading drift, justified), the layout across the page (spread, flush to the reading start or end, centred). Stagger, gap rhythm, group gap, tracking and hand jitter (size, offset and turn per character) shape the rhythm.

## Ten styles

| Style | After | Construction |
| --- | --- | --- |
| Noh colour columns | Tanaka 1961 | Mincho on black, per-character six-colour cycle, ruled groups, programme in two tiers, staggered columns |
| Green bottom line | Fukuda 1955 | Bold mincho on leaf green, bottom-aligned ragged columns, upright digits, note at the far edge |
| Prewar right-to-left | Sugiura 1927 | Header rows read right to left above one column; stripes, cast shadows |
| Gradient title column | Shochiku 1983 | Heavy gothic, justified single column, cobalt-to-vermilion gradient with halo, picture panels |
| Sparse title | Asaba 1980 | Four characters tracked down the edge, notes, one picture field |
| Cascading brush | Hayakawa 1951 | Columns step down to the left, small kana, hand jitter |
| Band and Latin | Matsuyama Ballet 1983 | Title on a vermilion band, notes in tiers, 35 tate-chū-yoko, sideways Latin bands |
| Neon cascade | new — electro | Heavy gothic, glow per column on near-black haze, Latin band at the far edge |
| Riso overprint | new | Rounded gothic, pink / blue / yellow overprinted off register, staggered |
| Manuscript grid | new | Genkō yōshi squares, furigana (Sōseki, 1905) |

## Controls

| Group | Controls |
| --- | --- |
| Setting | Typeface (Hiragino Mincho W3 / W6, Kaku Gothic W6 / W8, Maru Gothic W4), direction, numbers, Latin in columns, ruby on/off |
| Composition | Block layout, column alignment; size, size step per column, title ×, note ×, kana size, margin; tracking, column gap, gap rhythm, group gap, stagger, cascade drift, hand jitter |
| Parts | Latin band position and width, ruby size, header size |
| Colour | Colour cycle (character, column, group, role, one ink), fill, ground, effect strength, rule weight; eight colours (ground, ink, accent, colours 1–5) |

Controls that do not apply (drift outside cascade, ruby size with ruby off, band width without a band, effect with a solid fill) are disabled in the editor.

## Type

`prepare-fonts.mjs` reads the macOS Hiragino fonts with fontkit and writes `fonts.mjs`: outlines for 1,273 kanji (the 1,026 kyōiku kanji plus common poster vocabulary), 180 kana, 81 CJK punctuation marks and symbols and 140 Latin characters, in five faces, with each face’s vertical alternates and half-width digits. Paths are integer font units, relative, as base-64 varints (≈ 3.9 MB for all five faces). Provenance, file hashes and features are in `font-provenance.json` (copied to the output as `type.json`). The outlines are for local study only and must not be redistributed. SVGs carry outlines, not text, so they render the same everywhere.

## Print: riso and separations

The editor's **Riso and separations** panel comes from the shared print kit (`geometry-bench/print-kit.mjs`; see `geometry-bench/print-kit-readme.md`):
- it splits the poster on screen into one black-on-white sheet per ink, with later shapes knocking out earlier ones;
- paper prints as an ink on white stock when it is dark or lighter inks sit on it;
- it previews the riso print with adjustable misregistration and grain, and saves the sheets and the preview.

The build writes the same for every style to `print/` (sheets, riso SVG and PNG, `print/index.json`). `node geometry-bench/print-kit-check.mjs` checks them.

Film, Dream, Ballet, Neon, Riso and Manuscript use gradients or transparency, so their sheets hold greys. The panel flags them; screen them before printing.

## Rebuild and verify

```sh
node geometry-bench/tategaki-system/prepare-fonts.mjs   # only when the character set changes
node geometry-bench/tategaki-system/build.mjs
python3 geometry-bench/tategaki-system/contact-sheets.py
node --expose-gc geometry-bench/tategaki-system/verify.mjs   # frees resvg buffers every 25 rasters
node geometry-bench/tategaki-system/browser-check.mjs
```

`engine.mjs` holds text parsing, layout, colour and drawing; `glyphs.mjs` decodes outlines and writes them through affine matrices. The build bundles both with the outlines into the offline editor. Posters are 728 × 1030 (B-series proportion); PNG exports are 2120 × 3000.

`output/tategaki-study-v1/` contains the editor, every style with its own text and three shared texts, the four passes for four styles, 48 single-change variations (`variations/`), five vertical-form specimens, the references with provenance (`source.json`) and review boards: `styles.png`, `comparison.png`, `text-transfer.png`, `text-haiku.png`, `text-festival.png`, `variations-composition.png`, `variations-rhythm.png`, `variations-colour.png`, `variations-setting.png`, `construction.png`, `vertical-forms.png` and `phone.png` (every style at phone width).

`validation.json` records same-machine Node/resvg/fontkit checks: ten distinct styles under one palette; every control and option value visible in every style; four passes; exact replay; decoded outlines equal to fontkit’s rounded outlines; every vertical form placed or turned correctly in every face (stops upper right, small kana up and right, ー, 〜, … and brackets turned) and used by the renderer; sideways Latin, tate-chū-yoko and upright numbers; right-to-left flow, no overlapping cells and nothing outside the margins in 70 scenes; alignment, layout, tier, size and ruby geometry; per-character colour probes in resvg pixels; and input bounds. `browser-validation.json` records isolated Chrome checks of the editor; captures are in `output/playwright/tategaki-system/`.

**Limitations.** The character set is bounded; other kanji are rejected. No kerning, proportional kana (`palt`) or punctuation compression; columns are explicit, so there is no automatic line breaking or kinsoku. Picture panels are abstract stand-ins for photographs.

New vector interpretations, created with AI assistance. The original designs remain credited to their designers; reference images are kept locally for study.
