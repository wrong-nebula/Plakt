# State machines

PosterLab has many state machines that were never written down as states: a `busy` flag and a task handle that had to change together, six sheet flags of which only one may be true, review statuses stored as free text. This file lists every one found in the native app (`Sources/`), what its states are, and whether it is now explicit.

Two of them carried real bugs and now have explicit types:

| Machine | Where | Now |
| --- | --- | --- |
| Job lifecycle | `JobLifecycle` (PosterCore), `JobRunner` (Studio) | **Explicit.** Studio rounds, source studies, style training, exports; image analysis, image studies, image exports |
| Studio sheets | `StudioSheet` (Studio) | **Explicit.** One value for the seven sheets of the main window |

## How to drive and check them

Open the app in any workspace and sheet:

```sh
open dist/PosterLab.app --args -PosterLabWorkspace review
open dist/PosterLab.app --args -PosterLabSheet tasteCheck
```

Sheet names: `imageStart`, `ruleField`, `effectors`, `kerning`, `shapeLibrary`, `tasteCheck`, `typeSystems`, `fontLibrary`, `sourceStudy` (opens the newest saved source study). The arguments are read from the launch only and never saved, so the next normal launch opens as usual. An unknown name shows an alert that lists the valid ones.

Check the job transitions without building the app:

```sh
swift run --disable-sandbox poster-checks --jobs-only
```

The full `poster-checks` run includes the same group.

## Job lifecycle

Every long-running job in the studio follows the same path:

```
idle ──begin──▶ running ──stop──▶ stopping
  ▲                │                  │
  └──── finish ────┴───── finish ─────┘
```

| Rule | Why |
| --- | --- |
| `begin` only from idle | one job at a time; a second Generate or Export is ignored |
| `stop` only for a running job that is stoppable | Stop is hidden for exports, which can't be interrupted |
| progress only while running | a late progress message can't overwrite "Stopping…" or the finished result |
| `finish` always runs when the job's body returns | the app can't stay busy after a job ends early |

| Job | Model | Stoppable | Stopped status |
| --- | --- | --- | --- |
| `rounds` | Studio | yes | Stopped · completed rounds are saved |
| `source-study` | Studio | yes | Source study stopped · completed rounds remain saved. |
| `style-training` | Studio | yes | Style training stopped · the current judges stay in use. |
| `export` | Studio, Image start | no | — |
| `image-analysis` | Image start | yes | Image analysis stopped |
| `image-study` | Image start | yes | Stopped · completed rounds remain saved in … |

`JobLifecycle` is a value type in PosterCore so `poster-checks` can walk its table. `JobRunner` holds it with the job's `Task`, and is the only place either changes. Each model keeps `busy` as `jobs.busy`, so views read the same property as before. `JobStopButton` shows Stop only for stoppable jobs and reads **Stopping…** (disabled) after a press.

What changed for you:

- **Stop no longer appears during PNG and PDF exports**, in the studio or in Image start. Before, it showed, did nothing, and changed the status to "Stopping after the current analysis…" until the export finished anyway.
- **Stopping style training no longer shows an error alert.** It used to report the cancellation as a failure.
- **"Stopping…" stays visible.** Source and image studies report progress from a background actor; those messages used to replace the stopping status, so it looked as if Stop had been ignored.
- **Pressing Stop twice does nothing the second time**, and the button says Stopping… meanwhile.
- **Image exports say what they are doing** ("Exporting PDF…") instead of keeping the previous status.

## Studio sheets

The main window presents one sheet at a time: Start from image, Source study, Google Fonts, Type systems, Shape library, Taste check, Rule field, Effectors or Kerning. Each of the first six used to have its own flag (`showImageStart`, `showSourceStudy`, …). SwiftUI shows a single sheet per view, so two flags set together silently lost one sheet.

Now `StudioModel.sheet: StudioSheet?` is the one source of truth, with a single `.sheet(item:)` and a `switch`.

