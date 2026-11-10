# Library archive: new system candidates

A second visual pass over the whole poster library (1,130 surfaces from the swissposters source; the Japanese archive is separate, see `JAPANESE-POSTERS.md`), looking only for type and shape constructions that no built system, recipe or type operator covers yet. Candidates 1, 15 and 17 are built; the rest are not.

## Contact sheets

`output/archive-census-v3/sheet-01.jpg` … `sheet-32.jpg` show every surface at 36 per sheet, labelled with census index and short ID. The 46 posters that already source a built system (geometry-bench studies, shape recipes, contour, dominant-shape, paper relief, physics) have an orange frame; `used-ids.txt` lists them. `manifest.json` maps each index to its ID, image, caption credit and post URL. `zoom/` holds the enlargements used to check each lead.

```sh
python3 -I scripts/archive-contact-sheets.py scan --out output/archive-census-v3 --used output/archive-census-v3/used-ids.txt
python3 -I scripts/archive-contact-sheets.py refs --spec output/archive-census-v3/system-candidates/spec.json --out output/archive-census-v3/system-candidates
```

## Candidates

Each has a reference sheet in `output/archive-census-v3/system-candidates/` with the source posters, caption credits, construction, what to build and its controls. `spec.json` there holds the poster IDs. Sources are given as census indices.

| # | Kind | Candidate | Sources | Why it's new | Electro fit |
| --- | --- | --- | --- | --- | --- |
| 1 | Type | Rule-field letters | 0924, 0785, 0073, 0803, 0124 | **Built**: [README](geometry-bench/rule-field-system/README.md), [editor](output/rule-field-study-v1/index.html), with 22 styles, five fields, pens, inks, warps, a second layer, plotter and separation outputs | Strong |
| 2 | Type | Ribbon type | 0436, 1035, 0576 | Copy on a twisted 3D band (Möbius, helix, linked rings) with front and back faces; the tube gestures carry no text | Strong, loops for reels |
| 3 | Type | Globe type | 0326, 0721, 0978 | Glyphs projected into a sphere's lat/long cells, mixed fonts per cell | Strong, spin loop |
| 4 | Type | Stutter chains | 0526, 0689, 0946 | Operator: one grapheme repeats to fill a length or trace its own giant skeleton (`Maaaaagenta`) | Medium |
| 5 | Type | Acrostic lift | 0069, 0942, 0814 | Operator: a hidden word picked in order out of the copy and enlarged in place or kept in ink while the rest fades | Low |
| 6 | Type | Pictogram swap | 0239, 0987, 0818 | Icons replace letters of matching silhouette, or letters assemble into icons; only the tittle heart exists | Medium |
| 7 | Type | Thorn, puff and chrome dressings | 0116, 0047, 0177, 1126 | Any font outline grown into thorns, inflated bubbles or banded chrome; capsule Tube styles cover one alphabet only | Strong (Y2K) |
| 8 | Type | Treatment roulette | 1020, 0455, 0396 | Each glyph a different construction (halftone, stripes, pixel, bead chain, hairline); P.A.G.E.S. does this for shapes only | Medium |
| 9 | Type + shape | Route diagram layout | 1038, 0670, 0032, 0884 | Copy placed along a routed path: board-game track, transit map, maze; the meander is a single spiral with no content | Medium |
| 10 | Type | Tagged lines | 0817, 0529, 0750, 1088 | Per-line containers: arrow tags, merging pills, highlight bars | Low |
| 11 | Shape | Horizon plane | 0676, 0981, 0884 | Perspective ground plane of spheres, blocks or extruded words; the tunnel only recedes frames | Strong (synthwave) |
| 12 | Shape | Kaleidoscope fold | 0910, 0208, 0200 | Motif folded into 2/4/6/8 mirror symmetry and stacked | Strong |
| 13 | Shape | Thermal blobs | 0249, 0280 | Metaballs filled through a heat-map gradient | Strong |
| 14 | Shape | Morph matrix | 1041, 0456, 1075 | Grid whose module morphs (disc → ellipse → square) and scales; density field varies spacing only | Medium |

### Shape candidates, second pass

A further read of all 32 sheets (8 November 2026), checked against the 45 catalog recipes, 14 survey recipes, contour, paper relief, gravity type, dominant shapes and every geometry-bench system. None is built and none repeats a row above. Sources were checked at full size.

