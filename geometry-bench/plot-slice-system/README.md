# PLOT — modular letter slices

A vector construction system after **Christian Gautschi’s 2019 PLOT poster for f’ar Lausanne**. [Open the editor](../../output/plot-slice-study-v1/index.html) to compare the source and build your own slice system. Choose a sequence, cut edge, motion, depth profile and row tone; set any text at any angle; place it on a poster, feed, square, story, landscape or banner page; then export SVG, PNG or a saved JSON rule. Letters widen or condense while their stems keep one weight, and every exported slice is a plain filled outline.

The source repeats the **same master word nine times**. Each row starts at the letter tops and reveals a progressively taller crop. This is why the l appears immediately, the t enters in the third row and the o in the sixth. The last row reveals the complete word. These are repeated top windows, rather than nine successive strips cut from one vertically continuous word.

The P, l, o and t are manually authored source studies: a rounded P bowl, a full-height rectangular l, a lower square o and a hooked t with a raised start. Their frames and nine reveal heights were measured from a rectified photograph. The source’s changing row gaps are also preserved. Rectification and placement are proposals; the original font files, production outlines and printing texture are not recovered.

## Modules

The construction is split into independent axes. Any combination works at any angle, with any text, on any page.

| Axis | Choices | What it decides |
| --- | --- | --- |
| Sequence | Grow from the edge (source), Shrink to the edge, Open from the center, Exploded strips | Which part of the master each row’s window shows |
| Cut edge | Straight, Bowed under letters, Single arc, Zigzag, Wave, Steps | The shape of each cut, with *Edge depth* and *Edge period* |
| Motion | Still, Alternating lean, Alternating shift, Drift into place, Compress into the window | How the letters move inside their window, with *Lean*, *Shift* or *Compression* |
| Depth profile | Measured source, Linear, Geometric | How fast the windows deepen; *Reveal progression* bends any profile |
| Row tone | Solid ink, Fade in, Alternate rows, Master in full ink | How each row mixes the ink toward the paper |
| Line width | Fill measure, Natural, with Left / Center / Right alignment | Whether letters stretch weight-true to the measure or keep their drawn width |

Some rules are worth knowing:

- **Exploded strips** cut one word into successive strips. Each cut bulges exactly where its neighbour indents, so with no motion the strips rebuild the master.
- **Open from the center** cuts both sides of each window, sharing the edge depth between them.
- **Compress** squeezes the whole word vertically into its window’s share of the cap height, so at full compression each row shows every letter. Squeezing along a diagonal reveal direction would skew the word across the page; that was tried, and it collapsed the stack at oblique angles.
- **Rows never overlap.** Each row’s height is measured from what its window can show after its motion, including any strip bulge. Motions that move letters sideways reserve side room, and the cap height is solved so the stack still fills the field.

## Systems

Systems are named module combinations with their own palettes and parameter defaults. Changing a module turns the system into a *Custom combination*. If a change happens to match a named system, it takes that system’s name. *Shuffle modules* picks a random sequence, edge, motion, profile, tone, angle, row count and palette.

| System | Modules | Palette |
| --- | --- | --- |
| Progressive windows | Grow · Straight · Still (the source construction) | Cool pearl / royal blue |
| Alternating shear | Grow · Straight · Alternating lean | Pistachio / mulberry |
| Bowed windows | Grow · Bowed under letters · Still | Petal / petrol |
| Exploded strata | Exploded strips · Wave · Alternating shift | Bone / oxblood |
| Saw drift | Grow · Zigzag · Drift into place | Graphite / signal |
| Aperture | Open from the center · Single arc · Still | Lilac / indigo |
| Accordion | Grow · Steps · Compress, fading in | Night / acid |

Shared palette presets sit beside each system’s own pair: Paper / black, Acid / night, Signal / black and Ice / ink. All reach a WCAG contrast of at least 4.5:1.

## Any angle

Two angles generalize the source rule without changing it.

- **Slice angle** (−180° to 180°) sets where the cut enters the letters. 0° is the source: slices run with the baseline from the letter tops. 90° wipes the word in from the left, −90° from the right, 180° reveals from the baseline (the o enters first), and 40° enters at the top-left corner.
- **Word angle** (−90° to 90°) turns the whole stack. Rows always stack perpendicular to the baseline, so 90° gives a word that reads upward with column reveals.

A turned stack takes the largest box that fits the field once turned. It keeps the source proportions where they fit and lengthens the word up to the field’s own aspect, so a vertical word still fills the page. Five presets cover the main cases: Horizontal, Vertical slices, Vertical word, From the baseline and Diagonal. *Sweep the slice angle* animates the cut through a full turn.