- **A source study can't open empty.** `.sourceStudy(URL)` carries its folder. Before, "View source study" re-scanned the output folder and could show a blank sheet with no Done button when the study had been moved or deleted; now it says so in the status bar instead.
- **A finished source study doesn't interrupt you.** When rounds finish while another sheet is open (Taste check, say), the result waits behind **View source study** instead of fighting the open sheet.
- **Votes from any sheet reach the jury.** The taste jury used to refresh only after Taste check itself. Ratings made through **Rate…** in Image start or **Rate for my taste…** in a source study now count as soon as that sheet closes.
- The workspace switch (Generate / Review library) is a `StudioWorkspace` value instead of a `Bool`.

## Still implicit

These work today. They are listed so they don't grow new flags, with the change each would take.

### Poster review status (stored)

`PosterRecord.reviewStatus` is a free-text string in every `library/posters/*/record.json`:

```
surface-and-elements-need-review ──Confirm & next──▶ surface-confirmed; elements-need-review
        │
        └──Save technique review──▶ tags-reviewed; surface proposal unchanged
```

On 9 Nov 2026 the library held 1,127 posters in the first state and 3 in the second. Readers test `hasPrefix("surface-confirmed")` (review queue, pending count, semantic search scope, the review engine, `LibraryChecks`) and `!= "rejected"` (survey, image-start and type-placement source filters), though nothing writes `rejected` for a whole poster.

Next step: a `RawRepresentable` `ReviewStatus` that decodes every string above unchanged, with `isSurfaceConfirmed` and `isRejected` replacing the prefix tests. This touches PosterCore files other sessions are editing, so it should land as its own change.

### Element review status and tag state (stored)

| Field | Values on disk | Written by |
| --- | --- | --- |
| `PosterElement.reviewStatus` | `unreviewed` 37,339 · `proposal` 3,657 · `rejected` 1 · `reviewed` (after edits) | `LibraryAnalyzer`, `PosterLibraryEngine.apply` |
| `TechniqueTag.state` | `detected` · `suggested` · `confirmed` · `rejected` | analyzer, SAM/SigLIP enrichment, type-system fit, review |
| `TechniqueTag.origin` | `review` · `sam-siglip-vision-v1` · `type-system-fit` · `OCR` · `measurement` · `caption` | same |

A tag moves `suggested`/`detected` → `confirmed`/`rejected` only through review; enrichment never overwrites a reviewed tag. The same typed-enum change applies, keeping the strings as raw values.

### Library review (`LibraryReviewModel`)

- **Library load and review saves:** `busy` guards `load` and `apply`. Neither can stop. Could use `JobRunner` for consistency.
- **Visual-meaning search:** six properties (`semanticBusy`, `semanticTask`, `semanticRequestID`, `semanticMessage`, `semanticHits`, `semanticHasResults`) encode idle → indexing → searching → results / failed / stopped. A request token already drops stale results correctly. Collapsing them into one enum would make the states readable at a glance.
- **Region analysis** of the selected poster loads in the background with no loading state shown.
- **Border drafts:** unsaved corner edits per poster, kept in `posterlab-border-drafts` until confirmed or reset.

### Region selection (`RegionSelectionModel`)

Marks → mask alternatives → measured region → related regions → saved. `busy`, `saving`, `selection`, `maskID`, `region`, `searchedRegions` and a request token together encode it; the token cancels stale predictions correctly.

### Taste check (`TasteCheckModel`)

Deck ↔ reviewing a past vote (`review`), a `busy` guard through `run`, and a 200 ms debounced weight write (`pendingWeight`) flushed before every action and on Done.

### Smaller ones

- **Live previews** in Type systems, Shape library and Google Fonts re-render 100 ms after the last change through `.task(id:)`; the old preview stays until the new one is ready, with no "rendering" indicator.
- **Source study sheet** loads rounds in `.task`; an empty manifest leaves it on "Loading source study".
- **Staged construction pass** in the inspector (`processStep`, 0–3), reset to the finished pass on every new selection.
- **Generations on disk:** an existing `generation.json` is never overwritten; resume continues from the last completed round.
- **Semantic index:** a file lock lets one index build run at a time; search reports posters missing from or stale in the index.
