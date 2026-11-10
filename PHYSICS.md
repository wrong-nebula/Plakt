# Rigid-body physics

PosterLab has a native 2D rigid-body engine, `PhysicsWorld`, in `Sources/PosterCore/Physics/`. It has no dependencies and is deterministic: equal inputs give bit-identical poses on one machine. **Fallen letters** is the first system built on it. It turns the glyphs of a title into rigid bodies in six arrangements and four looks, and stores where they come to rest.

## Engine

- **Bodies** are fixed or dynamic, and each is made of one or more convex polygons around its centre of mass. Mass and rotational inertia come from the polygons.
- **Contacts** use separating-axis tests and clipped two-point manifolds. A thin collision skin lets resting bodies keep stable contact.
- **Solver**: sequential impulses with warm starting, Coulomb friction and restitution, plus a two-point block solver that keeps stacks and resting letters steady. Non-linear Gauss–Seidel position correction removes leftover overlap.
- **Pins** (revolute joints to the world or between two bodies) take an optional friction torque, so swinging bodies come to rest. Two pinned bodies don't collide with each other, and a large pin error (a chain that starts longer than its span) closes over several steps instead of snapping.
- **Substeps**: a step is split into up to eight equal substeps when any body would otherwise move more than 5 cm in one, so fast letters don't pass through thin strokes or shelves. The split depends only on the state, so it stays deterministic.
- **Rolling resistance**: optional angular damping that applies only while a body touches something, so an O on its side stops rolling without slowing letters that tumble in the air. Letters use it.
- **Impacts and fracture**: a body with a break speed reports every contact that strikes it faster than that, with its motion just before the hit. `retire()` takes a body out of the world. `PhysicsFracture` splits a body's convex pieces into Voronoi fragments, crowded around the impact point, so a caller can replace a body with its pieces mid-simulation. Fragments push out of anything they start inside, so they can't fall through what their parent struck.
- **Sleeping**: bodies joined by contacts or pins form islands, and an island sleeps as a whole. A moving body wakes the sleeping bodies it strikes. `settle()` steps until everything sleeps or a time limit is reached.
- A **release time** holds a body in place, as if fixed, until it is due to fall. Bodies that start out overlapping (kerned letters, tight leading) are not pushed apart; the pair starts colliding once the bodies separate.
- Tolerances follow Box2D's metre scale. The poster systems simulate a poster as 10 m wide under 10 m/s² gravity.

`PhysicsOutline.pieces(_:)` turns any filled outline into collision polygons. It rasterises the outline with the renderer's non-zero fill and cuts it into thin bands. Each connected run within a band becomes a convex hull, and stacked hulls merge while merging adds almost no empty area. Stems become one piece, while counters (O, A, e, %) and crooks (L, J) stay open, so letters can nest into each other. Overlapping variable-font contours and separate parts, such as tittles and accents, are handled. Each piece has at most eight vertices. A glyph takes under a millisecond.

## Fallen letters

The `fallen-letters` recipe (Shape library → Physics) sets the title flush left near the top, one line per measure, under two lines of supporting copy. An optional rule and footer sit at the bottom. What happens next depends on the arrangement:

| Arrangement | What happens |
|---|---|
| Collapse (preset 0) | A seeded share of the headline's glyphs is released; lower letters go first. |
| Pour | The whole title starts above the page and drops into a heap. Pour spread shifts each letter sideways and up; a letter that would start overlapping another starts above it instead. The supporting copy is not an obstacle here. |
| Sign | Every letter was nailed at both upper corners. Released letters swing from one nail or fall; the nails stay in the wall. |
| Stairs | Shelves step down to the right under the headline, each tipped so letters slide on to the next. Stair steps sets how many. |
| Garland | The title is set on one line, and its letters are linked by rings at their upper corners. The ends hang from two nails, pulled in by the slack, so the chain sags. Released letters break the chain; the pieces dangle from one nail or fall. |
| Balance | A beam on a pivot catches the falling letters and tips under their weight. Pivot position moves the fulcrum. |

