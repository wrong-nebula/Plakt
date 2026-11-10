# Rising-ray stage — after Tadanori Yokoo

A shape system after **Tadanori Yokoo’s** ray stages of 1965–97 (*Made in Japan, Tadanori Yokoo …*, *Yukio Mishima, The Aesthetics of End*, the 16th Japan Advertising Artists Club exhibition, *À la Maison de M. Civeçawa*, *Word Image*, *Hino Moto no Keko*, *Fancydance*; MoMA and V&A records in the local Japanese poster archive). Open [the editor](../../output/rising-ray-study-v1/index.html) to build a stage in ten styles, five layouts and four formats, follow the four construction passes and export SVG, PNG or a saved JSON rule.

The subject is the figure, not the lettering: filled wedge rays composed as a stage. The source posters are kept as four presets; the goal is the shared construction.

## The construction

1. **Rays.** A full turn of N rays round an origin. Each ray gets a width weight between 0.35 and 1.65 of the mean, and the weights are scaled to close exactly 360°. N is rounded to a multiple of the colour count (2 or 3), so neighbours never share a colour, even where the turn closes. Ray 0 (colour A) is centred on the rotation angle, measured from straight up.
2. **Layered fill.** Colour A is a full disc. Each later colour covers its own wedge and runs on under the middle of the next colour’s wedge (the last colour stops at its own edge). Every boundary is then a single edge drawn over the ray colour it meets, so no ground shows between rays at any count or zoom, and no boundary carries a second antialiased edge.
3. **Stage.** A sun sits at the origin. A flat sea starts at the horizon with receding wave bands (or a perspective floor) below it, drawn far to near. Panels, edges and the title slot frame the opening. Twin and stacked bursts draw the first burst mirrored about the vertical or horizontal centre line, each clipped to its half; the mirrored half overlaps the centre by two pixels.

| Part | Choices |
| --- | --- |
| Width modulation | Even; wide / narrow (colour A wide); tapering (wide toward the page centre, narrow behind); breathing (three swells per turn); random (seeded) |
| Ray fill | Solid; radial checker (colours swap ring by ring, rings grow by 2π/N so cells stay square); hatched (colour B striped in the accent); glow fade (each colour fades into the ground) |
| Ray ends | To the edges; star points; forked (swallowtail) tips; scalloped; disc — all at a **reach** of the farthest corner |
| Bursts | One; twin (mirrored left/right); stacked (mirrored top/bottom) |
| Sun | Disc with outer ink rings; target rings; halo bands; slatted sunset (gaps thicken downward and show the rays); corona star (points on the ray centres) |
| Below the horizon | Sine swell; scallop hills; stepped terraces; curling crests (a cliff face with a lip curling over it, and spray); stage floor (row bands bowed like an apron, columns to the vanishing point, checkered) |
| Panels | None; proscenium curtains with folds, tie-backs and a swagged valance; columns with capitals and a lintel; frame; arched window (frame, an arch that the title band follows, spandrels and two side boxes with their own three-colour bursts, a date box) |
| Edges | None; clouds; scalloped hem; bunting — clipped to the panel opening |
| Title band | Arched band; straight band; plain letters; no copy |
| Texture | Flat; halftone dots; riso grain (seeded); neon glow; overprint (sun and sea printed over the rays in multiply, off register) |
| Format | Poster B 728 × 1030; square 900 × 900; landscape 1030 × 728; banner 420 × 1030 |

Controls: rays per turn (4–96), rotation, width modulation, ray reach, seed; origin across and down (−0.5 to 1.5 of the page, so the origin can sit off the page), sun size, sun rings; horizon, wave bands, wave amplitude, waves across, stage depth (far bands thin, near bands thick, near waves longer); panel width; ink line, texture scale, title size. Controls that do nothing under the current options are disabled in the editor. Twelve palettes of ten colour roles (ground, ray A/B/C, sun, sea A/B, panel, accent, ink); each colour can be edited.

## Ten styles

