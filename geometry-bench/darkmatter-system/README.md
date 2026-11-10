# Hørde DarkMatter — wedges and quarter-discs

A type system after the poster credited in the local archive to **Hørde, in collaboration with Altiplano Typefaces**, 2021. [Open the editor](../../output/darkmatter-study-v2/index.html) to set any text, follow the four construction steps, change the shared construction and export SVG, PNG or a saved JSON rule. Six edge systems and six treatments give the same text 36 constructions before layout and colour. The measured poster composition remains available as the **HØR / DE source collage**.

The source reads **HØR / DE**. Rectangular masses overlap at unequal scales and meet through fine gaps. Triangles open the Ø, a quarter-disc opens the R, and the D brings a broad circular sector into a chamfered corner. The H's lower counter is mostly filled, and the fill's diagonal edge runs on through the stem as a hairline.

## One part

Every glyph is built from one part: a **block whose corners are square, chamfered (a wedge) or rounded (a quarter-disc)**. A glyph lists ink blocks, counter blocks, pockets and joints in letter units (100 tall, its advance wide). The stages show the pipeline: **parts → solid masses → counters & joints → poster**.

| Corner | Meaning |
| --- | --- |
| number | A chamfer of that size, in letter-height units: it stays 45° when a frame is stretched |
| `{r}` | A quarter-disc of that radius, also height units, so it stays circular |
| `[x, y]` | A chamfer in frame units, which stretches with the frame |
| `'c'` / `'r'` | A wedge or quarter-disc spanning the whole block — the counter parts |

- **Counters** are blocks removed from the ink: notches open to an edge, wedges and quarter-discs. The D, P and R counters start in a cusp at the top edge, as in the source.
- **Pockets** are open counters partly filled with dark matter. The fill's edge starts on one wall at a depth set by **Dark-matter fill**, falls at 45° in poster space, and runs on through the opposite stem as a joint. The joint is only cut where it crosses that whole stem with half a counter-width to spare. Where it would leave through the counter's open end, it would only nick a sliver off an arm or foot, so the fill stays a plain wedge. The H, E and F use pockets: a tall H gets its hairline, as in the source, while E and F arms mostly end in clean 45° wedges.
- **Joints** are hairlines cut with square ends. Open ends run past the letter, so the cut leaves it cleanly. The Q's tail is one.
- **Marks** are incised, since every letter fills the full height. Umlaut dots are square holes, and the Å ring is a cut annulus whose centre is laid back in.

Every polygon is wound the same way before the booleans, so overlapping cuts never cancel each other. Ink is united, and counters and joints are subtracted with Clipper booleans. Specks smaller than three joint widths squared, or one terrace step in the terraced system, are dropped. SVG output is plain filled paths, with no clip paths, masks or painted strokes. Joint width and the terrace module are poster units (every format is 1100 tall). They keep one physical size on display letters and shrink below 200 units of letter height.

| Control | Effect |
| --- | --- |
| Stem weight | Stem width `s`; bars follow at 0.62 × s |
| Corner wedge | The chamfer guide `c` on B, C, D, F, G, P, R and S |
| Quarter-disc fullness | Every arc, from flatter to squarer |
| Counter aperture | Scales counters and pockets about the edge they open onto, or their centre |
| Dark-matter fill | Pocket depth: 0 leaves the counter open, 1 fills it to a wedge |
| Fine joint width | Every hairline and the gap between packed letters |
| Diagonal scoop, terrace module, facets per quarter, ogee swing, corner softening | One per edge system, shown only for it |
| Line inset, hatch spacing, slices per line, slice shift, shadow depth | One or two per treatment, shown only for it |
| Letter width, spacing, line gap | Even rows only |
| Interlock | Packed masses only: how far neighbouring stems step into each other |

Controls that cannot change the current rendering are disabled; `verify.mjs` checks both directions.

## Edge systems

An edge system redraws every diagonal and arc of the parts — ink, counters, pockets and joints alike — so a letter keeps its construction and changes its edges.

