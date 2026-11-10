# Effectors and modifiers

Fields that sit on top of a poster's elements and influence them, after the cursor-driven textures on textures.dev and MoGraph-style effectors. [Open the editor](../../output/effector-study-v1/index.html), or use the **Effectors** sheet in the PosterLab Effectors app copy (`workspaces/effectors`), where the same engine acts on the selected generated poster.

## The stack

| Layer | What it is | Choices |
| --- | --- | --- |
| **Elements** | Things that become clones: every cell, rule segment, dash, arc, letter (or word or line) and SVG shape is one clone with a position, size, rotation, colour and depth | Grid (eleven cell shapes, including eyes with pupils, hexagons and stars), Rules, Dashes, Rings, Scatter (seeded, even or random, with size variation and random turns), Text (eight OFL faces), Type matrix (cells inside letters, or sized by coverage), Artwork (any filled SVG; each shape or each element) |
| **Effectors** | Change each clone, in order, weighted by a field | Pinch, Stretch, Twist, Watch, Settle, Warp, Pillars, Repel, Shift, Wave, Jitter, Spin, Tone, Flow (curl-noise streams, optionally turning elements with the flow), Recolour (random, checker, row or column picks to the accent or knocked out), Snap |
| **Modifiers** | Act on the finished outlines | 37, in three kinds below |
| **Colour** | Repaint the finished outlines, never move them: on any element, on the paper or on the whole poster | Tint, Gradient, Gradient map, Spectrum, Hue shift, Saturation, Light, Invert, Fade, Posterize, Stripes, Threshold, Solarize, Channel swap, Split tone, Palette snap, Warmth, Separation, Shape gradient, Shape colour, Aurora, Four corners, Pop |
| **Fields** | Where an effector or modifier acts | Radial, linear, ring, box, noise, angle sweep (conic) or everywhere; size, softness, angle, steps (posterized bands), invert; still, orbit, sweep, wander, pulse or rotate; optionally following the pointer |

