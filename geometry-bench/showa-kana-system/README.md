# Shōwa display kana kit

A type system after Japanese display lettering of the 1920s–50s: Victrola (1930), Calpis (1932), Obata Roppei’s Exposition of Japan (1936), Nakashima Gorou’s Kyoto coronation exposition (1928), Yanase Masamu (1929), Yamada Shinkichi’s Ten Commandments (1925), Okuyama Gihachiro’s Nikke (c.1935), Takashi Kono’s デザイン book poster and Family of Man (c.1955) and Shigemi Hijikata’s Ishi-no-Hana. All are from the local archive `output/japanese-posters/`. Open [the editor](../../output/showa-kana-study-v1/index.html) to set any supported text in 13 families, 4 constructions and 3 reading directions, follow the four construction passes, and export SVG, PNG or a saved JSON rule.

The goal is a reusable system, not poster remakes. There is one set of stroke skeletons and one renderer, and every style, direction and layout is a control. Ten families follow source posters; three are new.

## The kit

`glyphs.mjs` holds every glyph as a skeleton of strokes on a 100-unit em: `kind[@weight] x y x y …`. A `~` marks a smooth point that the Curve control rounds; unmarked points stay corners.

| Kind | Primitive | Wedge-brush profile |
| --- | --- | --- |
| `-` `\|` `=` | bar | horizontals grow to the right, verticals thin downward, `=` even |
| `/` `r` | sweep, rise | full at the start, run to a point |
| `\` | press | grows toward the end |
| `.` | dot | short, grows |
| `k` `j` `h` | frame, frame into a sweep, hook | taper only on the first and last runs |
| `o` | ring | even (handakuten, 。, O, 0, 8) |

The character set has 164 glyphs:

- the 46 basic katakana, 21 dakuten forms (ヴ included), 5 handakuten forms, 9 small kana (ァィゥェォッャュョ) and ー・、。
- 36 poster kanji: 日本大会展博覧新聞社東京都阪年月, 一 to 十, 円人中上下山万金映画
- 0–9, a Latin bar alphabet A–Z, and `. , : - ! ? '`

Dakuten and handakuten are built by composition: the base glyph moves toward the bottom left and the marks sit at the top right. Small kana are the full skeletons scaled to 66% and lightened. In vertical columns, ー turns, small kana move to the upper right, and 、。 move to the top right.

## Constructions

| Construction | Ends | Joins |
| --- | --- | --- |
| Square bar | Cut square to the axis, so diagonals end on a horizontal or vertical cut | Corners filled, T-joins stop at the centreline |
| Wedge brush | Cut by a 40° chisel nib | Same; strokes taper by brush role |
| Neon tube | Square ends that round off with the Corner control | Same |
| Stencil cut | Axis cuts | Every join breaks short of the stroke it meets |

Joins are found automatically. An end landing on another stroke's end at roughly a right angle is a corner (filled). An end landing on a stroke is a T-join. Ends that meet at an acute angle stay flat. Stencils break where a stroke ends on another; at a corner only the flatter stroke breaks, so boxes such as 日 keep their shape. Glyphs whose parallel strokes sit closer than the weight allows (mostly kanji such as 覧, 博 and 聞) lighten the crowded direction, by up to half, so counters keep at least 30% of the gap. This usually means thinner stacked horizontals and full-weight verticals, as in heavy gothic kanji. Very short strokes become square dots as wide as the stroke.

The arch places glyphs by their advance along the arc (advance plus tracking, never closer than a small gap at the inner edge), so neighbours never touch. The sweep grows with the word, 11° per glyph step times Arch bend, but the end glyphs never tilt past ±33°: short words take a flatter, larger arc instead of spreading. In vertical columns the arch bends the column with glyphs upright.

## Families

| Family | After | Construction / direction / layout | Finish, ornament |
| --- | --- | --- | --- |
| Gold bars at dusk | Victrola, 1930 | bar, right to left, banner | hard shadow, rays and sun, gradient |
| Exposition bars | Obata Roppei, 1936 | bar, right to left, banner | band and sun |
| Wedge brush | Takashi Kono, c.1955 | wedge, left to right, tilted | red triangle |
| Slanted gold bars | Kono, Family of Man | condensed slanted bar, centred band | black band |
| Block kana | Nikke, c.1935 | heavy bar, fill | black sun |
| Deco inline | Calpis, 1932 | bar, right to left, banner | inline, red sun |
| Arched stencil | Nakashima Gorou, 1928 | stencil, right to left, arch | rays and sun |
| Red columns | Yanase Masamu, 1929 | wedge, vertical columns, fill | none |
| Gold stencil | Yamada Shinkichi, 1925 | stencil, right to left, giant grid | red shadow, triangle |
| Sunburst wedges | Shigemi Hijikata | wedge, fill | yellow shadow, rays |
| Neon tubes | new: electro | tube on near-black, fill | neon glow, ring |
| Fluoro overprint | new: risograph | stencil, vertical columns | pink over blue, out of register |
| Acid outline | new: club flyer | hollow wedge, tilted band | acid lime |

