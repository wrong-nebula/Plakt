# Shape library

Open **Shape library** in the app header, or **Explore shapes…** in the generation controls. Search by technique, change parameters, preview with a font, and save a reusable JSON preset. **Use in image areas** pins that variation for the next source composition study. **Automatic matching** restores seeded selection. Layouts without a suitable observed image region remain type based.

The 45 recipes cover repetition, radial forms, cutouts, modular structures, line fields and eight shaded volumes: sphere, torus, capsule, rounded cube, cone, ellipsoid, linked rings and a gyroid section. All render through native Core Graphics; PDF exports retain vector paths and circular halftone dots. Construction stages progressively develop the tonal volumes.

Each recipe stores its generating rule, parameter schema, technique tags, eight descriptive geometry traits, preferred physical aspect, style vocabulary and font targets. Every generated scene stores the selected recipe ID, parameter values, seed, source image anchor and compatibility explanation. Presets include the recipe snapshot and font profile. Seed controls stochastic tile rotations and Voronoi sites; deterministic forms vary through their explicit parameters.

Automatic matching combines physical image-area fit (30%), font properties (28%), style vocabulary (23%), type density (14%) and a saved source-reference match (5%). It samples among 16 suitable choices with a separate seeded random stream. Font suggestions compare weight, width, serif/mono and italic properties. These weights are authored starting points, not learned aesthetic facts. The existing source and personal juries evaluate the resulting posters independently.

The neutral specimen index has a normalized 10-dimensional descriptive vector and a separate 768-dimensional native Vision embedding for each recipe. Keeping neutral shape specimens separate from font-pairing specimens avoids encoding a particular font as the shape itself.

Saved SigLIP rankings and visually reviewed SAM selections provide source references. Their scores, when available, retain their original meaning; manual review is never assigned a fabricated cosine. Model packs and semantic indexes are unchanged. Fourteen source-linked interpretations share renderers with the native recipes.

## SAM-reviewed expansion

The [visual review and proof gallery](output/sam-shape-expansion-v1/index.html) records all 61 shape leads, thirteen refined source selections and six additions:

| Recipe | Construction |
| --- | --- |
| Disc wreath | Separate circular modules at equal angles on an orbit; collision-safe radius controls. |
| Segmented ring | Annular sectors with independent count, coverage, thickness and phase. |
| Polygon contours | A single polygon frame or nested regular polygons with preserved gaps. |
| Star frame | Alternating tip/root radii with an optional homothetic star aperture. |
| Notched disc | A disc with a controlled wedge removed; depth, angle and orientation remain editable. |
| Radial cell mosaic | Shared concentric boundaries and staggered radial seams, with seeded irregularity. |

The mosaic preserves the source’s polar organization. The existing Voronoi recipe remains a separate construction. Plain disc grids are exposed by setting satellite size to zero in **Satellite clusters**, preserving one family instead of adding an alias.

Search **sam-reviewed** in Shape library. All six work in image areas and whole-poster mode, with saved preset replay and vector PDF export. Source photographs and masks are evidence rather than embedded render assets. All eight independently segmented wreath discs produce a circle fit with 0.81% relative radial residual; the native reconstruction overlaps their refined masks at 94.3% IoU.

The verified snapshot is [PosterLab SAM Shapes](<dist/sam-shapes-preview/PosterLab SAM Shapes.app>). It has a separate bundle identifier and preferences so concurrent main-app builds cannot replace it. Repackage an existing verified build with `scripts/package-sam-shapes-preview.sh`.

## Isolated preview

```sh
scripts/build-shape-library.sh
open 'dist/shape-library-preview/PosterLab Shapes.app'
dist/shape-library-preview/poster shape-library list
dist/shape-library-preview/poster shape-library render --id tone-link --seed 817 --out output/my-shape
dist/shape-library-preview/poster shape-library render --preset output/my-shape/preset.json --out output/replayed-shape
```

The preview uses its own build directory, bundle identifier and preferences. It does not overwrite the main app or the active SigLIP build. Its library/taste root points to this project; no votes are created by browsing shapes.

```sh
dist/shape-library-preview/poster shape-library index --out output/my-shape-index
dist/shape-library-preview/poster shape-library showcase --out output/my-shape-pairs
dist/shape-library-preview/poster shape-library study --out output/my-shape-study --rounds 5 --count 4
.build/shape-library/release/poster-checks --shape-library-only
```

The study reads existing poster genomes, inherits actual source compositions and runs the current jury over successive two-donor rounds. It does not write to the poster library or train/alter SigLIP. Use a new output directory for each run.

## Verified outputs

- `output/shape-library-v2/gallery.html`: 36 neutral specimens, 72 font/parameter examples, a contact sheet of all 36 shapes in the inherited blue Offene Formen composition, vector PDFs, presets and embeddings.
- `output/shape-source-study-v2/gallery.html`: four directions, five rounds per direction, 80 candidate instances. The earlier `shape-source-study-v1` run is retained for comparison. Across both runs: 160 judged instances, 128 unique PNGs, 15 shape families, and ten distinct source donors per direction per run. Repeated incumbents account for the remaining instances.
- `output/shape-library-v2/validation.json`: counts and verification scope. All **26 native check groups pass**, including exact preset replay, 36 unique nonempty renders, pixel changes for every exposed parameter, stochastic seed repeatability, font-property discrimination and physical-field compatibility.
- `output/shape-library-v2/ui-tested-preset.json`: the linked-ring variation changed to view angle 0.85 and Space Grotesk 600 in the native gallery, saved, reopened after changing recipes, and pinned to generation. The same preset replays through the CLI.

Visual review caught clipped crescent artifacts and overly thick linked rings in v1. The revised crescent grammar clips actual disc differences in a radial arrangement; thinner perpendicular rings preserve their holes. v1 specimens remain available as the comparison baseline.

The native gallery uses an ordinary sidebar list, segmented shape/type preview, labeled parameter sliders, explicit reset, a searchable recipe list, suggested font buttons and native file dialogs. Before, shape choice was hardcoded to a handful of operators. After, the user can inspect the rule, change geometry and fonts, save/reopen the exact variation and pin it without altering source type anchors. Reduced motion requires no special handling here because controls and preview updates have no decorative transitions.

The build script snapshots sources before compilation so ongoing edits in the SigLIP chat do not invalidate a build. `--reuse-snapshot` rebuilds that private snapshot for local verification; a normal invocation refreshes it. The signed preview is `dist/shape-library-preview/PosterLab Shapes.app`; the main app is deliberately not replaced while the other chat is active.
