# Reusable type systems

Open **Explore type systems…** in the Generate workspace. The gallery shows a live vector study and its controls; it does not display source crops. Browse one representative per method or every source variant, search tags/words, change the input and Google Font profile, adjust pitch/tracking/scale/angle/colors, and inspect individual transformation steps. The provenance disclosure distinguishes fitted sequences, geometric proposals and visual annotations.

**Save variation…** stores the complete rule, controls, text, colors, font profile, trace and vector scene. **Open variation…** restores it. **Use for posters** persists the operator and controls; new poster briefs supply fresh text and existing source compositions supply placement. Automatic inheritance instead selects compatible systems already belonging to the source donors. Supporting information remains protected. Source photos, manual borders, rejected tags and review status are preserved.

The complete November 7 scan covers **1,130 surfaces from 1,103 source files, 40,971 elements**, including 11,798 text lines and 23,944 words. Its original 456 systems remain intact. The November 8 SigLIP study adds three visually annotated rules, bringing the catalog to **459 source records, 448 distinct browsing variants and 14 populated method families**: 377 fitted, 76 inferred and 6 visually annotated. Eleven near-repeat aliases retain their original stable IDs and genomes. Radial fans, general curved baselines and unconstrained permutations still have no fitted evidence in this scan; the new glyph arc is an explicit visual annotation.

| Method | Source records | Stored logic |
| --- | ---: | --- |
| Grapheme migration | 1 | Move one grapheme by adjacent transposition; preserve the remainder's order and complete multiset |
| Compensated erosion | 1 | Remove a prefix grapheme, grow a periodic insertion, keep the suffix and total count |
| Repeated phrase/glyph fields | 267 | Repeat text at measured source anchors |
| Coupled columns | 5 | Independent phrase trajectories with shared vertical rhythm |
| Baseline staircase | 39 | Fitted x displacement and y pitch |
| Scale ramp | 31 | Approximate geometric progression of observed type heights |
| Rotation fields | 104 | Vertical/opposed reading bands and half turns |
| Word reflow | 4 | Preserve word order while changing the line-break schedule |
| Tittle substitution | 1 | Replace a selected lowercase i/j dot contour with a heart; preserve the stem |
| Reflection | 1 | Reflect the complete group with changed ink role |
| Alternating ink | 2 | Proposed two-ink cycle from measured source colors |
| Tangential glyph arc | 1 | Preserve grapheme order along a physical arc, turning each glyph to the tangent |
| Protected prefix / suffix cycle | 1 | Keep the prefix while cycling an explicit list of endings |
| Stepped glyph tiles | 1 | Advance ordered glyphs through three columns with shared affine shear |

For **positions**, the observed nine rows are `positions → opsitions → ospitions → osiptions → ositpions → ositipons → ositiopns → ositionps → ositionsp`. This is a moving `p`, not a random shuffle. For Bibliotopia, six rows follow `autour + du + monde`, shrinking the left prefix while alternating d/u additions compensate. The lower left column steps right; the response column stays fixed. The heart dot is a separate glyph-component rule.

Each system stores source poster/element IDs, normalized field frames, observations, fit status/error, invariants, parameters, per-step grapheme maps, a **45-dimensional normalized descriptive vector**, and a **768-dimensional Apple Vision revision-2 vector** of its source element. The original 42D descriptors are zero-padded for the three new operator columns. Separate **768D SigLIP profiles** encode each source crop and two fixed-copy vector specimens. These are procedural grammars and descriptors, not neural fine-tuning or reliable font/designer attribution. OCR and uncertain poster borders can introduce false positives. Proposals retain that uncertainty.

```sh
node geometry-bench/learn-type-systems.mjs library output/type-systems-v3
./dist/poster systems embed --catalog output/type-systems-v3/catalog-draft.json --out output/type-systems-v3
./dist/poster systems tag --catalog output/type-systems-v3/catalog.json --library library
./dist/poster systems showcase --catalog output/type-systems-v3/catalog.json --out output/type-system-proofs
./dist/poster scene render --genome saved-variation.json --out output/variation-export
./dist/poster library breed --library library --out output/variation-study --type-system saved-variation.json --brief mixed --rounds 5
node geometry-bench/type-system-audit.mjs output/type-systems-v3
```

