# Poster source library

PosterLab can index a folder of saved source photographs, propose poster surfaces and sub-elements, embed every extracted crop, record technique evidence, fit a procedural genome per surface, and train shared technique classifiers. This is local on macOS: Vision, Core Image, Core Text, Create ML and Core ML. Source images and Instagram sidecars are read without modification.

## Start or update the collection

```sh
./scripts/build.sh
./dist/poster library index --source output/instagram --library library
./dist/poster library inspect --library library
node scripts/library-server.mjs --library library --port 8766
# Open http://127.0.0.1:8766/review.html
```

Run `index` again after adding files. Completed images are cached by image content and analyzer configuration. Existing reviewed elements and fitted genomes survive metadata refreshes. Changed source files replace active index entries, while old derived records remain on disk. Exact duplicate image bytes are recorded as duplicate notices. Temporary download files and non-image files are ignored. The file inventory is a snapshot taken when the command starts; files added mid-run appear on the next run.

The native studio’s **Review library** workspace opens the catalog inside the app; its **Poster library** toolbar shortcut enters the same workspace. The HTML report is an additional portable review surface. Indexing and technique training are CLI actions; style judge retraining is also available in the main app. `--limit 8` gives a small first pass; `--no-words` omits word-level extraction when a lighter index is desired. Use consistent word settings for an existing catalog.

## What a record means

A source photograph can contain multiple posters, windows and display frames. Vision proposes up to four sufficiently large quadrilaterals; Core Image rectifies each one. **These are poster-surface proposals**, not guaranteed poster detections. A source with no reliable rectangle uses the full image and carries a warning. The original photograph, quadrilateral and detection confidence stay attached to each record so a bad surface is visible rather than silently trusted.

Each surface contains:

- Source content hash, account, Instagram post URL, caption and metadata file reference. Related carousel images share a post group.
- A revision-2 Vision visual feature print with explicit model, scalar type, dimension and preprocessing. Crop and poster prints share the same schema. These are learned **visual** embeddings; they are not text-aligned CLIP embeddings.
- OCR text lines and word boxes, parent relationships, crop images, rotations, recognition confidence and feature prints.
- Up to 16 non-text contour region proposals, with crops and embeddings. These are generic region proposals, not semantic object masks or original design layers. Tiny boxes are skipped and missed elements can be drawn in review.
- Tags with a state, confidence, evidence and origin. Repeated OCR strings and shifted boxes suggest text duplication/offsets. Similar disjoint region crops suggest shape replication. Luminance and chroma support operational contrast/monochrome labels.
- An editable layout genome: normalized element bounds, text, rotation, color, font/spacing, outline, shadow and replication operators. Every surface also has a retrieval prototype.

The taxonomy includes duplication, drop shadow, replication, offsets, extrusion, outline type, circular text, text on paths, stacking, grids, overlap, crop, gradients, halftone, texture, photography, collage, distortion, geometry and palette treatments. **Being in the taxonomy does not mean a technique was detected.** Tags without evidence remain unknown. A caption keyword is a weak hint. Drop shadows, offset outlines and repeated layers can look alike; they are not automatically asserted as established facts.

## Review and correct

In the main app, select **Review library** and choose your library folder. Drag numbered corners on the original photograph, zoom or use arrow keys to nudge a focused handle. Border drafts persist across poster selections. **Confirm & next** saves the correction and opens the next pending surface. In **Elements & styles**, click the image boxes to inspect a crop and review techniques or style labels. The HTML version remains available at `library/review.html`. Select a poster, click a box to inspect its element, and enable **Show words** for word-level boxes. Hover a technique’s evidence text for its reason. Each technique can be explicitly marked **Present**, **Absent** or left **Unknown**. Unselected techniques do not become negative training examples.

Use **Draw missing element** to add a region. Its crop and embedding are generated when edits are applied. **Reject this element** excludes a false proposal from future fitting/training. **Keep this annotation** queues the change. Export the JSON and apply it:

```sh
./dist/poster library apply --library library --input /absolute/path/review-edits.json
./dist/poster library report --library library
```

The **Poster detection to review** section displays the original photograph. Click **Reset points**, then mark top-left, top-right, bottom-right and bottom-left. **Keep four corners** queues the border; **Apply to library** on the local review server rectifies the original and re-extracts its elements. Convex clockwise borders are validated both in the browser and the CLI. You can zoom the original for precise pointing. Every unconfirmed surface remains in this queue, even when Vision gave a confident rectangle.

Border changes archive the old record, derived image, genome, prototype and fit before replacing active coordinates. Old element labels remain in that archive because they cannot be transferred safely across a new crop. A confirmed border survives incremental indexing. The street-panel proposal `9206c59ab729f838d5182dc0-p0-596724818ded` has been rejected as requested; its source record is waiting for your exact border.

