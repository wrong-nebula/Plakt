# Letters from shapes

An isolated, editable vector workshop for the FUBU reference supplied on 8 November 2026. It contains six new construction rules and a curated list of ten complete posters from the local library, plus five linked published references.

Open [the workshop](../../output/experimental-letter-systems-v1/index.html). Select a system, change the letters and geometry, invert or recolor it, and save SVG, PNG or a portable JSON rule. The initial input is `FU/BU`; `TY/PE` proofs demonstrate reuse. The shared hand-authored 5 × 7 alphabet deliberately holds letter structure constant while the six shape rules change. A–Z, 0–9, spaces, hyphens, at most eight explicit rows and 36 characters are supported. Accented Latin input is decomposed to its base letters; other unsupported characters show an error.

| System | Construction | Exposed controls |
| --- | --- | --- |
| Scalloped boundaries | Unite occupied cells; add repeated discs along exposed boundaries, including counters | Lobe depth, lobes per edge |
| Capsule columns | Compress each uninterrupted vertical run into a capsule | End radius, seam width |
| Rotating counter tiles | Subtract a corner disc from a square and rotate the resulting tile | Counter cut, seam width |
| Perforated disc network | Join cell-centred discs along a neighbour graph; punch their centres after all overlaps | Disc radius, hole radius |
| Displaced slices | Intersect the complete letter with horizontal strips, then displace alternate strips | Strip count, displacement |
| Hinged rails | Replace graph edges with bent rails and diamond joints | Rail width, hinge offset |

Seed selects tile orientation, rail bends and starting figure/ground polarity. Some rules vary primarily through their geometric controls. No source is traced, and these rules are interpretations rather than recovered designer files. Poster captions use the same original bitmap alphabet, so exported lettering contains only vector geometry and has no font dependency. Reference images are complete local source posters with archived credits; they are research evidence, not generated artwork. No change is made to the native shape/type catalogs, source review records, taste labels or models.

Rebuild from the project root using the existing geometry-bench dependencies:

```sh
node geometry-bench/letter-shape-systems/build.mjs
python3 geometry-bench/letter-shape-systems/contact-sheets.py
node geometry-bench/letter-shape-systems/verify.mjs
node geometry-bench/letter-shape-systems/browser-check.mjs
```

`build.mjs` refreshes this experiment's outputs in `output/experimental-letter-systems-v1/`. It embeds the engine into a standalone HTML document; all controls and exports work offline. Referenced poster images live alongside it. Keep the directory together if moving it. URL parameters preserve the current rule on reload.

`posters/` contains six FUBU SVG/PNG/JSON studies and six TYPE transfer proofs. Default PNGs are 1400 × 2000; browser PNG exports rasterise the vector scene at 2100 × 3000. SVG uses a 700 × 1000 viewBox and retains all paths, masks and clipping regions. JSON presets store the explicit parameters; replay currently depends on this version of the engine.

`references.json` retains original IDs, complete archived captions, source URLs and source-image/record SHA-256 values. `semantic-modules.json` preserves the 70-result SigLIP shortlist from 1,128 indexed posters out of 1,130 eligible posters (two missing or stale embeddings), subsequently visually curated; affinity is not a confirmed construction label. The anchor was located independently in the existing source census. The attempted native image-similarity query failed before producing results and was not used for selection.

`validation.json` records same-machine Node/resvg checks: A/B/A SVG and pixel replay, portable-state replay, six distinct rendered systems, visible changes for all twelve controls, all supported letters and digits, finite geometry, invalid-input handling and raster dimensions. `browser-validation.json` records isolated Chrome checks of text and slider controls, rule save/reopen, SVG/PNG downloads, URL reload, narrow layout, distinct systems and offline operation. Browser captures and UI-authored exports are in `output/playwright/letter-shape-systems/`.

The code and visual interpretation were created with AI assistance. Source credits belong to the named designers. No publishing or licensing decision is implied.
