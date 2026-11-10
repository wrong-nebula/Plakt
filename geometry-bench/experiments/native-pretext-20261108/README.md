# Native Core Text caching

The native implementation retains the original wrapping rules and exact Core Text
ink-bound measurements. It adds bounded, synchronized caches for prepared words,
candidate-line measurements, and complete layouts. It does not use the JavaScript
Pretext package or change Japanese line-breaking rules.

In PosterLab, open **PosterLab → Settings… → Text layout → Pretext**. It defaults
to enabled. Disabling it selects the unchanged previous wrapper and bypasses the
cache. The preference persists and applies to new source-generated posters. Each
poster snapshots the selected method before choosing its information region.

## Isolation

The `workspace/` directory is a private source snapshot. Its builds and compiler
caches are local to that snapshot. The standalone optimized benchmark has another
private build folder. No shared `.build`, `dist`, package manifest, library data,
or other session's app bundle was written by this work.

The shared source integration adds seven files, moves the original wrapper into
`PreviousTextWrapping`, and adds the routing, Settings scene, and check runner
hooks in three existing files. `integration.patch` contains only these changes,
against the saved `*.before.swift` copies. Shared/tested file hashes are recorded
in `output/native-pretext-20261108/integration-manifest.json`.

The standalone app is `output/native-pretext-20261108/PosterLab Pretext.app`, with
its own bundle ID and preference domain. It leaves the other sessions' apps alone.
Its native Settings menu, toggle, disabled-state persistence across relaunch and
re-enabling were verified through the real UI.

## Benchmark

From the repository root, choose a fresh output folder:

```sh
node geometry-bench/experiments/native-pretext-20261108/benchmark.mjs output/native-pretext-20261108/another-benchmark
```

This compiles the five production wrapping files with `swiftc -O -swift-version 6`.
The same long headline, dense event details and Japanese fixtures from the earlier
browser experiment are tested at 16 widths. There are 21 samples per method, with
method order rotated across samples and timing batches targeting 15 ms. The
measurement-warm control retains only one completed layout, so it cannot obtain
the speedup by replaying width results. Its measurement count stays unchanged
while its completed-layout hit count remains zero.

Compilation, process startup and rendering are outside the wrapping timings.
Other sessions remained active and can affect absolute timings. Single cold wraps
are measured separately; these do have some cache setup overhead. The numbers do
not claim the same speedup for a complete poster generation with rendering and
image judging.

## Verification

Run the focused checks from the private snapshot:

```sh
cd geometry-bench/experiments/native-pretext-20261108/workspace
CLANG_MODULE_CACHE_PATH="$PWD/.build-native-pretext/module-cache" \
SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.build-native-pretext/module-cache" \
swift run --disable-sandbox --scratch-path .build-native-pretext --jobs 2 \
  -Xswiftc -module-cache-path -Xswiftc "$PWD/.build-native-pretext/module-cache" \
  poster-checks --text-wrapping-only
```

The checks cover 420 line-output comparisons, fractional wrap thresholds, empty
and malformed dimensions, whitespace, grapheme clusters and multiple scripts,
font/aspect cache separation, storage bounds, 96 concurrent tasks, preference
selection and cache bypass. Source integration checks compare complete genomes
and rendered pixels across both methods for three seeds. The new checks are also
part of the full `poster-checks` run.