| # | Kind | Candidate | Sources | Why it's new | Electro fit |
| --- | --- | --- | --- | --- | --- |
| 15 | Shape | Orbit wrap | 0277, 0690, 1062 | **Built** and merged into the main tree: [README](workspaces/orbit-wrap/README.md), with 29 looks. Rings, a coil, crossed orbits or a double coil wound round a solid or the title; the near arcs are drawn above the title, the far arcs below it | Strong, spin loop |
| 16 | Shape | Shock burst | 0938, 0669, 0998, 0105, 0121, 0252 | **Built**: [README](geometry-bench/shock-burst-system/README.md), [editor](output/shock-burst-study-v1/index.html), with 29 styles. Seeded spike length, width, lean, valley, tip and curvature, plus outliers, bend, forks and teeth; nested and outlined bursts; gradient fills; union and interference merges; 3- to 8-way mirrors; mirrored, pinwheel or free shard parts with edge combs; copy inside, across (with a crossing ink) or round a ring; info line; editor with drag, shuffle and undo; plotter (pen passes), separations (tints, dots) and riso preview | Strong (rave flyer) |
| 17 | Shape | Sawtooth and spring | 0255, 0702, 0029, 0262, 0807, 0948 | **Built** and merged into the main tree: [README](workspaces/sawtooth-spring/README.md), with 29 looks. Nine waves (zigzag, sawtooth, square, sine, coil, pulse, stairs, bounce, noise) as a compressing spring, tiled stripes, shaded fins, a sawblade ring, a spiral or a mirrored waveform, with extrusion, misregistration and glitch effects | Strong (op-art) |
| 18 | Shape | Coil and scribble pens | 0320, 0415, 0628, 0605, 0951 | Hand-like pen paths: trochoid coils along a line or a letter skeleton, crayon zigzag hatching that fills a band, a random-walk squiggle over type. Lissajous and guilloche are closed curves | Medium–strong (neon tube) |
| 19 | Shape | Action splatter | 0406, 0440, 0465, 0897 | Thrown paint over type: looping poured strokes with drops, a dot-spray plume, tapered splash streaks, blots. Gravity drips only fall from a rim | Medium–strong |
| 20 | Shape | Lane bundle | 0280, 0018 | Several parallel lanes offset from one meandering path, with rounded turns, flat or blurred. The meander is a single right-angle line; route diagram carries copy | Strong, flow loop |
| 21 | Shape | Torn layer | 0393, 1074, 0459 | A fractal tear exposes a second layout underneath, with a white fibre lip and curled flaps. Nothing yet shows one layer through damage to another | Medium, tear loop |
| 22 | Type + shape | Pasted sheets | 0918, 1000, 0264, 0446 | A pile of tilted sheets, tapes or punched tags, each carrying a word or glyph, overlapping. Tagged lines keep their containers in reading order | Medium |
| 23 | Shape | Overprint blobs | 0429, 0691, 0943 | Rounded blobs in two or three spot inks that overlap with multiply mixing. Organic silhouette is a single form | Medium (riso) |
| 24 | Shape | Pixel stairs | 0883, 0448, 1081 | A shape quantised to a coarse visible grid, its stepped edge echoed in offset copies, often masking a photo. The density field varies module size, not occupancy | Medium (8-bit) |
| 25 | Shape | Smear trail | 0850, 0862 | Solid shapes dragged into a soft tonal trail. Offset discs repeat discrete copies | Low |

## Extensions, not new systems

- **Radial spokes: twist.** 1085 bends the rays into a vortex; `radial-spokes` has count, inner radius, phase and weight but no twist.
- **Path-set copy.** The `radial-fan` and `curved-baseline` type operators have no fitted source yet. 0159 (text spokes), 0742 (spiral), 0839 (concentric `rosa` rings) and 0926 (zigzag bolts) supply that evidence and suggest spiral, ring and zigzag paths.

## Seen but already covered

Wave-warped or melted type (sinusoidal displacement), echo and repeat stacks (repeated phrase fields, echo stack), outward contour rings (contour letter channels), perspective text corridors (projective type portal), scattered and falling letters (fallen letters), sliced or windowed words (PLOT, displaced slices), exploded stencil glyphs (capsule Exploded), checker warps, regular star bursts (star frame), spider webs (tension web), drips, dot halftone portraits (tonal halftone, glyph density field), nested squares (tunnel, polygon contours), mirrored copy (reflection). Photo, collage and hand-drawn illustration posters were skipped as not systemizable.

Credits come from the Instagram captions and are not verified; studies should extract constructions, not reproduce posters (see `TYPE-SYSTEMS.md`).
