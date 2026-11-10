# Getting started with Plakt

Plakt was developed as **PosterLab**. The app is `PosterLab.app` and the command is `poster`; both will be renamed before a packaged release.

## 1. Build

You need macOS 15 or later and Swift 6.0 or later (Xcode or the Command Line Tools). From the repository root:

```sh
./scripts/build.sh
```

This writes `dist/PosterLab.app` and `dist/poster`. The first build takes a few minutes.

```sh
open dist/PosterLab.app
```

The app is signed ad hoc for the Mac that built it. Copied to another Mac, Gatekeeper will block it; build it there instead.

## 2. Make a study

The main window has two workspaces, **Generate** and **Review library**.

1. In **Generate**, choose one of the briefs or type your own title, subtitle, institution and footer.
2. Set a seed and a batch size. The same seed on the same Mac gives the same posters.
3. Press **Generate study**. Each poster is drawn, then scored by the committee.
4. Click a poster to see its raw judge scores and its votes.
5. Mark the posters you like with the plus button and press **Evolve picked**. With no picks, the top three become parents.
6. Export the selected poster as a 3508 px PNG or an A4 vector PDF with outlined type.

Studies save under `~/Documents/PosterLab/`. **Open study** reopens a `generation.json`; **Show files** reveals the images, the contact sheet and the manifest.

## 3. Tune the jury

**Judging mix** lists every judge with a weight slider. Zero removes a judge from the vote.

- **Craft and image checks** measure legibility, spacing, type integrity, copy completeness and similar.
- **Style heads** measure affinity to the fourteen authored style directions.
- **Designer profiles** measure affinity to a sample of credited works; see [DESIGNER-JUDGES.md](../DESIGNER-JUDGES.md).

Votes are combined by weighted Borda count, so ranks are relative to one batch. Compare raw scores, not ranks, across rounds.

## 4. Train your own taste

Open **Taste check** in the header and vote **Yes**, **No** or **Skip** (Y, N, Space; ⌘Z undoes). After three Yes and three No votes your profile starts voting as a juror. You can add it to the committee or choose **Use only my taste jury**. Votes and the model stay on your Mac. Details: [USER-TASTE.md](../USER-TASTE.md).

## 5. Edit a winner

Click a winner of a source study or an image study to open the poster editor:

- select an element to move, scale or rotate it;
- apply a type system or a shape system from previews drawn with the poster's own headline and colours;
- place modifiers on the poster;
- press **Tweak** to let the jury rank a dozen small variations (← → compare, Return keeps, Esc reverts).

Header buttons open the other tools on the selected poster: **Kerning**, **Rule field**, **Effectors** and **Glass objects**. Each is described in the [feature reference](FEATURES.md).

## 6. Work from a poster library (optional)

**Review library**, source studies ("Generate from library") and the source-based type systems need a library folder of indexed posters. The library is not part of the repository. To build one from your own images:

```sh
./dist/poster library index --source /path/to/images --library library
```

See [LIBRARY.md](../LIBRARY.md). Semantic search (SigLIP) and region selection (SAM 2.1) need model packs prepared once with `scripts/prepare-siglip.py` and `scripts/prepare-sam2.py`; everything else works without them.

## 7. Use the command line

```sh
./dist/poster --help
```

```sh
./dist/poster generate --seed 2026 --count 12 --rounds 3 --out output/study
```

```sh
./dist/poster evolve --resume output/study/generation-2/generation.json --rounds 2
```

```sh
./dist/poster render --resume output/study/generation-2/generation.json --width 3508 --out output/print
```

Commands never overwrite a finished generation or an existing export; choose a new `--out`.

## 8. Let an agent make posters

```sh
./dist/poster tool list
```

```sh
./dist/poster tool call guide '{}'
```

`poster mcp` serves the same 23 tools over MCP; [.mcp.json](../.mcp.json) registers it for agents started in the repository folder. Agents must call `guide` first and follow [AGENTS.md](../AGENTS.md). To let an agent show posters in a live window, build the agent Studio as well:

```sh
zsh scripts/build-agent-studio.sh
```

## 9. Check your build

```sh
swift run --disable-sandbox poster-checks
```

All groups should pass. The `segmentation` and `semantic` groups run only with `--all` and need the model packs. The `glass` group needs Metal.

## Where things are

| Path | Contents |
| --- | --- |
| `~/Documents/PosterLab/` | Studies made in the app |
| `output/` | Studies and exports made from the command line (not in git) |
| `output/agent/` | Agent projects |
| `taste/` | Your votes and the voted images |
| `kerning/` | Your kerning tables, beside `taste/` |
| `library/` | The poster library (not in git) |
| `models/` | Optional model packs (not in git) |
