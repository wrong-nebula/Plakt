# Wagara window letters — type system 6

Heavy letters used as **windows into traditional Japanese patterns**, after Ikko Tanaka’s *Poster Nippon 1955–72* (1972), where each block letter of NIPPON opens onto its own motif, and the pattern posters of Tadanori Yokoo (*Takeo* 1997, *National Bunraku Theatre* 1971, *16th JAAC* c. 1956–66), Yusaku Kamekura (*Classical Performing Arts Friendship Mission* 1981) and Norito Shinmura (*MUJI New Year* 2014). Records are in the local Japanese poster archive (MoMA and People’s Graphic Design Archive). Open [the editor](../../output/wagara-study-v1/index.html) to set any text, follow the four construction passes, and export SVG, PNG, a saved JSON rule or a single pattern tile.

The goal is a reusable system, not poster remakes: one pattern kit, five letter sources, eight layouts and one renderer; every style is a preset of those parts. Six styles follow the posters, three are new.

## The wagara kit

Eighteen procedural vector patterns (`patterns.mjs`). Each is a lattice of motifs: a motif depends only on its lattice index modulo a small period, so the pattern repeats exactly by its two period vectors and by a rectangular tile. Only motifs that can reach the visible region are generated; consecutive paths of one ink merge, so a full field stays a handful of elements in painting order.

| Pattern | | Construction | Detail |
| --- | --- | --- | --- |
| Seigaiha | 青海波 | Concentric fans in half-offset rows; each row’s paper discs hide the row behind | Rings |
| Gyorin | 魚鱗 | Shallow scale arcs hung from the lowest points of the row above | Echo lines |
| Asanoha | 麻の葉 | Triangular lattice, every triangle’s vertices joined to its centroid | Stars (ink, accent) |
| Kikkō | 亀甲 | Flat-topped hexagons | Inner shells |
| Shippō | 七宝 | Circles on two interleaved square lattices | Lens petals, centres |
| Ichimatsu | 市松 | Checks; line weight grows or shrinks the ink squares | Nested squares |
| Uroko | 鱗 | Triangle rows, apex on the joint below | Sierpiński subdivision |
| Yagasuri | 矢絣 | Chevron feathers in alternating inks | Barbs and shaft |
| Kanoko | 鹿の子 | Rounded tie-dye squares on a diagonal grid | Eye, pupil |
| Sayagata | 紗綾形 | Linked manji: arms *a*, hooks *b*, lattice v₁ = (a+b, a−b), v₂ = v₁ turned 90° | Arm length |
| Tatewaku | 立涌 | Paired wavy lines, neighbours half a wave apart | Lines |
| Nami | 波 | Parallel sine lines with drifting phase, gathered into crests | Lines per crest |
| Ume | 梅 | Five round petals on a half-drop lattice, turned and coloured by index | Centre, stamens |
| Sakura | 桜 | Five notched petals | Centre, dots |
| Kiku | 菊 | Radial capsule petals, a second ring behind | Petal count |
| Take | 竹 | Culms with node ridges and a highlight, leaf sprays from alternate nodes | Leaves |
| Hinode | 日の出 | Rising sun with rays over two wave mounds (Yokoo’s repeated tile) | Rays |
| Sumi | 墨 | Solid ink — the plain window | — |

Every pattern takes **scale, rotation, line weight, detail** and **two inks** (paper and ink) plus an accent; figurative motifs take their colours in turn from a cycle. The rectangular repeat of each is exported as `patterns/<id>.svg`.

## Letters as windows

Letters come from the 7-row cell alphabet shared with the isometric prism study (**block** corners or **round**, eased by a clipper opening) or from pre-extracted outlines of three heavy OFL faces — **Archivo Black**, **Anton**, **Rubik Mono One** (`prepare-fonts.mjs` → `fonts.mjs`; provenance and licences in `font-provenance.json`). Each glyph is condensed or extended, then grown or thinned as a true outline offset (clipper), so heavy weights close the counters to Tanaka’s slots. Letters sit like tiles: placed by their outline boxes with a fixed gutter.

Every letter is an SVG clip path. Behind it, one pattern is drawn in that window’s inks — by **sequence** (six slots, letter by letter), **one pattern for all**, or the sequence **shuffled**; anchored per **letter** or as **one field** behind all letters; inked from **six window pairs in turn**, **two inks only**, or two inks **swapped** per letter; with an optional turn per letter. Edges: **keyline**, **rim** (the pattern clipped to an inner offset, an ink frame around it) or **double keyline** (an outer offset ring). Shadows: **drop**, **block** (an exact extrusion, unioned with clipper) or **neon glow**.

## Layouts and the ground