The local server binds only to `127.0.0.1`; same-origin token checks protect the apply endpoint. Indexing and fitting release their writer lock between poster/source images so queued corrections can be applied while a scan runs. Source originals are served only from the indexed source root. An interrupted scan resumes its saved inventory; new downloads are picked up on the next completed scan.

Browser drafts are a convenience; exporting/applying is the durable dataset update. A crop’s coordinates use a top-left normalized origin on the rectified image. Reindexing leaves cached reviewed records intact. Confirmed text effects map to outline/shadow operators in the measured genome. Original source captions are data and are safely escaped in the report.

## Search

```sh
# Similar posters or element crops, with a known local image/crop
./dist/poster library search --library library --image library/posters/ID/poster.png --limit 12

# OCR/caption/tag search; lexical rather than text-to-image semantic search
./dist/poster library search --library library --query 'design'
./dist/poster library search --library library --tag text-duplication --posters-only
```

Embeddings from a different revision or preprocessing are rejected rather than compared silently. Visual nearest-neighbor search uses feature-vector Euclidean distance. A whole street photograph may match less accurately than an extracted poster or element crop.

## Semantic search with SigLIP

**Review library → Visual meaning** searches poster imagery using a description, even if its wording is absent from OCR, captions or technique tags. Enter an English description such as “dense experimental typography” or “minimal red and black geometric poster” and press Return or **Search**. **Words & tags** retains the existing literal filter. The current review section still applies; choose **Elements & styles** to include confirmed surfaces.

Prepare the optional Google `siglip-base-patch16-224` pack once:

```sh
python3.11 -m venv .build/siglip-venv
.build/siglip-venv/bin/pip install -r scripts/requirements-siglip.txt
.build/siglip-venv/bin/python scripts/prepare-siglip.py
./scripts/build.sh
./dist/poster library semantic-check --out output/siglip-verification.json
./dist/poster library semantic-index --library library
./dist/poster library semantic-search --library library \
  --query 'dense experimental typography' --limit 12 --out output/semantic-hits.json
```

In the app, **Index → Build or refresh search index** performs the same resumable indexing. **Stop** cancels between images; completed checkpoints remain saved. Search shows index coverage and excludes changed image files until refreshed. Model preparation downloads the pinned original Google weights and tokenizer, converts both encoders to FP16, and asserts PyTorch/Core ML cosine agreement above 0.999 on text and sampled poster inputs. Build dependencies are isolated from the dependency-free Swift package. Runtime search uses neither Python nor remote services.

The model pack is `models/siglip/` (about 400 MB). `build.sh` includes it in `dist/PosterLab.app/Contents/Resources/SigLIP` and `dist/SigLIP` when present. CLI commands also accept `--models /absolute/path/to/pack`; `POSTERLAB_SIGLIP_MODELS` overrides automatic discovery. The model card, revision, checksums, conversion report and provenance accompany the pack. The default source revision is `7fd15f0689c79d79e38b1c2e2e2370a7bf2761ed`; `--offline` rebuilds from the existing `.build/siglip-cache` download.

Image features are cached under `library/semantic-siglip/index.json`, independently of Vision feature prints, source reviews, trained heads and voting. Cache identity includes model hashes, a versioned preprocessing recipe and each image's SHA-256. A new model requires `semantic-index --force`. Incremental runs retain unchanged features, replace changed crops and exclude removed/rejected elements. Indexing checkpoints every 20 images and at completion or cancellation; an interrupted batch can repeat up to 19 images. Concurrent index writers fail visibly rather than overwrite one another. Each completed run also writes `index.bin`, a binary copy that loads in a fraction of the JSON decode time. It records the identity of the `index.json` it was written beside and is ignored once that file changes, so `index.json` stays authoritative. Searches skip rehashing unchanged images by comparing each file's device, inode, size and change time with those recorded at indexing.

Default indexing/search covers whole poster surfaces. Add `--include-elements` to both commands for element crops, or `--limit 100` to indexing for a small first run. `--tag` filters eligible records without requiring the description to match tags literally. Results include raw cosine similarity, model identity and indexed/eligible/missing counts. Similarity is prompt affinity, not a calibrated probability, aesthetic rating or verified historical-style label; no new judge ballot is added. This English-pretrained model accepts Unicode through original SentencePiece byte fallback, but non-English retrieval quality is not established.

The native tokenizer uses the original scored Unigram vocabulary and compiled normalization map, SigLIP lowercasing/punctuation handling, byte fallback, EOS and fixed 64-token padding. Descriptions longer than 63 content tokens are truncated. Native image preprocessing stretches upright sRGB images to 224×224 using Core Graphics high-quality interpolation, with pixel normalization inside the model. This resizing is explicitly versioned separately from Pillow's bicubic preprocessing; model-conversion parity checks use identical 224px inputs.

