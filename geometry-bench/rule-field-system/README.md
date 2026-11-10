# Rule-field letters

A type system after four posters in the local library:
- **RKC 2020 programme** (Giliane Cachin)
- **RKC autumn programme** (Giliane Cachin and Viltė Jurgutytė)
- **FUBU** (@tanjabailiff, @ladinadoerig, @elia.fidel.piero, @nicolaijaronkager, @tonjique)
- **Spatial Positions 10**, 2015 (@heee88)

Credits follow the archived captions. Open [the editor](../../output/rule-field-study-v1/index.html) to set any text, follow the four construction passes, combine modules, and export. Exports are a poster SVG or PNG, plotter centrelines, ink separations, a specimen, a print-ready PDF and a JSON rule.

One field of rules covers the sheet. Letters are never drawn: they show only where the rules break, shift, swell, wave, dash or cross. There are 22 styles: four follow the sources and eighteen are new. Every part of the construction is a module, so any style can take any field, wave, edge, pen, ink or warp.

## The construction

1. **Letter mask.** The copy is set in one of six SIL OFL faces and fitted into the field. Its outlines become a mask with two parts: an exact nonzero winding test on the flattened outline, and a signed distance raster (positive inside) for soft edges and contour fields.
2. **Plain field.** One of the field modules, bent by warps.
3. **Treatment.** Every rule is sampled along its length. Each point gets an insideness *t*:
   - hard edge: 0 or 1;
   - soft edge: an edge profile over the edge softness.

   The point then blends the outside and inside states:

   | State | Outside | Inside |
   | --- | --- | --- |
   | Offset | 0 | shift (in pitches) |
   | Wave | field wave | its own amplitude, phase and frequency |
   | Weight | rule weight | × weight inside |
   | Visible | rules or gap | rules or gap |

   Hard edges are found by bisection on the outline itself, where a rule is cut, jogged or ticked.
4. **Poster.** Inks, the second layer's ink, letter fill or outline, glow, and the information band.

## Modules

