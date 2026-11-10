# Rotational limbs and knots — after Shigeo Fukuda

A shape system after **Shigeo Fukuda’s** rotational figures and tube knots: *Images of Illusion* (1984), *UCC Coffee Pavilion at Expo ’85* (1984), *Kyogen* (1981) and *Inter Design ’81* (1981), with *Look 1* (1984) kept as a reference. All are records in the local Japanese poster archive (PGDA and MoMA). Open [the editor](../../output/rotational-limb-study-v1/index.html) to drag the limb into shape, tie knots from parametric or seeded curves, follow the four construction passes, and export SVG, PNG or a saved JSON rule.

The goal is a reusable system, not poster remakes. Two generators share one palette, one end-shape kit, one layout engine and one control panel. Five presets follow Fukuda in spirit; seven are new, two of them neon on near-black.

## The construction

**Limbs.** A limb is a few control points (root fixed at the hub). A centripetal Catmull–Rom spline runs through them and is resampled at equal spacing. **Curl** then adds turning: spread evenly (a straight limb becomes a circular arc) or gathered toward the tip (**curl toward tip** 1 gives an Euler spiral, as in Kyogen). The stroke tapers, can **swell** along the sleeve, and changes colour at a cuff where the **sleeve** ends. Its end is built from a few primitives (discs, round-capped strokes, small polygons): a hand, a foot, a high heel, a cup in a fist, a beak, a disc or an arrow, at the tip, the root or both. The limb is turned by **twist**, pushed out by the **radial offset** and repeated N times around a **hub**. Odd arms can mirror and end in a second shape. Arms are drawn as round-capped chunks, so tapers stay exact on tight bends. A limb that overlaps itself is drawn again segment by segment, so its later coils lie over the earlier ones with their own outline.

**Overlap order.** *Stacked* draws arm 1 to N. *Each over the next* closes the circle: arms are drawn last to first, then the last arm is drawn again inside the first arm’s silhouette, where only the first arm is visible. *Each under the next* is the reverse.

**Knots.** A closed curve, or two open strands, is resampled at a quarter of the tube width:

| Curve | Definition | Crossings |
| --- | --- | --- |
| Trefoil, figure-eight | Torus diagrams 2/3 and 3/2 | 3, 4 |
| Torus p/q | (1 + d·cos qt)·e^{ipt}; with gcd(p, q) = g it is a g-component torus link | q(p − 1) |
| Lissajous a/b | (cos(at + φ), cos bt), a/b reduced | 2ab − a − b |
| Seeded random | A Fourier series with harmonic k at amplitude (1 + 0.3(k − 1))^−smoothness | grows with harmonics |
| Two hands | Two open strands through stratified waypoints (a randomised nearest-neighbour walk), ending at the centre in two hands | — |

Random curves and hand strands are **relaxed** like rope: points of strands that run side by side push apart (crossing strands are left alone), a light Laplacian smooths, and points are re-spaced. Loops shorter than 3.5 tube widths are cut out at their crossing (a Reidemeister I move), so no kink is too small to read.

**Crossings.** Every self- and mutual crossing is found by testing segment pairs in a uniform grid (each pair once, half-open segments, neighbours skipped) and ordered along the strands. Over/under is assigned by the **crossing pattern**:

- *Alternate* solves a parity constraint per crossing so that, along every strand, occurrences go over, under, over… Every closed curve satisfies it (Gauss); two open strands sometimes cannot, and the editor reports how many steps do not alternate.
- *Laid* puts the later point along the strands on top, like rope laid down.
- *Depth* uses the curve’s own 3-D lift (torus, Lissajous z, a seeded lift for random curves).
- *Seeded* tosses a fixed coin per crossing.

Each strand is cut into pieces with at most one crossing occurrence (halfway between occurrences, and at every under occurrence, where an arc ends inside the gap). Under halves are drawn first as polygons — the tube offset minus a band W + 2·outline + 2·gap wide around their own crossing’s over strand, computed with Clipper — and over pieces on top as strokes. A band only cuts its own crossing’s under halves, so a crossing never cuts the strand that passes over it, and posters need no masks. Fills reach further than outlines at every joint, so no seam shows.

## Twelve presets

| Preset | After | Generator | Notes |
| --- | --- | --- | --- |
| Pinwheel of legs | Images of Illusion, 1984 | Limbs | 8 legs, shoes and heels alternating, each over the next, outlines in the ground colour |
| Coffee-cup arms | UCC Coffee Pavilion at Expo ’85, 1984 | Limbs | 2 swollen sleeves bent into one circle, cuffed hands and cups at both ends |
| Spiral leg | Kyogen, 1981 | Limbs | 1 leg curled toward its tip, foot at the root, coils outlined |
| Trefoil tube | Inter Design ’81, 1981 | Knot | Fat black tube, gaps and outlines in the ground colour |
| Two hands knot | Inter Design ’81, 1981 | Knot | Two strands tangle and end in hands meeting at the centre |
| Neon knot | new — electro | Knot | Torus 3/5, alternating magenta and cyan arcs, glow on near-black |
| Flower of hands | new | Limbs | 10 mirrored arms, alternating sleeves, flower hub |
| Riso pinwheel | new — risograph | Limbs | 6 birds, each over the next, two misregistered inks and grain |
| Seeded tangle | new | Knot | Random curve, relaxed, black and cobalt arcs |
| Lissajous weave | new | Knot | Lissajous 3/4, arcs ramp from cobalt to vermilion, rings ground |
| Neon kick | new — electro | Limbs | 7 heeled legs, one step of the hue circle each, glow on rays |
| Knot field | new — pattern | Knot | A field of small knots, one seed per cell |

