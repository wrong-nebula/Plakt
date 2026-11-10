# Spectral echo glyphs — after Mitsuo Katsui and Koichi Sato

A type system after **Mitsuo Katsui’s** spectral letter posters (*Letters and Life*; *1: Design for the Next*, 2008) and **Koichi Sato’s** *The Modern Poster* (MoMA, 1988), from the local Japanese poster archive. Open [the editor](../../output/spectral-echo-study-v1/index.html) to set Latin or Japanese text in seven styles, follow the four construction passes and export SVG, PNG or a saved JSON rule.

## The construction

A glyph is repeated N times. Copy *t* ∈ (0, 1] is the core glyph moved by one composed transform — **travel** along a **direction**, **turn**, and **stretch** across and up about an **anchor** — each scaled by *t* raised to the **easing**. Copies are drawn from the farthest to the core, so the core always sits on top.

Copy colour walks an **OKLCH hue ramp** (start hue, hue walk) at a fixed lightness and chroma; colours that leave sRGB are pulled back by reducing chroma, so a walk never jumps in lightness. Opacity fades with *t*. Copies can be filled or drawn as outlines, blended (normal, multiply, screen, difference) and given a glow.

| Construction | Rule |
| --- | --- |
| Linear echoes | The composed transform above — fans, trails, tunnels and orbits are all settings of it |
| Radial split | Copies spread round a small circle with the hue circle shared evenly — three copies at a 360° walk land on red, green and blue and recombine to white under screen |
| Sliced smear | Each copy is cut into horizontal bands; every band shifts on a sine wave and takes its own hue (Katsui’s smeared ONE) |
| Prism fill | One spectrum runs through every core glyph; echoes become hard offset shadows (Sato) |

The anchor can alternate between the base on odd rows and the top on even rows, which reproduces Katsui’s 雨 fanning upward over 木 fanning downward.

## Seven styles

| Style | After | Construction |
| --- | --- | --- |
| Spectral bloom | Katsui, *Letters and Life* | 26 copies stretched across about the stem, alternate anchors, dark core |
| Spectral smear | Katsui, *1: Design for the Next* | Sliced bands on a wave, turned to read downward, screen on black |
| Prism windows | Sato, *The Modern Poster* | Letters spread on a grid, one spectrum, black offset shadows |
| Neon trail | new | White-hot core trailing outline echoes with glow on a violet gradient |
| Chromatic split | new | Three additive copies, RGB misregistration |
| Zoom tunnel | new | Outline copies shrinking toward a vanishing point |
| Orbit fan | new | Copies swinging round each letter’s foot |

## Type

Outlines are pre-extracted by `prepare-fonts.mjs` into `fonts.mjs`, so the editor and its SVGs need no font files: Archivo Black, Anton, Rubik Mono One and Unbounded Black (SIL Open Font License), and a subset of macOS Hiragino Sans W6 — kana and 90 kanji — kept for local study only. Latin faces fall back to Hiragino for Japanese characters.

## Rebuild and verify

```sh
node geometry-bench/spectral-echo-system/prepare-fonts.mjs   # only when the glyph set changes
node geometry-bench/spectral-echo-system/build.mjs
python3 geometry-bench/spectral-echo-system/contact-sheets.py
node --expose-gc geometry-bench/spectral-echo-system/verify.mjs
node geometry-bench/spectral-echo-system/browser-check.mjs
```

`output/spectral-echo-study-v1/` contains the editor, posters for every style with three more texts each, the four passes per style, twelve variations (`variations/`), seven specimens, the references with provenance (`source.json`) and review boards: `comparison.png`, `styles.png`, `text-transfer.png`, `variations.png`, `construction.png`, `alphabet.png`. Posters are 728 × 1030; PNG exports are 2120 × 3000.

`validation.json` records same-machine Node/resvg checks: seven distinct styles under one palette, every control and option visible in every style (each where it applies; circular controls against their half turn), four passes, exact replay, echoes always drawn before the core, every glyph of every face, the OKLCH ramp inside sRGB with the three-copy split landing on red, green and blue, and input bounds. `browser-validation.json` records isolated Chrome checks of the editor.

New vector interpretations, created with AI assistance. The original designs remain credited to Mitsuo Katsui and Koichi Sato; reference images are kept locally for study.