**Glass letters** work with every arrangement. A free-falling letter that strikes anything faster than its toughness (varied ±25% per letter) breaks into Voronoi shards. The shards are small near the impact and larger far from it. Each keeps the letter's motion just before the hit, is thrown away from the impact by the burst, and then collides and settles like any letter. A shard is drawn as the letter's real outline clipped to its cells, so the pieces are exact vector type in every look, and the cells together always cover the whole glyph. Hanging and garland letters don't break, and shards don't break again.

**Looks** render the same poses four ways, all as vector paths: solid, outline, cast shadow (a fixed down-right offset in a translucent ink), and neon (a soft stroke glow, a faint body and a near-white core; strongest on dark paper).

| Control | Effect |
|---|---|
| Arrangement, Look | See above. Pour spread, Stair steps, Garland slack and Balance pivot are active only in their arrangement. |
| Glass letters | Off or on. Shards per break (2–12), Toughness (the impact speed in m/s that breaks a letter) and Shard burst are active only when it is on. |
| Letters that fall | Share of glyphs released (in a garland: letters that break out of the chain). Raising it adds letters; the ones already falling keep their fall. |
| Share left hanging | Share of released letters nailed near one upper corner. They swing on the pin and stop. |
| Collapse | 0 picks falling letters at random. Higher values make lower letters fall first and earlier, so the letters above have a clear path down instead of landing on the line below. |
| Moment shown | Seconds after release. 8 shows the settled result; lower values catch letters mid-fall. |
| Release spread | Letters let go at different times over this many seconds, so later ones land on earlier ones. |
| Tumble | Initial spin and sideways throw. |
| Gravity tilt | Angle of gravity. Letters slide toward one wall. |
| Bounce, Friction | Restitution and Coulomb friction for every contact. |
| Floor | Paper edge, a rule above the footer, or open (letters leave the poster). |
| Headline measure | Width of the title block. |
| Empty sockets | Opacity of the outline left where each letter fell from. |
| Motion exposures | 0–8 faded copies spaced evenly along each letter's path. |
| Second ink | Fallen letters use the recipe's second ink. |

Letters collide by their real outlines with the type that stayed, any other text, shelves, beams, the walls and the floor. The seed picks which letters fall and how they tumble; every letter has its own random stream.

The simulation runs once, when the scene is made. The scene stores each glyph's font, glyph ID, rest transform and final pose (plus pins, rings, nails, shelves, the beam's final position, shards and exposures) in `SceneElement.physics`. Rendering, PNG export and the outlined vector PDF replay those poses and never re-simulate. Construction stages show glyph blocks and scenery, then the letters, then sockets, rule, nails and rings, then the motion exposures.

**Inks**: the first ink is the type (and scenery), the second the fallen letters, the third the paper; all three are editable in the Shape library. `--inks '#f2f0ea,#c8ff1a,#0c0c0e'` gives light type with acid-green fallen letters on near-black, and with `look=3` a neon sign.

Used in an image area of a generated poster, the recipe fills that field with the poster's own title in its own font. It falls to the field's bottom edge and is clipped to the field. A title typed in the Shape library stays fixed; leave it blank to follow the brief.

## Any poster: loosen existing type

`GravityTypeSystems.loosen` releases letters from text elements in any scene genome. By default it loosens the largest text block, or the IDs you pass. Each glyph starts exactly where the renderer draws it, including rotation, tracking, stretched (non-proportional) type and type transforms. All other text stays put and blocks the falling letters; with `--shapes`, shape and image elements do too (their rotated boxes, or 16-sided outlines for round shapes). The loosened elements are replaced by one physics element that keeps the originals, and `restore` puts them back exactly.

