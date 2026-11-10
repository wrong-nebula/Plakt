# More Love / Weltformat — reciprocal module type

A type system after **New Studio’s 2021 Weltformat poster**, credited in the local archive. Open [the editor](../../output/more-love-study-v2/index.html) to set lettering in A–Z, 0–9 and basic punctuation, follow the four construction steps, change the shared construction and export SVG, PNG or a saved JSON rule. The measured poster composition stays available as the **NEW STUDIO** preset.

The source lettering reads **NEW / STU / DIO**. Version 2 builds all 26 letters, including those nine, clear alternates for N and W, the figures 0–9 and punctuation from one construction kit. Version 1 drew the nine source letters separately and assembled the other letters from scaled copies of them; it remains in `output/more-love-study-v1/` for comparison (`v1-v2.png`).

## The construction kit

Every letter starts from the same parts, in glyph units with a cap height of 100:

| Part | Rule |
| --- | --- |
| Frame | A body box. Horizontal frames are 82 wide with tips left and right; vertical frames are 100 wide and 74 tall, with tips above and below, so those tips pass the cap line as in the reference |
| Tip | Two concave shoulders meeting at a rounded point. Each shoulder is the parabola measured on the reference N: it leaves the corner along the side and flares into the tip |
| Notch | The same shoulder pair turned inward (U, V, B, K, X, Y) |
| Counter | An ellipse, or a slot with elliptical corners. A tip pushes the counter out through its side into the tip |
| Cut | A straight slit of the shared cut width. It stops just inside the counter, so it never notches a bar or stem behind it |
| Opening | A wider removal from one side (E’s aperture, I’s sides, C’s mouth) |
| Stem, bar | Rectangles added after the cuts. A stem placed against a cut continues that cut’s edge, as in the source W |

Polygon booleans combine the parts into one ink region per letter. A single corner pass then rounds every convex corner and fillets every join. It does not erode thin shoulders, and it never bridges a cut, so each piece is one clean contour with no overlapping joins or nubs.

N E W / S T U / D I O follow the reference. The other seventeen letters, the ten figures and the punctuation are new: A (top tip, open counter, crossbar), H and M (tipped stems), K and X (four reciprocal notches), Y (notched fork), V (one deep notch down to its bottom tip, where U keeps a round counter and a pill), B (two counters and a notched waist), Q (O with a tail), Z (S’s spine mirrored onto a flat frame), and so on. Each figure stays clear of its letter look-alike: 0 is O turned upright (top and bottom tips, side cuts, no bar), 1 carries a tip as its flag, 2 has a top tip and a diagonal spine where Z has a flat frame, 8 is notched at the waist on both sides where B has one notch, and 5 and 6 share a flat top bar over a tipped bowl. Punctuation uses square dots the size of the frame weight, a hyphen and en dash with short tips, and a question mark on the 2’s tipped arch. These are interpretations, not recovered original outlines.

### Letterforms

The source N and W only read inside NEW STUDIO: in running text N is hard to tell from O and Q, and W reads as ɑ. Each has a clear alternate built like M, from tipped stems under one bar. The clear N has one counter open below and one open above, so its diagonal steps from top left to bottom right; the clear W is M turned upside down. The **Letterforms** setting chooses **Auto** (the source forms for NEW STUDIO, clear forms for anything else), **Source** or **Clear**. Saved rules record the setting.

## Controls

| Control | Effect |
| --- | --- |
| Curve fullness | Scales every curve handle |
| Tip reach | Length of every tip; the counter follows it into the tip |
| Frame weight | Frame thickness, stems and bars |
| Cut width | Every slit |
| Corner softness | Convex corner radius and join fillets |
| Letter spacing | Space between letters (spreads the source cells) |
| Band height | Height of the two word bands (passes 3 and 4) |

The three shape systems transform the same curves: **reciprocal arcs** (cobalt / pale rose), **tensioned lenses** (handles pulled toward their chords; mulberry / celadon) and **chamfered curves** (each curve sampled into facets; lagoon / acid yellow). Each has its own two-color palette; the reference’s orange and blue stay in the source image. The four passes are **frame & cuts → solid letters → word bands → poster**. The first shows each letter’s box and only what each counter, cut and notch removes.

## Setting text

Both the display lettering and the band words take A–Z, 0–9, spaces and `. , : ; - – ! ? '`, up to twelve characters; in the display lettering `/` chooses up to three rows. Accented Latin letters decompose to their base letters, curly apostrophes become straight and the em dash becomes an en dash. Without `/`, one to three characters sit on one row, four make two rows (FU / BU, 20 / 21), and longer lettering shares three rows evenly, like NEW / STU / DIO. Whole words win when they need at most one more letter per row (MAKE / IT / BOLD). All rows share one cap height and letters are spaced by their actual ink.

One and three rows use the source’s row slots and band positions. Two rows pair the bands in the middle (row / band / band / row) and each row grows to fit its half, tips included, so short words fill the poster. The band words use a separate extended grotesque, now with figures and punctuation; narrow marks keep narrow advances, so dates like 9.10.–17.10. set evenly. The small festival credit is a fixed scaffold and, as in the reference, ends with the festival dates.

## Rebuild and verify

```sh
node geometry-bench/more-love-system/build.mjs
python3 geometry-bench/more-love-system/contact-sheets.py
node geometry-bench/more-love-system/verify.mjs
node geometry-bench/more-love-system/browser-check.mjs
```

`engine.mjs` holds the letters, layout and poster; `geometry.mjs` holds the shared primitives, curve transforms, booleans and corner pass. The build bundles both with Clipper (`clipper-lib`, Angus Johnson, Boost Software License) into the editor, which runs offline with no font service or network request. PNG exports are 2154 × 3000; SVG keeps the vector contours. Saved JSON names `more-love-v2`; version 1 rules still open, keeping their text, palette and controls, and are drawn with the new construction.

`output/more-love-study-v2/` contains the editor, twenty-two SVG/PNG/JSON proofs, three specimens (A–Z, figures, punctuation and the other N and W), source metadata and palette measurements. `comparison.png`, `alphabet.png`, `shape-systems.png`, `construction.png`, `text-transfer.png`, `figures.png`, `punctuation.png` and `v1-v2.png` are the review boards.

`validation.json` records same-machine Node/resvg checks: three distinct systems under one palette, 21 visible control changes, four passes per family, exact replay, the nine source cell centres, clean contours for all 45 glyphs and both N/W forms in all families at every control extreme (no slivers; parts stay inside the cap band except tips, Q’s tail and the comma), pixel probes of cuts, bars, the clear N and W and the figures most like letters, the three letterform settings, row rules, band clearance for transferred text, input bounds, version 1 rule replay and export size. It does not score similarity to the original typeface. `browser-validation.json` records isolated Chrome checks of the specimen, text, figure, punctuation and row inputs, the letterforms setting, all seven controls, stages, systems, inversion, saved-rule / version 1 rule / URL replay, downloads, mobile width, redraw time and offline operation. Browser evidence is in `output/playwright/more-love-system-v2/`.

New vector interpretations, extensions and tools were created with AI assistance. The original design remains credited to New Studio. No native archive records were changed.
