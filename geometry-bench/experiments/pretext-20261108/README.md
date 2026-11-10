# Isolated Pretext comparison

This experiment owns only this directory and `output/pretext-20261108/`.
It does not edit the workshop's package files, the app, shared `.build`, or `dist`.
It reads Playwright and esbuild from the existing workshop install; Pretext has its
own exact-version install and lockfile here. The browser it launches is its own
headless process, and only that process is closed.

Run from the project root:

```sh
npm ci --prefix geometry-bench/experiments/pretext-20261108 --ignore-scripts --no-audit --no-fund
node geometry-bench/experiments/pretext-20261108/run.mjs output/pretext-20261108/another-run
```

The runner refuses to replace a completed results folder. The first invocation
freezes `SourceLayoutDNA.swift` as `source.snapshot.swift`. Later runs use that
snapshot even if another chat changes production code. The exact wrapping
function is inserted into a standalone Swift executable with its own compiler
cache; SwiftPM and the running app are not involved.

The three fixtures contain a long headline, fictional dense event details, and
Japanese with punctuation, explicit newlines and a Latin email address. Each
fixture is evaluated at 16 widths. The report distinguishes:

- The actual captured Core Text wrapper, measured in-process with optimized Swift.
- Its browser algorithm control, with Canvas ink bounds and grapheme iteration.
- Pretext's cleared-cache preparation, one-shot preparation plus full lines,
  warm preparation, prepared full-line layout and stats-only layout.

Visual output in both columns is generated from Core Text outlines using the same
selected font. Current output reproduces the app's per-line ink-height fitting;
Pretext output keeps a fixed em and baseline pitch. Font sizes are calibrated to
the same nominal ink height, but are not guaranteed to match every line's
effective em size. The report makes that difference explicit.

Validation covers all non-whitespace characters, matching CSS heights and exact
non-whitespace line membership against real DOM Range rectangles at all 48 widths
in both normal and pre-wrap modes, native outline bounds, and a targeted Japanese
line-start/line-end punctuation check. That check is not complete kinsoku
conformance. Performance excludes compilation, process startup, font loading,
rendering and browser-control overhead. Other active sessions may contend for CPU.

Artifacts include the visual HTML report, PNG comparisons, vector SVG specimens,
raw JSON results, raw timing CSV and the exact captured wrapper.