## Controls

| Group | Controls |
| --- | --- |
| Limb | Limb shape (straight, bend, S-curve, hook, knee, wave, or dragged), end shape, every-other-arm end shape, end placement, mirror, overlap order, hub; arms, limb length, twist, radial offset, curl, curl toward tip, taper, swell, hub size |
| Knot | Curve, crossing pattern; p / a, q / b, lobe depth, phase, harmonics / waypoints, smoothness, relax, seed (and a new-seed button), crossing gap |
| Shape | Colour per arm or arc (single, alternate, ramp, spectrum walk); stroke weight, outline weight, end size, sleeve length |
| Layout | Layout (hero, field, cropped giant, pair / dialogue), format (poster B, square, landscape, story 9:16), finish (flat, neon glow, riso overprint, drop shadow), ground (plain, gradient, rays, rings); scale, position, rotation, field columns |
| Colours | Ground, figure, outline, end, accent, alternate |

Controls that do not act on the current state are disabled (for example torus counts on a random curve). In the field, cells mirror on a checkerboard, alternate rows swap figure and alternate colours, and random knots take one seed per cell. In a pair the second figure is mirrored and colour-swapped. Random knots and hands stretch to the frame’s aspect so they fill a portrait poster. End shapes always get a visible outline: if the outline colour matches their fill, the figure or ground colour is used instead.

The editor’s round handles sit on the master limb’s control points. Drag them (the figure keeps its scale while dragging) or focus one and use the arrow keys; *Add point* and *Remove point* allow 3–7 points. Dragging makes the limb shape *custom*; the points are saved in the rule.

## Rebuild and verify

```sh
node --expose-gc geometry-bench/rotational-limb-system/build.mjs
python3 geometry-bench/rotational-limb-system/contact-sheets.py
node --expose-gc geometry-bench/rotational-limb-system/verify.mjs
node geometry-bench/rotational-limb-system/browser-check.mjs
```

`geometry.mjs` holds the kernel (splines, bending, relaxation, kink removal, crossings, over/under, Clipper tube cuts, OKLab colour); `parts.mjs` the end shapes and hubs; `engine.mjs` the presets, controls, limb and knot scenes, layouts and renderer. The build bundles them (with clipper-lib) into the offline editor. Posters are 728 × 1030 (B-series proportion); PNG exports are 2120 × 3000.

`output/rotational-limb-study-v1/` contains the editor, every preset (SVG, PNG, rule), the four passes per preset (`stages/`), six presets in four layouts (`layouts/`), three in four formats (`formats/`), an 18-piece knot atlas (`knots/`), 20 limb studies (`limbs/`), twelve variations (`variations/`), four kit sheets, the references with provenance (`source.json`) and review boards: `comparison.png`, `presets.png`, `construction.png`, `layouts.png`, `formats.png`, `knots.png`, `limbs.png`, `variations.png`, each also at phone width in `phone/`.

`validation.json` records same-machine Node/resvg checks: twelve distinct presets under one palette; every control visible where it applies and inert where it does not; every option value distinct; four passes; exact replay (including dragged limbs) and differing seeds; crossing counts against the closed forms for every coprime torus p ≤ 7, q ≤ 9 and Lissajous a, b ≤ 6 at three phases; torus links with gcd components; the grid crossing finder against an independent all-pairs pass on 63 curves; one over and one under per crossing and full alternation on every closed curve; pixel probes at isolated crossings of closed curves and the laid, seeded and depth patterns (the over outline, the gap inside the under tube, the under tube beyond it, the over fill); for two-hand tangles, the cut structure (every under occurrence ends two under halves, none lies inside an over piece); N-fold turned arms, mirror, splines through their points, exact curl turning, taper, self-overlap, the cyclic mask, handle drag mapping; margins; input bounds. `browser-validation.json` records isolated Chrome checks of the editor; evidence is in `output/playwright/rotational-limb-system/`.

Saved rules name `rotational-limb-v1`.

## Limitations

- Hands, feet and cups are built from a handful of primitives: they read as Fukuda-like signs, not as his drawings.
- Two open strands cannot always alternate at every crossing; presets use seeds that do, and the editor reports the count otherwise.
- Where many crossings crowd into one tube width (dense hand tangles), a crossing’s gap can be shorter than ideal or an over piece can graze a neighbouring crossing.
- Look 1’s impossible stairs are not modelled; it remains a reference only.
- Poster text uses system fonts.

New vector interpretations, created with AI assistance. The original designs remain credited to Shigeo Fukuda; reference images are kept locally for study.
