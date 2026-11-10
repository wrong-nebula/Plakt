# Shock burst

A shape system after six posters in the local library (census indices from `output/archive-census-v3/manifest.json`):
- **0938, 51. Solothurner Filmtage**, 2016 (@solothurnerfilmtage; caption tags #raffinerie, #uldry)
- **0669, Streit Festival**, 2021 (@samsteiner.ch, @wanjaadamzorn, @keibo_ratvuer)
- **0998, ECAL guide** (@arthurseguin / @ecal_ch)
- **0105, Indicateur de performances**, Grütli 2020–22 (TM David Mamie, Nicola Todeschini)
- **0121, Satoshi Kon**, Filmpodium 2023 (@moritzfurger)
- **0252, Dishcomfort**, Aargauer Kunsthaus 2025 (repost by @atlas_studio_zurich)

Credits follow the archived captions. Open [the editor](../../output/shock-burst-study-v1/index.html) to set any copy and seed, follow the four construction passes, combine modules, shuffle, and export. Exports are a poster SVG or PNG, a plotter file, ink separations, a riso preview, a print-ready PDF and a JSON rule.

A burst is a run of spikes round a centre, each of its own length, width and lean. Its spikes can shoot out, hook, fork or grow barbs. Bursts can be outlined or gradient-filled, nested, merged, mirrored three to eight ways, or split into shard quadrants. Copy can sit inside a burst, run across the sheet, or circle a ring. The existing star frame is a regular star; with every jitter at zero this system draws one too, and that is where it starts. There are 29 styles:
- one stays close to its source (Twin shock, after Solothurn);
- five are new styles on a construction taken from one of the other five sources;
- twenty-three are new.

Every part of the construction is a module, so any style can take any spike character, split, symmetry, layout, merge, nesting, paint or copy.

## The construction

1. **Skeleton.** Valleys sit round the centre at the inner radius, and tips at the outer radius. All of them are drawn from the seed:
   - **width jitter** moves the valleys, so spikes differ in width;
   - **angle jitter** leans each tip inside its base;
   - **length jitter** shortens tips;
   - **long outliers** make a few spikes up to 3.6 times as long (a heavy tail, so most stay as they are);
   - **valley jitter** moves the valleys in and out;
   - **spray** lengthens spikes toward one direction and pulls the base in on the far side;
   - **short every other spike** gives a long–short rhythm.

   Values are keyed by spike, not by position in a list, so moving a slider does not reshuffle the burst. The stage shows the base ellipse, the valley radius, the spokes to the tips and the inner polygon.
2. **Outline.** Each side between a valley and a tip is a quadratic curve. The **curvature** bows it along its outward normal (negative curves inward: needles and scallops). The **swirl** bows rising sides one way and falling sides the other, so spikes curl.

   Each spike can then take on character:
   - a **tip width** cuts its end into a slant; as the valleys reach the centre, spikes become wedges, as in a sun fan;
   - a **bend** hooks the tip sideways and bows both sides with it;
   - a **fork** splits the tip into two prongs (or notches a cut end);
   - **side teeth** add sawtooth barbs pointing to the tip.
3. **Shapes.** Levels, layers and parts:
   - levels nest inward or echo outward by the level scale; each can turn a little and re-seed;
   - a whole burst can be mirrored 3, 4, 6 or 8 ways: one run over half a wedge, reflected and turned round the centre;
   - several bursts can be laid out at once and merged: their union (one outline) or their interference (overlaps cut out), computed with Clipper;
   - a burst can split at a centre into parts.
4. **Poster.** Inks, gradients, outlines and glow, then the type:
   - **Copy inside** is fitted by its horizontal chords. Every row is measured across the outline at its top, its bottom and just above and below every outline vertex in between, which is exact for a polygon. It must clear the outline by the clearance. Rows share one height (fit) or stretch to their own chord. The largest height that fits is found by bisection.
   - **Copy across** runs the width of the sheet, centred on the burst.
   - **Copy round a ring** repeats round a circle inside the burst, upright to the outside, within the largest disc that clears the outline.
   - **Crossing ink:** where copy across, or sheet type over the bursts, crosses a burst, the crossing part can take another ink. The cut is exact (Clipper).
   - **Sheet type** sits over the bursts or under them.
   - **Info line:** small rows for date and venue, in a corner band.

## Modules

| Module | Choices |
| --- | --- |
| Spike character | long outliers, bend, forked tips, side teeth, alongside tip width, curvature and swirl |
| Symmetry (whole bursts) | none; 3-, 4-, 6- or 8-way mirror |
| Split | whole bursts; mirrored halves; mirrored quadrants (one quarter reflected into four, curvature and swirl mirrored with it); pinwheel quadrants (one quarter turned four times); free shards (each part drawn afresh) |
| Parts | burst; combs of spikes rising from the sheet edges; bursts above and combs below. In free shards the combs alternate between the side edges and the top and bottom edges |
| Part colours | the same, or paper and burst swapped in alternate parts (a checker); parts can pull apart by a gap |
| Layout (several bursts) | row, column, scatter (a seeded sunflower spiral), orbit, stack (each smaller). One burst always takes the centre; the centre can sit up to a quarter of the sheet off its edge, for bleeds |
| Overlaps | separate; union (one outline); interference (overlaps cut out) |
| Nested levels | alternate fill and accent; step from fill to accent; outlines inside (one filled burst crossed by its echoes); same ink |
| Fill | none (outline only), solid, linear gradient across the sheet at any angle (shared by every burst, so overlapping bursts merge), radial gradient from each centre to its tips |
| Copy | inside the burst (fit or stretch), across the sheet, round a ring inside the burst, or none; line, paper, fill or accent ink; six SIL OFL faces |
| Crossing ink | where copy across or sheet type over the bursts crosses a burst: the same ink, paper (knocked out), fill, line or accent |
| Sheet type | top, bottom, top and bottom, or spread over the sheet; over or under the bursts; one size for every row or each row to the width; its own ink |
| Info line | none, bottom or top; up to three small rows in the sheet ink |
| Layout | five formats (A series, poster 2:3, story 9:16, square, wide 16:9) and a paper frame |
| Outputs | plotter pen width, hatch spacing, edges as centrelines or as the outline's width in pen passes, parallel hatching, crosshatching or none; separations as one sheet per colour or with steps as tints of two inks, line or dot screens at any pitch; riso misregistration and grain |

Controls and options that only apply to some modules are dimmed in the editor. `applies(control or option, state)` gives the same answer to scripts. Where a control is dimmed, moving it leaves the poster pixel-identical. Output settings never change the poster.

## The editor

- **Construction:** the four passes (skeleton, outline, shapes, poster), plus **Plotter** and **Riso** views of the same rule.
- **Drag** on the poster to move the centre (the split centre, or the middle of a layout). On a touch screen, turn on **Move centre** first.
- **Shuffle** picks new values within readable ranges for every group not kept. Each group has a **Keep when shuffling** box; colours come from the styles' palettes.
- **Undo** and **Redo** (⌘Z, ⇧⌘Z or Ctrl+Y) step through every settled change: a drag, a typed word, a shuffle.
- **Seeds:** a sheet of eight seeds; choose one to use it, or ask for a new seed.
- **Exports:** poster SVG and PNG, plotter SVG, ink separations, riso preview PNG, print / PDF, and the rule as JSON.

## Styles

| Style | After | Construction |
| --- | --- | --- |
| Twin shock | Solothurner Filmtage | Two irregular bursts in a row, heavy black outline, one blue-to-orange gradient across both, over the type |
| Mirror quadrants | ECAL guide (construction) | A quarter burst mirrored into four quadrants; violet and pink swap in alternate quadrants |
| Shard quarters | Streit Festival (construction) | Four free shards: fans of red wedges above, combs from the side and bottom edges below |
| Shout bubble | Grütli (construction) | Scalloped, inward-curved speech burst covering violet type, lime copy inside |
| Splash | Filmpodium (construction) | Needle spikes sprayed to one side, a re-seeded pink burst nested inside |
| Echo scrawl | Dishcomfort (construction) | A black burst crossed by six re-seeded white outline echoes on orange |
| Neon shock | new | Four outlined, slightly re-seeded bursts nested in glowing cyan |
| Rave flyer | new | Three scattered bursts in acid yellow and pink with black outlines |
| Sun fan | new | Wedges of uneven width from one point, radial yellow to red, type on the violet beyond |
| Pinwheel | new | One curled quarter turned four times; red and black swap |
| Ice shards | new | Four free shards pulled apart, linear ice-to-deep-blue, outline echoes |
| Shock rings | new | A small magenta burst with five outline echoes going outward; copy knocked out |
| Pow | new | Yellow burst round a red one, heavy black outlines, on blue |
| Heat flare | new | Curled spikes flaring upward, radial yellow core to red tips, three deep |
| Split shift | new | A mirrored burst split down the middle, halves pulled apart and swapped |
| Chrome spike | new | Four nested bursts with alternating silver gradients |
| Burst cluster | new | Six scattered small bursts in green and pink with white outlines |
| Vortex | new | Forty curled spikes, six levels each turned 12°, stepping cyan to ultramarine |
| Ink stamp | new | A red seal with long and short spikes; copy knocked out |
| Barbed union | new | Two barbed bursts merged into one outline under a cyan-to-magenta gradient; the type crossing them is knocked out |
| Needle spray | new | Forty needles, a few shooting far out and hooking; giant copy across the sheet turns black over the white |
| Thorn crown | new | Forked, barbed spikes in black with two white echoes, on acid green |
| Interference | new | Four bursts in orbit cut each other out where they overlap |
| Kaleido | new | A six-way mirrored burst, five levels from magenta to violet, copy round a ring |
| Snow crystal | new | An eight-way mirrored burst with forked, barbed spikes in glowing ice-blue lines |
| Hook spin | new | Three mirrored arms of hooked spikes round a black core; copy knocked out |
| Corner blast | new | A burst centred off the corner, spikes across the sheet; type and an info line below |
| Crossing | new | Giant white type across the sheet turns black where it crosses the magenta burst |
| Ring chant | new | A black burst with a red core; the copy chants round a ring between them |

`output/shock-burst-study-v1/variations/` has 35 more combinations. Examples:
- `regular-star`: Twin shock with every jitter at zero, the regular star this system starts from;
- Pow with outliers, bend, forks or teeth alone;
- Rave flyer as a union and Burst cluster as interference;
- Neon shock mirrored six ways, Ink stamp with its copy round a ring, Mirror quadrants with copy across;
- Twin shock as mirrored quadrants, and with its type over the bursts and knocked out where it crosses them;
- Streit's shards mirrored, and pulled apart.

## Outputs

| Output | How | Use |
| --- | --- | --- |
| Poster SVG / PNG | `render(rule)`; PNG at a 3000px long edge | Screen and print. Every burst is one plain path of lines and quadratic curves (merged bursts and crossing type are exact polygons); only gradients, glow and part clips add anything else |
| Plotter SVG | `render(rule, {output: 'plotter'})` | Visible edges and hatching, one stroke group per ink, at the pen width. Each ink hatches at its own angle, parallel or crossed. A gradient keeps a share of its hatch lines by an ordered threshold, so line density follows the ink. Outlines can be drawn as centrelines, or as their full width in passes one pen apart (offset with Clipper). Lines stop where a later shape covers them (decided on a 1 px raster of shape ids). Inks too pale for white paper are drawn darker. For pen plotters, laser and vinyl |
| Ink separations | `separations(rule)` → `[{ink, colour, svg}]` | One black-on-white sheet per ink for screen or riso printing. Later shapes knock out earlier ones. Gradients print as screens in each of their two inks, as lines or halftone dots at the screen pitch, each ink at its own angle. Stepped levels separate either per step colour or, as tints, into their two inks. Dark paper prints as an ink of its own on white stock |
| Riso preview | `render(rule, {output: 'riso'})` | Every separation printed in its ink and multiplied over the stock. Each layer is shifted by a seeded misregistration and mottled by grain. A preview of the print, not a replacement for the separations |
| PDF | Editor: **Print / PDF** sizes the page to the format. Build: vector PDFs printed by Chrome | Print |
| Seeds | `seeds(rule)` | Eight seeds of the current rule on one sheet |
| Rule | JSON state | Replay; rules saved before the new modules open with them off |

## Files and replay

```sh
node geometry-bench/shock-burst-system/prepare-fonts.mjs   # only when the face list changes
node geometry-bench/shock-burst-system/build.mjs
python3 -I geometry-bench/shock-burst-system/contact-sheets.py
node --expose-gc geometry-bench/shock-burst-system/verify.mjs
```

`engine.mjs` exports these:
- `render`, `resolve`, `separations`, `seeds` and `geometry` (every shape's outline, tips, valleys, part clip and merge count, the copy container, the crossing area and the placed glyphs);
- the catalogue: `FAMILIES`, `CONTROLS`, `GATES`, `OPTIONS`, `LABELS`, `OUTPUT_KEYS`, `FORMATS`, `OUTPUTS` and `SOURCES`;
- `applies`, and the `inside`, `distance` and `contrast` helpers the checks use.

The spot separations and riso preview are also shared, in a simpler form, as the print kit (`geometry-bench/print-kit.mjs`, see `geometry-bench/print-kit-readme.md`). Six other systems use it: heavy-dither, rkc-disc, darkmatter, plot-slice, tategaki and rule-field.

`fonts.mjs` holds the extracted outlines, so the editor and its SVGs need no font files. Boolean operations and offsets use clipper-lib. The build bundles engine, Clipper and outlines into one offline editor with esbuild. It prints the PDFs with headless Chrome (playwright-core).

`output/shock-burst-study-v1/` contains the following. Each example is an SVG, a PNG and a JSON rule:
- the 29 styles, each with two other texts (`texts/`);
- the four construction passes of ten styles (`stages/`);
- five formats (`formats/`);
- 35 variations (`variations/`);
- a seed sheet per style (`seeds/`);
- every style at 390 px wide (`phone/`);
- `outputs/`: plotter SVG and PNG, separations, a riso preview and a PDF for every style, indexed in `outputs/index.json`;
- `outputs/realistic/`: the output options side by side (pen passes, crosshatching, tints, dots, a rough riso);
- the six references with census index, caption, post link and checksums (`source.json`), and `catalog.json`.

The boards are `comparison`, `families`, `construction`, `formats`, `variations`, `seeds`, `outputs`, `riso`, `realistic` and `phone`.

`verify.mjs` writes `validation.json`, with the seconds each section took. Its checks:
- every style distinct under one palette;
- every poster control visible in six styles covering whole bursts, mirrored quadrants, free shards with combs, copy, nesting and gradients;
- every gated control and option leaves the poster pixel-identical where it is dimmed;
- every option value visible;
- every output setting changes its output (plotter, separations or riso) and leaves the poster pixel-identical;
- four distinct passes per style;
- exact SVG and saved-rule replay, including every built example from its saved rule and rules from before the new modules;
- jitter is not cosmetic: at zero jitter, spike lengths and spacing are exactly uniform; with each style's own jitter, both vary;
- outliers make the longest spike more than twice the median; teeth and forks add outline points;
- eight seeds give eight different posters.

It also checks:
- **symmetry:** mirrored halves and quadrants (with aspect, curvature and swirl) reflect onto their own outline, pinwheel quadrants turn onto it, and 3-, 4-, 6- and 8-way mirrored bursts (with teeth, forks and bend) do both, within 0.5 px;
- **merge:** one outline per level, whose area matches an independent union (or even-odd union for interference) of the separate bursts within 0.5%;
- **copy containment:** every glyph outline point of copy inside a burst or round a ring lies inside the burst and on the sheet, clearing the outline by the clearance less at most 0.5 px, across styles, copy, seeds, fits and formats;
- **crossing:** the crossing ink lies inside the bursts and the base ink outside them, exactly;
- **phone:** at 390 px wide, in A and story formats, the largest type is at least 22 px cap height and none (info lines included) is under 11 px, and at least 80% of the visible type pixels contrast 3:1 or more with what lies under them;
- **plotter cover:** sampled every 3 px in eight cases, including pen passes, merged bursts and crossing type, no plotter line lies more than 1.5 px inside a later opaque shape of another ink (exact winding test); plotter files are strokes only;
- **outputs:**
  - separations are pure black on white, one per ink, including tint and dot modes;
  - Twin shock's gradient screens are darker on their own side;
  - Vortex needs four sheets with tints instead of eight;
  - every riso preview has one layer per ink;
- **coverage:** every glyph of every face fits inside a burst; every style renders in every format and with every split, part and symmetry.

## Limits

Copy inside is kept inside the outline of the main burst (layer one, level one). Other layers and nested levels can cross it. On a split burst the copy fits the whole outline before the parts pull apart. Mixed and comb parts have no central burst, so their copy takes the middle of the sheet. Copy across ignores the burst outline by design.

Merging and crossing work on flattened outlines (curves sampled to within a few tenths of a pixel), so those shapes are polygons rather than curves. The plotter decides cover on a 1 px raster, so lines stop within about a pixel of what hides them.

The riso preview is a simulation: misregistration is a seeded shift and grain is noise, not a model of a particular machine. Halftone dot separations are large files (several MB per sheet at the default pitch).

Free shards and pinwheels are not mirror-symmetric by design. Mirrored parts use the larger extent of each axis, so an off-centre split crops one side. A split centre stays on the sheet.

Source imagery stays attributed to its designers. The construction, styles and proofs are new and were made with AI assistance. Nothing is traced from the posters. No library records, models or votes are changed.