## Controls

| Group | Controls |
| --- | --- |
| Text | Headline (up to 32 characters, four lines). Information lines (set in the same kit). Romaji option. Kana palette |
| Letters | Reading direction (left to right, right to left, vertical columns), construction, weight, wedge contrast, curve, corner radius, slant, width |
| Spacing | Tracking; interlock, which blends the even em box with each neighbour pair's ink profile so shapes nest; line gap. Even spacing widens where heavy strokes overrun the em, so neighbours never fuse before tracking |
| Layout | Banner over a field, fill, giant grid (lines wrap to the largest glyphs), arch, tilted centre; headline size, tilt angle, arch bend; ornament (sun, rays, rays and sun, triangle, band, band and sun) |
| Surface | Solid, hard shadow, inline, hollow outline, neon glow, riso overprint; shadow offset, line width, glow; plain or gradient ground; six colours |

Ornaments fill the field left free between the headline and the information. When no field is left, a disc searches for the largest free spot. If it must sit under the letters, it takes the first palette colour that still separates from them.

The text input converts hiragana, half-width kana and full-width Latin to katakana or ASCII. With the romaji option on, Hepburn romaji converts too: long vowels by macron or hyphen, ッ from double consonants, ン, and yōon (`tōkyō` → トーキョー). An unsupported character is named in the error message.

Right-to-left rows reverse every character, Latin and figures included, as prewar shop signs did (Victrola: 円十五金).

## Rebuild and verify

```sh
node --expose-gc geometry-bench/showa-kana-system/build.mjs
python3 geometry-bench/showa-kana-system/contact-sheets.py
node --expose-gc geometry-bench/showa-kana-system/verify.mjs
node geometry-bench/showa-kana-system/browser-check.mjs
```

`engine.mjs` and `glyphs.mjs` have no dependencies; the build bundles them into the offline editor. `--expose-gc` lets the build and verify free resvg’s native buffers every 25 rasters. Posters are 728 × 1030 (B-series proportion); PNG exports are 2120 × 3000.

`output/showa-kana-study-v1/` contains:

- the editor
- posters for every family with four transferred texts, and the four passes per family
- directions (`directions/`), layouts (`layouts/`), constructions (`styles/`), finishes (`finishes/`) and 18 variations (`variations/`)
- 13 specimens and 4 look-alike sheets
- the references with provenance (`source.json`)
- review boards:
  - `families.jpg` and `phone-size.png`
  - `comparison.png`
  - `text-transfer-tokyo.png` and `text-transfer-expo.png`
  - `directions.png`, `layouts.png` and `constructions-finishes.png`
  - `construction.png` and `variations.png`
  - `alphabet.png` and `lookalikes.png`

`validation.json` records same-machine Node/resvg checks:

- **Families and controls:** the families stay distinct under one palette; every control is visible in every family, and layout and surface controls are inert where they do not apply; every option value is distinct.
- **Passes and replay:** four distinct passes and exact replay.
- **Glyphs:** finite outlines for all 164 glyphs in all four constructions.
- **Legibility guard:** each glyph is rasterised at 48 × 48 and compared by the share of differing ink. Look-alikes (シツ, ソン, ウワ, クタケ, スヌ, ラテフ and others) must differ by at least 15%. Every pair of kana, voiced and small kana and kanji must differ by at least 7%; the closest are dakuten against handakuten.
- **Layout:** reading order in every family, layout and direction, and 1560 margin renders.
- **Arch:** words of 2–10 glyphs in every family, direction and bend, with two trackings; turned em cells never intersect and no glyph tilts past ±33°.
- **Input:** text conversion and error messages.

`browser-validation.json` records isolated Chrome checks of the editor; screenshots are in `output/playwright/showa-kana-system/`.

Limitations:

- The kanji are a fixed poster set, not a general kanji font.
- Legibility was checked by eye on the specimen and look-alike sheets and by the pixel-difference guard, not with readers.
- Stage labels use a system sans-serif.

New vector interpretations, created with AI assistance. The original designs remain credited to their designers; reference images are kept locally for study.
