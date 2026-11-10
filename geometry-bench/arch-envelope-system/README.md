# Arch-envelope headlines — after Tadanori Yokoo

A type system after **Tadanori Yokoo’s** warped headlines of 1965–97 (Made in Japan, Koshimaki-Osen, 100 Posters of Tadanori Yokoo, Takarazuka, LaChapelle Land, Okabe Silkscreen Studio, Okera Kai; MoMA and PGDA records in the local Japanese poster archive). Open [the editor](../../output/arch-envelope-study-v1/index.html) to set any headline in ten styles and twelve envelopes, follow the four construction passes, and export SVG, PNG or a saved JSON rule.

The goal is a reusable system, not poster remakes: one set of outlines, one envelope warp, one renderer; every envelope, stem direction, banner, extrusion, face, ground and layout is a control. Six styles follow Yokoo posters, four are new (two electro styles on near-black).

## The construction

1. **Setting.** The headline is set from outlines pre-extracted from ten OFL fonts (`prepare-fonts.mjs` → `fonts.mjs`; cap height 1000, overlaps merged with paper.js, kerning pairs from each font’s own layout). No font files ship with the editor.
2. **Flattening.** Curves are subdivided by length and by turning; straight segments are subdivided by length too, measured with the row’s horizontal stretch — otherwise they could not bend. `detail` sets segments per letter height.
3. **Envelope.** Every envelope is a centre curve with an upper and a lower half-height. A point at position *s* across and *v* up maps to the centre at *s* plus an offset along the stem direction. **Stems: vertical → radial** blends the vertical with the centre’s normal. The normal field is gaussian-smoothed over half a band height and widened until it turns slowly enough that no stem can cross its neighbour. Edge-defined envelopes (bridge, gable, valley: a flat side against a curved one) run each radial stem from edge to edge, so the flat side stays flat. Radial stems space letters by arc length; keystone, rising and tapered envelopes can foreshorten spacing as in one-point perspective.
4. **Letter fit.** At 1 every point is warped, so letters fill the band — a capital’s top runs along the top curve and its foot along the bottom one, and radial letters widen upward. At 0 each letter stays a rigid box at its centre’s height and normal: stepped heights with vertical stems, or plain text on a path with radial stems. Rows with descenders fit descender-to-cap-height.
5. **Rows.** Up to three rows, each in its own band (stacked) or all in one envelope (block), each filling the width or sharing one scale.
6. **Banner, depth, line.** The banner is the envelope band itself (solid, ruled, metal, rules only) with flush, folded-ribbon, swallowtail or pointed ends. Extrusions: flat drop, stepped layers (three colours, line between steps), a block or a vanishing-point solid built from a back face plus visible side strips in two tones, drawn back to front by their front edges. Faces: solid, outlined, inline (a line inset inside each letter), outline only, neon.
7. **Ground and layout.** Rays, sunburst with sea, sun on a horizon, neon grid, rings, gradient or plain, in six layouts (proscenium, masthead, twin, centre stage, diagonal, stack) with double-rule, barber-stripe or border frames. Kicker and information plates use the same outlines, unwarped.

## Ten styles

| Style | After | Envelope · typeface | Banner · depth · face | Ground · layout |
| --- | --- | --- | --- | --- |
| Silver arch | Made in Japan, 1965 | Arch, radial · Anton | Metal band with gold and black rules | Rays, proscenium with side panels |
| Vanishing masthead | Koshimaki-Osen, 1966 | Valley · Archivo Black | Vanishing extrusion in cobalt and black | Rays from the vanishing point, masthead with footlight arcs |
| Valley stretch | Okabe Silkscreen Studio, 1997 | Deep valley · Anton | — | Sun on a horizon, twin |
| Gable banner | LaChapelle Land, 1996 | Gable · DM Serif Display, mixed case | Ruled yellow band | Rays, proscenium |
| Inline revue | Takarazuka, Grand Revue, 1966 | Slight bulge · Bodoni Moda Black | Inline face, red drop shadow | Rays, masthead, barber stripes |
| Rising ribbon | Okera Kai, 1997 | Rising ribbon, half radial, slanted · Barlow Condensed | Outlined, block extrusion | Beams from a corner, diagonal |
| Night drive | new — electro | Wave block · Bebas Neue | Neon face, vanishing extrusion | Neon grid with a striped sun |
| Acid pinch | new — rave | Pinch · Unbounded Black | Stepped pink and blue extrusion | Rings, stack |
| Riso bulge | new — risograph | Bulge block · Rubik Mono One | Outlined, block extrusion | Rays, centre stage |
| Groovy smile | new — seventies | Inverted arch, radial · Fraunces Black Soft | Outlined, stepped tangerine, amber and rust | Sunburst and sea |

