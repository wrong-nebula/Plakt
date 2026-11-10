# Bead-ray blooms and flip-disc screens — v2

Shape system 5 from the Japanese poster archive, after **Kazumasa Nagai** and **Yusaku Kamekura**: rays of beads or fine lines from a centre, and disc screens that tilt to reveal a hidden image. Open [the v2 editor](../../output/bead-ray-study-v2/index.html). The editor has 24 presets, four construction passes, a series strip, click-to-place centres and a paint brush, and it exports SVG, PNG, a saved JSON rule and the source as a PNG.

Version 2 adds to version 1 and changes none of it. **Version 1 is frozen.** Its code is in `v1/` and its outputs are in `output/bead-ray-study-v1/`. Every v1 rule renders in v2 exactly as its shipped v1 SVG, and `verify.mjs` checks this for all of them. Both editors open v1 rules.

## What v2 adds

| Area | Additions | Off by default |
| --- | --- | --- |
| Bloom generators | **Phyllotaxis spiral**: rays × beads seeds, one *divergence* angle apart (137.51° by default), radius ∝ √n. **Concentric rings**: bead rings spaced along each ring, every ring turned a further *phase step*. **Bend**: a quadratic turn for vortex rays (a tip turn of up to a quarter for spikes and petals). | Ray mode beads; bend 0 |
| Bead vocabulary | Half-disc, petal, star, cross and tiny **letter beads**, which spell the word along each ray in the cell alphabet. A **second bead** shape every *n* beads. **Stepping** colours: ink, ink 2 and accent cycle along each ray, by ring, or across spikes, petals and screen rows. | No second bead |
| Masks | A **word** or **silhouette** mask over the poster keeps, sizes or cuts the beads, so a bloom can fill a letter. Spikes and petal lines are tested at their midpoints; *size* narrows spikes and shortens lines. Source scale, angle and softness shape the mask. | None |
| Screens | Elements: **square**, **hatch** stroke (weight from the value, angle from the axis), **Truchet** tile (orientation from the value). **Coin** discs: front ink, back accent, with a shaded rim as they turn. Lattices: **triangle**, **brick**, **golden spiral**. **Dithering**: ordered (Bayer 4 × 4) or error diffusion (Floyd–Steinberg along rows; along the sequence on radial and spiral lattices). A **moiré** second screen in ink 2, turned a few degrees. **Painted** source. | Disc, no dither, no moiré |
| Print finishes | **Riso**: the marks print twice, an accent plate off register and then the inks, both multiplied. **Paper grain**: seeded fractal-noise speckle in the ink. | None |
| Composition | **Series** of 2–6 posters from one rule. Each steps the seed, twist, bend, ring phase and turn, turns or swaps the source, and carries a number in the date line. **Placed field centres** replace the seeded scatter. | No placed centres |
| Editor | Click to place the bloom centre; in a field, a click adds a bloom and Alt-click removes the nearest. Paint brush: the first stroke samples the current source into a 96-sample grid, and light or dark strokes edit it. The grid is saved with the rule. Export the source or mask as a PNG; it opens again through the image input. Make a series of four. | — |

The four passes are unchanged for v1 features. For the v2 features:

- **Modules pass:** hatch strokes and Truchet arcs are drawn as hairlines, and second beads and the moiré screen are left out.
- **Colour pass:** adds the value weights, the second beads and the second screen.
- **Poster pass:** adds the finish.

## Presets

The eleven v2 presets come first and use print palettes, with one accent each: ink on cream, blue on ivory, forest on sage, slate on stone.

| Preset | Construction |
| --- | --- |
| Sunflower press | 640 phyllotaxis seeds; every fifth seed is a ring; ink on cream, grain |
| Letter bloom | 96 dense bead rays sized by the word RAY; blue on ivory, ochre centre |
| Tide rings | Petal beads in rings turned 6.5°, colour stepping ring by ring; forest, sage, vermilion |
| Vortex | Bent lozenge rays, an ochre disc every third bead; slate on stone |
| Hatch hand | Hatch screen along the contours of a hand; ink on cream |
| Dither board | Flip squares, ordered dither of a soft moon; ink on paper |
| Two-sided coins | Brick lattice of coins, forest fronts and ochre backs with shaded rims; heart |
| Truchet weave | Quarter-arc tiles turned and coloured by a whirl; blue and ochre on ivory |
| Moiré lines | Two hatch screens 4° apart, ink and vermilion |
| Riso burst | Blue and vermilion spikes with a misregistered vermilion plate and grain |
| Seed heads | A seeded field of eight phyllotaxis heads in forest, ochre and vermilion |