## Weight-true widths

Each line fills the measure, as the source word fills its poster. Every outline goes through a small Clipper kernel, the same library PUNKT uses:

1. Each letter is flattened from its authored path to within 0.08 poster units.
2. It is scaled horizontally by one width factor k per line.
3. A horizontal Minkowski step resets its own stem to stem·k^γ. The stem is measured as the letter’s thinnest run through the middle of its ink. γ is .5 when condensing, so compressed letters lighten as compressed cuts do, and .3 when extending.

Horizontal bars never change, so the stem-to-bar contrast stays close to the drawing. k runs from 0.45 to 3. Past 3, a line gains at most .35 cap heights of spacing per gap and then aligns. Only a line that cannot fit even at 0.45 shrinks its cap height, and its stack is then centered. At the source setting k is exactly 1, so Plot keeps its measured frames and outlines.

The g’s hook was redrawn to end clear of its bowl: the original nearly touched it, and any condensing closed a false counter.

## Text and lines

Text accepts A–Z, 0–9, spaces and `. - !`, up to 36 characters, with the first character as a capital and the rest lowercase. Type `/` to set up to three lines. Without it, text with spaces is tried as one line and as balanced two- and three-line breaks, so Shape system becomes Shape / system. Each line is its own reveal stack, and all stacks share one cap height. The figures and marks are new, built on the square o with 28-unit stems and 20-unit bars.

P/l/o/t keep the source-specific contours. Additional capitals and lowercase letters extend the experiment with manually authored outlines; extension bounds are fitted into the final reveal. The extension alphabet is not a reconstruction of the source’s complete typeface.

## Pages

Formats keep the source poster’s 27-unit margins, 68-unit header and 105-unit footer, scaled to each format’s smaller ratio to 700 × 1000. The formats are Poster 7 × 10, Feed 4 × 5, Square, Story 9 × 16, Landscape 16 × 9 and Banner 3 × 1. Each takes one of three scaffolds:

- **f’ar 2019 poster**: the exhibition header, f’ar name, website lettering and 2019 date stay fixed. Small unreadable sponsor material becomes a reveal key, whose bars turn to the on-page slice angle, and a construction credit that names the active modules and angles.
- **Own caption**: up to two lines of serif capitals, set at the source header’s size and stretch. Accented capitals are supported, and other accents fall back to their base letters. The reveal key and module credit stay in the footer.
- **Type only**: no header or footer, and the field grows to the page margins.

Fixed phrases and caption letters are vector outlines prepared from the locally installed Times New Roman and Arial fonts, recorded in `supporting-type.json`. No font binary, external font service or font installation is needed to view or export the finished editor.

## Reel

`reel.mjs` renders a wordless 15-second electro loop of PLOT slices, cut to one 8-bar phrase at 128 BPM. The only words are the source poster’s own copy: Plot, Atlas, Lausanne, Forum and 2019. It is portrait 4:5 (the Feed format at 1440 × 1800), with giant type, neon inks on near-black grounds, and a single light ground for the drop. Every ink clears at least 4.5:1 against its ground.

| Bar | What moves | On the beat |
| --- | --- | --- |
| 1 | The seven slice systems, one word | A cut on every eighth note |
| 2 | The slice angle | A quarter turn per beat, settling on 0°, 90°, 180° and 270° |
| 3 | The reveal rows of Atlas, as tickers in alternating directions | Continuous |
| 4 | Lausanne, cropped giant, through wave, zigzag, steps and bowed edges | Edge depth hits each beat and decays |
| 5 | Forum turning from reading upward to reading downward | One sweep over the bar |
| 6 | Build-up: windows, outlines, then rows multiplying | Sixteenths, with the drop to a light ground on beat 4 |
| 7 | 2019 as an accordion | Windows spring open from the compressed word on each beat |
| 8 | Plot exploding into interlocking strips, then snapping back | The snap lands on beat 4 and loops into bar 1 |

Lowercase words reveal from the baseline in bars 3 and 4, so every row carries ink. Construction lines are drawn at seven times their editor weight, so they still read on a phone. Frames were checked at 390 px wide.

```sh
node geometry-bench/plot-slice-system/reel.mjs     # 1440 × 1800 frames
python3 geometry-bench/plot-slice-system/reel.py   # GIF + MP4
```

The reel writes `output/plot-slice-study-v1/reel/plot-reel-1440.mp4` (50 fps H.264) and a looping `plot-reel-1440.gif`.

## Print: riso and separations

