# Visual census and reusable shape grammars

On 8 November 2026 this study read all **1,130** `library/posters/*/record.json` records and reviewed all 12 contact sheets, then enlarged **18** selected leads. This is a visual census and authored interpretation, not a trained detector or an exhaustive annotation of every element. Source image and record SHA-256 values freeze the evidence in `output/library-shape-survey-v1/manifest.json`. Source posters are read only; no library tags, personal votes, models, semantic indexes or segmentation artifacts are updated.

Eight executable vector recipes live separately from the active discovery catalog in `Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json`. `LibrarySurveyShapes.swift` merges them into the app's existing searchable shape gallery, font compatibility matching, presets and neutral descriptor/Vision index. `SurveyShapeGeometry.swift` renders them with Core Graphics and retains vector PDF paths. Existing IDs and discovery results are preserved.

| Recipe | Distinct construction | Source census indices |
| --- | --- | --- |
| Right-angle meander | One open rectilinear spiral, rather than separate nested polygons | 216, 775 |
| Off-axis perspective tunnel | Exponentially receding frames with a movable vanishing point | 416, 639, 1030 |
| Rounded branching molecule | Recursive paired arms, tapered stems and shared round junctions | 608 |
| Shared-anchor tension web | Cubic strands converge on two common anchors | 1105 |
| Graded module density | Nonlinear row spacing, local pitch limits and seeded jitter | 745, 1122 |
| Scalloped counterform frame | Periodic boundary modulation around one cutout | 477, 419 |
| Progressive chevron echoes | Serial scaling and drifting bent bands form apparent depth | 17, 308 |
| Opposed bracket enclosure | Opposing L brackets frame a central disc or anchor | 841 |

The source images establish visible families, not exact original algorithms or designer identities. The source uses letter modules in the density field, shaded forms in some perspective examples and different symbols in serial stacks; the first vector recipes deliberately abstract those mechanisms. Similarity scores are absent for this manually reviewed evidence. Font/style compatibility remains an authored heuristic, not trained preference evidence.

`output/library-shape-survey-v1/systems.json` separates the **implemented geometry** from **composition specifications**: scale, copies, candidate type zones, crop modes and possible interactions. These composition suggestions are not a newly implemented automatic type-flow engine. Existing placement and dominant-shape engines still control complete poster layouts. Shapes remain optional; the suggestions favor one or two large forms.

Six further systems are specified with sources but have **not** been implemented here: folded/faceted spires, sliced tonal orbs, gravity drips, bilateral soft crosses, text projected into perspective portals and glyph/image substitution in density fields. These deserve separate material, text-layout or simulation controls rather than disguising them as another blob preset.

## Reproduce

- `python3 scripts/survey-poster-shapes.py` rebuilds the census contact sheets and source manifest from the current library. Preserve this study's output first if the library has changed.
- `python3 scripts/define-survey-shapes.py` rebuilds the eight recipe definitions from that frozen manifest, plus composition/future-system specifications.
- `poster shape-library render --id survey-dendrite --seed 817 --set depth=4,spread=0.6 --out output/my-branching-study` renders a saved preset, editable scene, PNG and vector PDF.
- The existing native **Shape library** gallery exposes the eight recipes, live sliders, font pairings, preset saving and generation pinning after rebuilding with these sources.

Validation results, prototype variations, source links and checksums are retained alongside the study gallery. Source contact sheets are analysis artifacts; the gallery uses procedural specimens and links to complete source posters, without displaying source crops.

## Continued study

The six proposals above are now implemented and all 14 defaults have been revised around canonical reference geometry. The scalloped example was corrected from a generic frame to editable FUBU letterforms. See `SHAPE-SYSTEMS-V2.md` and `output/library-shape-survey-v2/gallery.html` for the current implementation, source-first defaults, generation runs and verification. This document retains the original eight-recipe study as historical evidence. Use `define-extended-survey-shapes.py` followed by `align-survey-defaults.py` for the current catalog; the original eight-recipe script reproduces only the historical first pass.
