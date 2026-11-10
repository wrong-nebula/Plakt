# Geometry workshop and comparison

This optional Node workshop tests the 22 path, font, layout and animation packages suggested in the chat. The native SwiftUI app remains independent of Node. The workshop renders SVG experiments to PNG locally and sends them through **the same Core ML/Vision committee** as the native generator using `poster judge-images`.

## Reproduce

Node 22+, macOS, the local native build (`../scripts/build.sh`), and Google Chrome at its normal `/Applications` path. Use a different output folder for another run.

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix geometry-bench
node geometry-bench/probe.mjs
node geometry-bench/fixtures.mjs output/geometry-comparison
node geometry-bench/run.mjs --rounds 3 --population 4 --out output/geometry-comparison
node geometry-bench/report.mjs output/geometry-comparison
```

The run creates 4 initial candidates per workflow from matching seeds. After each generation, the shared committee ranks all outputs; each workflow retains its best candidate and mutates its top two parents to fill the next generation. Every sample retains the seed and parameters, SVG source, PNG preview, raw judge values and Borda votes. The comparison uses the **workflow's distinctive operation** in one large poster region, keeping the surrounding composition and starting parameters shared. Font helpers, skeleton solvers and animation wrappers are different roles, so this is not a universal performance race or objective ranking of libraries. Library choice alone does not imply better art.

The five votes are Composition (authored Core ML prior), Reference (Vision feature distance), Typography (OCR/hierarchy), Rhythm (detail/balance/coverage), and Diversity (nearest peer feature distance). They are correlated heuristic preferences. Borda scores are relative to each round; do not interpret a score increase as absolute aesthetic improvement. Parent selection uses the current round's votes.

`fixtures.json` separately records analytical length, tangent, area, hole topology, transform, parser and font observations. Those checks are more appropriate than aesthetic voting for numerical correctness. They are focused fixtures, not exhaustive geometry or shaping test suites.

## Runtime adjustments, kept explicit

- Pave `1.0.1` requests optional Paper `^0.12.4`. The lockfile installs `paper@0.12.20` for that peer and the old `paper-clipper` bridge, plus `paper-latest` as an alias of `paper@0.17.0` for the current Paper experiment.
- Pathomorph `0.0.5` imports `vector2` while declaring `@rawify/vector2`. The lockfile includes an explicit `vector2` npm alias to the declared dependency. The initial unmodified import failure is preserved in `imports.json`.
- Flo-Mat's current dependency calls `Map.getOrInsert`, absent in Node 22. The adapter uses the equivalent small compatibility shim, as its own test setup does. No package files are patched.
- The deprecated Typr npm wrapper assumes `window` even in Node. Its fixture runs in an isolated VM with a minimal `window` object. This is the npm wrapper tested here, not an assertion about the current upstream Photopea repository.
- Plumin, Typesettable, SVG Text Animate and Khoshnus run in isolated headless Chrome. All external network requests are blocked. Font data comes from the same local Arial Bold file. SVG Text Animate is frozen at its completed appearance; Khoshnus uses a deterministic ID shim in the blank-page fixture and a local-font override. Static poster scores do not evaluate animation timing or motion quality. Browser motifs are fitted to content bounds and must pass a foreground-pixel visibility check. The browser text wrappers are raster motifs in the exported SVG, not claimed as vector glyph generators.
- Khoshnus's Node import has an extensionless relative import that Node ESM rejects; the browser fixture uses esbuild resolution, with the failure recorded in `imports.json`.
- Font outlines are explicitly closed before geometry operations. Some font serializers describe a closed fill with coincident endpoints rather than `Z`; that is fine for SVG filling but ambiguous for offset/area tools.

No runtime network API or remote image judge is used. Registry discovery and package installation need network; experiments do not. The snapshot of versions, package metadata and original import results lives in `registry.json` and `imports.json`. Dependency licenses remain in `node_modules` and can be inspected from the lockfile; font data is read from this Mac and not copied into the project. Generated glyph outlines in experiments are local artwork artifacts.

The corrected local results are in `output/geometry-comparison-v2/`. The earlier comparison remains preserved with a superseded notice because its two animation fixtures had capture issues.

## Fonts that are not here

Six studies draw with letter outlines taken from fonts that ship with macOS: Hiragino (tategaki, compound glyph, glow aperture, one face of spectral echo), and Arial and Times New Roman (pages atlas, the fixed phrases of plot slice). Those fonts may not be redistributed, so the generated outline files are not in this repository. Each study makes its own from the fonts on your Mac:

```sh
node geometry-bench/tategaki-system/prepare-fonts.mjs
node geometry-bench/spectral-echo-system/prepare-fonts.mjs
node geometry-bench/compound-glyph-system/prepare-fonts.mjs
node geometry-bench/glow-aperture-system/prepare-fonts.mjs
node geometry-bench/pages-atlas-system/prepare-fonts.mjs
node geometry-bench/plot-slice-system/prepare-type.mjs
```

Until then those six studies do not run. The app itself and every other study use only the open fonts in `Sources/PosterCore/Resources/Fonts`, each with its licence.