| Module | Choices |
| --- | --- |
| Field | parallel rules at any angle; rings and boxes (a superellipse from circle to box, any aspect, rotatable, sampled evenly by arc length); rays; spiral (1–8 arms, by arc length); contours of the letters (iso-lines of the distance field, one pitch apart) |
| Wave shape | sine, triangle, square, saw (square and saw softened so sampling holds them) |
| Warp | row pinch (fans between rows that meet at the side edges); noise warp (a smooth seeded field along each rule's normal) |
| Edge profile | soft step, ramp, dome, terraces (four steps) |
| At a hard cut | open, connect (a bar joins a shifted rule), ticks (a crossbar caps a cut rule) |
| Pen | flat (offsets along the field normal, thins on bends), round (keeps its weight, round ends), dashes, dots (one disc per period, sized by the rule weight) |
| Second layer | inside the letters, outside them, or everywhere; any field, or the complement of the first (parallel turned by an angle, rings ↔ rays); its own pitch and ink |
| Rules ink | one ink, gradient, two-tone (rules inside the letters in the letter ink), rainbow (an OKLCH hue walk across the field from the rules ink), alternate (every other rule in the accent) |
| Letter shapes | none, letter fill under the rules, letter outline over them |
| Letter fit | fit, rows to width, stretch to field, justify letters |
| Layout | five formats (A series, poster 2:3, story 9:16, square, wide 16:9), information band at bottom, top or sides or none, paper frame |

Dashes and dots follow the rule's own parameter. Inside the letters the pattern moves by the inside phase, so letters can show as a seam in dashes, and dot size carries a halftone.

Controls that only apply to some modules are dimmed in the editor. `applies(control, state)` gives the same answer to scripts.

## Styles

| Style | After | Construction |
| --- | --- | --- |
| Phase wobble | RKC 2020 | Fine wave on every rule; the rules swell inside a blurred letter mask |
| Cut field | FUBU | White rules on red stop exactly at every outline |
| Jogged trace | RKC autumn | Hairlines on a blue–green ground, cut at the outlines and capped with ticks |
| Pinched relief | Spatial Positions 10 | Justified rows; rules jump half a step inside outlined letters and pinch into fans between rows |
| Neon moiré | new | Two thin fields at 7°, both shifted inside two-tone letters, with glow |
| Ring swell | new | Concentric rings thicken inside the letters |
| Sun gap | new | Rays break at filled letters |
| Scanline swell | new | Horizontal rules swell inside the letters under a gradient |
| Cross hatch | new | Diagonal rules stop at the letters; a crossing field fills them |
| Pillow dome | new | Horizontal rules bulge over a dome profile, like inflated type |
| Tremor | new | Calm field; the rules shiver inside the letters |
| Spiral groove | new | One spiral groove, half a turn out and orange inside the letters |
| Box tunnel | new | Concentric boxes in the shape of the sheet stop at black letters |
| Contour echo | new | The letters' own contour lines echo out in cyan around solid yellow letters |
| Noise drift | new | Rules bent by a noise warp, shifted and ultramarine inside the letters |
| Dot screen | new | Rows of dots that grow inside a soft mask: halftone letters |
| Dash code | new | Dashes half a period out of step, thicker and pale inside the letters |
| Zigzag | new | Triangle waves inside the letters, straight rules outside |
| Square pulse | new | A square pulse that flips and thickens inside the letters, with glow |
| Prism scan | new | Rainbow scanlines that swell inside the letters |
| Lattice hole | new | A black and a blue field weave a grid; the letters are holes in both |
| Terraces | new | Rules step down in four terraces inside the letters, like a relief map |

`output/rule-field-study-v1/variations/` has 27 more combinations. Examples:
- the FUBU cut on a spiral and on contours;
- Spatial Positions in neon;
- boxes with terraces;
- dot spirals;
- a rainbow ring field;
- the earlier stretched ramp version of Spatial Positions (`relief-slid-ramp`).

## Outputs

| Output | How | Use |
| --- | --- | --- |
| Poster SVG / PNG | `render(rule)`; PNG at a 3000px long edge | Screen and print. Every rule is a plain filled outline; only the field clip, gradients, glow and the optional letter outline add anything else. With a hard gap on one side of the letters, first-layer rules also sit under a mask of the exact outline, so a rule through a slot narrower than its own weight cannot poke into a letter |
| Plotter SVG | `render(rule, {output: 'plotter'})` | One centreline stroke per rule run, dots as small circles, jogs and ticks as single lines; no fills, ground or text. For pen plotters, laser and vinyl |
| Ink separations | `separations(rule)` → `[{ink, colour, svg}]` | One black-on-white sheet per ink (rules, letters, accent; the information text goes with the rules) for screen or riso printing. Rainbow inks separate per hue step |
| Riso preview | Editor: **Riso and separations** (shared print kit, `geometry-bench/print-kit.mjs`). Build: `print/riso/` and `print/separations/` | The system's own separations printed in their inks over the stock, with misregistration and grain; on dark paper the paper sheet is made from them (black wherever no other ink prints). Checked by `geometry-bench/print-kit-check.mjs` |
| PDF | Editor: **Print / PDF** sizes the page to the format. Build: vector PDFs printed by Chrome | Print |
| Specimen | `specimen(rule)` | A–Z, 0–9, & and ? in the current rule |
| Rule | JSON state | Replay; `rule-field-v1` rules still open |

## Files and replay

```sh
node geometry-bench/rule-field-system/prepare-fonts.mjs   # only when the face list changes
node geometry-bench/rule-field-system/build.mjs
python3 -I geometry-bench/rule-field-system/contact-sheets.py
node --expose-gc geometry-bench/rule-field-system/verify.mjs
```

`engine.mjs` exports these:
- `render`, `resolve`, `separations`, `specimen` and `letterMask` (the fitted mask: exact winding, exact distance to the outline, and the signed distance raster);
- the catalogue: `FAMILIES`, `CONTROLS`, `OPTIONS`, `LABELS`, `FORMATS` and `OUTPUTS`;
- `applies`.

`fonts.mjs` holds the extracted outlines, so the editor and its SVGs need no font files. The build bundles engine and outlines into one offline editor with esbuild. It prints the PDFs with headless Chrome (playwright-core).

`build-app.mjs <out.html>` builds the same editor in app mode for the native PosterLab copy in [`workspaces/rule-field`](../../workspaces/rule-field/README.md). There it starts from the selected poster's copy, shows that poster beside the rule field, can take the poster's colours, and saves through the app's panels.

`output/rule-field-study-v1/` contains the following. Each example is an SVG, a PNG and a JSON rule:
- the 22 styles, each with two other texts (`texts/`);
- the construction passes of eight styles (`stages/`);
- five formats (`formats/`);
- 27 variations (`variations/`);
- a specimen per style;
- `outputs/`: plotter SVG and PNG, separations and a PDF for every style, indexed in `outputs/index.json`;
- the four references with their caption, post link and checksums (`source.json`), and `catalog.json`.

The boards are `comparison`, `families`, `construction`, `formats`, `variations` and `outputs`.

`verify.mjs` writes `validation.json`. Its checks:
- every style distinct under one palette;
- every control visible in six styles that, with per-control contexts, cover every field and pen;
- every module value visible;
- four distinct passes per style;
- exact SVG and saved-rule replay;
- v1 rules still open.

It also checks:
- **cut accuracy:** in plotter centrelines no point of a cut rule lies more than 1.2 px inside a letter, and in the poster no rule ink shows more than 1.5 px inside a cut letter (both by exact winding and exact distance to the outline), across parallel, rings, boxes, rays and spiral fields, four faces and two pitches;
- **rings:** every plain-field ring is drawn as a full ring;
- **contours:** every contour centreline lies within 1.6 px of its distance level;
- **dots:** halftone dots inside the letters are more than twice the size of those outside;
- **outputs:** separations are pure black on white, one per ink; plotter files are strokes only;
- **coverage:** every glyph of every face renders in all five fields, and every style in every format.

## Limits

Information text uses system fonts; in a PDF it stays live text. Glyph parts thinner than the sampling step can be skipped by a rule. That step is about 3 px at the default pitch, finer with waves, soft edges or dashes.

The soft edge and the contour field come from a raster distance field about 2.5 px per cell, so they are accurate to about a pixel. Hard edges are exact.

Dense styles take time:
- **Spiral and contour fields:** a few hundred milliseconds per render.
- **Dot screens:** many thousands of discs.

Source imagery stays attributed to its designers. The construction, styles and proofs are new and were made with AI assistance. Nothing is traced from the posters. No library records, models or votes are changed.
