> **Frozen version 1.** These are the shipped v1 sources, kept so `output/glow-aperture-study-v1/` stays rebuildable (`node --expose-gc geometry-bench/glow-aperture-system/v1/build.mjs`). Do not edit them: version 2 (`../engine.mjs`) imports this engine to draw v1 rules byte-identically, and `output-manifest.json` holds the sha-256 of every shipped v1 output file. Links below are relative to the system folder.

# Glow apertures — after Koichi Sato’s luminous fields

A shape system after **Koichi Sato’s** glowing windows and shadows (The 6th Iwaki Prefecture Art Festival 1982, Morisawa 1983, Dress of Japan “Seisei-an” 1987, Urban Frontier Tokyo ’96 1993, Life 1994, The Women’s Memorial Service 1979) and **Susumu Endo’s** light shaft (Hiroshima Appeals “negative flashing light”, 2011). References are MoMA and PGDA records in the local Japanese poster archive. Open [the editor](../../output/glow-aperture-study-v1/index.html) to pick a style, shape, layout, mode and ramp, follow the four construction passes, and export SVG, PNG (2120 × 3000) or a saved JSON rule.

The goal is a reusable system, not poster remakes: one construction (aperture mask → distance falloff → gradient map) and every look as a preset of shared controls. Seven styles follow the references; six are new, three of them neon on near-black.

## The construction

| Pass | What happens | Where |
| --- | --- | --- |
| 1. Aperture mask | Shapes are fitted into the layout’s boxes and drawn white on black. Smear copies along the light angle are grey and drawn dimmest first (each pixel keeps its brightest copy, a max); nested layers alternate black and white; fray strands hang on the side away from the light; haze is a seeded, seamless cloud tile | `maskGroup()` |
| 2. Falloff field | The mask is blurred at the falloff width σ and at 3σ; the bloom control mixes the two and the wide tail drifts 0.8σ toward the light. A blurred step is the normal CDF of signed distance, so this is a distance falloff with a long tail — the tail is what makes it read as light, not as a soft edge | `falloffFilter()` |
| 3. Gradient map | An `feComponentTransfer` table (64 entries per channel) sends the field through a 2–5 stop ramp, interpolated in OKLab, with the inner/outer balance and the curve baked in | `profile()`, `rampAt()` |
| 4. Poster | Sparkles, grain (a seeded PNG noise tile in overlay, plus a faint normal copy that dithers near-black and near-white, where overlay vanishes and banding shows), frame inset, title band and copy. Copy is plain vector text outside every filter, so it stays crisp | `draw()` |

### Modes

| Mode | The ramp is read… | Source |
| --- | --- | --- |
| Halo | by the field: dark far away, the last stop deep inside; the aperture is the light | Iwaki window, neon door, moon, sunrise |
| Soft shadow | by the field, cast 0.8σ toward the light angle; the object stays crisp in the ramp’s last colour | Seisei-an box, Life soles, the veiled figure |
| Spectral field | round a ring: twelve blurred lamps sampled from the ramp as a cycle plus a white centre lamp, seen through the soft aperture | Urban Frontier, Morisawa |
| Beam | along the light: the ramp runs down a streaked slit (fray = streaks; haze clouds the beam) over a plain, graded or counter-field ground | Hiroshima Appeals, aurora |

## Thirteen styles

| Style | After | Mode / shape / layout | Ramp |
| --- | --- | --- | --- |
| Halo window | Sato, Iwaki Art Festival, 1982 | Halo, rectangle, centred; petals, red frame, stacked title | black → violet → blue → cyan → cream |
| Spectrum window | Sato, Morisawa, 1983 | Field, hard rectangle on its counter-field; scribbles | cyan, mint, yellow, pink, violet (cycle) |
| Ember box | Sato, Seisei-an, 1987 | Shadow, box, smear rising | pale grey-green → salmon → rust → black |
| Spectral field | Sato, Urban Frontier Tokyo ’96, 1993 | Field, rectangle, title band, black frame | blue, green, yellow, red, magenta (cycle) |
| Smoke soles | Sato, Life, 1994 | Shadow, soles, smear and haze, heavy grain | sepia |
| Shadow veil | Sato, The Women’s Memorial Service, 1979 | Shadow, figure, fray strands | umber |
| Light shaft | Susumu Endo, Hiroshima Appeals, 2011 | Beam, slit, graded ground with rain streaks | red → orange → yellow |
| Neon door | new — electro | Halo, door with floor spill, cyan neon line, stars | black → purple → magenta → pink → white |
| Sunrise slits | new | Halo, three stacked slits | indigo → plum → red → orange → gold |
| Aurora curtains | new — neon | Beam, five slanted slits, haze, stars | violet → blue → teal → green |
| Moon gate | new — ink blue | Halo, crescent, star points | ink blue |
| Backlit hand | new — acid electro | Halo with solid core, hand, lime title band | black → indigo → blue → teal → acid |
| Ink vessel | new | Shadow, vase, low light from the upper right, offset | indigo on paper |