| Layout | After | The kit around the letters |
| --- | --- | --- |
| Nippon row | Tanaka | Dark ground (optionally patterned), boxed outline title built from the same letters |
| Justified stack | new | Each row stretched to the full width — phone-first |
| Crest bands | Kamekura | Panels between strips of crests (one lattice row); one text row per panel |
| Pattern field | Yokoo, 1960s | The whole sheet a repeated tile, crossed by stripes snapped to the tile rows |
| Sea horizon | Yokoo, Bunraku | Dark-to-bright sky with suns over a patterned sea of rolling crests |
| Bamboo bars | Yokoo, Takeo | A patterned sky disc behind, bamboo and vermilion bars in front |
| Tenugui frame | new | A patterned border around a plain field |
| Scale emblem | Shinmura | A large patterned fish emblem (scales follow its axis) above the letters |

## Nine styles

| Style | After | Letters / patterns / layout |
| --- | --- | --- |
| Nippon windows | Tanaka 1972 | Heavy block cells; seigaiha, bamboo, sunrise, steam, shell, plum; six window pairs on black |
| Bamboo bars | Yokoo 1997 | Round cells filled with bamboo, keyline and vermilion drop; plum-blossom sky disc |
| Wave horizon | Yokoo 1971 | Archivo windows into one sea field; cobalt and gold seigaiha |
| Sunrise field | Yokoo c. 1956–66 | Anton letters with geometric wagara and a navy block shadow over a field of rising suns |
| Gold crest bands | Kamekura 1981 | Black letters in gold lattice on gold panels, strips of cherry crests |
| Sea bream scales | Shinmura 2014 | Vermilion letters scaled in gold under a scaled fish |
| Neon wagara | new — electro | Rubik Mono windows of glowing line patterns on near-black, magenta glow |
| Indigo cotton | new — tenugui | White resist patterns on indigo, rims, seigaiha border |
| Kabuki checks | new — two-ink | Anton extended, inks swapped per letter, double keylines, vermilion block shadow |

## Controls

| Group | Controls |
| --- | --- |
| Letters | Letter source; weight, width, gutter, row gap |
| Windows | Pattern assignment, one pattern or six sequence slots, anchor, inks; pattern scale, rotation, line weight, detail, turn per letter |
| Edge and shadow | Edge, shadow; keyline / rim width, shadow depth and angle |
| Layout and ground | Layout, ground pattern; ground pattern scale, bands / stripes / bars / frame |
| Colour | Seven roles (ground, text, keyline, shadow, accent, band, band ink) and six window pairs |

Controls that cannot change the current poster (a keyline with no edge, a shadow angle with no shadow…) are disabled in the editor and verified inert.

## Rebuild and verify

```sh
node geometry-bench/wagara-system/prepare-fonts.mjs         # only if fonts change
node --expose-gc geometry-bench/wagara-system/build.mjs      # add --editor to re-bundle only the editor
python3 geometry-bench/wagara-system/contact-sheets.py
node --expose-gc geometry-bench/wagara-system/verify.mjs
node geometry-bench/wagara-system/browser-check.mjs
```

resvg frees its native buffers only on garbage collection, so build and verify collect every few rasters when run with `--expose-gc`; renders load only the font files the posters name (Helvetica Neue, Georgia, Hiragino Sans) instead of scanning all system fonts.

`engine.mjs` (families, layouts, renderer), `patterns.mjs` (the kit) and `letters.mjs` (sources, clipper offsets) have no dependencies beyond clipper-lib and the prepared outlines; the build bundles them into the offline editor. Posters are 728 × 1030 (B-series proportion); PNG exports are 2120 × 3000.

`output/wagara-study-v1/` holds the editor, every style with four more texts, the four passes per style, every layout on two styles (`layouts/`), pattern scales from 10 to 160 (`scales/`), the five letter sources (`sources/`), sixteen variations (`variations/`), specimens and kit sheets per style, pattern tiles with 3 × 3 repeats (`patterns/`), the references with provenance (`source.json`) and review boards: `comparison.png`, `styles.png`, `text-transfer.png`, `layouts-tanaka.png`, `layouts-neon.png`, `scales.png`, `letter-sources.png`, `variations.png`, `construction.png`, `tiles.png`, `kits.png`, `alphabet.png`.

`validation.json` records same-machine Node/resvg checks: nine distinct styles under one palette; every control visible where active and inert where not; every option value distinct; four passes and exact replay; every pattern periodic by both period vectors and its tile, straight and turned 30°, and its exported tile matching the field when repeated; all glyphs of all five sources at extreme widths and weights; margins in every layout; and legibility at pattern scales 10, default and 160 — against the same poster without letters, either every letter’s inner rim or its drawn keyline must differ from what lies behind it (closed silhouettes), and letter bodies must differ on average. Pixels the layout covers on purpose (the bamboo bars in front, about 7% of the letters) are excluded and reported; the weakest case is Bamboo bars at its default scale (89% of the keyline distinct). `browser-validation.json` records isolated Chrome checks of the editor; captures are in `output/playwright/wagara-system/`.

New vector interpretations, created with AI assistance. The original designs remain credited to their designers; reference images are kept locally for study and are not published.
