# Strata line fields — after Kiyoshi Awazu and Kazumasa Nagai

A shape system after **Kiyoshi Awazu’s** contour landscapes (*A New Spirit of Japan*, 1976; *Kizashi*, 1975; *Noh Performance at UCLA*, 1981; *Ninth Contemporary Japanese Sculpture*, 1982; *Art Today in Kyoto* and *Contemporary Japanese Art*, 1983) and **Kazumasa Nagai’s** 1968 one-man-show poster, from the local Japanese poster archive. Open [the editor](../../output/strata-field-study-v1/index.html) to build whole-poster fields of dense parallel lines in eleven styles, follow the four construction passes and export SVG, PNG or a saved JSON rule.

The goal is a reusable system, not poster remakes: one construction, every style as a preset, and seeds, controls and a drawn curve that deform it. The source posters are kept as six of the eleven presets.

## The construction

A field is a stack of **guides** with **tween lines** between them.

1. **Guides.** One base curve — noise, a sine, stacked waves, a ridged terrain profile or a drawn curve — is displaced once per guide. **Drift** sets how differently each guide moves: at 0 every guide is the same curve offset (pure offsets); noise and terrain guides decorrelate, periodic curves swing their amplitude guide by guide, so neighbours converge into dark compression bands (Nagai). Guide spacing ramps (perspective) and jitters.
2. **Tween lines** are interpolated between neighbouring guides. **Wobble** perturbs the interpolation parameter, never the position, so a trembling line stays between its neighbours.
3. **Faults** are seams in poster space; everything on one side moves by the fault’s shift along the seam, so crossing lines step.
4. **Order.** In *stack* order a clamp pushes guides and then lines outward from a pivot so every neighbour stays at least 0.5 px apart; lines pile into dark bands instead of crossing. *Fold* order switches the clamp off and lets strata cross.

Directions map the stack onto the poster:

| Direction | u (along a line) | v (across the stack) |
| --- | --- | --- |
| Horizontal / vertical | x / y, with tilt | y / x |
| Radial rays | radius | angle |
| Concentric rings | angle (periodic noise and whole-number waves, so rings close) | radius |
| Contour levels | — | levels of a height field: one to four cone peaks, warped by drift, with the base curve as noise, lobes or the peaks’ slope profile |

Contour levels are marching-squares level sets, which cannot cross; the others are graphs over u, so a line can never cross itself.

**Ranges** are separate offset stacks: a top edge under a terrain profile (humps × soft noise) and a bottom edge that **relaxes** from a parallel offset of the top (constant-thickness ribbon) to a flat foot. Ranges occlude the field, take the range palette and are drawn back to front. The **horizon** either **reflects** the whole scene below it, or sets ranges **facing** — rising from the bottom and hanging from the top (Awazu’s Kyoto poster).

**Inlays** cut windows into the strata: disc, ring, slotted sun, eye, diamond, pillar or window, filled solid, with a second field at another angle (on ground, or laid over the strata so the two gratings beat into moiré), with nested rings, or left void. Several inlays follow Awazu’s axis of signs — eye, pillar, diamond, disc, ring, sun, window — downward from the first (upward into the sky when the scene is reflected), shrinking if needed so the axis fits. They sit in front of the ranges or behind them.

**Colour** steps through five colours per *cycle length* lines, blends them in OKLab and sweeps back and forth (Nagai’s spectrum), or scatters them without repeats (Awazu). Lines can be stroked, filled as bands, or both (bands with ink lines). Fourteen colour roles: paper, ground, ink, accent, five field colours and five range colours.

## Eleven styles