| System | Edge rule | Palette |
| --- | --- | --- |
| Wedges & quarter-discs | Straight diagonals, circular arcs | Ice blue / midnight |
| Scooped diagonals | Every diagonal bends into a concave scoop | Lilac / aubergine |
| Terraced quadrants | Diagonals and arcs become terraces of one module | Rose / oxblood |
| Faceted quarters | Every quarter-disc is cut into 1–5 straight facets; at one facet every curve becomes a wedge | Mint / forest |
| Ogee diagonals | Every diagonal swings into an S-curve | Sand / umber |
| Softened masses | Every square corner of every part becomes a quarter-disc of one radius | Ultraviolet / ink |

Softening uses the system's own vocabulary rather than rounding the finished outline. Rounding the finished mass would erode the thin necks at the D, P and R cusps and break letters apart. Instead, square corners of ink blocks and counters become quarter-discs, so counters gain fillets and outer corners round. Three kinds of corner stay square: corners beside a whole-block wedge or disc, a counter's corners on the letter's edge (where rounding would leave ears at the opening), and corners that sit on another part (two wedge halves of one counter would leave a keyhole). Joints and marks stay sharp. On the source collage the measured masses are rounded outside only, so its fine gaps never close.

## Treatments

Treatments act on the finished letters after interlock, in any edge system and layout, from the counters & joints step on.

| Treatment | Effect | Control |
| --- | --- | --- |
| Solid | Plain masses | — |
| Inline | A hairline (the joint width) runs inside every mass, parallel to its edge | Line inset |
| Outline | Only a band along each edge remains; counters, pockets and joints keep their places | Line inset (band width) |
| 45° hatching | Hairlines on one 45° grid for the whole format cut every mass, continuing from letter to letter; the edge system bends or steps them too | Hatch spacing |
| Glitch slices | Each line of letters is cut into horizontal slices that shift sideways in turn | Slices per line, slice shift |
| 45° shadow | Each mass casts a solid extrusion down and to the right, in a tone halfway between figure and ground, behind all letters | Shadow depth |

Palettes are independent of systems: the source yellow and ink (median samples of the rectified photograph), the six system palettes, and **Acid / carbon** and **Signal / black** for night and phone formats. Choosing a system in the editor keeps the current colours; **Edit this system** in the gallery applies its palette. Inversion swaps ground and figure and inverts the specimen colour.

The editor's **Variations** strip renders the current text in all six systems and all six treatments. The thumbnails render one per frame once typing settles, and choosing one applies it with the colours unchanged. **Shuffle** picks another system, treatment and palette at once. On desktop the poster is sized to the window height and the controls scroll on their own, so the whole format stays in view while editing.

## Characters and setting

A–Z, Æ Ø Å Ä Ö Ü, 0–9 and `. - + !` — 46 characters. Æ joins the A's diagonal to the E's pocketed arms. ß is set as SS, and other accents fall back to their base letters. O is a leaf with rounded opposite corners, Ø a square split by two wedges, and 0 a stadium, so the three stay distinct. Text takes up to 36 characters in up to five lines; `/` starts a new line.

- **HØR / DE source collage**: the measured contours for HØRDE (or HORDE), at 700 × 1100. Other text falls back to packed masses. The strip's CONSTRUCTION lines are set in the live alphabet, so stem, wedge and fill change them at the poster step.
- **Packed masses**: letters fill the format edge to edge, separated only by the joint. Each row is stretched to the full width. With **interlock**, the joint between two neighbours jogs sideways at 45°, as the source's R stem follows the Ø's edge. The giving letter is shaved and the gaining letter's stem shifts into the space. A step is only taken where both sides are straight stems: the ground given away must be a clean slice, and the ground gained is filled by one whole stem or left empty. Bowls and chamfers are never faceted. Of three step heights and two directions, the step that removes the least ink wins, so an E's stem tucks under a T's arm before it cuts a neighbouring stem. Without `/`, the break is chosen so letters come closest to the source's tall proportions (about 0.62 wide per unit of height). Word breaks are free and breaks inside a word cost a little: DARK MATTER packs as DARK / MAT / TER on a poster and DARK / MATTER on a landscape.
- **Even rows**: letters keep their proportions in centred rows with letter spacing. The break that sets the largest letters wins. Spacing is optical. Each letter's ink profile (the distance from each side of its frame to the first ink, in 24 bands) comes from the live construction. A pair closes up by part of its average opening, but never by more than leaves 35% of the letter spacing at the closest point. Stem pairs stay put, while L|T, T|A, A|V and Y|. lose the holes between them.

