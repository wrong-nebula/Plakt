# Bead-ray blooms and flip-disc screens — v1 (frozen)

> Frozen copy of the shipped v1 code. Its outputs live in `output/bead-ray-study-v1/` and are not modified by v2. Rebuild from this folder (`node --expose-gc geometry-bench/bead-ray-system/v1/build.mjs`, and likewise `verify.mjs`, `browser-check.mjs`, `contact-sheets.py`). Version 2 is one folder up and renders every v1 rule identically.

## After Kazumasa Nagai and Yusaku Kamekura

Shape system 5 from the Japanese poster archive: rays of beads or fine lines from a centre (Nagai’s *The Cell*, Kamekura’s Expo ’70 petals and atomic burst) and grids of discs that tilt into ellipses to reveal a hidden image (Nagai’s 1969 Imabashi Gallery and *Light and Vision* posters). Open [the editor](../../../output/bead-ray-study-v1/index.html) to pick one of 13 presets, follow the four construction passes, change any control, load a local image as the flip source, and export SVG, PNG or a saved JSON rule.

It is a shape system, not a type system. The source posters are kept as seven presets of one construction; six presets are new. The rounded-module field of the RKC study already covers size-modulated grids, so the new parts here are bead rays, line petals and the flip-angle screen.

## Two generators, one construction

**Bloom.** Rays leave a centre at even angles, or across a **sector** centred on **turn**. Bead *k* of a ray sits at radius `hub + (1 − hub) · u^spacing` (u = k/(beads − 1)), so the **spacing ramp** crowds beads toward the hub (> 1) or the tips (< 1). Its size follows a **curve** — growing, shrinking, pulsing (with **waves**), swelling or even — between the **size range** and full size. **Twist** turns each bead in proportion to its radius, so rays become spirals; beads stay aligned with the spiral’s tangent. **Length jitter** (seeded) and **length modulation** (a cosine over the rays, or over the lines of a petal) shorten rays; a modulated fan becomes the triangle of the green Imabashi poster. **Gaps** drop beads, lines or spikes at random (seeded). **Squash** and **tilt** turn the whole bloom into a leaning ellipse.

| Rays | Rule | From |
| --- | --- | --- |
| Bead rays | Discrete beads: disc, ring, square, lozenge, chevron or stacked egg (halo, white, offset yolk) | Imabashi green, Nagai retrospective |
| Perforated bars | A round-capped bar per ray, the beads punched through as holes (an SVG mask), bars merging into a hub disc | *The Cell* |
| Tapered spikes | A thin triangle from the hub edge to the tip; spike width; a filled hub ellipse | *Peacefully Use Atomic Energy* |
| Petals | N fine lines leave a rounded base side by side (where they merge into a solid cap) and fan out on quadratic curves to an outer circle; petal width, lines per petal, line weight | Expo ’70 |

**Hub rings** fill the hub with staggered rings of beads (the centre of *The Cell*). **Layers** repeat the bloom up to four times, each smaller and half a ray-step turned. A **centre emblem** (disc, ring, five-disc flower, gear) sits on top, never squashed.

**Screen.** Discs sit on a **square**, **hex** or **radial** lattice at a given **pitch** and **disc size**. A **source** gives every disc a value v from 0 (dark) to 1 (bright), after **invert**, **gamma** and **contrast**:

| Disc | v = 1 | v = 0 |
| --- | --- | --- |
| Tilt | flat disc | edge-on sliver (86°), turned about the **flip axis**; **hinge offset** keeps the ellipse against one side of its socket, as in the red Imabashi poster |
| Iris | an open dot nearly filling its socket | closed |
| Flip-dot | front face (ink) | back face (ink 2); half-turned discs are thin ellipses in either colour |

The axis is **fixed**, **swings** with the value (by **axis swing** × 180°), runs **along the contours** of the source (perpendicular to its gradient — an engraving-like op-art), or is **radial**. Behind each disc a **socket** in ink 2 shows at the chosen opacity. Disc colour is one ink, a ramp, alternating, or **follows the source** (accent → ink).

Sources: **linear** and **radial** gradients, **wave**, **whirl** (stripes turned in proportion to the radius), **interference** (two ripples), six built-in **silhouettes** (circle, eye, star, hand, heart, moon, as signed-distance shapes with **softness**), a **word**, and a **local image**. **Source scale** and **source angle** apply to all of them. Words are set in the cell alphabet of the isometric-prism study (`../isometric-prism-system/engine.mjs`, imported read-only): full cells, half-cell triangles, quarter discs and tips are tested per sample, and each disc averages 4 × 4 samples over its window. In the editor, an image file is drawn into a canvas (long edge 72 samples, composited on white) and stored in the rule as a hex luminance grid, so the image travels with the saved rule and nothing leaves the browser.

## Layouts, formats, colour and passes

