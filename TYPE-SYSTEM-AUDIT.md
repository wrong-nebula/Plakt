# Type-system generation audit

The sweep covers all **459 saved source variants**, including the eleven gallery aliases, and all **14 cataloged method families**. It retains the source catalog as read-only input. Separate regression fixtures exercise the three implemented operator branches that currently have no source-catalog entry: permutation sequences, radial fans and curved baselines.

Each saved variant renders its observed copy and new copy. Family probes add short copy, Unicode, long copy with mono/serif/condensed fonts, paired parameter extremes, replay and repeat checks. Full-poster probes apply each family to two real source compositions using one-word, two-word and longer briefs. The output includes PNGs, scene genomes, source-index traces, a filterable gallery and contact sheets. Source crops are not shown.

Overlaps, crops and pale palettes remain artistic choices. Off-paper glyph bounds are diagnostic observations. The technical checks look for render failures, missing geometry, empty raster output with the audit's diagnostic ink, invalid character maps, non-deterministic replay and inactive controls.

## Verified results · 8 November 2026

The final sweep generated **1,232 cases**: 918 source/new-copy variants, family and stress probes, 132 control renders and **84 full-poster transplants**. All **66 control pairs** change actual pixels. There are **zero technical issue cases, render errors or blank renders**. Long-copy probes cover mono, serif and condensed fonts for every family. The baseline had 73 cases with character-provenance issues; the expanded final sweep has none.

All **28 native check groups** pass, including the new type regression group. The discovery checks pass separately. The generated gallery's filters were executed and their counts verified. Native UI checks in the separate preview confirmed the Heart size control, reflow rhythm and picker, and scale-ramp type scaling. The 14-family contact sheet, full-poster examples and four before/after comparisons were visually reviewed.

Browse [the final results](output/type-system-audit-v4/gallery.html), [before/after comparisons](output/type-system-audit-v4/before-after.png), [full-poster family examples](output/type-system-audit-v4/poster-families.png) or [machine-readable validation](output/type-system-audit-v4/validation.json). Per-case genomes and traces, PDFs for the family samples and verification logs are retained alongside the results. Previous runs remain available for comparison.

This verifies implementation behavior, not the aesthetic quality or historical interpretation of every inferred source rule. The source catalog is semantically identical to the baseline snapshot. Model files, semantic indexes, source library records and taste votes were left untouched.

## Corrected behavior

- **Heart tittle:** `heartScale` now reaches the glyph renderer; previously the trace recorded overrides while the element retained the source value. The gallery exposes Heart size.
- **Scale ramp:** a single global fit preserves the measured relative row heights, including with long copy. Overall type-scale changes and font substitution retain that progression.
- **Word reflow:** the source word-count rhythm repeats until the copy is consumed. Previously all remaining words were packed into a final tiny line. Words per line can be set explicitly in the gallery.
- **Character provenance:** paired columns, reflections, erosion and reflow now map every output grapheme to the correct original input index. Generated joining spaces use `-1`, consistent with generated suffix characters. Pipes and whitespace no longer shift the provenance incorrectly.
- **Glyph arcs:** an open arc reaches its stated endpoint; a closed circle leaves its final interval open. Glyph slots follow available arc length, and circles fit wide as well as portrait fields. The gallery exposes radius, arc span and start angle.
- **One-word reflection:** automatic poster transplants use subtitle words, or the title again, for the second panel. A one-word brief no longer creates alternating blank labels.
- **Gallery controls:** grid columns, shear, vertical scale and turn are editable. Irrelevant count overrides are omitted for input-length systems; tracking is hidden for isolated-glyph methods where it cannot change the output.
- **Loaded parameters:** whitespace-only input, unsafe numeric magnitudes and unavailable pinned font IDs fail cleanly.

## Reproduce

```sh
.build/shape-library/release/poster system-audit --out output/my-type-audit
node geometry-bench/type-audit-gallery.mjs output/my-type-audit
.build/shape-library/release/poster-checks --type-regressions-only
.build/shape-library/release/poster-checks --systems-only
.build/shape-library/release/poster-checks --discovery-only
```

Run from this project directory to include the full-poster probes against the local library. Choose a fresh output directory for every sweep.

The isolated preview is packaged with `scripts/package-type-audit-preview.sh`. Its **Explore type systems…** gallery contains the corrected controls. Models, semantic vectors, curation data, manual library reviews and source images are not regenerated or edited. Rendering fixes can change specimens; the saved semantic index is left for its owning workflow to refresh.