The thirteen v1 presets follow, unchanged. Seven follow the source posters: The Cell, both 1969 Imabashi Gallery posters, Light and Vision, Expo ’70, Peacefully Use Atomic Energy, and the 2001 retrospective. Six are the v1 new presets, including the neon ones; they are kept so saved rules still open. The MoMA record credits *Light and Vision* to Nagai.

## Construction recap

Version 1 still describes the base: bead rays with size curves and spacing ramps, twist, perforated bars, spikes, petals, hub rings, layers, squash and tilt; and screens of tilt, iris and flip-dot discs on square, hex and radial lattices, driven by gradients, waves, whirls, interference, silhouettes, words and images. The full v1 notes are in `v1/README.md`. Words use the cell alphabet of `../isometric-prism-system/engine.mjs`, imported read-only. A render stops adding marks at 60,000 and reports `capped`.

## API

```js
import {render, resolve, series, specimen, applies, maskOf, ditherCells} from './engine.mjs';
render({family: 'sunflower', params: {divergence: 137.1}});                  // spiral arms appear
render({family: 'letter', word: 'SUN', maskMode: 'cut'});
render({family: 'coin', source: 'word', word: 'COIN', dither: 'diffusion'});
render({engine: 'bead-ray-v1', family: 'cell'});                             // a v1 rule, rendered as in v1
series({family: 'truchet'}, 4);                                               // four states
```

Saved rules name `bead-ray-v2`; `bead-ray-v1` rules open unchanged.

## Rebuild and verify

Run heavy jobs through the shared machine lock:

```sh
node --expose-gc geometry-bench/bead-ray-system/build.mjs
python3 geometry-bench/bead-ray-system/contact-sheets.py
node --expose-gc geometry-bench/bead-ray-system/verify.mjs
node geometry-bench/bead-ray-system/browser-check.mjs
```

`output/bead-ray-study-v2/` holds:

- the editor, and every preset with its SVG and rule (v2 presets at 2120 × 3000)
- four passes per v2 preset (`stages/`)
- 16 generator, bead and mask examples (`generators/`) and 16 screen examples (`screens/`)
- finishes, series, formats, three specimens of 60 tiles, references with provenance, and `catalog.json`

Boards, phone-size check first:

- `phone.png`: v2 presets at 390 px wide
- `presets-v2.png`, `generators.png`, `screens.png`, `finishes.png`, `series.png`, `construction.png`, `formats.png`
- `presets-v1.png`

`validation.json` records same-machine Node/resvg checks:

- **v1 compatibility.** All shipped v1 rules match their SVGs in v2. The frozen engine replays them byte for byte. 80 seeded random v1-style rules render identically in both engines.
- **Controls and options.** Every control and option on the v2 presets changes the picture exactly where `applies` says it should. The same holds for the v2 controls and options on the v1 presets. The new values of v1 options change the v1 presets.
- **Passes, replay and generators.** Four distinct passes per v2 preset; exact replay, including painted sources and seeded grain; seed and ring counts.
- **Masks.** Nothing is inked outside a kept mask or inside a cut one.
- **Dithering.** The on-fraction tracks the value within 0.03 for diffusion and 0.07 for ordered.
- **Truchet orientation.** A pixel probe agrees with the source on over 97% of tiles.
- **Hidden images.** Correlation is at least 0.8 at full size and 0.7 at 390 px wide, for every new element and lattice.
- **Also checked:** finishes, series, placed centres, sizes for every preset × layout × format, and inputs.

`browser-validation.json` records offline Chrome checks of the editor, including the paint brush, click-to-place, source export, series, and v1 rules rendering their shipped SVGs. Evidence is in `output/playwright/bead-ray-system-v2/`.

New vector interpretations, created with AI assistance. The original designs remain credited to Kazumasa Nagai and Yusaku Kamekura; reference images are kept locally for study.