Compiled Core ML models are reused under `library/semantic-siglip/compiled/FINGERPRINT/` across launches. Text queries use the CPU to avoid GPU graph compilation overhead for short sequences; image indexing permits all compute units. Whole-poster queries read the compact active catalog rather than decoding every crop's Vision data. Four fresh-process CLI searches over this collection took 2.5–6.24 seconds in the final local trial, including loading, checksum verification and file validation; the app retains its model and query cache. Timing is machine- and load-dependent.

Run the real-model integration checks separately:

```sh
./.build/release/poster-checks --semantic-only
```

These check exact token IDs against the original tokenizer (including Unicode, punctuation, special tokens and long inputs), native image/text output agreement, real retrieval, cached resumption, crop invalidation, scope filtering and rejection of incompatible feature spaces. The ordinary checks remain usable without the optional pack.

## Color names, palettes and harmonies

```sh
# Backfill existing records; new imports and manual crops include this automatically
./dist/poster library colors --library library
./dist/poster library search --library library --query 'blue' --posters-only
./dist/poster library search --library library --query 'complementary'

# Compare generated alternatives without changing observed metadata
node geometry-bench/color-workshop.mjs library output/color-workshop
open output/color-workshop/report.html
```

Every poster and active sub-element stores an optional versioned `colors` profile in `record.json`. It includes up to six dominant measured swatches, normalized pixel proportions, nearest descriptive names and name distances, basic color families, hex/sRGB values, OKLCH lightness/chroma/hue, palette types, and candidate harmony scores. The review inspector shows the selected poster or element’s profile; its search includes color metadata. Rejected proposals are excluded from backfill, search and training.

Extraction uses a deterministic weighted k-means over a 64×64 sRGB thumbnail in perceptual OKLab. This describes photographed colors—including lighting, paper and background that remains inside an unconfirmed border—not original ink specifications. Antialiasing and small details can mix at this scale. Dominant proportions estimate pixel coverage, not semantic foreground/background roles. Neutral swatches have no hue; an achromatic poster is not classified as complementary simply because a numeric hue defaults to zero.

