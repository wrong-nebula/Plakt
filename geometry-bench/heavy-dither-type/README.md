# Heavy dither type — type system

A type system after the same reference as the [Heavy dither shape system](../heavy-dither-system/README.md): a photograph dithered to coarse 1-bit pixels inside a black frame, sent by the user on 8 November 2026. [Open the editor](../../output/heavy-dither-type-study-v1/index.html) to set any text, build and light its letters, dither them, and export SVG, PNG, a JSON rule, or an OTF font of the style.

Letters here are tone, not outline. The goal is a system for any copy, not a remake of the reference; the reference is kept as one style (**Photo type**) and nothing is traced from it.

## The construction

1. **Set.** Text (“/” breaks lines) is set in one of sixteen SIL OFL faces with width, slant, weight, tracking and leading. **Bounce** and **spin** lift and turn each glyph by its own seeded amount.
2. **Warp.** The set outlines are resampled and bent: wave, arc, floor (perspective), bulge or zigzag, measured against the setting’s own block.
3. **Measure.** The outlines are scanned row by row into coverage at up to 4× the pixel grid, then an exact Euclidean distance transform gives every sample its signed distance to the nearest edge. **Weight** shifts that distance, so letters thicken or thin without new outlines.
4. **Construct.** The distance decides what is letter:

   | Construction | Rule |
   | --- | --- |
   | Solid | Everything inside |
   | Outline (hollow) | A band inside the edge, a share of the stroke’s half width, so every stroke opens |
   | Contours | Bands at a fixed spacing inside the letters and two rings outside, like a map |
   | Neon tube | A tube centred on the outline |
   | Eroded | The edge eaten by noise, like a worn stamp |
   | Slices | Horizontal cuts through each line, two to ten of them |
   | Melting | Columns drip below the letters, each by its own seeded length |

5. **Relief.** A profile turns depth across the stroke into height — flat, tube, chisel, pillow, groove (inline) or rim — and the light (direction, height, ambient, gloss) shades its slope. Fills tint the letter: a ramp up each line, a sweep across the setting, swirl, cloud or stripes.
6. **Outside.** Halos spread letter tone outward; drop shadows sit under the letters at an offset and softness; extrusions sweep the letters along an angle from a near tone to a far one.
7. **Dither.** Tone, grain, contrast and gamma, then fourteen methods into two to four inks on a pixel grid tied to the cap height. **Rows per cap** is the system’s main axis, from five chunky rows to forty-eight; the grid is aligned so the first cap line sits on a pixel edge.
8. **Render.** Fourteen renderings, shared with the shape system: square pixels, LEDs, dots, scan lines, diamonds, stitches, halftone (dots sized by tone), Ascii text mode (glyphs by density), hatching (slashes that join into diagonals and cross where dark), rings, knit, mosaic tiles, bricks and triangles. **Bloom** lays a blurred copy of the marks beneath them; **misregistration** slides each ink by its own seeded offset.

The editor shows the three steps on their own: the letters on the grid, the tone, the dithered poster.

## Layouts

Stack (each line to the width; the pixel follows the smallest line), poster (one size for the block), alphabet specimen, sizes (one line at five sizes, the pixel shrinking with it), rows ladder (one line at 6, 9, 14, 22 and 34 rows per cap) and letter tiles. Stack and poster take a caption, set small at the foot, and an optional frame. Five formats.

## Styles

Thirty-eight. Photo type stays close to the reference: letters as windows onto a dithered swirl, Atkinson with ordered checks, a black frame. The rest are new: Chrome tube, Chisel, Neon glow, Long shadow, Riso drop, Fade, Decay, Scan, Stitch, Handheld, Receipt, Press, Inline, Static, Block, Terminal, Pop halftone, Engraving, Knit, Mosaic, Bubbles, Brick wall, Triangles, Electric (Monoton as an LED sign), Melt, Wave, Floor, Contours, Eroded, Neon tube, Slices, Bounce, Arcade, Bulge, Hollow, Elegance and Zigzag.

## Faces

Archivo Black, Anton, Bebas Neue, Unbounded Black, Rubik Mono One, DM Serif Display, Barlow Condensed Black, Bodoni Moda Black, Bricolage Grotesque ExtraBold Condensed, Fraunces Black (soft, wonky), IBM Plex Mono Bold, Monoton, Syne ExtraBold, Roboto Flex Extended Black, Cormorant Garamond Bold Italic and Space Grotesk Bold, all SIL OFL from the project’s pinned set; `prepare-fonts.mjs` extracts their outlines once into `fonts.mjs`.

## Fonts

`build.mjs` writes an OTF per style (version 1.0, a build of the live system, not a frozen version) to `output/heavy-dither-type-study-v1/fonts/`: every glyph of the shared set (106 characters, accents included) dithered on its own at the style’s rows per cap, with its halos, shadows and extrusions. A style in several inks ships one font per ink that is not the page; they share advances, so set on top of each other in their colours they rebuild the style. Warps, bounce and spin need a whole setting and are left out of the fonts.

## Code

| File | Role |
| --- | --- |
| `engine.mjs` | Catalogues, styles, setting, warps, distance transform, constructions, relief, layouts, render, glyph pixels for fonts |
| `fonts.mjs` | Outlines from `prepare-fonts.mjs` |
| `workshop.mjs` | The editor page |
| `build.mjs` | Styles, phone proofs, stages, layouts, text transfers, sheets, OTF fonts, catalog and the editor |
| `verify.mjs` | Checks, written to `validation.json` |

The dither core, palettes, formats and renderings come from `../heavy-dither-system` (`dither.mjs` and `engine.mjs`).

## Build and verify

```sh
node geometry-bench/heavy-dither-type/build.mjs
node geometry-bench/heavy-dither-type/verify.mjs
```

The build writes every style as SVG, PNG and JSON, phone proofs at 390 px, three stages for six styles, six layouts on four styles, every style with three other texts, sheets (styles, renderings, constructions, warps, rows ladder, methods, profiles, faces, fills, alphabets) and the fonts.

`verify.mjs` checks every style for valid, deterministic output in two or more inks, normalization as a fixed point and all three views; every option and range end; every face setting the alphabet; that more rows mean more cells; that every construction and warp changes the letters while unused amounts, warp 0 and bounce 0 change nothing; that every rendering draws, bloom adds one blur and misregistration offsets inks; layout panel counts; that dimmed controls are inert; that glyph pixels sit on the cap grid; and that every built font parses and the ink fonts of a style share advances.