Native operators work in grapheme clusters. Exact sequence checks, Unicode conservation, reverse direction/step limits, constant-em migration, heart-glyph pixel changes and portable variation replay are covered by `poster-checks --systems-only`.

Rotation fields regularize photo/OCR angle noise: near-orthogonal baselines snap to 90° increments, source lane order/directions survive, explicit lane gaps prevent touching columns and the field uses a shared em size. Lane count resampling treats reading direction categorically, so opposite directions never interpolate through accidental diagonals. Live controls expose lane pitch/gap. Reusing a rule reserves its mapped field against unrelated display text. Original measurements remain in provenance.

The native gallery was checked by changing `horizons` to `material`, moving grapheme 3 left, adjusting tracking, following the trace, saving/reopening the portable JSON and reopening the persisted poster rule. `output/type-system-material-demo.json` is that UI-authored example; `output/type-system-material-replay` reproduces it through the CLI. New posters adapt the rule and geometry controls to their own brief and source palette; gallery colors belong to the standalone variation.

## November 8 — SigLIP study

The [evidence gallery](output/siglip-system-study-v1/index.html) compares source regions with native renderings and changed controls. Two frozen collection passes score all 1,130 posters: 16 type prompts and 14 separate shape prompts, with no missing or stale features. Scores shortlist visual references; they are not confirmed technique labels or probabilities.

All original 456 rules, plus the three additions, have a source embedding and two neutral specimen embeddings (459 + 918 vectors; no failures). **Related variants** in the native gallery blends normalized operator distance (60%) with SigLIP specimen distance (40%). This improves visual browsing without treating resemblance as symbolic equivalence.

Twenty-eight conservative pair proposals were visually inspected. Eleven same-poster, same-operation pairs with matching symbolic behavior, both probe cosines above 0.98 and maximum normalized layout delta below 0.04 were grouped. Complete-link grouping prevents chains. There were **zero exact two-probe pixel duplicates**. `TypeSystemLibrary.systems` and ID lookup retain all 459 records for reproduction and inheritance; `distinctSystems` exposes 448 representatives. The curation manifest records every alias and its basis.

The three additions are visual annotations: circular lettering from SALTS, `Vi|ti|ni|ci → Viti / Vini / Vici`, and the KUNSTKAMMER stepped tile sequence. They accept new copy and retain their source references. Their source bounds are proposed; qualitative confidence and the required stored fit-error field are not image-reconstruction measurements. The gallery labels image fitting as unevaluated for these annotations.

Stepped glyph tiles use one row per input grapheme, so shorter and longer copy is preserved without padding or truncation. A suffix cycle accepts `prefix|suffix|suffix`; plain input is treated as the complete prefix. Unicode, short and long copy transfers are checked explicitly.

The separate shape pass yielded **eight editable vector interpretations**: a growing spiral stack, wave lines, opposing mirrored curves, diagonal tiles, circle clusters, perforated tiles, radial spokes and a petal rosette. Each has explicit parameters, repeatable output, a pure-shape scene, PNG and vector PDF. These interpretations are available through `poster shapes`; they do not recover the source authoring layers. The separately developed [shape library](SHAPE-LIBRARY.md) offers a broader native recipe browser.

```sh
./dist/poster systems semantic-index --catalog library/type-systems.json \
  --models models/siglip --out output/my-system-embeddings
./dist/poster library discover-systems --library output/siglip-collection-snapshot-v1 \
  --scope type --models models/siglip --out output/my-type-discovery
./dist/poster library discover-systems --library output/siglip-collection-snapshot-v1 \
  --scope shape --models models/siglip --out output/my-shape-discovery
./dist/poster shapes list
./dist/poster shapes render --id shape-wave-lines --set count=30,amplitude=0.12 \
  --out output/my-wave-system
```

`scripts/curate-siglip-discoveries.py` materializes the recorded annotations; its `--merge-embedded` option merges the three additions after native Vision crop embedding. `scripts/report-siglip-systems.py` rebuilds the evidence gallery from the frozen runs and native proofs. `poster-checks --discovery-only` checks new text behavior, Unicode order, alias provenance, pure-shape scenes, A/B/A pixel repeatability and visible parameter changes. The review was performed by the coding agent, without independent human validation.
