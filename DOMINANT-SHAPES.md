# One or two oversized shapes

Reference: **L Viscosi**, library poster `6f0afba09e88052dee70c023-p0`. The saved caption credits Studio Feixen; its [Luzerner Theater identity project](https://www.studiofeixen.ch/luzerner-theater/) documents the design system. The reusable relationship is a single large continuous gesture spanning sparse title/date anchors, rather than the original wording, dates or exact photographed curve.

Open **Shape library**, enable **Whole-poster system**, and select a silhouette, volume or continuous curve. Three new native vector grammars—poster helix, poster loop and poster ribbon—provide tubular gestures. Eighteen eligible families can be combined as one or two logical objects.

- **Span** uses a poster-wide envelope.
- **Zoom** magnifies the object beyond the paper.
- **Offset** shifts an oversized crop away from the centre.
- **Edge / corner** show a fragment. **Visible shape amount** fits a paper-ink target from the actual native shape mask. Manual horizontal/vertical offsets apply afterward.
- **Behind / front / weave** route the object around the type. Weave repeats exactly the same object through saved foreground windows; these passes are not additional logical shapes.
- **Push nearby type** repels display blocks from occupied shape regions. It retains the original source anchors and stores `anchorX/Y` and `nudgeX/Y`, while protecting supporting information.

Presets carry `DominantShapeSettings` alongside the selected recipe snapshot, font, seed and geometry parameters. Scene genomes store the actual oversized envelope, bleed permission, fitted crop translation, clipped foreground windows, original anchors and displacement vectors. Composition constraints explain logical object counts and layer order. PDF exports remain vector paths.

The default standalone copy is a newly authored **NEUE RÄUME** concept programme at the real Luzerner Theater, explicitly marked *Konzeptprogramm*. It is not an advertised real event. Existing app briefs remain editable and can be used with this system.

## Iteration and judging

```sh
.build/shape-library/release/poster shape-library dominant-study \
  --out output/my-dominant-study --rounds 5 --count 12 \
  --framings span,zoom,offset,edge,corner
node geometry-bench/dominant-shape-gallery.mjs output/my-dominant-study
.build/shape-library/release/poster-checks --dominant-only
```

The first round explores every eligible family, then each round retains four leading presets, mutates their geometry, scale, offsets, crossing windows and displacement, and introduces fresh families. The exact incumbent remains available for comparison. The study uses a frozen instance of the existing explicit-vote taste jury; it does not create votes or train on its own rankings.

Framing, visible ink, controlled text crossing and actual displacement are measured from rendered native masks. Native Vision/Core ML image measurements, diversity and the existing personal jury provide independent ballots. Weighted Borda ranking is relative to each batch, not an objective quality score. Edge and corner targets differ from full-page targets.

The v1 pilot revealed entirely hidden corner objects and excessively wide metadata clearance strips. The refined system fits visible fragments and clears only the actual information glyph extent. Tube defaults also gained more suitable monospace/grotesk font targets, while free font selection remains available.

The build and app are isolated from the ongoing SigLIP work. No SigLIP models, indexes, discovery files or active app are overwritten. A compiler scoping workaround for unrelated in-progress segmentation code exists only inside the private `.build/shape-source` snapshot; its shared source is untouched. Use the tested snapshot while that work continues:

```sh
scripts/build-shape-library.sh --reuse-snapshot
scripts/package-space-preview.sh
open 'dist/space-preview/PosterLab Space.app'
```

## Verified output

`output/dominant-shapes-v2/gallery.html` contains **330 candidate instances / 310 unique PNGs**, eighteen recipe families and five rounds in each of five framing directions. There are 219 one-object instances, 111 two-object instances and 105 instances with actual text displacement. The gallery filters full histories, weaving, displacement and first-round exploration, and sorts by batch rank, least visible ink or greatest displacement. Its emitted filtering code was executed and checked.

All **27 native check groups pass**. Specific checks cover one/two logical objects, identical geometry across foreground/background passes, visible differences between depth modes, exact preset replay, all framing modes, actual displacement and saved vectors, and nonempty auto-reveal crops across every eligible family. The native UI was inspected with a full-page tubular gesture and a fitted corner variant; framing and push-strength controls visibly update the poster.

Pale-on-pale remains a valid artistic choice. No extra contrast penalty or rejection is applied. The recorded generation history and original committee results are retained. The default jury uses framing intent, controlled crossings, actual shape visibility, displacement, native image measurements/diversity and the existing personal preference model.

Open the isolated **PosterLab Space** preview, choose **Shape library → Whole-poster system**, and explore framing, reveal, zoom, offsets, text crossings and displacement. The main app and ongoing SigLIP work were not replaced.
