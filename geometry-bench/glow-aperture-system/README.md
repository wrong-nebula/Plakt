# Glow apertures — after Koichi Sato’s luminous fields (version 2)

A shape system after **Koichi Sato’s** glowing windows and shadows (Iwaki Art Festival 1982, Morisawa 1983, Seisei-an 1987, Urban Frontier Tokyo ’96 1993, Life 1994, The Women’s Memorial Service 1979) and **Susumu Endo’s** light shaft (Hiroshima Appeals, 2011). Open [the v2 editor](../../output/glow-aperture-study-v2/index.html) to pick a style, shape, word or path, layout, mode, finish, ramp, format and series, follow the four construction passes, and export SVG, PNG (3000 px long edge) or a saved JSON rule.

Version 2 is **additive**. Version 1 is frozen in [`v1/`](v1/) (engine, editor, build and checks, rebuildable into `output/glow-aperture-study-v1/`, which v2 never writes). Every saved v1 rule opens in v2 and renders **byte-identically**: states that only use v1 features are drawn by the frozen v1 engine, and the v2 code draws those same states pixel-identically when forced (`render(rule,{v2:true})`), so switching on a v2 feature never shifts the rest of the poster.

## The construction (unchanged from v1)

| Pass | What happens |
| --- | --- |
| 1. Aperture mask | Shapes, words or a path, fitted into the layout’s boxes, drawn white on black; smear copies along the light; nested layers; **blinds**; fray strands; haze tile. A **cut** aperture inverts the mask: the shape becomes the dark hole in a glowing field |
| 2. Falloff field | The mask blurred at the falloff width σ and at 3σ; the bloom tail mixes them and drifts toward the light |
| 3. Gradient map | An `feComponentTransfer` table sends the field through a 2–5 stop ramp — smoothly, or in a v2 **print finish** |
| 4. Poster | Sparkles (now also **dust**), grain, **paper fibre**, frame, and copy in a **lockup**, which stays vector and crisp |

## What version 2 adds

| Area | Additions |
| --- | --- |
| Words | A `word` shape: a title or kanji whose strokes dissolve into light or shadow, or (cut) type cut from a glowing field. Outlines are read from two prepared font modules of other systems, read-only (`prepare-fonts.mjs` → `fonts.mjs`): **Hiragino Mincho** and **Hiragino Kaku Gothic** (kana and ~90 kanji: 光 月 夢 心 山 川 花 雨 星 …; macOS fonts, local study only) and **DM Serif Display** (SIL OFL). Missing characters fall back face to face; one to three lines with `/` |
| Shapes | Eight new: moon phase (its own phase control), stairs, window, tree, mountain, standing figure, word, custom. **Custom** takes SVG path data or polygon points; the editor has a text field, presets (keyhole, leaf, star, house, bird) and a point editor (click to add, drag to move, double-click to remove). A **grid** layout lets neighbouring glows merge (spacing below 1) |
| Light | Up to **three lights**: the same mask lit from angle ± spread, each field tinted by its light colour — screen on dark grounds (lights add), multiply on paper (coloured shadows that darken where they overlap). **Rim light** on the lit edge of a silhouette. **Blinds** cut the aperture into soft shadow bands. **Aerial depth** fades the farther apertures of a stack toward the paper. **Dust** motes and out-of-focus discs float in the light |
| Print | **Screenprint steps**: a discrete 256-entry table quantised to 2–12 bands (Sato’s banded airbrush). **Halftone**: the field becomes ink coverage, a dot screen (an `feImage` of a rotated radial-gradient pattern) is added and thresholded — ink on paper. **Riso duotone**: the glow and the deep core printed as two posterised inks, the second misregistered; silhouettes print as ink too. **Paper fibre**: stretched, softened grain, darkest fifth only, multiplied |
| Ramps | Eleven calm ramps lead (blue on ivory, fog, lantern, sage and forest, slate, stone, afternoon wall, ash and ink, dusk, paper white, sepia light); the fourteen v1 ramps stay. The ramp editor adds reverse, add stop (in the widest gap) and remove stop |
| Composition | **Formats**: poster 728 × 1030, square 880 × 880, story 612 × 1088, landscape 1030 × 728 (PNG at 3000 px on the long edge). **Series**: the poster split into 2–6 panels of the same rule under one change — time of day (the light sweeps, morning and evening sink toward dusk blue), a turning light, moon phases, or one light across shapes. **Lockups**: auto (v1, by layout), foot, centre, spine; sans or serif copy |

## Twenty-one styles

The eight new styles lead and keep to calm print palettes — ink on cream, blue on ivory, sage and forest, slate, stone, sepia — each with at most one accent:

| Style | Shows | Mode / shape | Ramp, finish, format |
| --- | --- | --- | --- |
| Lantern kanji | a word of light | halo, 光 in Mincho | lantern, smooth, poster |
| Afternoon blinds | light through blinds, dust | halo, window turned −16°, 8 blinds | afternoon wall, poster |
| Coloured shadows | three lights | shadow, standing figure | ivory grey with blue and sienna lights, square |
| Moon phases | series | halo, moon, six panels | blue on ivory, screenprint steps |
| Mountain mist | riso, aerial depth | shadow, three stacked mountains | sage and forest, riso, landscape |
| Stair shadow | halftone, long cast shadow | shadow, stairs | ash and ink, halftone |
| Tree in fog | story format | shadow, tree, heavy haze | fog, story |
| Cut light | type cut from light | halo, cut, GLOW in DM Serif | sepia light, landscape |

The thirteen v1 styles follow unchanged (Halo window, Spectrum window, Ember box, Spectral field, Smoke soles, Shadow veil, Light shaft, Neon door, Sunrise slits, Aurora curtains, Moon gate, Backlit hand, Ink vessel). The neon ones stay for compatibility; the v2 showcase leads with the calm styles and the three v1 styles that set their mood (Halo window, Ink vessel, Moon gate).

## Same in resvg and Chrome

v2 keeps v1’s rules (no `feTurbulence`; every backed blur laid over an `feFlood`; filtered content clipped to the filter region; bounded-slope tables; Hiragino named first for Japanese copy). New primitives were tested in both renderers before use: discrete tables, the `feImage` dot screen with `arithmetic` (alpha-safe: `c + d − 1`), multiply-blended filtered layers, rotated serif and Mincho copy. Hard-edged finishes move band and dot edges by a pixel between renderers, so `browser-check.mjs` measures outliers on 4 × 4 block averages; the mean is taken per pixel.

## Rebuild and verify

```sh
node prepare-fonts.mjs                                  # only if the source font modules change (run from geometry-bench/glow-aperture-system)
node --expose-gc geometry-bench/glow-aperture-system/build.mjs
python3 geometry-bench/glow-aperture-system/contact-sheets.py
node --expose-gc geometry-bench/glow-aperture-system/verify.mjs
node geometry-bench/glow-aperture-system/browser-check.mjs
```

`engine.mjs` (v2) imports the frozen `v1/engine.mjs`, `fonts.mjs` and `svgpath`; the build bundles them into the offline editor. `demos.mjs` lists the feature demonstrations.

`output/glow-aperture-study-v2/` holds the editor, all 21 styles (calm ones at 3000 px), the four passes of each calm style (`stages/`), 40 feature demos (`demos/`), eight specimens, references with provenance and font provenance (`source.json`), and review boards: `styles.png` (calm styles first), `all-styles.png`, `words.png`, `shapes.png`, `light.png`, `finishes.png`, `series.png`, `formats.png`, `construction.png`, `specimens.png`, `comparison.png`, and the phone-width checks `phone-styles.png` and `phone-features.png`.

`validation.json` (Node + resvg) records: the v1 output folder unchanged against the sha-256 manifest taken at the freeze (`v1/output-manifest.json`); every saved v1 rule byte-identical in v2; the v2 code path pixel-identical to v1 for all v1 styles and passes; 21 distinct styles at their format sizes; every control and option visible where read and inert where not; ramp presets; probes for the new silhouettes in every layout and lit boxes for words and paths; posterised steps, two-ink halftone, riso misregistration, paper texture; coloured shadows from three lights; cut apertures; series panel counts; PNG sizes per format; copy outside every filter; input bounds for words and paths. `browser-validation.json` records the editor checks in Chrome and the resvg-versus-Chrome parity for every style and demo. Captures are in `output/playwright/glow-aperture-system-v2/`.

## Limitations

* Words can only use the characters in the prepared outlines (Latin, kana, about ninety kanji); others are dropped with a fallback to the style’s word. The Hiragino outlines are macOS system fonts kept for local study and must not be published.
* Very wide falloffs and series of six panels are slow to redraw in the editor and to export (each panel and each extra light is its own filter pass). Wide-falloff redraws are not faster than in v1.
* Halftone and riso are filter approximations of print, not separations; colours stay sRGB.
* Copy uses system fonts (Helvetica Neue, Georgia, Hiragino), so it varies on machines without them.

New vector interpretations, created with AI assistance. The original designs remain credited to Koichi Sato and Susumu Endo; reference images are kept locally for study and are not for publication.
