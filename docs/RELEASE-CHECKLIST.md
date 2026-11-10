# Release checklist for the Plakt alpha

What was done for the first push to GitHub, and what has to be settled before the repository is made public and before the app is packaged.

## 1. The first push (done, 11 November 2026)

The GitHub repository was started from a cleaned copy of the last local commit, with a fresh history. The development repository keeps its own history and was not changed.

| What | Why | What was done |
| --- | --- | --- |
| Personal taste votes and voted images (`taste/`) | Personal data | Left out and ignored by git; each user votes for themselves |
| Photographed reference poster (`Sources/PosterCore/Resources/reference.jpg`) | No right to redistribute | Replaced by one of the app's own posters, placed where the old photo's fixed crop expects the paper |
| A reference image sent for the heavy-dither study | Origin and rights unclear | Left out; the two dither study builders need your own image to rebuild |
| Absolute home-folder paths in the type and shape catalogs and in `geometry-bench` | Exposed a home folder; useless elsewhere | Rewritten to the placeholder root `/PosterLab` |
| Development copies of the app (`workspaces/`) | History of how features were built, not product | Left out |
| Tool caches and local launch settings | Machine-specific | Left out and ignored |

## 2. Still open in the content

- [ ] **Choose a licence** and add `LICENSE`. Without one nobody may use or contribute to the code.
- [ ] **Catalog paths.** The placeholder `/PosterLab/library/…` paths point at nothing. Make them relative to the library the app works in.
- [ ] **Reference judge.** The Composition prior was authored for the old reference photo. Decide whether it and the bundled reference stay as defaults.
- [ ] **Source-linked catalogs.** Type and shape catalogs carry poster IDs and measured systems from a private library. Review what is a measurement and what is a reproduction.
- [ ] **Designer-affinity models** (`DesignerJudges/*.mlmodel`) were trained on 430 credited MoMA works and carry designers' names. Only models are bundled, no images. Confirm the wording ("affinity to a collection sample") and the credits in the app.
- [ ] **Concept briefs** are invented programmes at real venues. Keep the "Concept brief · real location" label everywhere they appear.
- [ ] **References to `workspaces/`** remain in some topic documents and scripts.

Already in order: the 20 Google Fonts families ship with their `OFL.txt`; the colour names ship with meodai's MIT licence; SigLIP's licence is in `scripts/siglip-LICENSE.txt`; the poster library, model packs and outputs are ignored by git.

## 3. Before the repository is made public

- [ ] Build and run `poster-checks` **from a clean clone on a second Mac**, with no `library/`, no `models/` and no `taste/`. First-run behaviour of the app without a library is unverified.
- [ ] Check that the app opens to a usable Generate workspace with no library, and that library-only features explain what is missing.
- [ ] Remove or repair documentation links into `output/`, which is not in the repository.
- [ ] Reduce the root: move the topic documents into `docs/`.
- [ ] Add `CONTRIBUTING.md` and issue templates, or state that the alpha takes feedback only.

## 4. Before the app is packaged

Not started, by decision.

- [ ] Rename PosterLab to Plakt: bundle name, identifier (`studio.posterlab.local`), executable, the `poster` command, MCP server name, `POSTERLAB_*` variables, `-PosterLab*` launch arguments, `~/Documents/PosterLab/`, the autosave folder. Plan a migration for existing studies, votes and kerning tables.
- [ ] Version: the bundle says 1.0 (1). Set an alpha version such as 0.1.0.
- [ ] App icon.
- [ ] Developer ID signing, hardened runtime and notarization. The build signs ad hoc.
- [ ] Decide whether the model packs (SigLIP, SAM 2.1) ship inside the app, download on demand, or stay a manual step, and check their licences for redistribution.
- [ ] A disk image or zip, and release notes taken from [ALPHA.md](ALPHA.md).