## Envelopes and controls

Envelopes: arch, inverted arch, bridge, gable, valley, bulge, pinch, wave, flag, keystone, rising ribbon, straight. Waves and flags are bounded so their slope stays under about 37° and, with radial stems, their curvature stays gentle enough for half a band.

| Group | Controls |
| --- | --- |
| Envelope | Envelope; depth, stems vertical → radial, waves, wave phase, height taper, perspective spacing, letter fit stepped → smooth |
| Letters | Typeface (10), case, rows (bands / block), row width (justify / shared); letter height, width, tracking, slant, row gap, flattening |
| Banner | Banner (none, solid, ruled, metal, rules only), ends (flush, folded tails, swallowtail, point); padding, end length |
| Depth and line | Extrusion (none, drop, block, stepped, vanishing), face (solid, outlined, inline, outline, neon); depth, angle, steps, line weight |
| Ground | Layout (6), ground (7), frame (4); rays/rings, ray width, origin height, sun size; nine colours |

Sliders that do nothing in the current state are disabled (`applies()` in the engine; the checks confirm they are inert).

## Rebuild and verify

```sh
node geometry-bench/arch-envelope-system/prepare-fonts.mjs   # only when changing the typefaces
node --expose-gc geometry-bench/arch-envelope-system/build.mjs
python3 geometry-bench/arch-envelope-system/contact-sheets.py
node --expose-gc geometry-bench/arch-envelope-system/verify.mjs
node geometry-bench/arch-envelope-system/browser-check.mjs
```

`engine.mjs` holds the envelopes, warp, layouts and renderer and imports only `fonts.mjs`; the build bundles both into the offline editor. Posters are 728 × 1030 (B-series proportion); PNG exports are 2120 × 3000.

`output/arch-envelope-study-v1/` contains the editor, a poster per style (3000 px) with four more texts each (`texts/`), the four passes per style (`stages/`), every envelope with vertical and radial stems (`envelopes/`), ten typefaces (`fonts/`), six layouts (`layouts/`), 24 variations (`variations/`), every envelope at full depth plus a coarse flattening (`extremes/`), ten specimens, the references with provenance (`source.json`), `font-provenance.json` and review boards: `styles.png`, `comparison.png`, `text-transfer.png`, `text-transfer-more.png`, `envelopes.png`, `extremes.png`, `fonts.png`, `layouts.png`, `variations.png`, `construction.png`, `alphabet.png`.

`validation.json` records same-machine Node/resvg checks: ten distinct styles under one palette, every control visible in every style (switching on what it needs) and inert where it does not apply, every option value distinct, four passes, exact replay, every character warped in every typeface, no NaN across probe texts. Geometry checks: no envelope folds (12 presets × depth × tilt × taper × one- and three-row bands, every grid cell keeps one orientation); straight outline segments stay smooth after warping (turning per subdivision bounded, and decreasing with finer flattening); with no banner every capital touches both envelope edges (letters fill the envelope); a radial arch letter widens upward while a rigid letter on a path keeps its width; lettering stays inside the frame; input bounds. `browser-validation.json` records isolated, offline Chrome checks of the editor; evidence is in `output/playwright/arch-envelope-system/`.

Saved rules name `arch-envelope-v1`.

Limitations: the headline alphabet is Latin (80 characters per typeface; no kana or kanji), and plates are set in capitals. Extrusion side faces are ordered by their front edges, exact for neighbouring faces and approximate where far-apart faces overlap. Radial stems on edge-defined envelopes fan the flat side outward at the ends. Layouts are geometric stand-ins for Yokoo’s collage; nothing pictorial is generated.

New vector interpretations, created with AI assistance. The original designs remain credited to Tadanori Yokoo; reference images are copyrighted and kept locally for study only. Headline outlines come from SIL Open Font License fonts (Anton, Bebas Neue, Barlow Condensed, Archivo, Archivo Black, Rubik Mono One, DM Serif Display, Bodoni Moda, Fraunces, Unbounded) — see `font-provenance.json`.
