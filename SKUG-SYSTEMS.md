# Salon skug series + Täuschung: system candidates

Nine references the user sent on 9 November 2026: eight Salon skug posters (Rhiz and elsewhere, Vienna, 2024–25, credited *Grafik: Nguyen Gobber* on each sheet) and the cover of *V#38 Täuschung* (literatur:vorarlberg). None are in the library. The images are in `output/skug-system-candidates/sources/` (`01`–`09`, numbered as below).

Each one was checked against the built systems: the shape library (45 recipes plus the survey recipes), the geometry-bench systems, the workspaces, the type operators and the unbuilt rows in `ARCHIVE-CANDIDATES.md`. Each candidate is a reusable construction. The source poster becomes its first preset, with its real copy.

## Verdict

| # | Source | Kind | Candidate | Status | Nearest existing |
| --- | --- | --- | --- | --- | --- |
| A | 05 SALONNNN | Type | **Spiral stutter coil** | New | Rotation fields (bands only), unbuilt *Stutter chains* (archive #4), contour channels (round, not stepped) |
| B | 03 RICO / MYNTHEN | Type | **Fragment-fill lines** | New | Repeated phrase fields (whole words), capsule kits (no fill rule) |
| C | 08 SETZKASTEN | Type | **Type case keys** | New | RKC disc (modules *build* letters), circle pack (one letter per circle, packed, not gridded) |
| D | 06 14.3.25 | Type + layout | **Cascade tab grid** | New | Scale ramp (heights only), unbuilt *Tagged lines* (archive #10) |
| E | 02 DAGMAR / NINI | Shape | **Reeded glass grid** | New | Glass workspace (3D solids, no flutes), Effectors *Tiles* (cuts shapes, no refraction), unbuilt *Thermal blobs* (#13) |
| F | 09 collage | Shape | **Texture shard overprint** | New | Effectors screens (one screen per shape), unbuilt *Overprint blobs* (#23) and *Treatment roulette* (#8) |
| G | 07 BAM! | Shape | **Even-odd emblem stage** | New, partial overlap | Rising-ray (radial checker, checkered floor), shock-burst mirrors |
| H | 01 TÄUSCHUNG | Shape | Ouchi brick field | **Extension** of rule-field | Rule-field second layer "parallel turned by an angle" is the same idea, letters only |
| I | 04 AUF RÄDERN | Shape | Needle corona | **Extension** of shock-burst / rising-ray | Corona star sun, glow fade, seeded spikes |

Suggested build order: A, B, C (strongest new type systems), then E, F, D, G. H and I are small additions to existing systems.

---

## A · Spiral stutter coil (type)

**Construction.** Words run clockwise round a rectangular spiral, one word per side, turning 90° at each corner (SALONNNN across the top, SKUGGGG down the right side, SCHLORRR and NESSSS round the remaining sides, then WURSTTT, TALKK and the date further in). A word that is shorter than its side **stutters**: its last letter repeats until the side is filled. Each turn inward sets smaller. Offset outlines follow the block's outer silhouette as **stepped orthogonal outlines** in two or three inks (blue, red, green), like a pixel staircase. Letters can switch between solid and dot screen.

**Why new.** Rotation fields only give straight vertical or opposed bands. Copy along a closed path has no fitted source. Stutter fill is archive candidate #4, still unbuilt. Contour channels draw round offsets, not stepped ones.

**Breadth.**
- Paths: square spiral, rectangular spiral (aspect), triangle and hexagon spirals, a meander, concentric frames (no spiral), double spiral (two words meet in the centre).
- Fill rules: stutter last letter, stutter a chosen letter (Maaaagenta), stretch the word (scale x), track it out, repeat the whole word, mixed by side.
- Size progression: constant, geometric per turn, per side.
- Outlines: none, stepped (pixel), mitred offsets, rounded offsets; 1–4 rings, ink cycle, gap.
- Rendering: solid, dot screen (the source), line screen, outline only, riso misregistration.

**Controls.** Turns, inward scale, corner rule (overlap / butt / mitre), start side, direction, stutter letter, outline count and step.
**Hand edits.** Drag a corner to resize a side; the stutter count updates live. Click a word to swap fill rule.
**Source preset.** *SALONNNN · SKUGGGG · WURSTTT · SKUGGGG · TALKK · DJSSS · 05.12.2024* on white, black type with dot screen, blue/red/green stepped outlines.

## B · Fragment-fill lines (type)

**Construction.** Each line is set to full measure at one cap height. Space a word leaves over is filled with **fragments of its own glyphs**: the diagonal strokes of M and A become a run of slanted wedges (`\\\\MAJOR\\\`), the bowl of O or C becomes nested arcs (`RICO))))`, `((((SALON`), the bowl of P becomes small rings (`SHRIMPoooo`), stems become hairline bars. Runs grow, shrink, slant or clip as they move away from the word. The face itself is a parts kit (stems, wedges, arcs, ball terminals, hairline serifs), so fragments are exact pieces of real letters. The source frames the sheet with a red/blue triangle border, which the sawtooth system already draws.

**Why new.** Repeated phrase fields and echo stacks repeat *whole* words or glyphs. No operator takes a glyph apart and uses its parts as justification.

**Breadth.**
- Fragment sources: from the adjacent glyph, from the word's first/last letter, from one chosen part across the poster, from any Google Font outline (split at contour extrema and inflections).
- Run shapes: constant, decay (shrink), grow, rotate (arcs turn into C → ⊃), lean (wedges fan), clip by the measure.
- Placement: before, after, both sides, between letters (loose tracking filled), right-aligned rag filled.
- Faces: the source's stencil-serif kit, a sans kit, a mono kit, Google Fonts split into parts.
- Rendering: solid, outline, halftone grain (the source has paper grain), two-ink (fragments in the accent).

**Controls.** Measure, fragment density, run law, part pick, frame on/off.
**Hand edits.** Click a fragment run to cycle its source part; drag its end to change the run length.
**Source preset.** *RICO · MYNTHEN · MAJOR · SHRIMP · SKUG TALK · 9.5.2024 · RHIZ · SALON · SKUG*, light grey on black, red/blue triangle border.

## C · Type case keys (type)

**Construction.** A modular grid of rounded keys (squircles), one letter per key, in three key sizes: large keys span 2×2 small cells, medium keys 1.5 or 2 cells. Copy flows into keys by information tier: title in the largest keys (red), date and venue in medium keys (green), line-up in small keys (yellow). Every key that receives no letter is filled **black**, so the empty case is part of the picture. Small words can nest two rows of small keys inside one large slot (NORDWEST / BAHNHOF). The letters are a sharp serif cap, centred.

**Why new.** RKC disc uses modules to *draw* letters. Circle pack places one letter per circle, but packs them rather than gridding them. Nothing sets copy as a type case with tiers, nesting and filled blanks.

**Breadth.**
- Key shapes: squircle (exponent), circle, rounded square, octagon, pill (double keys), keycap with bevel.
- Grids: the source's 2-scale grid, three scales, golden subdivision, random quadtree, strict monospace.
- Flow: tier by size, tier by colour, justify per row with blanks, ragged with blanks, centred words.
- Blanks: black keys, outline keys, paper (holes), hatched, second-ink tint.
- Rendering: flat, riso overprint, embossed keycaps, letterpress.

**Controls.** Columns, scale ratios, squircle exponent, gap, blank fill, tier inks, letter size inside key.
**Hand edits.** Click a cell to merge or split keys; drag a word to another row; the rest reflows.
**Source preset.** *SALON X SKUG SETZKASTEN · SA 6.9.2025 AB 18 UHR @ TRACING SPACES NORDWEST BAHNHOF* plus the line-up, red/green/yellow keys on white.

## D · Cascade tab grid (type + layout)

**Construction.** Rows whose column count doubles (or halves) down the sheet: 2, 4, 8, 8, 16, 16. Each cell is an image tile with a black **tab bar** at its top edge. The copy (*SALON SKUG · 14.3.25 · RHIZ · ELASTIC SKIES · SPUR: B DJ-SET · SKUG TALK*) flows through the tabs in order and starts again at the end, so the type gets smaller as the cells do and the whole programme is repeated at every scale. Inside each row the image runs on across the tiles, cut by thin coloured gutters. The image is a duotone with a coarse halftone (clouds in red and lime on kraft), and the tab type is a pixel face.

**Why new.** Scale ramp changes type height, not the grid. Repeated phrase fields have no containers. Tagged lines (archive #10) keep one container per line, in reading order.

**Breadth.**
- Progressions: doubling, Fibonacci, linear, halving upward, golden; rows or columns; spiral (golden rectangle).
- Copy flow: cycle, one token per cell, split tokens into syllables or characters at small sizes (the source drops to `14.`, `3.`, `25`), fade to bars.
- Tabs: top bar, side bar, pill, inverted, no tab (type over image).
- Fill: duotone halftone image, flat ink alternation, gradient per row, any shape-library recipe per cell.
- Rendering: halftone dots, pixel grain, riso two-drum.

**Controls.** Rows, ratio, gutter, tab height, type scale per row, image source, duotone inks.
**Source preset.** The 14.3.25 programme, red over kraft with lime clouds, black tabs, pixel face.

## E · Reeded glass grid (shape)

**Construction.** A soft colour field (blurred blobs of orange, cream and violet on black) is seen through **reeded glass**. Each flute refracts the field into vertical streaks. The sheet is split into a grid of panes (6×4 in the source), and each pane shows the field shifted by its own offset, so blobs break at the pane edges. A fine dot screen sits over everything. The type sits on row lines, one word per column, in white.

**Why new.** The glass workspace refracts posters through 3D solids. Effectors' *Tiles* cut and copy shapes but do not refract. *Thermal blobs* (archive #13) is the field alone.

**Breadth.**
- Fields: metaball blobs, the poster beneath (any generated poster or photo), a title set huge and blurred (type mode), a gradient mesh.
- Glass: round flutes, triangular ribs, square fluting, ripple glass, frosted bands, lens dots (fly-eye); vertical, horizontal, diagonal.
- Panes: grid, rows only, shuffled offsets, mirrored panes, one pane per word.
- Rendering: smooth, dot screen (the source), riso grain, scanline.

**Controls.** Flute width, refraction strength, blur, pane grid, offset range, seed, screen size.
**Hand edits.** Drag a blob; the panes redraw live. Drag a pane to change its offset.
**Source preset.** *DAGMAR · NINI · SKUG TALK · 21.3.2024 · RHIZ · SALON SKUG*, warm blobs on black and violet. Build it in the glass workspace copy rather than a new app.

## F · Texture shard overprint (shape)

**Construction.** A stack of layers, each a large geometric cut (triangle, sector, band, stepped polygon, circle) filled from a **texture bank**: halftone dots at several rulings, a reaction-diffusion labyrinth, stepped pixel lines, stripes, checks. Layers overprint in multiply with a 6–10 colour palette, so every crossing makes a new colour. The title is set as one more layer, almost lost (the source's ghosted `SALON SKUG` in a pixel face along the foot).

**Why new.** Effectors apply one screen per shape. Overprint blobs (archive #23) are flat and rounded. Treatment roulette (archive #8) is per glyph. Nothing composes many textured cuts into one overprint.

**Breadth.**
- Cuts: triangles, sectors, bands, stairs, circles, letters of the title as cuts.
- Textures: dots (round, square, line), reaction-diffusion (spots, stripes, maze), Truchet, stepped lines, crosshatch, noise grain. Reaction-diffusion is new to PosterLab and useful elsewhere.
- Blend: multiply, screen, darken, knockout.
- Density: 5–60 layers; calm (few layers, two inks) to dense (the source).
- Rendering: riso (each texture a drum), offset CMYK, screen print.

**Controls.** Layer count, cut mix, texture mix, palette, scale, seed, title prominence.
**Hand edits.** Click to add a cut at the pointer; drag to move; click a cut to cycle its texture.
**Source preset.** The dense collage with ghosted SALON SKUG. A calmer first preset should lead (posters use calm print palettes).

## G · Even-odd emblem stage (shape)

**Construction.** A bilateral emblem of long curved claws, built from tapered Bézier spikes that open outward from a central axis and lean toward a vanishing point, stands over a **polar checker ring in perspective** (rings × sectors on a tilted disc). Shapes combine by **even-odd fill** in three tones: wherever a claw crosses the checker ring, the colours swap. The source is black, white and grey with yellow type.

**Why new, and the overlap.** Rising-ray already has a radial checker and a checkered stage floor, and shock-burst has mirrored parts. Neither has curved claw silhouettes, and neither composes with even-odd inversion. Build it as a new system that reuses rising-ray's floor code.

**Breadth.** Emblem families (crown, wings, flame, fork, fountain); symmetry 2/4/6; floor (polar checker, square checker, rings only, none); tilt; tones (2, 3, duotone gradient); type in the headroom or round the ring.
**Source preset.** *Salon skug: BAM! Wahlspecial · Wien-Edition mit Café Schädlweh · FLUCC Deck, 27.04.2025*.

---

## Extensions, not new systems

- **H · Ouchi brick field → rule-field.** Täuschung is the Ouchi illusion: a field of short bars in alternating-phase rows (a stretched checker) is turned 90° inside a disc, and the disc appears to float. Rule-field already has "second layer: parallel turned by an angle, inside the letters". Add a **brick-checker pen** (dashes whose phase alternates row by row, with a checker ratio) and **shape masks** (disc, ellipse, any shape-library silhouette) beside letter masks. Source preset: *V#38 TÄUSCHUNG · literatur:vorarlberg*, violet on vermilion.
- **I · Needle corona → shock-burst (or rising-ray's sun).** Auf Rädern draws detached tapered needles in two tiers around a gradient disc. The inner tier starts at the disc, the outer tier starts past a gap ring, and needles cross the gap. Add a *detached needles* part, a tier count with gap ring, and a vertical three-stop background gradient. Source preset: *SALON SKUG AUF RÄDERN · TOXIC VIOLIN · ENNO LINGG · SKUG TALK · MINIBAR MORALIA · DOHNAL-VILLA, MERKURWEG 15, 1140 PENZING · 29.06.2024*.
