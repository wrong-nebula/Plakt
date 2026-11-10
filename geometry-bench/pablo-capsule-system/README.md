# Pablo Nouvelle / Neubad — capsule type

A type system after the poster credited in the local archive to **Enea Bortone**. Open [the editor](../../output/pablo-capsule-study-v1/index.html) to set any text in columns or rows, follow the four construction steps, change the shared construction and export SVG, PNG or a saved JSON rule. The measured poster composition remains available as the **Neubad source layout**.

Seven styles are frozen as fonts — Incised, Compressed, Split, Exploded, Tube, Tube Shadow and Tube Fill. See [the family page](../../output/pablo-capsule-study-v1/font/index.html) and [Fonts](#fonts) below.

## Shared parts and seams

Every glyph is an assembly of a few parts placed on common guides. Parts are rounded rectangles — blocks, discs, half-discs and shoulders, depending on which corners are round — plus a few wedges. The guides are the **stem split** `s`, the **mid line** `m` and the **ascender/descender depth** `d`. Letters with a stem (a b d f h j k n p q r u B D) take their stem width from `s`; the rest keep fixed proportions.

Seams are declared lines between parts. Each end has a type:

| End | Behaviour |
| --- | --- |
| `c` closed | Stops short by the bridge, so the letter stays one piece |
| `o` open | Runs out of the letter: the counter's opening |
| `v` aperture | Open, with a V notch scaled by the aperture control (c, e, figures) |
| `j` joined | Meets another seam exactly |

The incisions are what carry the reading, so a closed seam reads as a closed counter and an open seam as an open one.

| Control | Effect |
| --- | --- |
| Seam width | Hairline width, as a fraction of the em |
| Bridge at closed seams | Inset at closed ends; 0 cuts right through and separates the parts |
| Stem / bowl split | Moves the `s` guide in every stem letter |
| Bowl squareness | One curvature for every round corner, from circular to squarer |
| Aperture notch | Size of the V notch at aperture ends |
| Letter width, letter spacing, line gap | Setting; width and line gap do not apply to the source layout |
| Half displacement | Offset family only |

The three cutting systems act on the finished glyphs: **incised** (single seams), **twin** (each seam doubled along its normal) and **offset** (the glyph split at its middle and displaced along the line). The construction steps are **frames & guides → parts → solid bodies → seams**.

## Characters and setting

Lowercase a–z, figures 0–9, `. , : ; ! ? ' " - – — / ( ) [ ] & + = % # *`, poster punctuation `« » × · … → ← € $ ° @`, the space and `ä ö ü ë é è ê à â ô û ç`. The ampersand is the source poster's own form. The type is unicase: capitals use the lowercase forms, except **B** and **D**, which keep the source's capital forms (as in "Band").

Accents are incisions: the letters fill the full height, so marks are cut into the top (two short slots for an umlaut, one diagonal for an acute or grave, a caret for a circumflex, a slot in the foot for a cedilla). A circumflex replaces a seam that leaves the top centre, which would otherwise turn ô, ê and û into arrows. Other accents fall back to their base letters; curly quotes fold to straight ones; ß becomes ss.

**Cut**: Regular, or **Compressed** — 64% width, with round corners capped at 1.1 × their width so bowls become stadiums with round ends instead of pinched ellipses. The poster's ampersand is a drawing rather than parts, so it keeps 82% of its width.

**Wide seams** (the stencil styles): open ends overshoot by 0.6 seam widths, just enough to leave the letter, and a straight seam running just inside a part edge moves onto that edge instead of leaving a sliver. Neither rule changes anything at hairline width.

Text uses `/` for a new line and `\/` for a slash: up to eight lines of 24 characters, 64 in all. Layouts:

- **Columns reading up**: first line on the left, read from the bottom, as in the poster.
- **Columns reading down**: first line on the right, read from the top.
- **Rows**: first line at the top.
- **Neubad source layout**: exactly two lines in the measured columns; the date, venue, ampersand, Band block and ornaments are a fixed scaffold.

All lines share one em. **Fill each line** stretches letters so every line runs the full length (capped at three times the set width); **Even letter size** keeps the set width.

## Fonts

| Font | Construction | Glyphs |
| --- | --- | ---: |
| PosterLab Capsule **Incised** 1.2 | Incised 1.1 with every outline kept exactly, optically spaced, plus « » × · … → ← € $ ° @ and the rest of printable ASCII | 94 |
| PosterLab Capsule **Incised** 1.1 | Incised 1.0 plus the twelve accented letters; every 1.0 glyph is carried over exactly | 73 |
| PosterLab Capsule **Incised** 1.0 | The default construction, frozen first; no accents. Kept unchanged | 61 |
| PosterLab Capsule **Compressed** 1.2 | Compressed cut, default construction; width class 3. Optically spaced, all of printable ASCII | 94 |
| PosterLab Capsule **Split** 1.2 | Stencil: bridge 0, seam 0.05 em, so closed seams cut through. No crumbs, slivers or overshoot grooves | 94 |
| PosterLab Capsule **Exploded** 1.2 | The stencil with 0.12 em gaps, with the same clean-up | 94 |
| PosterLab Capsule Tube **Regular** 1.2 | The poster's outline lettering as an outlined two-lane track. Stacked-loop 8; « » × · … → ← ° $ € @ and the rest of ASCII | 92 |
| PosterLab Capsule Tube **Shadow** 1.2 | The track plus a solid extrusion down and right, like the poster's | 92 |
| PosterLab Capsule Tube **Fill** 1.2 | The solid tube silhouette. Shares every advance with Tube and Tube Shadow 1.2, so it sits exactly under either in a second colour | 92 |

Every earlier version stays frozen and downloadable from the family page; Incised 1.0, the version the system started from, stays exactly as it was. 1.2 keeps each 1.1 outline exactly (Tube Fill: each 1.0 outline) and changes three things:

- **Optical spacing.** 1.1 gave every glyph the same half-gap on each side, so flat-sided letters (i, l, m) set tighter than round ones (o, c, e) and diagonals (x, v, y) looked loose. 1.2 measures each side's average white across the letter's height (capped at 0.1 em) and moves the sidebearing by 65% of its distance from the alphabet's mean, so the rhythm evens out. No side goes below half the base gap, so without kerning two letters never get closer than the base gap; the other sides give back what that floor adds, so the average letter gap stays exactly 1.1's. Accented letters take their base letter's spacing; punctuation keeps the plain half-gap. `spacing.mjs` does the measuring.
- **All of printable ASCII.** < > \ ^ _ ` { | } ~ in every style (the Capsule backtick is a short stroke, so it never reads as the apostrophe), and $ € @ in Tube, where € and @ use a thinner inner track.
- **Line metrics and names.** Typo, hhea and Windows metrics agree and cover every outline (Tube's line is 1.17 em for its accents and shadow); USE_TYPO_METRICS is set; weight classes are 800 for Capsule and Tube Fill, 400 for Tube and Tube Shadow; each style links as its own Regular for older apps and as a named style of its family for newer ones.

1.0 had the j and f slivers, the k, x and y crumbs, overshoot grooves in p and b, the squeezed Compressed ampersand, a boxed Tube 8 and a flat offset shadow. Font-building drops any piece smaller than 3,000 units² (the 1,000-unit em).

`font.mjs --freeze <style> <version>` writes a style's exact outlines to `fonts/capsule-<style>-<version>.json` and refuses to overwrite an existing version. Capsule outlines are the union of each glyph's parts minus its seams and notches (paper.js). Tube outlines come from `tube.mjs`: a monoline skeleton per character with filleted corners, offset into a fat stroke whose outline and centre line form two lanes (Clipper); accents sit above the letters there. The OTFs, specimens, text samples and the family page are built from the frozen files alone, so later changes to the live system never change a frozen version. The family page shows the latest version of each style and links earlier ones. Versions of a style share a family and style name, so install only one of them.

Glyphs are 700 units tall in a 1000-unit em. Capsule styles use seam 0.018, bridge 0.09, stem 0.5, squareness 0.45, aperture 0.16 and letter spacing 0.055 em unless the table says otherwise. At build time each Capsule style matched the live engine's specimen of the same construction to within a few differing pixels of about half a million ink pixels (Incised 1.0: 0 for a–z). Exploded 1.1 differs by 130 pixels: the crumbs the font drops and the live engine still draws. The fonts load in macOS CoreText, fontkit and Chrome. They have no kerning and no OpenType features; 1.2's optical sidebearings stand in for kerning. Tube is fully unicase, so B and D take the lowercase forms there too.

## Reel

`reel.mjs` renders a wordless 15-second electro loop of capsule posters, cut to one 8-bar phrase at 128 BPM: lineup posters, scrolling tickers, giant flexing words, campaign formats, a build-up and drop, and one poster morphing from billboard to story. It is portrait 4:5 with large, condensed type so it reads on a phone.

Colours are named neons and grounds from meodai's colour names (Volt, Acid Green, Hyperlink Blue, Electric Indigo, Neon Purple, Technolust, Neon Pink, Red Light Neon, Toxic Orange, Binary Black, Artemis Silver …). A RampenSau hue cycle walks the wheel across the 32 beats, each beat's partner comes from a complementary pro-color-harmonies palette, and Poline glides the stage colour during the morph. Every ink is pushed until it clears a WCAG contrast ratio against its ground. Large light/dark swaps happen at most once per beat, so the reel stays fast without strobing.

```sh
node geometry-bench/pablo-capsule-system/reel.mjs            # 1440 × 1800 frames
python3 geometry-bench/pablo-capsule-system/reel.py          # GIF + MP4
```

The engine's `render(input, page, visible)` sets type on any page size; the optional visible area skips glyphs that would fall wholly off the frame.

## Rebuild and verify

```sh
node geometry-bench/pablo-capsule-system/build.mjs
python3 geometry-bench/pablo-capsule-system/contact-sheets.py
node geometry-bench/pablo-capsule-system/verify.mjs
node geometry-bench/pablo-capsule-system/browser-check.mjs
```

`build.mjs` also rebuilds every frozen font. It uses the existing geometry-bench dependencies (resvg, culori, paper.js, opentype.js). Boards use Pillow and local Arial for labels. Poster lettering and ornaments are vector paths; the editor needs no fonts, CDN or network.

`output/pablo-capsule-study-v1/` contains the editor, per-family type specimens and Neubad-layout versions, transfer probes, layout and construction examples, alphabet specimens, `catalog.json` (controls, guides and every glyph's parts and seams at the defaults), source provenance and the `font/` folder. PNG proofs and browser exports are 2139 × 3000. Saved rules name `pablo-capsule-v2`; rules saved by the first version still open, in the Neubad layout.

`validation.json` records the Node/resvg checks: replay, distinct cutting systems, every applicable control changing pixels and inapplicable ones staying inert, the guide and seam invariants, orientation and fit across 7 texts × 3 layouts × 2 fits, the source layout, input rules, v1 migration and the frozen fonts (built from their frozen files, matching outlines, Unicode mapping; for 1.2 also unchanged outlines, the spacing floor and mean, ASCII coverage, metrics, names and the stacking Tube trio). `browser-validation.json` records the Chrome checks of the editor. Visual quality is reviewed by eye, not scored.

The source imagery remains attributed to its designer. This is an interpretation of the visible construction, not the designer's typeface or production files. The type system, extensions and font were made with AI assistance.