- **Layouts**: centred bloom; bloom field (a seeded scatter of 2–24 blooms; small blooms carry fewer rays); screen, full bleed with a copy band; screen with a bloom overlay (a soft pool of the ramp colour clears room for the bloom); cropped giant bloom (a centre above or inside the poster, radius the poster’s long edge). **Zoom** and **shift** place the bloom.
- **Formats**: B-series poster 728 × 1030 (PNG 2120 × 3000), square, story 9:16, landscape 16:9.
- **Palette roles**: ground, ground 2, ink, ink 2 (second bead colour; disc socket and back), accent (emblem and egg yolks; second disc colour), type. The **ground ramp** runs top → bottom from ground to ground 2, with an optional **light band** (the white band of *Light and Vision*). Mark colour is flat (layers and field blooms cycle the inks), a radial ramp from the hub, a top-to-bottom ramp, or alternating rays. **Glow** blurs the marks on top of themselves for the electro presets.
- **Passes**: 1 construction (ray guides, hub and outer circles, bead centres; for screens the source map itself, cell by cell), 2 modules (marks in one ink), 3 colour (ramps, sockets, egg layers, emblems, perforation), 4 poster (ground ramp, overlay pool, glow, title and date line in system fonts).
- **Seed**: gaps, jitter and the field scatter use a seeded generator; a saved rule replays exactly. The editor’s **New seed** steps it.

Thousands of marks become a few merged paths (one per colour), coordinates are written to 0.1 unit, and ramps are user-space gradients on those paths. A render stops adding marks at 60,000 and reports `capped`.

## Presets

| Preset | After | Layout and construction |
| --- | --- | --- |
| Cell bloom | Nagai, *The Cell*, 1966 | 36 perforated bars from a hub of six bead rings, radial blue ramp |
| Egg cascade | Nagai, Imabashi Gallery (green), 1969 | Cropped fan of 21 rays from above the poster; stacked eggs growing downward, a modulated triangle |
| Light and vision screen | Nagai, *Light and Vision*, 1969 | Iris screen following a whirl on a red → white → yellow ramp |
| Flip-disc screen | Nagai, Imabashi Gallery (red), 1969 | Tilt screen; a diagonal wave sets tilt and axis swing, hinged ellipses |
| Petal flower | Kamekura, Japan World Exposition ’70, 1967 | 8 petals × 44 fine lines, gold radial ramp, flower emblem |
| Spike burst | Kamekura, *Peacefully Use Atomic Energy*, 1956 | 110 jittered spikes, alternating yellow and blue, squashed and tilted, gear emblem |
| Chevron vault | Nagai, retrospective of plastic arts, 2001 | Cropped bloom of 64 chevron rays past every edge |
| Neon bloom | new — electro | Ring beads pulsing along twisted rays, two layers, magenta → cyan, glow on near-black |
| Flip-dot scoreboard | new | Word mask on a flip-dot board, yellow fronts on dark backs |
| Op-art pulse | new | Hex screen, two interfering ripples, axis along the contours, colour follows the source |
| Eye screen | new | Radial lattice, eye silhouette, radial axis |
| Sun over sea | new | Wave screen with a spike-burst overlay on a night-to-orange ramp |
| Bloom field | new | Nine seeded blooms of shrinking beads on cobalt |

The MoMA record credits *Light and Vision* (moma-8815) to Kazumasa Nagai; it is listed under Nagai here.

## API

```js
import {render, resolve, specimen, sourceField, applies, imageFromLuminance} from './engine.mjs';
render({family: 'scoreboard', word: 'TOKYO/2026', format: 'landscape'});   // → {svg, state, width, height, features, cells}
render({family: 'cell', rayMode: 'beads', bead: 'lozenge', curve: 'pulse', params: {twist: 180, layers: 2}});
render({family: 'eye', source: 'image', image: imageFromLuminance(w, h, values)});
applies('swing', resolve({family: 'flip'}));   // true — which controls change the current picture
```

Saved rules name `bead-ray-v1`.

## Rebuild and verify

Heavy jobs share a machine-wide lock (see the coordinating session); without it:

```sh
node --expose-gc geometry-bench/bead-ray-system/v1/build.mjs
python3 geometry-bench/bead-ray-system/v1/contact-sheets.py
node --expose-gc geometry-bench/bead-ray-system/v1/verify.mjs
node geometry-bench/bead-ray-system/v1/browser-check.mjs
```

`output/bead-ray-study-v1/` holds the editor (`index.html`), every preset at 2120 × 3000 with its SVG and rule, the four passes per preset (`stages/`), five layouts on three presets (`layouts/`), four formats on four presets (`formats/`), the eight flip sources (`sources/`), sixteen variations (`variations/`), three vocabulary specimens, the demo image grid, the references with provenance (`source.json`) and `catalog.json` (controls, options, palettes with OKLCH and contrast, per-example features). Review boards: `comparison.png`, `presets.png`, `layouts.png`, `construction.png`, `sources.png`, `variations.png`, `formats.png` and `phone.png` (every preset at 390 px wide).

`validation.json` records same-machine Node/resvg checks: 13 presets distinct under one palette; for every preset, every control and option that applies changes the picture and every one that does not leaves it unchanged (the same `applies` table drives the editor); four passes; exact replay including image grids and seeds; bead, line and spike counts; lattice bounds; the hidden image measured as the correlation between source value and the luminance of each disc’s window, at full size and at 390 px wide, for every screen preset, words, an image and all six silhouettes; every cell-alphabet glyph; all preset × layout × format renders finite and under 1.6 MB; stress cases bounded by the mark budget; input bounds. `browser-validation.json` records isolated, offline Chrome checks of the editor, including a local image upload and a saved rule that carries it. Evidence is in `output/playwright/bead-ray-system/`.

New vector interpretations, created with AI assistance. The original designs remain credited to Kazumasa Nagai and Yusaku Kamekura; reference images are kept locally for study.
