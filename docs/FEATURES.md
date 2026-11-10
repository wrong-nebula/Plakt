# Plakt feature reference

Every feature in detail, in the order it was built. Plakt was developed as **PosterLab**; the app, the command (`poster`) and the paths below still use that name. Commands run from the repository root. Start with the [README](../README.md) and [Getting started](GETTING-STARTED.md).

A native Apple silicon poster workshop with fourteen procedural style families and a dense typographic mode inspired by the supplied Basel reference. Render populations as vector geometry, inspect the committee votes, and evolve selected parents. Includes a SwiftUI studio and a resumable CLI. All runtime work stays on your Mac; the base app needs no keys, subscriptions, Python installation, or model downloads. Optional SigLIP semantic search and SAM 2.1 region selection use separately prepared local model packs.

The isolated [Gradients edition](../workspaces/gradients/README.md#isolated-gradient-workspace) adds editable gradient fields and **Photo warp** for embedded photographs. Build and launch that edition from `workspaces/gradients` using its README.

LLM agents can drive PosterLab through the [agent edition](../workspaces/agent/README.md): 21 tools, served over MCP (`poster mcp`) or as JSON shell commands (`poster tool call`). Agents can create, read, edit, judge, rank and export posters.

## Run

macOS 15+, Apple Command Line Tools / Swift 6.0+. Apple silicon recommended.

```sh
./scripts/build.sh
open dist/PosterLab.app
```

Or run from source with the compiler caches inside the workspace:

```sh
CLANG_MODULE_CACHE_PATH="$PWD/.build/module-cache" \
SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.build/module-cache" \
swift run --disable-sandbox PosterStudio
```

To open straight into a workspace or sheet, for checks, screenshots or agents, pass launch arguments: `open dist/PosterLab.app --args -PosterLabWorkspace review` or `--args -PosterLabSheet tasteCheck`. Long jobs and sheets are explicit state machines; [STATE-MACHINES.md](../STATE-MACHINES.md) lists them, with the ones still implicit.

In the studio, edit the copy, set the seed and batch size, then **Generate study**. Inspect any poster to see raw judge scores and normalized votes. Mark parents with the plus button, then **Evolve picked**; with no manual picks, the top three become parents. Each action runs the requested number of rounds. Stop cancels between framework requests and preserves completed rounds. New sessions save under `~/Documents/PosterLab/`. **Open study** restores a `generation.json` at its original location. **Show files** reveals every image, contact sheet, and manifest. Export the selected poster as a 3508px PNG (about A4 at 300dpi) or an A4 vector PDF with outlined type.

## Batch workflow

```sh
# 36 evaluated posters, 3 rounds, fixed seed
./dist/poster generate --seed 2026 --count 12 --rounds 3 --out output/study

# Resume; human choices override automatic parent selection in the first new round
./dist/poster evolve --resume output/study/generation-2/generation.json \
  --pick g2-2026 --rounds 2

# Export the winner (or specify --pick with a candidate ID from the manifest)
./dist/poster render --resume output/study/generation-2/generation.json \
  --width 3508 --out output/print

# Custom wording and reference image
./dist/poster generate --title 'MATTER AND FORM' --subtitle 'Design Research' \
  --reference /absolute/path/reference.jpg --out output/matter

./dist/poster status
```

The example pick ID is illustrative: use an actual `id` from your manifest. Existing completed generations are never overwritten. The default photographed reference is cropped to the paper; a custom reference uses its full frame unless `--crop-reference` is passed. That switch uses fixed proportions for the supplied photo, not automatic perspective correction.

Each generation folder contains candidate PNGs, `contact-sheet.png`, and `generation.json` with all genomes, copy, parent IDs, settings, reference path, scores, ballots, and rank. Resume requires the original image/reference paths; moving a session between Macs is not currently supported. Artifacts are ordinary files and can be inspected without the app.

## Coin-toss construction experiment

A seed-specific coin toss assigns each candidate to **direct** or **staged** construction (roughly half each; deterministic, not cryptographic). Staged candidates first choose among six coarse geometric mass plans using a balance estimate. That choice fixes the layout **before any text is drawn**. The following passes add content into that same plan:

1. Large-shape blockout — primitives only, no letters.
2. Primary type — main headline and large letterforms; unresolved areas remain faint scaffolds.
3. Secondary type — orbits, badges, and supporting words.
4. Repetition and detail — trails, small marks, microcopy, header and footer.

Staged candidates save four previews and `blockout-plan.json` in `process-SEED/`. The inspector lets you select each pass. Direct candidates retain the original layout rule, with no blockout search. Final candidates from both groups enter the same voting committee. This is an exploratory comparison, not evidence that the staged method is better. Geometry estimates at the blockout step are heuristic; Core ML and Vision evaluate the finished images.

To render a particular pass manually:

```sh
./dist/poster render --resume output/study/generation-0/generation.json \
  --pick CANDIDATE_ID --stage blockout --width 1200 --out output/blockout
```

`--stage` changes the PNG; the companion PDF always exports the finished vector poster.

## How it works

1. **Procedural drawing:** Core Graphics and Core Text draw 12 motif families in an asymmetric poster grid: typographic orbits, tightly stacked headlines, huge counterforms, offset coin trails, capsule wordmarks, word staircases, geometric alphabets, and outlined initials. Text becomes paths for PDF export. A SplitMix64 seed controls layout, density, repetition, scale, distortion, and local inversions. One normalized design space preserves geometry across output sizes.
2. **Vision:** revision-2 image feature prints compare each composition to the cropped reference and to its peers; OCR measures the presence of readable text anchors. These are visual proxies and can favor artifacts. OCR is one vote, not a demand that every decorative glyph be legible.
3. **Core ML:** the bundled `CompositionPrior.mlmodel` is a small neural network with **authored heuristic weights**, not a pretrained aesthetic predictor. Eight measurements feed a ReLU projection and a weighted sigmoid. `MLComputeUnits.all` permits CPU/GPU/Neural Engine scheduling; it does **not guarantee** any particular processor is used. `--cpu-only` requests CPU execution. The model is deliberately small; Vision does most of the learned visual inference.
4. **Committee:** Composition, Reference, Typography, Rhythm, and Diversity each rank the population. Equal-weight Borda voting averages the normalized ranks; ties share their rank. The measures are correlated, not five independent AI agents. Consensus is relative to a batch, so use raw judge scores for cross-round comparisons. There is no promise of monotonic aesthetic improvement.
5. **Evolution:** preserve the strongest selected parent exactly, mutate the other offspring, and add one fresh seed. User picks determine the parent pool. Automatic rounds use the top three. Each generation has a separate render seed and records ancestry. Cancellation is checked before each render and after optional critique.
6. **Apple Intelligence (optional):** when compiled with a macOS 26 SDK, the Foundation Models adapter checks model availability before requesting a **text-only** critique of measured composition data and a sixth ballot. It does not see poster pixels. Requires macOS 26+, supported hardware/region/language and Apple Intelligence enabled. This Mac's macOS 15 SDK excludes that branch; it is not runtime-tested here. Invalid or unavailable responses are explicitly excluded and recorded in the manifest.

The reference is a user-supplied design cue. Its text is treated as visual content, never as executable instructions. The generator draws new layouts using editable copy and does not raster-trace the photographed poster. The original reference is bundled for this local project; no rights to redistribute that reference are asserted. App chrome uses native SwiftUI controls; posters intentionally stretch, crop, overlap, and repeat decorative typography. System fonts can change between OS versions, so same-machine reproducibility is the tested contract, not universal pixel identity.

## Development

No Swift package dependencies. The scoring model is already included. To rebuild it:

```sh
python3.11 -m venv .venv
.venv/bin/pip install coremltools==8.3.0
.venv/bin/python scripts/build_model.py
```

Weights and provenance are in `scripts/build_model.py`. Rebuild Swift after changing resources. Framework API references: [Vision feature prints](https://developer.apple.com/documentation/vision/vngenerateimagefeatureprintrequest), [Core ML compute units](https://developer.apple.com/documentation/coreml/mlcomputeunits), [Foundation Models availability](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel).

Optional **Visual meaning** search in **Review library** retrieves source posters from a description such as “dense experimental typography.” It uses Google SigLIP image/text encoders in native Swift/Core ML. Prepare the FP16 pack once with `scripts/prepare-siglip.py`, build the search index from the library's **Index** menu, then enter a description and press Return. The build script includes an available pack in the app and CLI distribution; search itself needs no Python or network. See [semantic search setup and validation](../LIBRARY.md#semantic-search-with-siglip).

Run the self-contained verification executable (this Command Line Tools installation has no XCTest). It checks repeatable renders, seed variation, mutation bounds, voting ties, invalid inputs, real Core ML + Vision inference, selected-parent evolution, resume, cancellation, overwrite protection, and PNG/PDF export:

```sh
CLANG_MODULE_CACHE_PATH="$PWD/.build/module-cache" \
SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.build/module-cache" \
swift run --disable-sandbox poster-checks
```

The checks run as named groups. Every group runs even when an earlier one fails, and a summary at the end lists what failed. `poster-checks --list` shows the groups, `--only jobs,agent` runs just those, `--skip taste` leaves one out, `--fail-fast` stops at the first failure, and `--all` adds the two groups that need a downloaded model pack (segmentation, semantic). The exit code is 1 when any group fails.

## Ink rules

Posters pick inks by rule, not by fixed value. `Sources/PosterCore/Library/InkRules.swift` ports the selectors of meodai's [design-book](https://meodai.github.io/design-book/tour/) to Swift, on the color math already in PosterCore (OKLab distance, OKLCH chroma and lightness, WCAG ratio).

| Rule | Picks |
| --- | --- |
| `closest(target, in:)` | the ink that looks most like the target |
| `furthestFrom(target, in:)` | the ink that looks least like it, within `maxDistance` |
| `bestContrastWith(targets, in:)` | the highest worst-case contrast over all targets |
| `minContrastWith(targets, in:, minContrast:)` | the quietest ink that still reaches the ratio |
| `mostVivid` / `leastVivid` | the ends of chroma, optionally inside a lightness band |
| `lightest` / `darkest` | the ends of lightness |
| `nth(ramp, i)` | by position; fractions are relative (0.5 = midtone) |
| `sibling(ink, in:, steps:)` | the next stop along a ramp, optionally `toward` another stop |

The rules that choose from a palette share one filter: `excluding:` skips members, and (except on the two contrast rules, which take their targets directly) `readableOn:` with `ratio:` keeps only members that reach the ratio on every listed ink. Ties go to the earlier member, so results are repeatable.

Two places use them. Type that crosses a shape of a similar color (`ShapeTypePlacement.declareContrast`) is redrawn in paper if paper reads there, else in the poster's own ink nearest the type's color that reads on every crossed ink; near-black and cream come in only when no palette ink reads. Source-layout posters (`SourceLayoutDNA.make`) set type in the source's own swatch when one reaches 4.5:1 on the ground, and take the most vivid readable swatch as the accent. `poster-checks --only colors` covers every rule and the overlap case.

The ratios are screen math: for Riso and letterpress, contrast should come from the simulated print in `workspaces/print`, which is not wired in yet.

## Agents

`poster mcp` serves PosterLab to LLM agents as an MCP server over stdio; `poster tool list`, `poster tool schema NAME` and `poster tool call NAME '{json}'` are the same tools from a shell. [.mcp.json](../.mcp.json) registers the server for agents started in this folder, and [AGENTS.md](../AGENTS.md) has the rules for making posters this way. Agent projects live in `output/agent`; the tools write nowhere else inside this folder except a new `output/<name>`. `zsh scripts/build-agent-studio.sh` builds `dist/PosterLab Agent.app`, a second copy of the Studio that agents can open posters in (`open_in_studio`); the main app ignores agents unless it is started with `POSTERLAB_ROOT` set.

## Rule-field letters

Select a poster in **Generate**, or a library poster in **Review library**, then press **Rule field** in the header. The sheet opens the rule-field editor with that poster's copy already set: the poster's image on the left, its copy as rule-field letters on the right, in any of the 26 styles. The poster itself is never changed; only its copy and a 900 px JPEG of its image go to the editor.

- **Where the copy comes from.** For a generated poster the title becomes the letters (one row per line), the subtitle the band title, and institution and footer the information lines; a slash inside a field turns into a middle dot, because a slash starts a new line. For a library poster it is the read text lines, largest first.
- **Copy that doesn't fit.** Copy longer than 40 characters, with more than six rows, or with a character the face lacks stays in the Letters field with the reason, and the letters keep the style's own text until you edit it. **Poster copy** brings the poster's copy back after you try other text.
- **Use the poster's colours** (under Ink) reads the poster image as six colour clusters: paper is the largest, rules the strongest contrast to paper, letters the most colourful contrasting cluster, accent the one farthest from both paper and rules.
- **Exports** each open a save panel: poster SVG, poster PNG (3000 px long edge), plotter SVG, ink separations (one new folder of SVG sheets), specimen SVG, poster PDF, and the rule as JSON, which **Open a saved rule** reopens. The PDF is the poster SVG printed to one vector page by WebKit. There is no video export.

The editor is the shared engine in `geometry-bench/rule-field-system`, built in app mode into one offline page, `Sources/PosterCore/Resources/RuleField/index.html`. It runs in a `WKWebView` with nonpersistent storage, navigation is limited to the bundled page, and it talks to the app through one message handler, `ruleField`. After changing the engine, run `zsh scripts/build-rule-field-editor.sh` (needs Node) and build the app again.

`poster-checks --only rule-field` checks that the page is bundled, still speaks the bridge and loads nothing from outside. `zsh scripts/rule-field-smoke.sh [poster.png] [output-folder]` runs the editor offscreen behind the app's own bridge and checks the copy, the poster colours, all 22 styles, copy that is too long and all seven exports. `open dist/PosterLab.app --args -PosterLabSheet ruleField` opens the sheet at launch.

## Effectors and modifiers

Select a poster in **Generate**, or a library poster in **Review library**, then press **Effectors** in the header. A generated poster is redrawn as a vector PDF in memory; a library poster contributes its fitted scene (the measured layout redrawn as vectors), not the photograph. Either is read back as outlines, and the sheet opens the effector editor on them. The poster itself is never changed.

- **Recipes** apply their effectors and modifiers to the poster. **Add the recipe's own elements too** lays the recipe's grids, rules or type over it; **Start again from the poster** returns to the poster with the Lens.
- **Elements, Effectors and Modifiers** stack in the side panel: add from each menu, turn items on and off, reorder, and point each at all elements or one. Every effector and modifier has its own field.
- **Outline modifiers** work on the poster's own shapes (Screen, Inline, Weight, Round, Outline); **cut modifiers** such as Tiles, Dial, Burst, Repeat and Shadow cut and copy them; **colour modifiers** repaint without moving anything.
- **More options** on a modifier's card hold what was added on 11 November: bend or cut **around each element** instead of the field centre, keep only the sideways or up-and-down part of a bend, re-roll one modifier's randomness, and per-modifier choices such as pleats for Fold, a cast shadow, tile gaps and turns, stem-only or bar-only Weight, a keyline Outline and halo rings for Inline. Left alone they change nothing. In the poster editor, Burst, Shear, Bend, Perspective, Envelope and Fold have **Each letter on its own**.
- **Groups** combine modifiers: chained, or with their displacements added or averaged. **Combos** drop a ready group onto the poster. Every card can be randomized or duplicated; **Undo** and **Redo** step through the whole stack.
- **Open PDF or SVG…** loads any outlined vector file instead. Library photographs are images and have no outlines.
- **Export**: SVG, vector PDF, PNG at 2000–4000 px, and the rule as JSON, each through a save panel. **Open a saved rule** reopens a JSON rule. There is no video export.

`PosterVectors` (in PosterCore) walks the PDF content stream with `CGPDFScanner`: fills keep their colour, fill rule and alpha, strokes become filled outlines, and what it cannot convert is reported by name. The editor is the shared engine in `geometry-bench/effector-system`, built in app mode into one offline page, `Sources/PosterCore/Resources/Effectors/index.html`. It runs in a `WKWebView` with nonpersistent storage and talks to the app through one message handler, `effectors`. After changing the engine, run `zsh scripts/build-effectors-editor.sh` (needs Node; it also rebuilds the study in `output/effector-study-v1`) and build the app again.

`poster-checks --only effectors` covers the PDF-to-outline conversion. `zsh scripts/effectors-smoke.sh [poster.pdf] [output-folder]` runs the editor offscreen behind the app's own bridge and checks the poster's arrival, 183 recipe and combination stacks, the group editor and the exports. `open dist/PosterLab.app --args -PosterLabSheet effectors` opens the sheet at launch. For an unattended check inside the app, start its binary with `POSTERLAB_EFFECTORS_SELFTEST` set to an output folder and `POSTERLAB_EFFECTORS_STUDY` to a saved `generation.json`.

## Glass objects

Press **Glass objects** in the header to open the glass window on the selected poster (a generated candidate, or a library poster in **Review library**). A source-study candidate has **Glass objects** among its actions, and an image-study candidate has **Glass**. Generated and study posters open on their preview at once, then switch to a vector PDF of the same design, so glass renders at print size.

- **Solids.** Add a sphere, cube, triangular prism or cylinder; up to eight can be visible together. Where solids overlap, the lower one in the list wins.
- **On the poster.** Drag a solid's handle to move it, ⌥-drag to tilt it, drag the dot on its ring or pinch to resize it, rotate two fingers to turn it. Arrow keys nudge; Delete removes. Each drag or gesture is one undo step.
- **Material.** IOR, roughness, dispersion, glass tint and tint absorption per object, or a preset (crown, flint, acrylic, water, diamond, frosted, smoked, amber). **Glass mode → Simple refraction** gives clear, basic distortion without lighting; **Physical glass** brings the material controls back.
- **Camera and light.** **Perspective** brings the camera closer so solids show their sides. **Studio lighting** sets what the glass reflects and the shadow it casts: Light studio, Poster colors or Dark studio, with **Paper shadows** and **Light spread**.
- **Compare and zoom.** **Glass · Split · Original**, and **Fit · 2× · 4×**.
- **Projects.** **Save project…** writes a portable `.glass.json` with the poster's pixels and the editable glass settings. The last scene is restored automatically from `~/Library/Application Support/<the app's identifier>/Autosave/`.
- **Export.** PNG at 1200, 2400, 3508 or 4096 px wide with Draft, Standard or High sampling. **Convert to vectors** traces the result into closed colour regions for **Export SVG…**, with no embedded raster image.

Shortcuts with the glass window in front: ⌥⌘1–4 add a solid, ⌘D duplicates, ⌘⌫ deletes, ⌘[ and ⌘] reorder, ⌘\ toggles the split, ⌘O and ⌘S open and save projects, ⇧⌘E exports. The Glass menu is disabled when another window is in front.

The renderer is an offline Metal compute shader (`Sources/PosterCore/Resources/Glass/Glass.metal`). It intersects closed solids and traces camera rays through their entry and exit surfaces to the poster, with Snell's law, Fresnel reflectance, total internal reflection, Beer–Lambert absorption, GGX roughness and separate refractive indices per colour for dispersion. Shadows come from a shadow map through the glass; rays are not bent there, so there are no caustics.

`poster-checks --only glass` needs Metal. It checks that an empty scene and IOR 1 leave the poster unchanged, that multi-pass renders are seamless and can be cancelled, shadows, the studio styles, all four solids, the optical controls, projects and vector conversion. Set `GLASS_PROOF_OUTPUT` to a folder to keep its proof images. `open dist/PosterLab.app --args -PosterLabOpenGlass YES` opens the glass window at launch.

## Optional SVG geometry workshop

The [geometry workshop](../geometry-bench/README.md) tests all 22 suggested path, typography, layout and animation packages, including Pave. It generates SVG posters, evolves four candidates per workflow over three generations, and judges every PNG using the same Apple committee through `poster judge-images`. This stays separate from the dependency-free native app. The completed local run and per-library pros/cons are in [the comparison report](../output/geometry-comparison-v2/COMPARISON.md); [the visual report](../output/geometry-comparison-v2/report.html) includes every workflow's iteration sheet.


## Source review and style judging

The main window now has **Generate** and **Review library** workspaces. The review queue shows original photographs with four draggable border handles, zoom, keyboard nudges and saved drafts. Confirming a border rectifies the source and re-extracts elements with an archived before-image. Click element boxes to review techniques and inspect named palettes and harmony suggestions. See [LIBRARY.md](../LIBRARY.md).

**Judging mix** groups fourteen style families, sixteen craft/image checks, and 27 designer-affinity profiles. Each slider controls its Borda weight; zero excludes a ballot. Designer presets supply compatible starting layout grammars and rank the rendered results with the selected affinity. The fourteen style-family heads are trained on 896 seeded recipe examples; their labels describe the authored grammars. Explicit present/absent source reviews can extend this training; unknown labels remain excluded.

The designer bank uses **430 credited real graphic works from The Museum of Modern Art**: eighteen validated learned heads and nine reference-similarity profiles. Each profile exposes reference links, work counts, model basis and held-out ranking metrics inside the app. These models measure affinity to a collection sample; craft judges evaluate information and layout separately. See [designer training and validation](../DESIGNER-JUDGES.md).

```sh
./dist/poster styles train --out models/styles --seeds 64 --library library
./dist/poster generate --out output/rand --seed 71 --count 8 --rounds 2 \
  --mix 'Designer / Paul Rand=3,Legibility=2,Spacing=2,Type integrity=1,Copy completeness=1'
./dist/poster designers train --dataset output/designer-references/dataset.json \
  --out models/designers

# Two compatible source genomes, then two new donors in each of five rounds
./dist/poster library breed --library library --out output/new-source-study \
  --rounds 5 --count 16 --seed 20261113 --directions editorial,typographic-collage,optical
```

Every source genome and generated source-study candidate has a codified composition: normalized regions, semantic roles, font treatment, reading/drawing order, alignment anchors, margins and constraints, exported as JSON and readable Markdown. Source layouts are measured proposals; generated layouts contain declared rules. Natural text proportions and minimum metadata sizes are checked before source-study rendering.

`output/source-focused-v5/` contains 240 candidates, fifteen rounds, four construction passes per round winner, and three PNG/vector-PDF exports. Each direction introduces ten distinct source donors. The editorial V/C interlock was selected after full-size visual review; [the curation record](../output/source-focused-v5/curation.json) preserves the reasons and limitations. [The gallery](../output/source-focused-v5/gallery.html) retains every candidate, ballot and source pair. The earlier 600-candidate strict study and older experiments remain available for comparison; an automatic committee winner is not automatically a curator-approved poster.

Palette-generator experiments live under `output/color-workshop/` with all 216 proposals and practical tradeoffs.

Native polish follows [Emil Kowalski's design-engineering skill](https://emilkowal.ski/skill); see [UI-POLISH.md](../UI-POLISH.md) for the applied changes.

## Stricter source evolution

Source studies reject near-duplicate proposals before voting (minimum 0.045 Euclidean distance between revision-2 scaleFit Vision prints). One exact elite is retained; at least a third of initial offspring are fresh layouts. Rejected proposals are counted in each round and shown in the native source inspector. Candidate `-embedding.json` files preserve the typed feature inputs.

Reference votes now compare the two current donor sources, rather than the original Basel photograph. Reference and Diversity use one persisted feature print extracted from the decoded candidate PNG. The authored Basel-specific Composition prior has zero weight in the default source-study mix. It remains available as an explicitly selectable judge. This makes the comparison coherent; it does not turn affinity into a measure of aesthetic quality.

The vector vocabulary includes declared strip clipping, sinusoidally displaced natural letterforms, and modular quarter-disc/annular counterforms. Every mask is stored in the genome and its composition plan. Any candidate scene can be reproduced at print resolution:

```sh
./dist/poster scene render --genome output/source-reference-v7/typographic-collage/winner.json \
  --out output/my-print --width 3508
```

This writes a PNG, outlined vector PDF, exact genome, composition JSON/Markdown and reproduction parameters. `--stage` changes the PNG construction pass; the PDF remains the finished design. Existing exports are protected from overwrite.

The final canonical study is `output/source-canonical-v8/`: 240 candidate slots, fifteen rounds, and a saved **Curator pick** that opens directly in the native source-study inspector. The selected counterform poster is exported under `output/curated/counterforms-v8/`. Its selection remains separate from the final round’s automatic winner. The complete output audit and visual critique are linked from that study’s `COMPLETION-AUDIT.md`.

## Source studies: reference, modifiers, live stage and editor

**Start-from-image logic.** A source study now composes the way an image study does. Each direction's own forms are rendered once and measured like a photograph (palette, texture, attention, calm space). Every candidate then takes a new donor pair, composes the inherited display type around those forms as one cluster at a size set by the calm space, and puts the information type in a calm island. Display lines may not pile into each other or disappear into a form of their own colour, and a headline too faint to carry the poster is proposed again. About a third of proposals echo the title on purpose.

**The judging reference steers the study.** With a reference you chose (not the bundled placeholder):

- **Scoring:** the Reference judge measures each candidate's visual and palette similarity to your image, at weight 1.5. Without a reference it measures resemblance to the donors and has no weight.
- **Donors:** library posters that already look and colour like the reference lead, with less random spread.
- **Colours:** paper is the reference's dominant colour, ink its highest-contrast colour, accent its strongest hue that differs clearly from the paper.

**Use modifiers** (a toggle under Generate from library): about half the proposals run their display type through one or two effector modifiers, headless, so the jury weighs modified against plain type. Modified type is kept only if text recognition still reads at least three quarters of the display words. Information type, forms and paper are never modified.

```sh
./dist/poster library breed --library library --out output/my-study --rounds 5 --count 8 \
  --reference image.jpg [--crop-reference true] [--modifiers true]
```

**Live stage.** While a study runs, the window shows it: candidates draw in one by one, the jury's scores fill, the ranking settles and the winner carries into the next round. A finished study ends on its **winners**, large; the round-by-round results stay one step away.

**Poster editor.** Click a winner to edit it over the whole window:

- select an element to move, scale or rotate it;
- place modifiers as circles on the poster, with the type staying live;
- browse type systems and shape systems as small previews drawn with the poster's own headline and colours, apply one with a click, then tune it;
- **Tweak** varies the selection a dozen ways behind the scenes and lets the jury rank them; in about half the versions the rest of the poster responds too. ← → compare, Return keeps, Esc reverts.

The editor exports PNG and PDF. **Start from image** has a simpler layout, and the whole app has a light and a dark look (Settings, or the View menu); dark is the default.

Launch arguments for checks, all read from the launch only: `-PosterLabLiveReplay STUDY` replays a saved source study on the live stage (with `-PosterLabLiveSnapshots FOLDER` it writes frames and quits); `-PosterLabWinners STUDY` opens a study on its winners; `-PosterLabEditorStudy STUDY -PosterLabEditorSnapshot out.png` opens the first winner in the editor, runs a Tweak, writes a picture and quits; `-PosterLabImageStartSnapshot out.png` does the same for Start from image; `-PosterLabLibrary`, `-PosterLabReference`, `-PosterLabBrief`, `-PosterLabModifiers YES` and `-PosterLabStartSourceStudy YES` start a study at launch.

The headless modifier pass runs `Sources/PosterCore/Resources/Effectors/effectors-engine.js`, the same engine as the Effectors sheet; `zsh scripts/build-effectors-editor.sh` regenerates both.

## Pre-render filter for source studies

A source study normally builds one genome per candidate slot and renders it. With the pre-render filter it builds up to eight per slot and renders only the one a small model of the jury ranks highest. Judging is unchanged, and the filter is off unless you turn it on:

- **App:** the **Pre-render filter** stepper just above **Generate from library** (off, or best of 2–8).
- **Command:** `poster library breed … --prefilter 4`.

Proposal 0 is the unfiltered proposal, so a filter of 1 changes nothing. Each round's `round.json` records the model version and every proposal's score under `surrogate`.

The model (`JurySurrogate`, `Sources/PosterCore/Resources/JurySurrogate.json`) is a LightGBM LambdaRank ranker trained on stored rounds and evaluated in Swift. It reads only the genome: 66 features such as element counts, areas, margins, contrast and font. Scores are relative; compare proposals within one slot or round, never across studies.

What is known about it: with whole studies held out, on 1,625 stored rounds, it ranks a round's candidates with a Spearman correlation of 0.71 against the jury, picks the jury's winner 72% of the time, and has the winner in its top half 94% of the time (chance: 50%). That measures agreement with the jury that judged those stored rounds, which was an older version of the judges and taste jurors. Whether filtering makes today's studies better has not been measured in this repository; `compare.py` is the tool for that. The stored rounds also predate the start-from-image logic above, so the model has not seen genomes composed that way.

The training pipeline is in `scripts/jury-surrogate` (Python with `lightgbm` and `numpy`):

```sh
cd scripts/jury-surrogate
python extract.py                       # data.jsonl from every stored round.json
python train.py                         # held-out scores, then surrogate-rank.txt
python export.py jury-surrogate-lambdarank-v2   # writes the JSON the app bundles
python parity.py ROUND.json > python-scores.jsonl   # compare with: poster library surrogate-score --input ROUND.json
python compare.py RUN_OFF RUN_ON        # two runs that differ only in --prefilter
```

`retrain.py` mixes in live rounds judged by the current jury. The Swift feature code mirrors `extract.py`; change both together. `poster-checks --only surrogate` checks that the model loads and that pinned scores hold; update the pins in `SurrogateChecks.swift` after exporting a new model.

## Source-study finalists

A source study keeps one champion per direction, and its last-round winner becomes `winner.png`. The **Finalists** tab next to rounds 1–5 in **View source study** puts every distinct round winner of a direction side by side so the final choice is yours. A champion that kept winning appears once, as **Won rounds 2, 3, 4**.

Select a poster and press **Pick as winner**. The committee's order and the automatic winner stay hidden until you pick, so the choice isn't anchored; **Show committee order** reveals them early. Picking records a yes vote in your taste profile. **Yes** and **No** vote on any finalist without picking it, and finalists you pass over get no vote.

The pick is saved as `final.json` in the direction's folder. Round files, `winner.png`, `winner.pdf` and `winner.json` are never changed, and a saved pick is dropped if that poster's PNG is later replaced. Finalists are rebuilt from the saved rounds each time, so every existing study works without being re-run.

```sh
./dist/poster finalists --study output/source-compositions-v13
./dist/poster finalists --study output/source-compositions-v13 --direction optical --pick optical-r0-c6
./dist/poster finalists --study output/source-compositions-v13 --direction optical --clear-pick
```

The command lists each direction's finalists in committee order and marks the last-round winner and your pick. `--pick` and `--clear-pick` write `final.json` only; taste votes are cast from the app or with `poster taste vote`.

## Fourteen-style spectrum

`output/source-style-spectrum-v10/` completed **560 candidates / 70 rounds / 14 directions**, with ten distinct donor genomes introduced per direction. The independent audit verified zero duplicate candidate PNGs within a batch, exactly preserved elites, frozen-feature reference/novelty scores, and 100 resampled near-clones. All 57 image, craft, style and designer-affinity scores are retained; only positive-weight complete ballots vote.

The four new authored families are kinetic headline typography, overprinted organic color fields, tonal vector halftones and serif guilloche compositions. The bank now has fourteen recipe heads trained on 896 examples, separately from the real-work designer-affinity models. Recipe holdout agreement is not historical-style or aesthetic validation.

After contact-sheet and full-size comparison with actual library donors, three results were kept: **Tonal halftone**, **Kinetic type**, and **Serif & guilloche**. The app’s **Curator picks** menu opens each one; its Direction menu contains all fourteen studies. Print exports, exact scenes and measured named palettes are under `output/curated/{halftone,kinetic,guilloche}-v10/`.

Source studies now use the copy, seed and candidate count entered in the app. They run five rounds per style, with 4–16 candidates per round. CLI source breeding also honors `--title`. Exporting a scene writes `colors.json` alongside the PNG, outlined PDF and composition rules.

## Editable content, fonts and type systems

The studio now starts with **22 inspired concept briefs**: exhibitions, concerts, literature, cinema and design programmes with real locations. Eight draw inspiration from the poster library. Titles, dates and programmes are newly authored; the app labels them as concepts and stores the original reference separately. Choose a brief, mix a different one per study direction, or edit every field.

**Browse Google Fonts…** offers 20 OFL families and 110 weight/width/slant profiles. Exact assets, checksums, variation axes, licenses and descriptive/native specimen embeddings are retained. Fonts register only inside the app process. Extend the pinned collection with `scripts/fetch-google-fonts.py --family …` and rebuild its index.

**Explore type systems…** opens the interactive gallery: edit text, font, moving grapheme/direction, row count, pitch, tracking, scale, angle and colors. **Frames** switches between the fitted second drawing and the frames as measured on the source poster, and **Minimum type size** grows undersized type in place; both off is the source look. Follow each step, save/open variations, or reuse the rule in new poster compositions. Source crops are not shown. See [TYPE-SYSTEMS.md](../TYPE-SYSTEMS.md) for coverage, evidence distinctions and CLI commands.

The [SigLIP systems study](../output/siglip-system-study-v1/index.html) adds three reviewed type rules and eight separate editable shape interpretations from two passes over all 1,130 posters. The type catalog retains 459 source records and shows 448 distinct variants after grouping eleven near repeats. Related variants now combine operator descriptors with neutral SigLIP specimens.

**Select region…** in the source review adds native SAM 2.1 point/box selection. The collection pipeline combines its masks with Vision appearance features, SigLIP meaning and measured ink geometry to propose tags and systems. [SOURCE-REGIONS.md](../SOURCE-REGIONS.md) covers selection, metadata, combined retrieval and review protection; the [region study](../output/multimodal-study-v1/index.html) contains inspectable results.

The [SAM shape review](../output/sam-shape-expansion-v1/index.html) adds six editable vector families, taking the library to **45 recipes / 14 source-linked shape systems**. It includes source masks, parameter variations, complete-layout tests and a separate verified SAM Shapes app preview.

The latest full concept-content run is `output/source-compositions-v13`: 560 candidates, 14 directions, five rounds each. Its `selected.html` and native **Curator picks** menu show three visual selections; 3508px PNG, vector PDF, named palette and editable scene exports are under `output/curated/{optical,guilloche,typographic-collage}-v13`. These are newly authored concept events at real venues. Briefs are grouped by event category rather than by source provenance.

## Kerning

Press **Kerning** in the header to proof any line in any font, or **Open scene…** there to load a poster: a source-study candidate, a saved `genome.json` or a type-system variation. In a source study, select a candidate and press **Kern this poster…**.

**What was wrong before.** Scenes set each line with Core Text's kern attribute carrying the tracking. Core Text reads a kern of exactly 0 as "no kerning", so every line with a tracking of 0 (most of them) was set without the font's own pairs.

**New posters are kerned optically**, poster-wide: source studies, the shape library, type systems, dominant shapes, paper relief, fallen letters and image starts. The setting is stored in the scene (`StyleGenome.kerning`), so exports and saved scenes replay it. Scenes saved before this have no poster-wide setting and still draw exactly as they always did; the sheet labels their lines **Original**, and such a line is kerned only once you change it. A line's own settings override the poster's.

| Mode | What it does |
| --- | --- |
| **Metrics** | The font's own pairs, as its designer kerned it |
| **Optical** | Pairs measured from the outlines, so the white between letters evens out |
| **None** | Plain advances, no pairs |

Optical slices each letter into 240 horizontal bands and measures the white between a pair in the zone both letters share, then moves the pair 44% of the way toward the white of an even pair in the same font (HH HO OO OH for capitals, nn no oo on otherwise). The constants were fitted to the kerning of seven fonts over 82 pairs; optical lands within about 13/1000 em of the designers' values on average. **Strength** scales the correction, **Tightness** adds to every pair, and **Keep letters apart** sets a minimum gap (default 12/1000 em).

Your own kerning, in thousandths of an em:

- **Gaps.** Click a gap in the proof, or press → to start, then ⌥← ⌥→ to kern by 10 (⇧⌥ by 50). A gap value belongs to that line's text and is ignored if the text changes.
- **Pairs.** Tick **Every AV** to kern a pair everywhere it occurs.
- **Tracking and word space** are separate sliders. **Use these settings on every line** copies everything but the gaps.
- **Font tables.** **Save pairs as … table** writes your pairs for that font to `kerning/<PostScript name>.json` beside `taste/`, that is next to the library the app works in (without a library: `Documents/PosterLab/Kerning`). A scene copies the pairs it uses, so editing a table later never changes a saved poster. `scripts/backup-data.sh` includes these tables.

Exports from the sheet: the kerned scene (in the type it was opened as), a 3508 px PNG, a vector PDF with outlined type, and a proof PNG that sets the line as None / Metrics / Optical / This line.

```sh
./dist/poster kerning proof --font HelveticaNeue-Bold --text 'AVATAR WAVY' --out output/my-proof
./dist/poster kerning scene --genome output/curated/guilloche-v13/genome.json \
  --mode optical --out output/my-kerned [--strength 1] [--tightness -10] [--pairs AV=-30,To=-20] [--tables kerning]
```

`kerning scene` writes before and after PNGs, an outlined PDF, the kerned scene and `kerning.json`. Neither command overwrites existing output. `poster-checks --only kerning` covers the modes, the controls, settings round trips, unchanged saved scenes and the optical default. `open dist/PosterLab.app --args -PosterLabSheet kerning -PosterLabKerningScene genome.json` opens the sheet on a scene; adding `-PosterLabKerningSnapshot /path/prefix` makes the sheet write PNGs of itself.

Limits: left-to-right text only. Kerning applies to scene text. The procedural **Generate** renderer and the shape systems that draw their own lettering (survey type, contours, orbit wrap, circle pack) keep their own setting, and lines owned by physics or paper relief are left out of the sheet's line list.

## Your own taste jury

**Taste check** in the main header lets you rate generated posters **Yes / No / Skip**, undo a decision, revisit votes and create separate weighted profiles. The three favourites shared in this conversation seed Personal taste. Only explicit yes/no votes train the local Create ML / Core ML classifier; it starts voting with at least three of each. Add the profile to the craft/style committee or choose **Use only my taste jury**. Model versions and weights are frozen in each generated study. See [USER-TASTE.md](../USER-TASTE.md).

The first personal-jury study is `output/source-personal-jury-v17/gallery.html`: 280 candidates, fourteen directions and five rounds, ranked only by a frozen 94-vote taste model. The gallery can filter all candidates by direction and round; it does not display source crops. Its model snapshots, vote membership and diversity checks are independently audited alongside the output.

`poster taste calibrate` measures how well stored committee rankings agree with your votes. It replays rounds under other weights, so jury changes can be tested before a new study. See [checking the jury](../USER-TASTE.md#checking-the-jury-against-your-votes).

## Physics: fallen letters

PosterLab includes a deterministic 2D rigid-body engine with no dependencies. Letters collide by their real outlines (counters and crooks stay open), with friction, bounce, pins and resting stacks. **Fallen letters** in the Shape library (group Physics) turns the title's glyphs into rigid bodies in six arrangements: a collapsing headline, a poured heap, a nailed sign losing nails, stairs, a sagging garland of linked letters, and a balance beam. Glass letters can shatter on hard landings into Voronoi shards, drawn as the real outline clipped to each piece. Each poster renders as solid, outline, cast-shadow or neon vector type. Empty sockets and motion exposures are optional. A "moment" control catches letters mid-fall. Poses are stored in the scene, so PNG and vector PDF exports replay exactly.

```sh
./dist/poster shape-library render --id fallen-letters --text 'LET IT\nFALL' --out output/fall
./dist/poster physics loosen --scene output/curated/kinetic-v10/genome.json --set detach=0.5 --out output/kinetic-loose
./dist/poster physics animate --id fallen-letters --seconds 4 --out output/fall-gif
```

`physics loosen` releases the headline of any saved scene genome, starting from exactly where the renderer drew it. Other text acts as obstacles, and `physics restore` undoes it. See [PHYSICS.md](../PHYSICS.md) for the engine, controls and limits.
