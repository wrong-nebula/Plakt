# P.A.G.E.S. — multiple modular glyph constructions (v1, archived)

A vector specimen atlas after **Neo Neo’s 2023 P.A.G.E.S. book-fair design**. [Open the editor](../../../output/pages-atlas-study-v1/index.html) for the source comparison, three module sets, five-letter replacement, construction passes and SVG/PNG/JSON exports.

The source is a collage of different glyph constructions. This study preserves that contrast instead of treating it as one uniform display alphabet. The visible reference crop supplies the panel proportions, approximate placements and prominent P/a/g/E/S motifs.

| Construction | Rule |
| --- | --- |
| Contour P | Alternate ink and ground strokes along a serif-like centerline to make parallel bands |
| Organic g | Combine four closed shapes with an even-odd fill; overlapping regions become white lenses |
| Linked S | Place repeated modules along a shaped centerline; their overlaps add ink |
| Perforated E | Activate eighteen modules in a 7 × 9 alignment grid; seven horizontal modules carry tails |
| Folded P and A | Use offset faces, gradient planes and wire edges |
| Rail E | Distribute the glyph across separate straight or faceted rails |

Ordinary serif, heavy and condensed glyphs provide the surrounding typographic contrast. The primary organic contours, linked S centers, perforation logic, ribbed P, folded P/A and tall S are manually authored interpretations. Original production outlines and exact typefaces are not recovered.

Three module sets change the geometry while keeping the methods separate:

| Module set | Shape changes | Palette |
| --- | --- | --- |
| Disc constructions | Round nodes, smooth organic curves and contour bands | Mint / pine |
| Lozenge constructions | Comparable-area diamonds, faceted organic boundaries and beveled joins | Lavender / aubergine |
| Soft square constructions | Rounded square nodes, altered overlap lenses and round ribbon ends | Ice / burgundy |

Controls change module weight, contour-band count, perforation-tail length, fold depth and linked-node count. Band count is enabled only when the final grooves are visible. Outer ribbon weight stays constant as band count changes. The four passes are **components → overlaps → glyphs → atlas**. The second pass shows translucent components before exclusive-or knockouts appear.

Enter exactly five A–Z letters; dots and spaces are accepted and accents normalize to their base letters. Each position replaces its corresponding P, A, G, E or S throughout the sheet, using the appropriate case and construction. PAGES, SHAPE, FORMS and PAPER are supplied as probes. The newly extended letters follow the methods rather than claiming to reconstruct Neo Neo’s complete alphabet. Smaller specimens move into clear space when a replacement folded letter fills the lower-left panel.

The source’s small illustration is replaced by an open-book construction diagram. Historical exhibition metadata remains tied to 2023, while unreadable microcopy is replaced with construction labels. Photographic paper texture and folds are omitted. The crop’s continuing specimen grid remains partially visible at the bottom.

Supporting serif, condensed and heavy type uses vector outlines prepared from locally installed Times New Roman, Arial Narrow Bold and Arial Black. Provenance is recorded in `supporting-type.json`. Font binaries are not embedded; the output runs offline and does not need those fonts installed.

## Rebuild and verify

```sh
node geometry-bench/pages-atlas-system/v1/build.mjs
python3 geometry-bench/pages-atlas-system/v1/contact-sheets.py
node geometry-bench/pages-atlas-system/v1/verify.mjs
node geometry-bench/pages-atlas-system/v1/browser-check.mjs
```

Run `node geometry-bench/pages-atlas-system/v1/prepare-fonts.mjs` first only if supporting font assets need regeneration.

The output folder includes the standalone editor, thirteen SVG/PNG/JSON proofs, three live-construction strips, source provenance and hashes, and palette measurements. `comparison.png`, `module-systems.png`, `construction.png` and `text-transfer.png` show the results. SVG retains paths, even-odd knockouts, contour strokes and gradients. PNG exports are **2721 × 3000**. Saved JSON and URL state replay through the embedded `pages-atlas-v1` engine.

`validation.json` records same-machine Node/resvg checks: three distinct module sets under common colors, fifteen visible parameter changes, four construction passes, exact SVG/pixel/JSON replay, all A–Z letters through the methods, gradient references and export dimensions. Independent component rasters verify the actual exclusive-or knockout behavior in all three module sets. Source checks cover eighteen active E modules, seven tails and eighteen linked S nodes. Supporting outline bounds also verify repeated implicit SVG path commands. These checks do not score reconstruction accuracy.

`browser-validation.json` records isolated Chrome checks of five-letter replacement, punctuation normalization, control sliders, construction passes, variants, inversion, saved-rule/URL replay, SVG/PNG downloads, mobile width and offline behavior. Evidence is in `output/playwright/pages-atlas-system/`.

New vector interpretations, extension letters and module sets were created with AI assistance. Original source design remains credited to Neo Neo. Native archive records were not modified.