## Controls

| Group | Controls |
| --- | --- |
| Aperture | Shape (rectangle, door, arch, circle, slit, crescent, vase, hand, figure, soles, box), layout (centred, stacked, beams, full bleed, title band), size, across, up/down, turn, apertures (1–6), spacing (overlap below 1), nested layers |
| Falloff | Mode; falloff width, curve (harder above 1, softer below), inner ↔ outer balance, bloom tail, light offset, directional smear, light angle, haze, fray / streaks |
| Ramp | 14 presets; 2–5 stops (changing the count resamples the ramp); each stop’s colour and position |
| Surface | Core (none, solid silhouette, neon line), sparkles (points, stars, petals, scribbles) and count, ground (field and beam modes: plain, gradient to the frame colour, counter-field), copy (across or stacked column), grain, frame inset, seed; four colours (ground, frame, core, ink) |

Everything random — sparkles, strands, streaks, haze and grain tiles — comes from the seed, so a saved rule replays exactly.

## Rendering: same in resvg and Chrome

Every falloff is an SVG filter, so the files stay small and vector. Early tests compared each primitive in resvg and headless Chrome:

* `feGaussianBlur`, `feComponentTransfer` tables, `feComposite arithmetic`, `feOffset`, `feMerge`, masks and `mix-blend-mode` agree to within about one level.
* `feTurbulence` does not (the two produce different noise fields), so grain and haze are seeded greyscale PNG tiles that the engine encodes itself (stored deflate, no zlib), byte-identical in Node and the browser.
* Renormalising alpha at the filter-region edge amplified the small differences between the two blur implementations, so each backed blur is laid over an `feFlood` of its background colour instead.
* Chrome lets content beyond the filter region feed a blur; resvg clips it first. Every filtered group therefore clips its own content to the filter region.
* Ramp curves keep a bounded slope, so the 8-bit field between primitives never turns into visible rings.
* Japanese copy names Hiragino first, so both renderers pick the same face and weight.

`browser-check.mjs` takes 23 rules (every style plus variants and construction passes), asserts the editor’s bundled engine produces the same SVG string as the Node module, then compares resvg’s PNG with Chrome’s screenshot of that SVG at 728 × 1030. Mean channel difference must stay at or below 3 (of 255), and at most 0.8 % of channels may differ by more than 40 (copy anti-aliasing).

## Rebuild and verify

```sh
node --expose-gc geometry-bench/glow-aperture-system/build.mjs
python3 geometry-bench/glow-aperture-system/contact-sheets.py
node --expose-gc geometry-bench/glow-aperture-system/verify.mjs
node geometry-bench/glow-aperture-system/browser-check.mjs
```

`engine.mjs` holds shapes, layouts, ramps, the filters and the renderer (no dependencies); the build bundles it into the offline editor. Posters are 728 × 1030 (B-series proportion); PNG exports are 2120 × 3000.

`output/glow-aperture-study-v1/` contains the editor, every style as SVG/PNG/JSON, the four passes per style (`stages/`), five layouts on three styles (`layouts/`), the four modes on one arch under two ramps (`modes/`), twenty variations (`variations/`), thirteen shape specimens, the references with provenance (`source.json`) and review boards: `comparison.png`, `styles.png`, `layouts.png`, `modes.png`, `construction.png`, `variations.png`, `shapes.png`, and the phone-width checks `phone-styles.png` and `phone-variations.png` (390 px wide).

`validation.json` records same-machine Node/resvg checks: thirteen distinct styles under one palette, every control and option value visible in every style (ground inert outside field and beam), ramp presets, stop counts and positions, four passes, exact replay and seeds, white probe points for every shape in every layout, gradient-map end colours, falloff rays that never brighten outward, crisp copy outside every filter, grain without `feTurbulence`, and input bounds. `browser-validation.json` records the Chrome checks of the editor and the resvg-versus-Chrome parity numbers; captures are in `output/playwright/glow-aperture-system/`.

## Limitations

* The airbrush, photography and halftone of the originals are approximated by blur, haze and grain; shapes and silhouettes are new drawings and nothing is traced.
* Filters are rasterised by the viewer: very wide falloffs (σ above about 80) are slow to redraw in the editor and to export in resvg.
* Copy uses system fonts (Helvetica Neue, Hiragino Sans), so it varies on machines without them.
* Light is clipped 20 units beyond the poster: a shape running off the edge fades as if the world beyond were dark.

New vector interpretations, created with AI assistance. The original designs remain credited to Koichi Sato and Susumu Endo; reference images are kept locally for study and are not for publication.