Names come from the bundled MIT [Meodai color-name-list](https://github.com/meodai/color-names), version 14.86.0. A nearest OKLab match preserves the measured hex separately from the named catalog hex. Names are descriptive labels, not calibrated color measurements. The bundled resource includes its license. No images or color queries are sent to an external naming API.

Palette types describe light/dark, muted/vivid, pastel, limited, neutral-supported, lightness contrast and warm/cool/mixed tendencies. Harmony suggestions compare dominant chromatic hue clusters against complementary, split-complementary, analogous, triadic, tetradic and square templates in **OKLCH**. These are geometric fits with explicit residuals, not probabilities or claims about the designer’s intent. Traditional RYB hue-wheel names can differ. A separate normalized 52-dimensional color histogram embedding supports later palette retrieval; it is distinct from the 768-dimensional Vision visual embedding.

The palette workshop exercises [Poline](https://github.com/meodai/poline), [RampenSau](https://github.com/meodai/rampensau), [FettePalette](https://github.com/meodai/fettepalette) and [pro-color-harmonies](https://github.com/meodai/pro-color-harmonies). It uses three measured poster palettes, 18 seeded proposals per tool/target over three rounds, and retains the previous winner in each round. Three Borda ballots assess source-color coverage in OKLab, best pair contrast and distinct-color fraction. These are engineering heuristics, not human aesthetic judgments. Generated palettes are stored separately in `output/color-workshop`; they never overwrite measured source colors. The comparison report describes the practical tradeoffs and pinned versions.

## Fit a genome per poster

```sh
./dist/poster library fit --library library --rounds 2 --count 4
./dist/poster library render --library library --poster ID --out variant.png \
  --seed 42 --variation 0.15 --title 'NEW WORDS'
```

Fitting searches font family, text scale and tracking against the source visual embedding, retaining the lowest-distance candidate each round. The default performs eight evaluations per surface. Scores are raw feature distances, not subjective design ratings. The measured layout, palette and element structure form the initial prior. `genome.json`, `fitted.png` and `fit-history.json` live next to each record.

A single photograph supports an approximate editable reconstruction and retrieval prototype. It does not establish a broadly trained generative neural model for that poster. Photographs, complex masks, custom letterforms and unresolved graphic regions remain placeholders in the vector reconstruction; low visual similarity is reported rather than hidden. New words replace the largest recognized text line. Variation moves elements slightly while preserving the genome’s structure. Edit the JSON for more deliberate changes to copies, offsets, outline and shadow flags.

## Train shared technique models

```sh
# Uses only explicit reviewed positives and negatives
./dist/poster library train --library library

# Experimental first pass using operational measurement labels for four tags
./dist/poster library train --library library --bootstrap
./dist/poster library predict --library library --image poster.png --scope poster
```

Each trained Core ML logistic head consumes a fixed 64-dimensional signed projection of frozen Vision image features. Poster and element heads are separate. Bootstrap labels are limited to monochrome, high contrast, dense recognized typography and recognized rotated text. Other tags require enough reviewed present/absent examples; sparse tags are skipped with a recorded reason. The element training sample uses at most 64 elements per poster, while the index retains all extracted elements.

Holdout groups combine Instagram post IDs and very similar poster feature prints before the deterministic 80/20 split. A crop and its poster stay together; carousels and detected near-duplicates do not cross the split. Both training classes and both holdout classes are required. Precision, recall and accuracy are recorded per head. Bootstrap metrics measure agreement with the detector-derived labels, **not human-verified technique accuracy**. Review, add independent examples and retrain before using them as trusted detectors.

Versioned model runs and training CSVs remain under `library/models/`; `library/training.json` points to the latest run’s model paths. No source images are uploaded and no remote model, API key or model download is required.

## Storage and checks

`library/library.json` is the active manifest. `posters/ID/record.json` includes element embeddings and provenance; `poster.jpg` (older records may use `poster.png`), element JPEGs, `prototype.json` and `genome.json` are sibling artifacts. Treat the library as a dataset to back up alongside the original source folder. `reviews/` retains applied edit JSON. Current manifests use absolute file URLs and are intended for this machine; moving a catalog requires path migration.

The release `poster-checks` executable also verifies weighted voting, zero-weight exclusion, normalized weights, seeded style recipes and perceptual color fixtures. It exercises indexing, hierarchy, embeddings, self retrieval, manual-region addition, label states, cache preservation, inverse fitting and report escaping in addition to the original generation checks. Numerical features and guesses are kept separate from confirmed annotations throughout the workflow.

## Codified compositions and source breeding

`poster library compositions --library library` backfills every source genome with `composition.json` and `composition.md`. New imports, manual review and fitting keep those files synchronized. The plan records normalized element regions, inferred reading order, alignment anchors, measured margins, hierarchy and uncertainty. OCR boxes remain proposals rather than recovered authoring layers.

`poster library breed` accepts `--directions editorial,optical` and optional `--mix 'Designer / Paul Rand=2'`. Each direction introduces two compatible source genomes per round, carries its strongest candidate forward without changing its pixels, and evaluates fresh crossovers. Semantic construction roles replace unrelated OCR rectangles: blockout, primary type, secondary type, then repetition/detail. Source traits influence palette, density, spacing and rhythm; the actual rendering layout is an explicit procedural grammar. Each candidate exports its real genome and composition rules. See `output/source-focused-v5/gallery.html` and `DESIGNER-JUDGES.md`.

Candidate exports also include typed feature prints. Source-study Reference is the mean `exp(-1.4 * distance)` affinity to the two current donors. Diversity is nearest-candidate distance divided by 0.8, capped at one. Both use the same saved decoded-PNG feature input. A pre-vote distance gate resamples proposals below 0.045. These are transparent visual measurements; the curator still judges whether the actual composition is worth keeping.

## Complete type-system scan

Source-element selection and subsequent collection enrichment also support SAM 2.1 masks, isolated Vision/SigLIP features and measured geometry. See [SOURCE-REGIONS.md](SOURCE-REGIONS.md). The separate relationship pass links repeated regions without rerunning the neural models. Automated tags remain unconfirmed, and reviewed positives/negatives and source borders are preserved.

The November 7 expansion indexes 1,103 image files as 1,130 proposed poster surfaces / 40,971 elements. The type-system scanner visits every indexed surface and retains per-poster coverage. Its refined catalog has 456 systems in 11 observed families, 42-dimensional descriptive method vectors and 768-dimensional native Vision element vectors. It links rules and technique tags back to source elements and genomes. Exact sequence fits, geometric proposals and visual annotations remain distinct.

See [TYPE-SYSTEMS.md](TYPE-SYSTEMS.md). The main app's interactive gallery shows editable studies without source crops. Manual border points, review states and negative technique labels survive indexing/tagging. Generated annotations are reconciled on later scans; explicit human reviews are preserved.

The November 8 [SigLIP follow-up](output/siglip-system-study-v1/index.html) scores the frozen 1,130-poster collection with sixteen type prompts and fourteen shape prompts. Three reviewed type rules extend the catalog to 459 records / 448 distinct browsing variants and 45D descriptors. Eleven near-repeat aliases preserve all source IDs and genomes. Separate source/probe SigLIP vectors support related-variant browsing. Eight editable shape interpretations are exported through `poster shapes`; source bounds and visual annotations remain proposals rather than fitted source reconstructions.
