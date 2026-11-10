# Heavy dither — shape system

A shape system after a reference the user sent on 8 November 2026: a photograph dithered to coarse 1-bit pixels inside a thin black frame, where solid blacks break into checks and noise and soft forms read only through the density of big pixels. [Open the editor](../../output/heavy-dither-study-v1/index.html) to build a picture from shapes, light it, dither it and set it in any arrangement, palette and format. Exports are SVG, PNG and a JSON rule.

It is a shape system, not a typeface. Shapes are tone fields; the construction is the dither. The reference is kept as one style (**Framed print**) and in `reference/user-reference.png`; nothing is traced from it.

## The construction

1. **Shapes become tone.** Every item is a field in its own frame (radius 1 is half its size), turned and stretched:
   - *Volumes* give a height. The light (direction, height, relief, gloss, ambient) shades it from the height's own slope, so a sphere, torus or blob reads as a lit object. A face turned straight up shades to a mid-light grey whatever the light's height, so volumes keep mid-tones to dither.
   - *Fills* give a tone directly: swirl (domain-warped noise, the reference's organic forms), tiger stripes, rings, burst, glow, ramp, cloud and warped checks.
   - *Copy* is set type: its outlines are scanned row by row into coverage, softened by the copy softness, and lit like a cushion by the slope of that softened coverage.
2. **Items compose.** Over a ground (a tone with a vertical ramp) each item paints in order with a blend: over, darken, lighten, multiply, screen or difference, at its own amount, optionally inverted. Disc and box shapes fade at their edge by the edge softness.
3. **Tone.** Brightness, contrast, gamma, grain (keyed to the page pixel, so it holds still) and an optional soften. Each cell averages 2×2 samples.
4. **Dither.** Fourteen methods into two to four inks: Atkinson, Floyd–Steinberg, Jarvis–Judice–Ninke, Stucki, Burkes, Sierra lite (error diffusion, serpentine), Bayer 2×2, 4×4 and 8×8, clustered dot, line screen, blue noise (interleaved gradient noise), white noise and plain threshold. **Ordered checks** mixes a Bayer threshold into error diffusion, so mid-tones fall into checks while edges stay noisy — the reference's mix.
5. **Marks.** Fourteen renderings: square pixels (runs merged into one path per ink), gapped LEDs, dots, scan lines, diamonds, cross stitches, hatching, rings, knit, mosaic tiles, bricks and triangles, plus two screens that read tone directly instead of the dither: halftone (dots sized by tone) and Ascii text mode (glyphs by density). Any pixel size and aspect.

## Parts

| Axis | Choices |
| --- | --- |
| Shapes | 18: Sphere, Torus, Pyramid, Star, Blob, Pillow, Bumps, Ripple, Ridges (volumes); Swirl, Stripes, Rings, Burst, Glow, Ramp, Cloud, Checks (fills); Copy. **Detail** (−2…+2) changes each one's count: rings, ridges, star arms, blob lobes, stripe and check frequency, noise scale |
| Items | Up to 24, each with position, size, turn, stretch, amount, blend, invert, detail and seed; copy adds its text and face |
| Dither | 14 methods, 2–4 inks, ordered checks, seed |
| Marks | 14 renderings, pixel 2–40 units, pixel aspect 0.5–3, mark size |
| Palettes | 12, light to dark: Newsprint (the reference), Night / acid, Neon, Riso pink / blue, Handheld green, Thermal, Blueprint, Signal red, Ultraviolet, Ice, Chrome, Ember. The page takes the light or the dark end; inks between are sampled along the palette |
| Arrangements | Framed picture (the reference), full bleed, picture over a headline, field of shapes (the items repeated in a grid, one continuous picture), shape atlas (every shape alone, labelled), method specimen (the picture through all 14 methods, labelled) and steps (four bands, pixels from heavy to fine) |
| Formats | A series, poster 2:3, story 9:16, square, wide 16:9 |

Controls that do not apply to the current state are dimmed; `applies(id, state)` gives scripts the same answer, and moving a dimmed control leaves the poster identical.

## Styles

| Style | After | Construction |
| --- | --- | --- |
| Framed print | the user’s reference | A swirl fills the frame, tiger stripes run along its top, dark blobs sink into it; Atkinson with ordered checks |
| Moon | new | One lit sphere on black in four chrome greys, Bayer 8×8 |
| Neon pulse | new | Rings and a glow on black, cyan and magenta through blue noise, as LEDs |
| Handheld | new | A torus over bumps in four handheld greens, chunky Bayer 4×4 |
| Riso blobs | new | Lit blobs in fluorescent pink and blue, Atkinson |
| Scan terrain | new | Ridges under a low sun in three embers, Floyd–Steinberg, scan lines |
| Press dots | new | Spheres as a clustered-dot halftone over a crisp headline |
| Stitch star | new | A lit star in blue cross stitches, Bayer 4×4 |
| Static | new | Clouds through white-noise thresholds |
| Strata | new | Lit strata crossed by stripes in red and black, Jarvis–Judice–Ninke |
| Block pyramid | new | One faceted pyramid in pixels a fiftieth of the page wide |
| Ripple LED | new | A lit water drop in acid on black, LEDs on Bayer 8×8 |
| Soft type | new | Copy softened and lit like a cushion, acid on black |
| Receipt | new | Fine thermal-printer pixels under a mono headline |
| Ultraviolet | new | A blob in a torus over rings, four ultraviolet inks, Stucki |
| Op checks | new | Warped checks with a lit sphere subtracted, Sierra lite |
| Shape field | new | Six volumes in a grid as one picture, three icy inks |

**Surprise** draws two to four random shapes with a random method, mark, palette and arrangement from a seed.

## Shared with the effector engine

`dither.mjs` is the dither core: the methods, a separable tent blur and exact row-scan coverage of filled outlines. The palettes, formats and renderings in `engine.mjs` are shared with the [Heavy dither type](../heavy-dither-type/README.md) system. The effector engine's **Dither** modifier (`../effector-system`) uses the same core to rebuild a poster's own outlines as a heavy dither, so it also runs inside the PosterLab Effectors app copy (`workspaces/effectors`).

## Print: riso and separations

The editor's **Riso and separations** panel comes from the shared print kit (`geometry-bench/print-kit.mjs`; see `geometry-bench/print-kit-readme.md`):
- it splits the poster on screen into one black-on-white sheet per ink, with later shapes knocking out earlier ones;
- paper prints as an ink on white stock when it is dark or lighter inks sit on it;
- it previews the riso print with adjustable misregistration and grain, and saves the sheets and the preview.

The build writes the same for every style to `print/` (sheets, riso SVG and PNG, `print/index.json`). `node geometry-bench/print-kit-check.mjs` checks them.

Dithered styles separate exactly: every cell is one ink.

## Code

| File | Role |
| --- | --- |
| `dither.mjs` | Methods, thresholds, error diffusion, blur, coverage |
| `engine.mjs` | Catalogues, styles, normalization, shape fields, type setting, tone, arrangements, marks, SVG, `applies`, `surprise` |
| `fonts.mjs` | Glyph outlines from `prepare-fonts.mjs` (six SIL OFL faces, the same set as Shock burst) |
| `workshop.mjs` | The editor page |
| `build.mjs` | Styles, phone proofs, stages, formats, variations, sheets, catalog and the editor |
| `verify.mjs` | Checks, written to `validation.json` |

## Build and verify

```sh
node geometry-bench/heavy-dither-system/build.mjs
node geometry-bench/heavy-dither-system/verify.mjs
```

The build writes `output/heavy-dither-study-v1/`: every style as SVG, PNG and JSON, phone proofs at 390 px wide, tone-then-dither stage pairs, five formats, fifteen variations that swap modules between styles, and sheets of every style, method, shape, mark, palette and arrangement.

`verify.mjs` checks that every method keeps a flat grey's mean ink within half its own step (Atkinson, which diffuses 6/8 of its error by design, is checked to push greys away from the middle instead), keeps paper and full ink exact, darkens along a ramp and stays within its inks; that ordered patterns continue across neighbouring grids; exact coverage of a square, a holed square and a triangle; every style for valid, deterministic, inked output and normalization as a fixed point; every option, range end, shape and blend; the panel counts of the specimen, atlas and steps; that the pixel grid fills the page; palette ramps; twenty surprises; and that dimmed controls are inert.