The editor's **Riso and separations** panel comes from the shared print kit (`geometry-bench/print-kit.mjs`; see `geometry-bench/print-kit-readme.md`):
- it splits the poster on screen into one black-on-white sheet per ink, with later shapes knocking out earlier ones;
- paper prints as an ink on white stock when it is dark or lighter inks sit on it;
- it previews the riso print with adjustable misregistration and grain, and saves the sheets and the preview.

The build writes the same for every style to `print/` (sheets, riso SVG and PNG, `print/index.json`). `node geometry-bench/print-kit-check.mjs` checks them.

## Code

| File | Role |
| --- | --- |
| `glyphs.mjs` | Letter outlines in a 100-unit cap box: source P/l/o/t, the extension alphabet, figures and marks |
| `kernel.mjs` | Clipper outline kernel: flattening, weight-true widths, stems, intersections, areas |
| `modules.mjs` | Module catalogues and their geometry: profiles, sequence windows, motions, edges, tones, formats |
| `engine.mjs` | State, layout, windows, rendering and scaffolds; re-exports the public API |
| `workshop.mjs` | The offline editor |
| `reel.mjs`, `reel.py` | The phone reel: frames, then GIF and MP4 |

`slices(rule)` returns every row’s cut pieces as outlines, for tools that need geometry rather than SVG.

## Rebuild and verify

```sh
node geometry-bench/plot-slice-system/build.mjs
python3 geometry-bench/plot-slice-system/contact-sheets.py
node geometry-bench/plot-slice-system/verify.mjs
node geometry-bench/plot-slice-system/browser-check.mjs
```

If supporting phrases or extension contours change, regenerate their prepared assets first:

```sh
node geometry-bench/plot-slice-system/prepare-type.mjs
node geometry-bench/plot-slice-system/prepare-bounds.mjs
```

The build bundles the engine and `clipper-lib` with `esbuild`, both from `geometry-bench/node_modules`. Build and verify rasterize with resvg with system fonts disabled: every SVG is outlined paths, and the font scan alone cost about a second per image.

The output folder includes the standalone offline editor and forty SVG/PNG/JSON proofs: seven systems with transfer words, construction stages, seven angle proofs, four text settings and four page formats. It also holds master specimens, source metadata and hashes, and palette measurements. Visual evidence is in `comparison.png`, `slice-systems.png`, `construction.png`, `text-transfer.png`, `angles.png`, `texts.png` and `formats.png`. Poster PNGs are **2100 × 3000**, and other formats are exported at a 3000 px long edge. JSON and URL state replay through the embedded `plot-slices-v4` engine. Saved v1–v3 rules still open, taking their modules from their system.

`validation.json` records same-machine Node/resvg checks:

- **Systems and controls**: seven distinct systems under common colors and 47 visible parameter changes. Each control is checked only where its module is active, and angle sliders are probed at half range, because center windows are symmetric under a half turn.
- **Passes and replay**: four construction passes, and exact SVG, pixel and JSON replay.
- **Source**: the t/o reveal timing, clean row gaps, and a complete final row matching the master.
- **Angles**: 690 pixel-checked gaps for the three source-era systems, 120 turned-field renders, turned stacks that fill the field, and reveals from the stated side.
- **Widths and text**: 325 width × glyph topology checks, and 385 multi-line gap bands.
- **Modules**: with no motion, interlocking strips rebuild every master line within 0.3% of its area, for all six edges at 0° and 35°. Full rows of grow, shrink and center sequences equal the master. Compression scales each row’s area by its depth. Fade darkens row by row toward the master.
- **Newer systems**: 208 gap bands at four slice angles, and field checks at four word angles.
- **Pages**: all 18 format × scaffold pages have the right size, keep letters in the field, and have a header only with a scaffold. Captions normalize, fall back and reject as intended, and natural width aligns left, right and center.
- **Random combinations**: 48 seeded combinations of every module, angle, format and scaffold keep ink inside the field, rows apart and stacks at full size.

These checks do not score similarity to the original poster.

`browser-validation.json` records isolated Chrome checks of the following, with evidence in `output/playwright/plot-slice-system/`:

- module selects switching to a custom system and back to a named one, and Shuffle;
- the story format and own captions with validation;
- text input, case normalization, and balanced and typed lines;
- clip-free output, palette and orientation presets, angle sliders and the sweep;
- construction passes, variants and inversion;
- saved-rule and URL replay, SVG and PNG downloads, mobile width and offline operation.

New vector interpretations, extension letters, figures, modules, systems, formats, captions, angled slicing and the width kernel were created with AI assistance. Original source design remains credited to Christian Gautschi. Native archive records were not modified.
