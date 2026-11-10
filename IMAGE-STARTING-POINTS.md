# Image starting points

**Start from image** opens a separate generation workspace in the main app. Choose or drop an image, set palette/composition/shape influence, choose an image placement and generate a study. The current event brief, font, type system, shape and jury settings are inherited from the studio. The former reference import is labeled **Judging reference** to distinguish its scoring role.

Image studies keep the actual input image in the artwork. They explore full-bleed, framed and split layouts; fit a coherent cluster of source typography against local texture and focal regions; place complete supporting information separately at the largest size that fits available calm space; and occasionally add large geometry influenced by measured image texture, direction and colors. Added shapes default to Follow jury, independent of shape influence; the UI also offers None, Occasionally and Often. Starting priors range from quiet to geometry-oriented, and the weighted juror mix guides the proposal frequency. Generated forms span roughly half to more than the paper width, with clipping allowed. New candidates recombine real source genomes. After each round, the winner survives and supplies parents for some of the next round's candidates; fresh donor combinations remain in the pool.

Analysis uses an upright sRGB raster, spatial luminance/edge cells, a structure-tensor direction estimate, the existing palette measurements and a Vision image feature print for donor affinity. [Apple Vision attention saliency](https://developer.apple.com/documentation/vision/vngenerateattentionbasedsaliencyimagerequest) proposes focal regions; face and [existing-lettering detection](https://developer.apple.com/documentation/vision/vnrecognizetextrequest) provide additional placement costs. These are proposals, not exact segmentation or semantic style labels. Composition measurements and visual affinity influence source choice; no SigLIP model/index work is needed or modified.

Every run stores normalized checksum-bound image assets, the measured image profile, source genomes, derived scene genomes, round ancestry, judge scores and ballots, four construction stages and the final winner. PNG exports use the actual source pixels; PDF embeds the raster while keeping procedural type/shapes as vectors. A missing or changed asset fails explicitly. Reproduction uses the saved asset URL; moving a study requires preserving that path or relinking its assets.

The jury combines configured local heads, explicit personal-taste models when present and image-specific breathing-room, focal-retention and display-presence scores. Visual review of the first run showed that a pure avoidance score could favor insignificant typography. The revised score uses actual unrotated glyph height and ink footprint, and cluster exploration allows larger fits, without normalizing away the source’s relative type sizes. Default image studies exclude reference-similarity voting because it rewards reprinting the photo. Relative Borda rankings are useful comparisons, not objective aesthetic truth. Intentional overlap, crop and pale palettes remain available. No labels, votes, model weights, semantic indexes or source-library records are written by generation.

```sh
.build/image-library/release/poster from-image \
  --image /absolute/path/photo.png --library library \
  --out output/my-image-study --seed 20261108 --rounds 10 --count 12 \
  --title 'OPEN CIRCUIT' --subtitle 'Print, sound and moving images' \
  --institution 'Museum für Gestaltung Zürich' \
  --footer 'Concept programme · 18–21 June 2027' \
  --placement mixed --palette 0.85 --layout 0.85 --shapes 0.65
.build/image-library/release/poster-checks --image-start-only
node geometry-bench/image-study-gallery.mjs output/image-start-examples-v4
```

Use a fresh output directory. Without an indexed library, the generator falls back to the existing procedural source recipes. Runs never train new models. The four supplied-image examples use newly authored concept briefs at real venues, not claims about announced events.

Generation archives use compact sorted JSON: all scene/source genomes and provenance remain available without repeated pretty-print whitespace. The first baseline run retained three complete studies and partial fourth-study outputs after a disk-space failure; the final run uses a fresh folder.

The third pass incorporates the user's direction: quiet areas support larger type, while small supporting text is a fallback for constrained images. Information layout searches multiple widths and type sizes rather than assigning the same small size to every poster. A title already present in display type is not repeated in the information block. Display cluster zoom responds to calm-area coverage while preserving internal size relationships.

## Jury-driven shape proposals

Each active juror keeps its own shape-probability and preferred-width estimates. Initial values are explicit authored priors, not claims about trained aesthetic labels. After a round with both shaped and unshaped candidates, a juror's top-third actual scores update its preference. Flat score ranges add no evidence. Preferences are saved in every round and shown in the app; the weighted mixture guides the next round. Automatic mode retains one large-shape and one no-shape probe to keep comparisons available. Manual None always bypasses automatic shape proposals.

These updates are run-specific adaptive search, not new Core ML training or causal attribution: image, type and shape variables vary together. Trained taste/style jurors contribute their actual image scores; their stored model weights and explicit user votes remain unchanged. The expanded default run uses 10 rounds × 12 candidates per image. Each final round ranks its retained champion alongside fresh variations; consensus scores from different images or rounds are not a global quality scale.

## Verified expanded run · 8 November 2026

The final run contains **480 candidate instances** over **40 rounds** (10 × 12 for each of the four supplied images), with **444 distinct rasters** and 36 retained-champion instances. The final-round top three for each image form a 12-poster shortlist. All 480 candidates, 40 round winners, source/derived genomes, individual scores and per-juror shape preferences are available in the generated gallery and reports.

Added decorative shapes occur in **130 of 480 candidates (27%)**; 350 have none. Their widths range from roughly **58% to 128%** of the paper width. Information type adapts among 1.5%, 2%, 2.5% and 3% of paper height; the prior fixed size was 1.25%. Larger sizes are chosen where a calm field fits, rather than forcing tiny information into every layout.

All **29 native check groups** pass. Separate juror fixtures verify opposite preferences from opposite scores, weighted mixture changes, exclusion of flat ballots and manual no-shape behavior. The actual four winning genomes reproduce byte-identical PNGs on this machine. Native UI checks verified import, influence controls, generation, saved-study loading, all 10 round selectors and the per-juror preference disclosure. No actual taste votes were cast during testing.

Visual review: skateboard #1 is the strongest composition; horse #2 is a cleaner alternative to the automatic #1. The eye variants still overemphasize “THE,” and some inherited fragments/treatments remain overworked. The jury scores are retained as generated rather than silently replacing their winners with review picks.

See [ranked finalists](output/image-start-examples-v4/finalists.png), [the full gallery](output/image-start-examples-v4/gallery.html), [validation](output/image-start-examples-v4/validation.json) and [exact replay results](output/image-start-examples-v4/replay-validation.json). The separate preview is `dist/image-preview/PosterLab Images.app`; the main app and SigLIP session were not relaunched or modified by this preview workflow.

## Optional experiments and the seven-image queue

Generated-type-only judging (**4**) and varied finalist selection (**5**) are separate switches, both off by default. Three composition directions (**2**) are also an optional experiment; default generation uses a single freely evolving pool. This keeps comparisons available without forcing every run into image-led/type-led/interaction categories. Large articles such as THE remain valid source emphasis. Matched shape comparisons (**3**) remain enabled unless shapes are explicitly disabled.

The experiment run at `output/image-start-examples-v5` exercises all three directions, matched controls, type-only scoring and direction-aware finalists. The next queue at `output/image-run-queue-v1/queue.json` uses the new default-off modes for all seven supplied images. Inputs are copied and checksum-pinned before running; the worker snapshots its executable/resources and records job status and individual logs. Each job is a new concept brief at a real venue, not a claim about an announced event.

```sh
python3 scripts/image-run-queue.py status
python3 scripts/image-run-queue.py run
```

Do not start a second worker while `worker.lock` exists. Job reports and completed rounds are retained if an individual job fails. The queue modifies neither the poster library nor the user's training labels/models.

The gallery separates ordinary proposals/retained parents from controlled experiments. Matched controls are designed comparisons, so their shape frequency is not a production-frequency estimate. Preview JPEGs are high-quality review files; source assets and frozen scene genomes support lossless PNG and PDF export. Repeated full analysis grids are stored once per study and referenced from compact scene files.
