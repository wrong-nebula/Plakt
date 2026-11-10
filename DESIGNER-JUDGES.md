# Designer-affinity judges

The native app includes 27 designer profiles from 430 sampled real graphic works. Eighteen profiles use learned Core ML classifiers; nine use reference-centroid similarity because the available independent groups are too sparse for the training/validation/holdout requirements. This is a visual-affinity bank, not a neural generator trained to reproduce a designer, an authorship detector, or a calibrated aesthetic judge.

## Reference provenance

Creator, title, date, museum record and image credit/rights notes are retained in `output/designer-references/dataset.json` and the bundled profile manifest. Reference links appear under **Judging mix → Designer affinities → Reference works**. The source is [The Museum of Modern Art collection catalog](https://github.com/MuseumofModernArt/collection). Its CC0 license covers catalog metadata; artwork images have separate rights. The app bundle contains models and reference metadata, not the downloaded reference bitmaps. No museum or designer endorsement is implied.

The collector filters cataloged graphic/print/paper works with available images, prefers posters where there are at least twelve, then samples up to 24 works per designer across the available dates. This is a collection sample, not a comprehensive or balanced history of graphic design. David Carson and Neville Brody had no qualifying works in this catalog query and were not assigned invented trained heads.

## Training and validation

Frozen Apple Vision revision-2 features feed Create ML logistic classifiers. Each head compares two input representations: a normalized 64-dimensional signed projection, and full 768-dimensional Vision features plus a 52-dimensional measured-color embedding. Validation work groups select the representation by ROC AUC. Final holdout groups are not used for model selection.

Exact byte duplicates, shared work IDs, near-duplicates and same-title series stay in one partition. Co-credited work groups are excluded from the other credited designer’s negatives. Each learned head requires at least ten independent groups, eight training positives, two validation positives and two holdout positives, plus negative examples in every partition. Validation AUC below 0.70 uses reference similarity in voting.

Holdout positive sets are small (often two to four works). Ranking AUC can be high while precision/recall at probability 0.5 is low on this imbalanced task. All three metrics, split audit, training CSVs and models are preserved under `output/designer-judges-real-v2/`. These numbers do not validate aesthetic quality or independent historical style recognition.

| Designer | Real works | Voting basis | Holdout positives | Holdout ranking AUC |
| --- | ---: | --- | ---: | ---: |
| Otl Aicher | 24 | Learned vision-color820 | 4 | 0.90 |
| Saul Bass | 5 | Reference similarity | — | — |
| Herbert Bayer | 24 | Learned vision-color820 | 4 | 0.76 |
| Max Bill | 24 | Learned vision-color820 | 5 | 0.91 |
| A. M. Cassandre | 23 | Learned vision-color820 | 4 | 0.98 |
| Shigeo Fukuda | 4 | Reference similarity | — | — |
| Karl Gerstner | 4 | Reference similarity | — | — |
| Milton Glaser | 16 | Learned vision-color820 | 3 | 0.78 |
| April Greiman | 7 | Reference similarity | — | — |
| Armin Hofmann | 24 | Learned vision-color820 | 4 | 0.90 |
| Yusaku Kamekura | 7 | Reference similarity | — | — |
| El Lissitzky | 24 | Learned vision-color820 | 4 | 0.90 |
| Shin Matsunaga | 4 | Reference similarity | — | — |
| László Moholy-Nagy | 24 | Learned vision-color820 | 4 | 0.83 |
| Josef Müller-Brockmann | 24 | Learned vision64 | 4 | 0.83 |
| Paul Rand | 14 | Learned vision-color820 | 2 | 0.99 |
| Aleksandr Rodchenko | 24 | Learned vision-color820 | 4 | 1.00 |
| Emil Ruder | 1 | Reference similarity | — | — |
| Koichi Sato | 21 | Learned vision-color820 | 4 | 1.00 |
| Paula Scher | 18 | Learned vision-color820 | 3 | 0.95 |
| Ralph Schraivogel | 3 | Reference similarity | — | — |
| Ikko Tanaka | 15 | Learned vision-color820 | 2 | 0.68 |
| Niklaus Troxler | 15 | Learned vision64 | 3 | 0.81 |
| Jan Tschichold | 24 | Learned vision-color820 | 4 | 0.81 |
| Massimo Vignelli | 24 | Learned vision-color820 | 5 | 0.89 |
| Wolfgang Weingart | 8 | Reference similarity | — | — |
| Tadanori Yokoo | 24 | Learned vision-color820 | 4 | 0.99 |

## Generation and voting

The generator remains procedural: Core Graphics/Core Text interpret editable scene genomes. Designer presets route to several authored layout neighborhoods, such as geometric, grid, expressive or editorial compositions. That routing is explicit code in `StyleCatalog.generationWeights`; it is not claimed to be learned from a designer. Rendered candidates then receive the real-work affinity votes. The ten recipe-family heads and sixteen craft checks remain independently adjustable.

Borda votes rank candidates within a batch. Affinity, legibility, alignment and novelty answer different questions; their sliders allow deliberate tradeoffs. The source-study preflight protects metadata, copy completeness, natural type proportions, ink contrast and unintentional collisions. Repeated artistic glyphs can intentionally overlap.

## Reproduce locally

```sh
python3 scripts/moma-designer-catalog.py
node scripts/designer-download.mjs
./dist/poster designers train --dataset output/designer-references/dataset.json \
  --out models/designer-experiment
```

The first two commands download catalog data and museum images; the training command uses the local files. Normal app generation and judging remain local. Bundled version: `real-designer-affinity-v2`; models and reference manifest are in `Sources/PosterCore/Resources/DesignerJudges/`.