| Style | After | Construction |
| --- | --- | --- |
| Mountain sea | Awazu, *A New Spirit of Japan* (1976) | Warm offset ranges over a cool noise sea, scattered colours, framed |
| Facing horizon | Awazu, *Art Today in Kyoto* (1983) | Pastel ranges rising and hanging across a flat horizon, a moon disc |
| Wave column | Nagai, one-man show at Ichibankan (1968) | Stacked waves over one spectrum with black lines, compression bands, two fault creases |
| Sign axis | Awazu, *Ninth Contemporary Japanese Sculpture* (1982) | Red strata stepped by faults, cool ranges, an axis of four inlaid signs |
| Contour map | Awazu, *Contemporary Japanese Art* (1983) | Contour levels of a two-peak height field, heat bands outlined in ink |
| Sunrise rays | Awazu, *Kizashi* (1975) | Coloured wedges fanning from an eye on the horizon, cool ranges below |
| Survey sheet | new — topographic | Brown contours with a heavier index level every fifth line over hypsometric tints |
| Op moiré | new — op art | Black lines on white, the same field laid over itself in a disc, turned 8°, beating into moiré fringes |
| Neon terrain | new — electro | Glowing ridged terrain on near-black, a slotted sun behind ranges, reflected in a black lake |
| Riso bands | new — risograph | Fluorescent vertical wave bands off register; the lower half turns a quarter |
| Pen rings | new — pen plotter | Single-pen concentric rings rippled by stacked waves, book-matched |

*Noh Performance at UCLA* (1981) informs the framed layout’s stripe columns and the eye inlay.

## Controls

| Group | Controls |
| --- | --- |
| Strata | Direction, order; line count, guides, pitch ramp, pitch jitter, line weight, weight ramp, guide weight (index lines), wobble, seed (with shuffle) |
| Displacement | Base curve and the drawn curve (drag points or type 2–16 heights); amplitude, frequency, octaves, drift, amplitude ramp; tilt (horizontal and vertical), centre (rays, rings, contours), peaks (contours) |
| Colour | Palette (twelve), colour cycle, render; cycle length, misregister (each colour layer shifted), glow; fourteen colour inputs |
| Faults | Count, angle, shift |
| Horizon and ranges | Horizon mode and height; ranges, range height, relax |
| Inlay | Shape, fill, layer; size, position, line angle (second field), count |
| Layout and type | Full field, title band, framed window (with stripe columns), diptych (book-matched halves), split (the lower half turns a quarter); title and up to three information lines |

Controls that do not apply to the current state are disabled in the editor and leave the poster unchanged.

## Files

Lines merge into one path per colour and weight, with round caps and joins, written in tenths with relative steps from rounded points (no drift). Stroked lines are trimmed to the field, so a plotter that ignores clip paths stays on the paper. Contour and ring bands are painted in order so every loop is written once. Default posters stay under about 450 KB and 170 path elements.

## Rebuild and verify

```sh
node --expose-gc geometry-bench/strata-field-system/build.mjs
python3 geometry-bench/strata-field-system/contact-sheets.py
node --expose-gc geometry-bench/strata-field-system/verify.mjs
node geometry-bench/strata-field-system/browser-check.mjs
```

`engine.mjs` holds the construction, the presets and the renderer (no dependencies); the build bundles it into the offline editor. Posters are 728 × 1030 (B-series proportion); PNG exports are 2120 × 3000.

`output/strata-field-study-v1/` contains the editor, a poster for every style, the four passes per style, five layouts on three styles (`layouts/`), five directions and five base curves on two styles each (`directions/`, `displacements/`), twelve variations (`variations/`), six seeds (`seeds/`), eleven specimens, the references with provenance (`source.json`) and review boards: `comparison.png`, `styles.png`, `construction.png`, `layouts.png`, `directions.png`, `displacements.png`, `variations.png`, `seeds.png`, `specimens.png`, with phone-width versions (`*-phone.png`, 390 px).

`validation.json` records same-machine Node/resvg checks: eleven distinct styles under one palette; every control and option visible in every style (each where it applies) and inert where it does not; four passes; seeds; exact replay; ordering — every neighbouring pair of lines evaluated at the union of both simplified polylines’ breakpoints in every style and in stress states (four graph directions × five base curves at full amplitude, drift, wobble and jitter with four steep faults and ranges; facing and reflected ranges), no crossings between drawn contour segments of neighbouring levels, and real crossings in fold order; fault steps; inlay centres; mirror symmetry of reflections and diptychs; clean margins; file sizes and single-pen strokes; input bounds. `browser-validation.json` records isolated Chrome checks of the editor. Browser evidence is in `output/playwright/strata-field-system/`.

Saved rules name `strata-field-v1`.

New vector interpretations, created with AI assistance. The original designs remain credited to Kiyoshi Awazu and Kazumasa Nagai; reference images are kept locally for study.
