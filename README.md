# Plakt

**A poster workshop for the Mac.** Plakt generates print posters as editable vector scenes, ranks them with a jury you can tune and train on your own taste, and lets you finish the winner by hand. Everything runs locally: no account, no keys, no network.

> **Alpha.** Plakt is being prepared for a first alpha release. It was developed under the name **PosterLab**, and the app (`PosterLab.app`), the command (`poster`) and the Swift package still use that name. There is no packaged download yet; you build it from source. Read [the alpha notes](docs/ALPHA.md) before you rely on anything.

## Download

Get the latest build from [Releases](https://github.com/wrong-nebula/Plakt/releases): `Plakt-0.1.1-alpha-macos-arm64.zip`. Unzip it; inside are `Plakt.app` and `How to open Plakt.txt`. It needs a Mac with Apple silicon and macOS 15 or later.

### How to open it

Plakt is not yet notarised by Apple, so macOS blocks it the first time. You allow it once; after that it opens like any other app.

1. Drag **Plakt** into your Applications folder.
2. Double-click Plakt. macOS warns that it could not verify the app. Click **Done** (not Move to Trash).
3. Open **System Settings** (Apple menu › System Settings).
4. Choose **Privacy & Security** in the sidebar.
5. Scroll down to **Security**. Next to *"Plakt" was blocked to protect your Mac*, click **Open Anyway**.
6. Click **Open Anyway** again in the dialog and confirm with your password or Touch ID.

Plakt now opens, and from here on a double-click is enough. The Open Anyway button only appears for about an hour after step 2; if it is not there, double-click Plakt again and go back to Privacy & Security.

Prefer Terminal? This one line does the same:

```sh
xattr -dr com.apple.quarantine /Applications/Plakt.app
```

## What it does

- **Generates** populations of posters from your copy in fourteen procedural style directions (Swiss, kinetic type, halftone, guilloche and others), drawn with Core Graphics and Core Text as real vector geometry.
- **Judges** every poster with a committee: craft checks (legibility, spacing, type integrity), style heads, designer-affinity profiles, and optionally **your own taste jury**, a local model trained on your Yes/No votes.
- **Evolves** the posters you pick over several rounds, keeping ancestry, scores and ballots in plain files you can reopen.
- **Edits** a winner in place: move, scale and rotate elements, apply type systems and shape systems, kern by hand or optically, and let the jury rank small variations.
- **Transforms** posters with effectors and modifiers, rule-field letters, glass objects (a Metal refraction renderer) and rigid-body physics for falling letters.
- **Exports** for print: 3508 px PNG (A4 at 300 dpi), A4 vector PDF with outlined type, and the editable scene as JSON.
- **Works with agents.** The same engine is served to LLM agents as 23 tools over MCP or the shell.

## Requirements

- macOS 15 or later. Apple silicon recommended.
- Swift 6.0 or later (Xcode or the Apple Command Line Tools).
- Nothing else for the base app. Node and Python are needed only to rebuild bundled editors, models and studies.

## Build and run

```sh
./scripts/build.sh
```

```sh
open dist/PosterLab.app
```

The build also writes the command-line tool to `dist/poster`. The app is ad-hoc signed for your own Mac; it is not notarized.

## Your first poster

In the app: edit the copy, set a seed and batch size, press **Generate study**, inspect the scores, mark parents with the plus button and press **Evolve picked**. Export the selected poster as PNG or PDF. Studies save under `~/Documents/PosterLab/`.

From the shell:

```sh
./dist/poster generate --title 'MATTER AND FORM' --subtitle 'Design Research' --seed 2026 --count 12 --rounds 3 --out output/study
```

```sh
./dist/poster render --resume output/study/generation-2/generation.json --width 3508 --out output/print
```

[Getting started](docs/GETTING-STARTED.md) walks through the app, the command line and agent use.

## Documentation

| Document | What it covers |
| --- | --- |
| [Getting started](docs/GETTING-STARTED.md) | Build, first study, taste jury, editing, export, agents |
| [Alpha notes](docs/ALPHA.md) | What is in the alpha, what is not, known limits, how to give feedback |
| [Feature reference](docs/FEATURES.md) | Every feature in detail, with commands and launch arguments |
| [Release checklist](docs/RELEASE-CHECKLIST.md) | What was cleaned for this repository and what is still open before a public release |
| [AGENTS.md](AGENTS.md) | Rules for agents that make posters with Plakt |

Topic documents, at the repository root:

| Topic | Document |
| --- | --- |
| Poster library, review, semantic search | [LIBRARY.md](LIBRARY.md), [SOURCE-REGIONS.md](SOURCE-REGIONS.md) |
| Your taste jury | [USER-TASTE.md](USER-TASTE.md) |
| Designer and style judges | [DESIGNER-JUDGES.md](DESIGNER-JUDGES.md), [VALIDATION.md](VALIDATION.md) |
| Type systems | [TYPE-SYSTEMS.md](TYPE-SYSTEMS.md), [TYPE-SYSTEM-AUDIT.md](TYPE-SYSTEM-AUDIT.md) |
| Shape systems | [SHAPE-LIBRARY.md](SHAPE-LIBRARY.md), [SHAPE-SYSTEMS-V2.md](SHAPE-SYSTEMS-V2.md), [CONTOUR-SYSTEMS.md](CONTOUR-SYSTEMS.md), [DOMINANT-SHAPES.md](DOMINANT-SHAPES.md), [PAPER-RELIEF.md](PAPER-RELIEF.md) |
| Fonts and briefs | [FONTS-AND-CONTENT.md](FONTS-AND-CONTENT.md) |
| Start from an image | [IMAGE-STARTING-POINTS.md](IMAGE-STARTING-POINTS.md) |
| Physics | [PHYSICS.md](PHYSICS.md) |
| App state machines, UI polish | [STATE-MACHINES.md](STATE-MACHINES.md), [UI-POLISH.md](UI-POLISH.md) |

## Checks

```sh
swift run --disable-sandbox poster-checks
```

The checks run as named groups and print a summary. `--list` shows the groups, `--only kerning,glass` runs some, `--skip taste` leaves one out. See [the feature reference](docs/FEATURES.md#development).

## Agents

`poster mcp` serves Plakt as an MCP server over stdio, and `poster tool list | schema | call` exposes the same tools to a shell. [.mcp.json](.mcp.json) registers the server for agents started in this folder. Agents create, read, edit, critique, rank and export posters; [AGENTS.md](AGENTS.md) has the rules and [llms.txt](llms.txt) the short index.

## Your data

- Studies and exports are ordinary files: PNG, PDF and JSON manifests.
- Taste votes and the images you voted on stay in `taste/` beside the library the app works in. The trained model is rebuilt from them.
- The poster library (`library/`) and the optional model packs (`models/`) are not part of the repository.
- `scripts/backup-data.sh <folder>` copies votes, library reviews and kerning tables.

## Licence

Not chosen yet. Until a licence file is added, all rights are reserved. Bundled Google Fonts are under the SIL Open Font License, with their licence files beside them; the colour names are from [meodai/color-names](https://github.com/meodai/color-names) (licence in `Sources/PosterCore/Resources`).
