# Isometric prism letters — after Takenobu Igarashi

A type system after **Takenobu Igarashi’s** isometric alphabets and posters of 1980–85 (12th and 14th Summer Jazz Festival, Zen, Noh, Expo ’85; MoMA collection records in the local Japanese poster archive). Open [the editor](../../output/isometric-prism-study-v1/index.html) to set any text in nine shape systems and ten views, follow the four construction passes, and export SVG, PNG or a saved JSON rule.

The goal is a reusable system, not poster remakes: one cell alphabet, one renderer, and every style, view and deformation as a control. Five systems follow Igarashi posters; four are new.

## The construction

Every glyph is a 7-row cell skeleton (A–Z, 0–9, `. , : - ! ? '`). A cell is one of:

| Cell | Shape | Use |
| --- | --- | --- |
| `#` | Full square | Stems, bars |
| `◢ ◣ ◤ ◥` | Half-square triangle | Two side by side make a 45° stroke (A, K, M, N, V–Z, 0–2, 4, 7) |
| `╭ ╮ ╰ ╯` | Quarter disc rounding the named corner | Bowls and terminals (B, C, D, G, J, O–S, U, 0, 2, 3, 5, 6, 8, 9) |
| `▼ ▲` | Tip | V’s point |

The skeleton sits in a **standing** or **lying** plane, reading **rising** or **falling** to the right, and can be widened, slanted, waved, stepped and staggered. Each cell is extruded into a prism; skyline jitter grows cells toward the viewer by a seeded random amount. Rods run along the reading direction and are hidden wherever they pass through a solid cell.

Cell columns never overlap and are all parallel, so drawing them in order of their footprint along the view (then along the extrusion) hides what is behind, in any parallel projection. Joins between full cells are dropped, so a stroke reads as one solid; outlines draw only real creases. Faces take the colour of the axis they face (letter face, side A, side B); diagonal and curved faces blend between them.

## Nine shape systems

| System | After | Plane / view | Surface |
| --- | --- | --- | --- |
| Floor plinths | 12th Summer Jazz Festival, 1980 | Lying, isometric | Grey tops, green and ultramarine sides, crease lines, grid floor |
| Speckled beams | 14th Summer Jazz Festival, 1982 | Lying, one cell deep | Speckle on every face, speckle fade |
| Cube walls | Zen, 1981 | Standing, stepped and staggered | Cube grid, rods |
| Dark monoliths | Noh, 1981 | Standing, deep, crowded | Charcoal faces, pale creases |
| Striped slabs | Expo ’85, 1982 | Standing, trimetric | Striped sides, yellow rods |
| Neon solids | new | Standing, pixel 2:1, waved | Near-black solids, glowing creases, gradient ground |
| Pixel relief | new | Standing, 2:1, skyline jitter | Separate blocks pushed out at random; lay it down for a skyline |
| Cut shadows | new | Cabinet oblique, slanted | Letter face left blank with a fine cut line; red and black extrusions |
| Blueprint wire | new | Lying, planometric | X-ray wireframes on a ruled floor |

## Views

| View | Projection | Setting |
| --- | --- | --- |
| Isometric | Axonometric camera | azimuth 45°, elevation 35.26° |
| Pixel 2:1 | Axonometric camera | 45°, 30° (2:1 pixel stairs) |
| High / Low | Axonometric camera | 45°, 58° / 15° |
| Dimetric | Axonometric camera | 20°, 24° |
| Trimetric | Axonometric camera | 63°, 27° |
| Worm’s eye | Axonometric camera | 45°, −35.26° (from below) |
| Planometric | Plan true, verticals vertical | Lays the letters down |
| Cabinet / Cavalier | Oblique: front true, depth at 45° × 0.5 / × 1 | Turns the letters to face front |

Azimuth is measured from the letter face, so a preset looks the same whichever way the text runs. Any azimuth from 5° to 85° and elevation from −70° to 80° works.

## Controls

| Group | Controls |
| --- | --- |
| Letters | Extrusion, step per letter, skyline jitter, letter gap, stagger, wave, cell width, slant, block gap, rods; letter plane and reading direction |
| View | Projection; azimuth and elevation (camera), azimuth and height scale (planometric), receding angle and depth scale (oblique). Unused controls are disabled |
| Surface | Face mode (solid, cut shadow, wire, neon); texture (flat, creases, cube grid, stripes, speckle) and its grain (greyed out unless a grid, stripe or speckle texture or a floor uses it); ground (plain, grid floor, speckle fade, gradient); six colours |

## Rebuild and verify

```sh
node geometry-bench/isometric-prism-system/build.mjs
python3 geometry-bench/isometric-prism-system/contact-sheets.py
node --expose-gc geometry-bench/isometric-prism-system/verify.mjs
node geometry-bench/isometric-prism-system/browser-check.mjs
```

`engine.mjs` holds the alphabet, projections, scene and renderer (no dependencies); the build bundles it into the offline editor. Posters are 728 × 1030 (B-series proportion); PNG exports are 2120 × 3000.

`output/isometric-prism-study-v1/` contains the editor, posters for every system with five texts each, the four passes per system, ten views on two systems (`views/`), twelve variations (`variations/`), nine specimens, the references with provenance (`source.json`) and review boards: `comparison.png`, `shape-systems.png`, `text-transfer.png`, `views-voxel.png`, `views-plinth.png`, `variations.png`, `construction.png`, `alphabet.png`.

`validation.json` records same-machine Node/resvg checks: nine distinct systems under one palette, every control visible in every system (view controls in their projection), every option value distinct, ten distinct views with unused view controls inert, four passes, exact replay, all 43 glyphs, and occlusion probes. With steps, stagger, jitter and rods off, every full cell’s letter face must show its exact colour at its centre, in all ten views, both planes, both reading directions, and with width, slant and wave. It also checks that rods hide inside solid cells and never half-cover one, margins, input bounds and version 1 rules. `browser-validation.json` records isolated Chrome checks of the editor. Browser evidence is in `output/playwright/isometric-prism-system/`.

Saved rules name `isometric-prism-v2`. Version 1 rules (symmetric axis angle) still open: an axis angle α becomes elevation asin(tan α).

New vector interpretations, created with AI assistance. The original designs remain credited to Takenobu Igarashi; reference images are kept locally for study.