| Style | After | Construction |
| --- | --- | --- |
| Yokoo stage | *Made in Japan …*, 1965 | 44 even red / sky rays from a half sun in an arched window; spandrels and side boxes carry their own three-colour bursts; clouds |
| Sun and surf | *The Aesthetics of End*, 1966 | Gold rays slightly wider than teal from a high sun; curling navy crests; arched red band |
| Spike tide | 16th JAAC exhibition, c. 1956–66 | Vermilion rays with forked tips on a yellow halftone ground, a big half sun on a flat blue sea, scalloped hem |
| Fancy burst | *Fancydance*, 1989 | 66 seeded random rays in three colours from an off-centre ringed sun; hatched pink rays |
| Neon festival | new — electro | Magenta and cyan glow rays on near-black, a haloed sun on a perspective grid floor, neon columns, bunting |
| Comic burst | new — pop art | Random yellow / orange rays cut to star points round a white corona, heavy ink, halftone |
| Riso twins | new — two-tone riso | Twin mirrored pink bursts on paper; a blue sun and stepped terraces overprint the rays |
| Sunset horizon | new — retro sunset | Slatted sun on a low horizon, three warm colours, receding sine swells, grain |
| Op-art tunnel | new — op art | Breathing black / white rays in a radial checker falling into a red target |
| Showa theatre | new — proscenium | Gold and crimson rays behind velvet curtains and a valance, a haloed spotlight over a board floor |

No preset is red rays on white with an offset red disc.

## Layouts

Layouts are composition presets that set the origin, horizon, sun and burst mode (the framed stage also sets the arched window and band): **centre burst**, **low horizon** (origin on the horizon), **corner burst** (a quarter sun in the lower left), **twin bursts** and **framed stage**.

## Title slot

The copy is placed for composition only. The title is set in the system’s Impact with every glyph forced to its Impact advance (`textLength`), so fitting is the same on any machine; a straight band uses one text run. `features.titleSlot` returns the band outline (and for the arch its centre and radii), so an arched-headline system can replace the slot later. Glyph shapes come from whatever Impact or fallback the viewer has.

## Rebuild and verify

```sh
node --expose-gc geometry-bench/rising-ray-system/build.mjs
python3 geometry-bench/rising-ray-system/contact-sheets.py
node --expose-gc geometry-bench/rising-ray-system/verify.mjs
node geometry-bench/rising-ray-system/browser-check.mjs
```

`engine.mjs` holds the whole construction (no dependencies); the build bundles it into the offline editor. Posters are 728 × 1030; PNG exports are 2120 × 3000 (other formats at a 3000px long edge).

`output/rising-ray-study-v1/` contains the editor, every style as a poster, its four passes, five layouts (`layouts/`), four formats on four styles (`formats/`), twelve variations (`variations/`), a kit sheet per style (`specimen-*.png`: every part of the construction in that style), the references with provenance (`source.json`) and review boards: `comparison.png`, `styles.png`, `showcase.png`, `layouts.png`, `formats.png`, `variations.png`, `construction.png`, `kit.png`. `phone/` holds every board at 390 px wide, the phone-size check.

`validation.json` records same-machine Node/resvg checks: ten distinct styles under one palette; every control (where it applies) and every option value visible in every style; five distinct layouts per style; four passes; exact replay and seeded randomness; ray tiling for every count from 4 to 96 × 5 modulations × 2 colour counts × 3 seeds and turns (contiguous, closing one turn, neighbours always different, no ray under a fifth of the mean); seam probes; clean renders of every style × layout × format × pass; input bounds and export sizes. The seam probes paint the rays alone on a pure green ground and rasterise them at zooms from 0.67 to 2.13. Every boundary pixel must be a blend of its two neighbouring ray colours, every ray centre must show its exact colour, and the twin and stacked centre lines must show no ground. `browser-validation.json` records isolated Chrome checks of the editor. Browser evidence is in `output/playwright/rising-ray-system/`.

Saved rules name `rising-ray-v1`.

New vector interpretations, created with AI assistance. The original designs remain credited to Tadanori Yokoo; reference images are copyrighted and kept locally for study only.