```sh
# A specimen, a mid-fall moment, and a dark version
poster shape-library render --id fallen-letters --text 'LET IT\nFALL' --out output/fall
poster shape-library render --id fallen-letters --set time=0.9,strobe=4 --out output/fall-mid
poster shape-library render --id fallen-letters --inks '#f2f0ea,#c8ff1a,#0c0c0e' --set detach=0.6,hang=0.3 --out output/fall-night

# Other arrangements and looks
poster shape-library render --id fallen-letters --set arrangement=1,scatter=0.6 --out output/fall-pour
poster shape-library render --id fallen-letters --set arrangement=4,detach=0.15,slack=0.35 --out output/fall-garland
poster shape-library render --id fallen-letters --set arrangement=2,look=3,detach=0.5,hang=0.5 --inks '#f2f0ea,#ff2bd6,#0b0b10' --out output/fall-neon-sign
poster shape-library render --id fallen-letters --text 'GLASS\nTYPE' --set shatter=1,detach=0.6,shards=8 --out output/fall-glass

# Loosen the headline of any saved scene, then put it back
poster physics loosen --scene output/curated/kinetic-v10/genome.json --set detach=0.5 --accent '#ff4a1c' --out output/kinetic-loose
poster physics loosen --scene genome.json --shapes --set arrangement=3 --out output/stairs-loose
poster physics restore --scene output/kinetic-loose/genome.json --out output/kinetic-restored

# Animate the fall: frame PNGs, a looping GIF and the final vector PDF
poster physics animate --id fallen-letters --text 'GRAVITY\nWINS' --seconds 4 --fps 24 --out output/fall-gif
poster physics animate --scene output/curated/kinetic-v10/genome.json --set detach=0.4 --out output/kinetic-gif
```

`--set` takes any control by ID: `arrangement`, `look`, `detach`, `hang`, `collapse`, `scatter`, `steps`, `slack`, `pivot`, `shatter`, `shards`, `toughness`, `burst`, `time`, `stagger`, `kick`, `gravityAngle`, `bounce`, `friction`, `floor`, `size`, `ghost`, `strobe`, `accent`. Loosening defaults to `floor=0` (the paper edge). Each animation frame is the same scene made at a later moment. Because the simulation is deterministic, the frames form one continuous motion.

## Using the engine directly

```swift
var world=PhysicsWorld()
world.addBody([PhysicsWorld.box(center:PhysicsVector(5,14.5),halfWidth:6,halfHeight:0.5)],kind:.fixed)
let letter=world.addBody(PhysicsOutline.pieces(glyphPathInMetres),kind:.dynamic,friction:0.5,restitution:0.1)
world.bodies[letter].angularVelocity=2
world.settle()   // or world.step(1.0/120) for each frame
let pose=(world.bodies[letter].position,world.bodies[letter].angle)
```

y points down the page, and angles are clockwise.

## Limits

- Collision shapes approximate each outline to within about 1/40 of the glyph's larger side, plus the 1 cm collision skin (0.1% of poster width). Resting letters can show hairline gaps; they do not visibly overlap.
- Stacks up to about eight bodies come to rest at once. Taller stacks can creep slowly before they sleep, a known limit of sequential-impulse solvers; letter piles are rarely that deep.
- Substeps limit travel to 5 cm per substep at up to eight substeps per 1/120 s step, so anything faster than 48 m/s (far beyond a poster-height fall) could still tunnel. There is no full continuous collision detection.
- Loosening uses each text element's first copy. Repeated copies, drop shadows, halftone and knockout treatments, and heart tittles are not carried over to the falling glyphs.
- Shapes and images block letters only when loosening with `--shapes`, and then by their box or a 16-sided outline, not their drawn geometry. Generated posters' image areas don't collide with other elements.
- Determinism is guaranteed on one machine, not across CPU architectures or OS versions, as for the rest of PosterLab.

`poster-checks --physics-only` verifies all of this: a six-box tower and a pin at rest, a thrown plate stopped by a thin shelf, every arrangement at rest inside the page (pour landing from above, sign nails, stair shelves, garland rings still joined, balance beam and pivot), glass letters (shards that cover the glyph, stay in the page and replay exactly; tougher letters break no more often), four distinct looks, shapes catching letters, replay, collision counters, specimen counts and floor contact, a monotone detach control, exact pose replay, construction stages, mid-fall moments, invalid-pose rejection, brief and field resolution, renderer-exact loosening of proportional and stretched type, and restore.
