# Print kit

Spot separations and a riso preview for any flat-ink poster SVG, shared by the geometry-bench systems. It is taken from the [shock-burst system](shock-burst-system/README.md), which has its own fuller print outputs (two-ink tints, halftone dots, plotter pen passes).

## What it does

| Function | Gives |
| --- | --- |
| `inksOf(svg)` | The paper, the inks in order of first use, whether the paper prints, and what keeps a style's sheets from being pure black and white (gradients, transparency, blend modes, images) |
| `spotSeparations(svg)` | One sheet per ink. Every fill, stroke and gradient stop of that ink turns black and every other colour white, so later shapes knock out earlier ones exactly where they cover them. Glow filters and blend modes are dropped |
| `risoPreview(source, {misregister, grain, seed})` | Each sheet printed in its ink and multiplied over the stock, shifted by a seeded misregistration and mottled by grain. `source` is a poster SVG, or a system's own separations `[{ink, colour, svg}]` |

The paper is the fill of the first rect covering the sheet. Pure white never prints. The paper prints as an ink of its own on white stock when it is dark or when a lighter ink sits on it (light type on a mid-tone ground); otherwise the paper is the stock. With a system's own separations on dark paper, the paper sheet is made from them: black wherever no other ink prints.

`print-kit-node.mjs` has the build hooks:
- `withPrintPanel(html, {separations})` appends the **Riso and separations** panel to an editor page. It reads the poster from `window.rendered` (or `#stage svg`) and sits with the editor's export buttons when there is an `.exports` row. Pass `separations` as a function expression to use a system's own.
- `printOutputs({out, styles})` writes `print/separations/`, `print/riso/` (SVG and PNG) and `print/index.json`.

## Where it is used

| System | Styles | Notes |
| --- | --- | --- |
| [heavy-dither](heavy-dither-system/README.md) | 17 | Dithered cells separate exactly |
| [rkc-disc](rkc-disc-system/README.md) | 3 | |
| [darkmatter](darkmatter-system/README.md) | 6 | |
| [plot-slice](plot-slice-system/README.md) | 7 | Accordion uses ten greens: ten passes |
| [tategaki](tategaki-system/README.md) | 10 | Six styles use gradients or transparency and are flagged |
| [rule-field](rule-field-system/README.md) | 22 | Uses the system's own separations |

Systems that rely on gradients, transparency or many hues (spectral-echo, isometric-prism, arch-envelope, pages-atlas, wagara) are left out: their posters do not reduce to a few flat inks.

## Check

```sh
node geometry-bench/print-kit-check.mjs
```

For every style of every system above it checks:
- the sheets are pure black and white (flagged styles excepted);
- the spot sheets match the poster at its own size: wherever the poster shows an ink, that sheet is black and the others white, within 2% of sampled pixels;
- the riso preview has one layer per ink;
- the editor carries the panel, and the build wrote the print outputs.

It writes `output/print-kit-v1/validation.json` and a board of riso previews, `output/print-kit-v1/board.png`.