Every effector and modifier can act on all elements or on one. Motions complete whole cycles in the loop (2–20 s), so any moment of the loop can be exported and the loop repeats seamlessly. Effects spring towards their targets with adjustable inertia; zero follows exactly. With **Show fields** on, still fields show their centre and size handles on the poster and can be dragged. Every card can be randomized (⚄) or duplicated (⧉), and **Undo**/**Redo** (⌘Z, ⇧⌘Z) step through the whole stack.

### Modifier kinds

- **Bend the outlines** (point modifiers move every outline point; long edges are resampled first): Lens, Twirl, Ripple, Wave, Turbulence, Shear, Taper, Pixelate, Displace, Bend, Polar (with a spiral control and spans up to three turns), Spherize, Ribbon, Envelope, Perspective, Fold, Melt, Roughen, and two that work round each element's own centre: Petal (lobes pushed in and out, like pucker and bloat) and Swirl (each element twisted, most in the middle). Wave and Ripple take sine, zigzag, square or saw waveforms.
- **Cut, mirror and repeat** (clip outlines against half-planes, then copy them): Mirror, Kaleidoscope (mirrored wedges, rotated wedges or whole copies), Echo (steps with scale, turn, colour shift and fade), Slice (bands slid in alternate, random, wave or ramp patterns, with an optional gap for stencil bridges), Shatter (seeded cuts pulled apart), Zigzag edge (sharp or smooth ridges along every edge's normals), Tiles (a square grid of cuts, each tile knocked out of place and optionally recoloured), Dial (concentric rings turned against each other; a ring is a disc minus a smaller disc, each clipped as a convex sector, so no boolean library runs per frame), Burst (wedges round the centre pushed out and turned), Repeat (the whole page stepped and repeated in tiles, mirrored and recoloured) and Shadow (a long shadow swept along a direction, or a drop shadow, behind each outline).
- **Rebuild the outline** (before the element is placed, reading the field at its centre): Weight thickens or thins each outline by an offset, Round rounds outer corners, inner corners or both (retrying at a smaller radius rather than erasing thin strokes), and Outline keeps a band inside, centred on or outside the edge. Inline turns each outline into concentric contour bands with Clipper offsets, and the field sets how many. Screen rebuilds it as a print screen of dots, squares or crosses on a rotated grid (centre-sampled, or sized by coverage) or as exact line spans; inside the field the screen opens to its set size, and towards the field's edge the marks grow until they read as solid again. Dither rebuilds it as a heavy 1-bit dither: the outline's coverage is blurred by an edge spread and scaled to its own peak (so thin strokes keep a solid spine), lit from one side so edge ramps read as volume, lightened, grained, then dithered by one of 14 methods (Atkinson, Floyd–Steinberg, Jarvis, Stucki, Burkes, Sierra lite, Bayer 2/4/8, clustered dot, line screen, blue noise, white noise, threshold; error diffusion can mix in ordered checks) into square pixels, gapped LEDs, dots or scan lines. On the page grid every element shares one pixel lattice and one ordered pattern, so an imported poster dithers as one picture. The core is shared with the [Heavy dither](../heavy-dither-system/README.md) shape system. All three work on imported posters too.

### Combining modifiers

Modifiers stack in order, and a **Group** combines several into one unit:

| Combine | What happens to each outline point |
| --- | --- |
| **Chain** | Each child takes the previous child's result, exactly as if the children sat in the stack in that order |
| **Add** | Every bending child moves the *same* starting point; their displacements are summed |
| **Average** | The same, with the displacements averaged, so no child dominates |

The group's own field and strength mask every child: a child's influence is its own field times the group's, so a group can fade in along a sweep, follow the pointer, or switch off at strength zero. Cutting children (Mirror, Echo, Tiles…) always run in order, after an Add or Average blend. Rebuild-the-outline modifiers act on each element before it is placed, so they always come first and stay outside groups. Groups are one level deep, with up to eight children.

**Combos** are named groups that drop onto any stack: Glitch scan, Liquid, Eddies, Kaleido burst, Tunnel, Misprint, Folded flag, Shattered globe and Pop shadow. **Group them** wraps the current bending and cutting modifiers into one chain group; **Ungroup** puts a group's children back in the stack.

Combining copying modifiers multiplies their output, so every frame has rails:

- Before a copying modifier (Echo, Kaleidoscope, Repeat, Shatter, Shadow, Mirror, Zigzag edge, Tiles, Dial, Burst, Slice) runs, its growth is estimated; past 600,000 painted points, or 2.5 million points of work in the frame (copies scaled far off the page are only culled when painted, so the work on the way counts too), it is skipped for that element, and the editor shows *Heavy stack*. Weight, Round, Outline and Inline likewise skip any shape past 8,000 points or 150 contours (a screened shape, for instance), since offsetting needs a union of the whole outline.
- Polygons with non-finite coordinates are dropped; runaway ones (past ten million units, such as a copy scaled up 24 times) and ones wholly a page away are culled. Resampling for bending never makes more than 4,000 points of one polygon, so a hugely scaled copy cannot explode the point count.
- An element that bending turns inside out (Ribbon past 90°, Fold past 90°, a Bend past its centre) is re-oriented as a whole before painting, so it cannot cancel its neighbours.
- Screens cap at about 12,000 cells per shape by widening the pitch, and at fewer cells for complex outlines, so cells × samples × outline points stays near thirty million tests.

### Colour modifiers

Colour modifiers sit in their own section after the modifiers and run last, in order. They change colour and opacity only, so any outline, cut or copy keeps its colour work. Each acts on **all elements**, **one element**, **the paper**, or **the paper and elements** (the whole poster), and its field is the gradient that controls where it acts:

| Colour | Field read as | What it does |
| --- | --- | --- |
| **Tint** | Mask | Washes towards one colour (paper, ink, accent, white, black or any hex), in Normal, Multiply, Screen, Overlay or Colour blend |
| **Gradient** | Ramp | The field’s value picks the colour of a ramp: a linear field gives a linear gradient, a radial or ring field a radial one, noise a marbled one. Two colours of your own or a named ramp |
| **Gradient map** | Mask | Maps each colour’s lightness onto a ramp, or between two colours of your own: duotones, heat maps, chrome |
| **Spectrum** | Ramp | Runs the hues of the rainbow across the field, in up to six bands, optionally keeping each colour’s lightness; it can cycle over the loop |
| **Hue shift** | Mask | Turns hues round the colour wheel, optionally spinning over the loop |
| **Saturation** | Mask | Drains colour to grey, or pushes it louder |
| **Light** | Mask | Brightness and contrast: glows, vignettes, shading, a sweeping band of sheen |
| **Invert** | Mask | The negative, or lightness only, keeping each hue |
| **Fade** | Mask | Fades to transparent or into the paper |
| **Posterize** | Mask | Snaps colours to 2–16 levels, so any gradient before it prints as bands, like a split fountain |
| **Stripes** | Ramp | Bands that follow the field: straight stripes, target rings round a radial field, wedges round an angle sweep, contour lines on noise. Each band inverts, takes a colour, fades or knocks out to paper; bands can travel over the loop |
| **Threshold** | Ramp | Splits colours into a dark and a light one by lightness; the field moves the level, so a linear field wipes across shapes with a hard edge |
| **Solarize** | Mask | Turns only colours above a level to their negative (each channel, or lightness only), like a darkroom solarization |
| **Channel swap** | Mask | Swaps the red, green and blue channels |
| **Split tone** | Mask | Tints the darks one colour and the lights another, keeping lightness |
| **Palette snap** | Mask | Snaps every colour to the nearest of the palette or a ramp’s colours, and can rotate the palette roles or swap ink with paper or accent; good for an imported poster |
| **Warmth** | Mask | Warms towards orange or cools towards blue, keeping lightness |
| **Separation** | Mask | Shows one print plate: each colour’s cyan, magenta, yellow or black coverage printed in process or fluorescent (Riso) ink on white |
| **Shape gradient** | Mask | A ramp across each shape on its own (each letter, dot or poster shape), in any direction: every letter its own sunset or chrome |
| **Shape colour** | Ramp | Each shape takes one solid colour from the ramp where the field puts its centre: rainbow letters, colour-coded dots |
| **Aurora** | Mask | Two to seven soft blobs of a ramp’s colours, seeded, drifting over the loop and melting into each other: a mesh gradient |
| **Four corners** | Mask | A colour at each corner of the page, blended across it |
| **Pop** | Mask | Snaps hues to a few vivid steps, pushes saturation and flattens lightness into levels, like a screenprinted portrait |

Ramps are Palette and Duotone (from the poster’s own colours) and Thermal, Acid, Sunset, Chrome, Ice, Toxic, Holo, Fire, Infrared, Night vision, Blueprint and Vapor. A field’s softness, steps, invert and motion all shape the gradient; steps give hard bands. The **angle sweep** field (for every effector and modifier, not only colour) runs from 0 to 1 once round its centre from its angle, a conic gradient: a colour wheel under Spectrum, pie wedges with steps.

The paint stays vector. When every field of the colour modifiers on a draw operation varies along one axis (parallel linear fields, or radial and ring fields round one centre), the operation gets one real linear or radial gradient, sampled along that axis: where the colour jumps (a stepped field, Posterize, a hard edge) the sampler bisects to the edge and writes a pair of stops at one offset, and elsewhere it keeps only the stops needed to stay within about 1/255. Otherwise each shape (an outline with its holes) gets its own gradient along the field that changes most across it: a linear field’s axis or a radial or ring field’s rings; where no single field is exact (box, noise, angle sweep, Aurora’s blobs, Four corners), along the direction the colour itself changes fastest, so neighbouring cells meet without a step. Shape gradient and Shape colour read the shape being painted, so their operations are always painted shape by shape. Outlines with holes (letters, or the overlapping pieces of opposite winding that Dial, Tiles or Shadow leave) only add up correctly as one path, so such an operation is refined into cells as a whole: a cell clips every outline, each piece keeps its winding, and nonzero filling inside the cell is exactly the path’s. Only Shape gradient and Shape colour need real shapes there; for them the painted region is resolved with Clipper into outlines with their holes (up to 40,000 points; past that the operation counts as one shape). Where that one gradient misses the true colour by more than 0.8% (checked on a 3 × 3 grid), or a field laying many bands (Stripes, Spectrum) bends within it (its bands no longer straight) or crosses it from the side, the shape splits in four and each quarter tries again, down to about 5 units. Cells refine breadth first, each shape within its share of a budget by its area against the page’s, so contour lines stay curved across the paper and through the letters alike; the samples along each cell’s gradient grow with the bands that cross it. So a round spot over a linear ramp stays a round spot: cells stay large where one gradient is exact and grow fine only along the spot’s edge. Opaque cells overlap by a unit, still inside their shape, so anti-aliasing at their joins does not let the paper through. The editor’s live view uses a draft precision (7%, coarser cells) so a pointer-following spot over a busy poster stays interactive; SVG, PDF and PNG exports redo the frame at full precision. Gradients are written into the SVG as `linearGradient` and `radialGradient` with `userSpaceOnUse` coordinates, and the editor draws the same gradients on its canvas.

All outlines keep one orientation, so overlapping clones, mirrored copies and extrusion walls never cancel under nonzero filling. Pillars lift faces along a direction and fill the gap with walls: each edge swept along the lift is a quad, and the lifted copy closes the solid. Lifted elements paint from far to near along the lift.

## Where the modifiers came from

Where Illustrator, After Effects or Cinema 4D has the same operation (Offset Path, Round Corners, Zig Zag, Pucker & Bloat, Motion Tile, Explosion), `evidence.mjs` names it too. The modifier set comes from a survey of every poster in the PosterLab library (1,132) and the Japanese archive (1,399), looking at all of them on numbered contact sheets for distortions that recur. Each modifier is a new general construction; nothing is traced. `evidence.mjs` lists where each one shows up, and `output/effector-study-v1/source.json` carries the same list.

| Modifier | Seen in |
| --- | --- |
| Displace | Kiyoshi Awazu’s ridged strata (1976–83); Kazumasa Nagai’s banded waves (1968) |
| Bend | Arched headlines in the Swiss street posters |
| Polar | Kazumasa Nagai, *The Cell* (1966); Yusaku Kamekura, *Atoms for Peace*; radial rays and dot rings |
| Spherize | Type on globes and drums; Nagai’s domes and spheres (1974, 1989) |
| Ribbon | Type bands twisting to show their back |
| Envelope | Words squeezed into boxes and blobs |
| Perspective | Receding type and floors; *Habitat* (c. 1982) |
| Melt | Dripping and smeared letters |
| Roughen | Eroded, photocopied edges |
| Mirror | Reflected and flipped type; Kamekura’s mirrored butterfly (1968) |
| Kaleidoscope | A mirrored star; Shigeo Fukuda, *Images of Illusion* (1984); Tadanori Yokoo, *Word Image* |
| Echo | Stepped cascades; Kamekura, *Nikon SP* (1957); Mitsuo Katsui’s chromatic offsets |
| Slice | Type cut into bands and slid |
| Shatter | Cut and shifted numerals; Toshifumi Kawahara’s faceted X (1993) |
| Inline | Contour-line letters; Awazu’s psychedelic bands (1981, 1983) |
| Dither | A user reference (2026): a photograph dithered to coarse 1-bit pixels in a black frame |
| Screen | Halftone and line screens; Shigeo Fukuda, *No More* (1968); Kamekura’s line gradient for Nikon (1957) |
| Fold | Sheets of type folded back in space |
| Polar spiral | Type wound into a spiral; Fukuda, *Kyogen* (1981); Yokoo, *Rouge* (1994) |
| Weight, Round, Outline | Mixed weights of one face; capsule and pebble letters; outlined and haloed type; Kamekura, *Nikon SP* (1957) |
| Zigzag edge, Petal, Swirl | Serrated bursts and lightning edges; puffed and lobed outlines; a single swirled letter; Nagai, *TENRI* (1981) |
| Tiles, Dial, Burst | Grid-chopped glitch type; rings of type turned like a lock (Ryuichi Yamashiro, Tokyo International Film Festival, 1985); radial wedges (Kamekura, *Expo ’70*) |
| Repeat, Shadow, stencil gaps | Step-and-repeat words (Yokoo, 1966); flat long shadows and isometric depth (Takenobu Igarashi, *Zen*, *Noh*, *Expo ’85*); stencil bridges |
| Waveforms | Zigzag rows and chevrons; Nagai’s zigzags for *TENRI* (1981) |
| Gradient | Whole-poster blends tagged #gradient in the library; Koichi Sato’s blue gradient, *Hiroshima Appeals “Golden butterfly”*; a printed background gradient by Utagawa Kunisada (1863); Yokoo’s soft gradations, *This is America* (1968) |
| Gradient (two inks), Posterize | Fluorescent split-fountain blends in the library (orange to magenta to yellow; #fluo, #gradiant) |
| Spectrum | Kiyoshi Awazu’s rainbow, *7th Contemporary Japanese Sculpture Exhibition* (1977); Yokoo’s rainbow rays, *LaChapelle Land* (1996) |
| Gradient map | Silver and chrome silkscreens (#metallic, #chrome, #silver) and fluorescent inks (Mitsuhiro Kushida, *Viet Rock*, 1968) |
| Tint, Light | Coloured highlights behind each motif, Kamekura, *Kyoko Edo Piano Recital* (1968); neon on black and silver |
| Invert | Susumu Endo, *Hiroshima Appeals “negative flashing light”* |
| Stripes | Kazumasa Nagai’s optical circles and waves, *Toshiba* (1967); Kiyoshi Awazu’s topographical curves, *A New Spirit of Japan* (1976) |
| Threshold, Split tone | Awazu’s two-colour sculpture posters (1974, 1976) |
| Separation, Palette snap | Colour-separated silkscreens (#colorseparation, #overprint) and limited spot inks in both archives |
| Solarize, Channel swap, Warmth | Darkroom and colour-correction techniques; no direct match in the archives |
| Shape colour | Ikko Tanaka, *JAPAN* (1986): each letter a different colour |
| Shape gradient | Yokoo’s printed gradations (1968) and blurred sun (1998); Eiko Ishioka’s airbrushed posters (1973, 1977) |
| Aurora | Shin Matsunaga, *PEACE* (1986): a blurred figure, each part a different colour |
| Pop | Yokoo’s and Shinpei Asai’s pop-art posters (1968, 1986) |
| Four corners | No direct match; the nearest are multi-colour whole-poster blends in the library |

## Recipes

81 named starting stacks: 18 from the first set (Lens, Pinch, Twist, Watch, Settle, Warp, Pillars, Extrude, Push back, Type matrix, Halftone wave, Twirl, Ripple, Flag, Pixel, Turbulence, Spin field, Horizon) and 19 for the surveyed modifiers (Ridges, Strata, Sunburst, Cell, Arch, Globe, Ribbon, Kaleidoscope, Cascade, Offset, Scan, Shatter, Contours, Melt, Crawl, Reflection, Bulge, Torn, Zigzag), and 10 for the newest pieces (Screen print, Line screen, Fold, Spiral, Flow, Confetti, Checker, Terraces, Honeycomb, Starfield), and 12 for the third set (Heavy, Soft, Halo, Jagged, Petals, Swirl, Glitch, Dial, Burst, Step and repeat, Long shadow, Stencil), and Heavy dither and Dither lens, and 18 for colour (Holo foil, Heat map, Sunset, Split fountain, Negative, Chrome, Target rings, Contour map, Colour wheel, Riso plate, Solarized, Threshold wipe, Outrun, Rainbow type, Aurora, Mesh, Pop art, Night vision). **Shuffle** draws a seeded random stack. Changing anything turns the recipe into a custom stack.

## Export

SVG of plain filled outlines, PNG at 2000–4000 px, and a JSON rule that reopens in the editor. In a browser, the address bar carries the whole stack except imported artwork. In the app, files go through native save panels and a vector PDF is also offered.

## Combination tests

`combinations.mjs` renders every ordered pair of the 37 modifiers (1,369), every modifier on every element type with and without a lifting effector (592), every ordered pair of the 20 bending modifiers chained, added and averaged in a group (1,200), 3,979 colour cases (every ordered pair of the 23 colour modifiers, each after every modifier, each on every element type, and each on all five kinds of target with every field shape, angle sweep included, still, orbiting with the pointer and pulsing in steps), 1,500 seeded random stacks (random elements, effectors, modifiers, groups, colour modifiers, fields, extreme settings, formats, times and pointer positions) and named edge cases, colour ones included (all eight at once, hard tiny fields, six spectrum bands on noise, colour after a copy explosion, faded to nothing, an empty page). Every draw operation's paint must be valid: sorted offsets in [0, 1], hex colours, opacities in range and finite gradient geometry. Each must not throw, must produce only finite points, must leave ink where ink is expected, must stay within the point budget, must not paint any colour with a net negative area (cancelling outlines), and a sample must render identically twice. Random stacks use extreme settings, which can tangle outlines into self-crossing loops (a 720° twirl through sharp noise, a zigzag deeper than the shape); there a net negative fill is reported as a warning rather than a failure, since nonzero filling still paints every crossed region. It also checks that a group at strength zero changes nothing, that a chain group equals its children inline, and that an Add group of one equals the modifier alone. Results, warnings and the slowest cases go to `output/effector-study-v1/combinations.json`.

## Code

| File | Role |
| --- | --- |
| `../heavy-dither-system/dither.mjs` | The dither core: methods, blur and row-scan coverage, shared with the Heavy dither system |
| `engine.mjs` | Catalogues, normalization, elements, fields, effectors, modifiers, composition into draw operations, SVG output, recipes and shuffle |
| `colour.mjs` | Colour modifiers: catalogue, ramps, blends and the pass that turns their fields into flat fills and sampled gradients |
| `fonts.mjs` | Glyph outlines from `prepare-fonts.mjs` (eight SIL OFL faces from the project's pinned set) |
| `workshop.mjs` | The editor page; `app: true` builds the variant hosted by the app |
| `evidence.mjs` | Survey evidence for each modifier |
| `build.mjs` | Proofs, sheets, catalog and both editor pages |
| `verify.mjs` | Engine checks, written to `validation.json` |
| `combinations.mjs` | Combination tests, written to `combinations.json` |

`render(state, {t, pointer})` returns the SVG, normalized state and draw operations; `prepare`, `context`, `evaluate` and `compose` are the same pipeline in steps, which the editor uses to spring the evaluated attributes between frames.

## Build and verify

```sh
node geometry-bench/effector-system/build.mjs
node geometry-bench/effector-system/verify.mjs
node geometry-bench/effector-system/combinations.mjs
```

The build writes `output/effector-study-v1/`: the editor, each recipe as SVG, PNG and JSON, `effectors.png`, `modifiers.png`, `colours.png`, `recipes.png`, `motion.png` (six moments of ten loops), `catalog.json` and `source.json`. It also writes the app-mode page into `workspaces/effectors/Sources/PosterCore/Resources/Effectors/index.html` when that copy exists.

`verify.mjs` checks every recipe for valid, deterministic output, seamless loops and normalization as a fixed point; that every effector and modifier changes the picture, is exactly neutral at zero strength and, for modifiers, still leaves ink at its defaults; that every option and range end renders; that inverted fields are exact complements and every field motion loops; the swept area of Pillars against a sampled raster; that cut modifiers keep outlines oriented; SVG import of transforms, even-odd holes and backgrounds; that every colour modifier changes the picture but not one outline, is neutral at zero strength, writes valid paint (sorted offsets, hex colours, finite geometry, every gradient referenced once) for every option, target and field shape, leaves the elements alone when it targets the paper, picks one gradient per operation on a shared axis, shape-by-shape paint on mixed axes and cells for noise, writes hard stops after Posterize, and loops; palette contrast; forty shuffles; and all formats. These are same-machine geometric checks, not judgements of the results.
