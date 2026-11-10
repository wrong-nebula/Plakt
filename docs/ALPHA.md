# Plakt alpha

Status on 11 November 2026: in preparation. There is no packaged app and no tagged release yet. This page describes what the alpha contains and what testers should expect.

## Names

The product is **Plakt**. It was developed as **PosterLab**, and that name is still in use in:

- the app bundle, `PosterLab.app`, and its identifier `studio.posterlab.local`;
- the command, `poster`, and the MCP server name, `posterlab`;
- the Swift package and its targets (`PosterCore`, `PosterStudio`, `PosterCLI`, `PosterChecks`);
- environment variables and launch arguments (`POSTERLAB_ROOT`, `-PosterLabSheet`);
- the documents folder, `~/Documents/PosterLab/`.

Renaming these is part of packaging and has not been done.

## Who the alpha is for

Designers and developers who are comfortable building a Swift package from the command line and who want to test the workflow: generate, judge, pick, edit, export. It is not yet for people who expect a download that opens with a double click.

## What is in

| Area | State |
| --- | --- |
| Generate and evolve studies in fourteen style directions | Works; the oldest and most tested part |
| Judging mix: craft checks, style heads, designer profiles | Works |
| Personal taste jury | Works; needs three Yes and three No votes to start |
| Source studies from a poster library, live stage, winners, finalists | Works; needs a library |
| Poster editor with type systems, shape systems, modifiers and Tweak | Works; newest part, expect rough edges |
| Start from image | Works |
| Kerning: metrics, optical, manual gaps, pairs and font tables | Works; left-to-right text only |
| Rule-field letters, effectors and modifiers | Works; web editors in an offline `WKWebView` |
| Glass objects | Works; needs Metal |
| Physics: fallen letters | Works |
| Export: PNG, vector PDF with outlined type, scene JSON, colours | Works |
| Command line and resumable studies | Works |
| Agent tools over MCP and the shell | Works; 23 tools |
| Semantic search (SigLIP) and region selection (SAM 2.1) | Optional; model packs are prepared separately |

## What is not in

- A packaged, signed and notarized app. You build from source.
- The poster library. The repository carries the code that indexes, reviews and learns from a library, not the posters.
- The model packs for SigLIP and SAM 2.1.
- Video export. Rule field, effectors and the app have none, by decision.
- The 3D print preview; it was taken out of the app for now.
- Print simulation (Riso, letterpress). It exists as a separate experiment and is not wired in.
- Windows, Linux, iOS.
- Automatic updates, crash reporting, telemetry. Plakt sends nothing anywhere.

## Known limits

- **Scores are not quality.** Judges measure craft rules and affinities. The committee's winner is a proposal; curated picks in this project were always made by eye afterwards.
- **Reproducibility is per machine.** The same seed gives the same pixels on the same Mac and OS. System fonts differ between macOS versions.
- **Studies do not move between Macs.** A `generation.json` stores absolute paths to its images and reference.
- **Kerning** covers scene text. The procedural Generate renderer and shape systems that draw their own lettering keep their own spacing.
- **Contrast is screen math.** Ink rules use WCAG ratios, not simulated print.
- **Apple Intelligence critique** is compiled only with a macOS 26 SDK and has not been tested at runtime.
- **The pre-render filter** agrees with an older jury; whether it improves current studies is unmeasured. It is off by default.
- **Dark is the default look**; a light look is in Settings.
- **`workspaces/`**, mentioned in some documents, held development copies of the app. They are not in this repository.
- **Links into `output/`** in the documentation point at studies on the development machine. They do not exist in a fresh clone.

## Testing the alpha

A useful first session, about half an hour:

1. Build, then run `poster-checks`. Report any failing group with its output.
2. Generate a study from one of the briefs, evolve it twice, export a PDF and open it in a vector editor: type should be outlines.
3. Vote on twenty posters in Taste check, then generate with **Use only my taste jury**. Does the ranking feel like yours?
4. Open **Kerning** on a headline and compare None, Metrics and Optical.
5. Open **Glass objects** on a poster, add two solids, export a PNG.
6. If you use an agent: have it call `guide`, create a poster from a brief, critique it and export it.

When you report a problem, include the macOS version, the Mac model, the seed and the study folder (the `generation.json` is enough to reproduce a render on the same machine).

## Before the alpha is tagged

See the [release checklist](RELEASE-CHECKLIST.md): the licence, the rename and a test on a second Mac are still open.