Formats: source poster 7:11, A series, square, story 9:16 and landscape 16:9. Non-source layouts reserve a footer for the study credit and a module key, drawn by the same kernel.

The alphabet is a new construction from the source's parts. It does not claim to reproduce the complete DarkMatter typeface, and the original font files and production outlines are not recovered.

## Print: riso and separations

The editor's **Riso and separations** panel comes from the shared print kit (`geometry-bench/print-kit.mjs`; see `geometry-bench/print-kit-readme.md`):
- it splits the poster on screen into one black-on-white sheet per ink, with later shapes knocking out earlier ones;
- paper prints as an ink on white stock when it is dark or lighter inks sit on it;
- it previews the riso print with adjustable misregistration and grain, and saves the sheets and the preview.

The build writes the same for every style to `print/` (sheets, riso SVG and PNG, `print/index.json`). `node geometry-bench/print-kit-check.mjs` checks them.

## Rebuild and verify

```sh
node geometry-bench/darkmatter-system/build.mjs
python3 geometry-bench/darkmatter-system/contact-sheets.py
node geometry-bench/darkmatter-system/verify.mjs
node geometry-bench/darkmatter-system/browser-check.mjs
```

The build bundles the engine, the shared Clipper kernel (`punkt-capsule-system/geometry.mjs`) and the support lettering into the editor with esbuild, so it works offline. `output/darkmatter-study-v2/` contains 32 SVG/PNG/rule proofs, six alphabet specimens, source provenance, a catalog and eight boards: `comparison.png`, `shape-systems.png`, `text-transfer.png`, `treatments.png`, `construction.png`, `formats.png`, `alphabet.png` and `phone-check.png` (packed proofs at 390 px wide). PNGs are 3000 px on the long edge.

Saved rules name `darkmatter-v2`, and the URL keeps the current rule. v1 rules still open: word becomes text, family, colours, aperture, fullness, joint and scoop carry over, and transferred words open as packed masses. v1's terraces per edge became an absolute module, so it falls back to the default.

`validation.json` records same-machine Node/resvg checks. They cover:

- six distinct edge systems under one palette, in the collage and in packed text
- five treatments each changing the poster in all three layouts; inline, outline and hatching only removing ink in all six systems; slices staying on the page; only the shadow adding a second tone
- every control changing the poster where it applies, and not changing it where it is disabled (72 / 36 cases)
- four distinct passes per family and layout
- exact SVG/pixel/JSON replay, and every v1 rule in the v1 study opening
- all 46 characters in all systems: inside their frames, counters only removing ink, no crumbs
- 90 text × layout × format settings, with frames inside the page, no overlaps, and packed rows from margin to margin
- full interlock in all systems: neighbouring pairs never touch and keep the joint between them, and the letters do step
- optical spacing: stem pairs keep the letter spacing, open pairs close up, and kerned neighbours never touch
- plain paths at stages 3–4, the source H/Ø junction pixels, ground-coloured packed joints, input bounds and export sizes

They do not score similarity to the original or legibility.

`browser-validation.json` records isolated Chrome checks: the poster fitting the window, text, line and Nordic input, the interlock slider, six systems and six treatments with their own controls, the variations strip, shuffle, layouts, formats, controls and their disabled states, stages, systems, palettes, inversion, v1/v2 rule loading, PNG/SVG downloads, URL replay, mobile width and offline operation. Evidence lives in `output/playwright/darkmatter-system-v2/`.

The v1 study — manual poster contours with a stroke-painted extension alphabet — stays in `output/darkmatter-study-v1/` for comparison; its engine is `engine-v1.mjs`.

New vector interpretations, the alphabet and the tools were created with AI assistance. The original source design remains credited to Hørde + Altiplano. Native archive records were not modified.
