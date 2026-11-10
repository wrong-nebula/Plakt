# Japanese poster archive

A local research archive of Japanese posters for PosterLab type and shape studies, plus notes on the designers worth building systems from. Images live in `output/japanese-posters/` (git-ignored, not bundled). Each record keeps its source page, creator, date, and the holder's license or rights note.

**Rights.** Most post-1950 posters here are still in copyright. Museum images (MoMA, V&A) and community scans (People's Graphic Design Archive) are kept for personal study only, as with `output/designer-references/`. Wikimedia Commons and Japan Search records are filtered to free licenses (Public Domain Mark, CC0, CC BY, CC BY-SA), and each file's license travels with it. Studies should extract construction systems, not reproduce posters (see `TYPE-SYSTEMS.md`).

## Archive

**1,400 posters, 727 MB**, browsable offline in `output/japanese-posters/index.html` (filter by source and designer; each card links to its source record):

| Source | Posters | Notes |
| --- | ---: | --- |
| MoMA | 244 | Yokoo 85, Koichi Sato 20, Tanaka 15, Nagai 9, Hayakawa 8, Ohchi 8, Awazu 7, Kamekura 7, Igarashi 6, Yamashiro 5 … |
| V&A | 88 | Posters made in Japan, prewar to 1990s |
| Wikimedia Commons | 814 | Free-licensed; fetched as standard-width thumbnails (up to 1920 px), as Wikimedia asks of automated clients |
| People's Graphic Design Archive | 252 | Japan-located items whose format is Poster; 1600 px |
| Japan Search | 2 of 248 | The Tokyo Museum Collection host refuses automated requests (HTTP 403); the other 246 are listed with that reason in `dataset.json` |

One byte-identical duplicate across sources is marked `duplicateOf`.

```sh
# Catalog (metadata only), then download. Both steps resume and skip finished files.
python3 -I scripts/japanese-poster-archive.py catalog                      # all default sources
python3 -I scripts/japanese-poster-archive.py catalog --sources vam,pgda   # refresh some sources
python3 -I scripts/japanese-poster-archive.py download
# Optional Flickr albums (official API; free key from flickr.com/services/apps/create):
FLICKR_API_KEY=… python3 -I scripts/japanese-poster-archive.py catalog --sources flickr
FLICKR_API_KEY=… python3 -I scripts/japanese-poster-archive.py download --sources flickr
```

`output/japanese-posters/catalog.json` holds every candidate record. `dataset.json` holds downloaded files with path, SHA-256, pixel size, and `duplicateOf` for byte-identical copies across sources. Failures are listed with their reason. Before fetching, the downloader reads each image host's `robots.txt`, and disallowed files are recorded as failures, not downloaded. Requests are rate-limited per host and identify themselves as `PosterLab/1.0 (personal graphic-design research)`.

The folder can be indexed like the Instagram source: `./dist/poster library index --source output/japanese-posters/images --library library`. That changes the shared library, so it is not run automatically.

## Sources

| Source | What it contributes | Selection | Image rights |
| --- | --- | --- | --- |
| [MoMA collection data](https://github.com/MuseumofModernArt/collection) | Canonical postwar designers: Yokoo, Sato, Tanaka, Nagai, Kamekura, Awazu, Igarashi, Fukuda … | Japanese nationality, Design/Graphic Design classification, printed media; plus Prints by those same designers | CC0 metadata; images personal research only |
| [V&A Collections API](https://developers.vam.ac.uk/) | Kamekura, Tanaka, Nagai, Katsui, Asaba, Saito, prewar and wartime posters | Posters with place Japan; poster searches by 40 designer names (maker field must match) | © V&A; non-commercial use |
| [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Posters_of_Japan) | Meiji–Shōwa advertising, travel, film and political posters; Sugiura Hisui and other prewar work | `Category:Posters of Japan` tree, depth 4, excluding street-location and wanted-poster branches; in the *Poster artists* branches only files named as posters (those categories also hold paintings, prints and portraits) | Free license per file |
| [Japan Search](https://jpsearch.go.jp/) (National Diet Library's aggregator) | Edo playbills (*banzuke*) through Shōwa posters held by Japanese museums | Type = poster, open rights only (PDM, CC0, CC BY, CC BY-SA); all 248 are Tokyo Museum Collection items, whose image host refuses automated downloads | Per-item license |
| [People's Graphic Design Archive](https://peoplesgdarchive.org/location/114/japan) | Community scans: Nakajo, Yamana, Kamekura, Expo '70, magazines' posters, many lesser-known designers | Japan and Tokyo location pages, items whose format is Poster | Non-commercial educational/research use |
| Flickr albums (opt-in) | Collector scans: 1920s–30s graphic design, Yokoo and Tanaka, film posters | Five albums listed in `FLICKR_ALBUMS` | Uploader license per photo; poster rights stay with the designer |

### Reviewed but not crawled

| Source | Why | How to use it |
| --- | --- | --- |
| [DNP Foundation collection database](https://collection.dnpfcp.jp/en/) (DNP Graphic Design Archives; Tanaka, Fukuda and Nagai archives) | `robots.txt` disallows all crawling | Browse by hand; the strongest single archive of postwar Japanese posters. Research access to the Ikko Tanaka Archive is by appointment |
| [Museum für Gestaltung Zürich eMuseum](https://www.emuseum.ch/) | Anubis bot-challenge on every request | Browse by hand; contact sammlungen@museum-gestaltung.ch about research data |
| [Cooper Hewitt](https://collection.cooperhewitt.org/highlights/1108777533/) ("Japanese Graphic Design" highlights) | Smithsonian request-verification wall; API needs a registered token | Browse, or request an API token yourself |
| [Poster House](https://collection-open.posterhouse.org/) (94 Japan-related posters) | Metadata API is open, but images are behind a Cloudflare challenge | Browse by hand |
| [Fonts In Use, Japan](https://fontsinuse.com/locations/114/japan) | Media loaded by script; 10 s crawl delay | High value for type IDs; worth a dedicated slow job |
| [Design Reviewed](https://designreviewed.com/) | Japanese features (Ohchi, Kamekura, Hayakawa) are members-only | Read with an account |
| Flickr HTML pages | `robots.txt` disallows generic crawlers | Use the official API path above |
| [Tokyo TDC results](https://tokyotypedirectorsclub.org/en/news/tdc2025-results), Internet Archive | No poster images in the pages / mostly film flyers | Reading list only |

Other places worth browsing by hand: Toyama Prefectural Museum of Art and Design (Toyama International Poster Triennial), Musashino Art University Museum & Library, Kyoto Institute of Technology Museum and Archives, Die Neue Sammlung (Munich), the Stedelijk, Brighton Design Archives (ICOGRADA, 148 Japanese posters from the 1960s–70s), and the Merrill C. Berman Collection.

## System candidates

A scan of the 542 posters downloaded so far (MoMA, V&A, People's GDA) found 13 construction families that the current type systems, shape library and geometry-bench studies don't cover yet. Each has a reference sheet in `output/japanese-posters/system-candidates/` showing the posters, the construction, what I'd build and its controls. `spec.json` there lists the record IDs; re-render with `.build/siglip-venv/bin/python -I scripts/japanese-poster-sheets.py refs --spec output/japanese-posters/system-candidates/spec.json --out output/japanese-posters/system-candidates`. Built systems are linked in the Priority column.

| # | Kind | Candidate | Source | Why it's new | Priority |
| --- | --- | --- | --- | --- | --- |
| 1 | Type | Isometric prism letters | Igarashi, 1980–85 | No 3D letter construction exists; any text, pure vector | **Built**: [README](geometry-bench/isometric-prism-system/README.md), [editor](output/isometric-prism-study-v1/index.html) — nine systems, ten views |
| 2 | Type | Shōwa display kana kit | Kono, Okuyama, 1920s–50s ads | First Japanese-script system; square-bar and wedge-brush stroke kits | **Built**: [README](geometry-bench/showa-kana-system/README.md), [editor](output/showa-kana-study-v1/index.html) — 13 families, katakana + 36 kanji, four reading directions incl. arch |
| 3 | Type | Spectral echo glyphs | Katsui, Koichi Sato | Spectral copy fans; fits the neon direction; quick | **Built**: [README](geometry-bench/spectral-echo-system/README.md), [editor](output/spectral-echo-study-v1/index.html) — seven styles, Latin and Japanese |
| 4 | Type | Arch-envelope headlines | Yokoo | Envelope warp (letters reshaped), unlike the tangential arc | **Built**: [README](geometry-bench/arch-envelope-system/README.md), [editor](output/arch-envelope-study-v1/index.html) — 12 envelopes, ten styles, extrusions and banners |
| 5 | Type | Tategaki colour columns | Tanaka, Fukuda, Hayakawa | Real vertical Japanese setting; prerequisite for Japanese copy | **Built**: [README](geometry-bench/tategaki-system/README.md), [editor](output/tategaki-study-v1/index.html) — ten styles, furigana, prewar right-to-left |
| 6 | Type | Wagara window letters | Tanaka's NIPPON, Yokoo, Kamekura | Procedural traditional pattern kit, letters as windows | **Built**: [README](geometry-bench/wagara-system/README.md), [editor](output/wagara-study-v1/index.html) — 18 tiling patterns, nine styles, eight layouts |
| 7 | Type | Compound-glyph silhouettes | Yamashiro, Fukuda, Aoba | Extends the glyph and image density field (escalating compounds, flow) | **Built**: [README](geometry-bench/compound-glyph-system/README.md), [editor](output/compound-glyph-study-v1/index.html) — ten styles, 22 escalation sets, word or shape silhouettes; [v2 editor](output/compound-glyph-study-v2/index.html) adds running text on contours, lattices, layered silhouettes, 18 more sets |
| 1 | Shape | Primitive-kit figures | Tanaka's Nihon Buyo | Cell-primitive figures (faces, masks, butterflies), not letters | **Built**: [README](geometry-bench/primitive-kit-system/README.md), [editor](output/primitive-kit-study-v1/index.html) — paintable figure grids, seeded figure generator; [v2 editor](output/primitive-kit-study-v2/index.html) adds calm print-palette defaults, merged cells, picture → figure, finishes, series |
| 2 | Shape | Strata line fields | Awazu, Nagai | Whole-field offset contour bands with faults | **Built**: [README](geometry-bench/strata-field-system/README.md), [editor](output/strata-field-study-v1/index.html) — 11 styles, five layouts, lines never cross |
| 3 | Shape | Glow apertures | Koichi Sato | Soft luminous falloff fields and beams | **Built**: [README](geometry-bench/glow-aperture-system/README.md), [editor](output/glow-aperture-study-v1/index.html) — 13 styles, four modes, matches in resvg and Chrome; [v2 editor](output/glow-aperture-study-v2/index.html) adds words/kanji as light, mixed lights, screenprint/halftone/riso finishes, series |
| 4 | Shape | Rising-ray stage | Yokoo | Filled wedge rays composed as a stage with horizon and panels | **Built**: [README](geometry-bench/rising-ray-system/README.md), [editor](output/rising-ray-study-v1/index.html) — ten styles, five layouts, seam-free ray tiling |
| 5 | Shape | Bead-ray blooms and flip-disc screens | Nagai, Kamekura | Bead rays, line petals, flip-angle disc screens | **Built**: [README](geometry-bench/bead-ray-system/README.md), [editor](output/bead-ray-study-v1/index.html) — 13 presets, blooms and hidden-image disc screens; [v2 editor](output/bead-ray-study-v2/index.html) adds spirals, vortex rays, word masks, hatch/Truchet/two-sided screens, dithering, moiré, riso |
| 6 | Shape | Rotational limbs and knots | Fukuda | N-fold limb repeats, interlaced tube knots | **Built**: [README](geometry-bench/rotational-limb-system/README.md), [editor](output/rotational-limb-study-v1/index.html) — 12 presets, draggable limbs, alternating over/under knots |

Also seen but not proposed: Yokoo's split-fountain gradients (a colour treatment, better as a palette option), Kamekura's Nikon *SP* scale cascade (covered by scale ramp and repeated fields), and Hattori's dot-matrix kanji (the existing 5 × 7 module systems apply once kanji skeletons exist).

## Designers

Grouped by generation. The *system angle* column names the reusable construction, the part a PosterLab type or shape system could take from the work. Dates are birth–death years.

### Foundations (1900s–1940s)

| Designer | Known for | System angle |
| --- | --- | --- |
| Hisui Sugiura 杉浦非水 (1876–1965) | Mitsukoshi department-store posters; the 1927 Tokyo subway opening poster; widely called the father of Japanese modern graphic design | Art Nouveau into Art Deco: flat color planes, framed lettering |
| Ayao Yamana 山名文夫 (1897–1980) | Shiseido's house style: fine-line figures and custom lettering | Hairline contrast, ornamental Latin/Japanese lettering |
| Takashi Kono 河野鷹思 (1906–1999) | Shochiku film posters, late 1920s–30s | Constructivist diagonals with hand-cut kana |
| Hiromu Hara 原弘 (1903–1986) | Introduced Tschichold's New Typography to Japan; art director of the wartime magazine *FRONT*; co-founded Nippon Design Center | Asymmetric grid; photo plus sans in tension |

### Postwar modernism (1950s–1960s)

| Designer | Known for | System angle |
| --- | --- | --- |
| Yusaku Kamekura 亀倉雄策 (1915–1997) | 1964 Tokyo Olympics emblem and posters; Nikon; first JAGDA chairman; co-founded Nippon Design Center (1960) | Big disc and bar primitives, radial symmetry |
| Ryuichi Yamashiro 山城隆一 (1920–1997) | *Forest* (1955): trees drawn entirely from the characters 木, 林 and 森 | Glyph repetition as texture: a word becomes the image |
| Yoshio Hayakawa 早川良雄 (1917–2009) | Osaka; Kintetsu department-store posters; soft, painterly color | Loose organic shapes on a strict type block |
| Hiroshi Ohchi 大智浩 (1908–1974) | Playful geometric illustration posters and packaging | Compass-and-ruler figures |
| Kiyoshi Awazu 粟津潔 (1929–2009) | *Give Back the Sea* (1955); theater and film posters; Metabolism circle | Dense line hatching, mapped and contour forms |

### Nippon Design Center, pop and psychedelia (1960s–1980s)

| Designer | Known for | System angle |
| --- | --- | --- |
| Ikko Tanaka 田中一光 (1930–2002) | *Nihon Buyo* (1981): a face built from circles and rectangles; Kanze Noh posters; Muji founding art director (1980) | Figures composed from a few geometric primitives on a grid; strongest "kit of parts" reference |
| Kazumasa Nagai 永井一正 (1929–) | 1960s engraved-line geometric abstractions; later animal "Life" series; Sapporo 1972 emblem | Parallel-line fields that bend into volume (contour systems) |
| Shigeo Fukuda 福田繁雄 (1932–2009) | Visual puns and impossible figures; *Victory 1945* (1975) | Figure–ground reversal, one-shape double readings |
| Tadanori Yokoo 横尾忠則 (1936–) | Pop/psychedelic collage; *Having Reached a Climax at the Age of 29, I Was Dead* (1965); posters for Terayama's and Kara's theaters | Rays, halftone, stacked frames, kitsch print textures |
| Mitsuo Katsui 勝井三雄 (1931–2019) | Luminous color gradations; early computer graphics | Gradient-band type and fields |
| Kohei Sugiura 杉浦康平 (1932–) | Taught at HfG Ulm; information diagrams and dense multi-script book design | Diagrammatic layout, vertical/horizontal mixed setting |
| Takenobu Igarashi 五十嵐威暢 (1944–) | Axonometric alphabets; 3D aluminium letters; MoMA calendars | Isometric-grid letter construction (directly systemizable) |
| Koichi Sato 佐藤晃一 (1944–2016) | Glowing gradients and quiet Japanese motifs | Soft light fields behind minimal marks |
| Eiko Ishioka 石岡瑛子 (1938–2012) | Parco campaigns of the 1970s; later film costume design | Photo-led, large confrontational headline type |
| Masayoshi Nakajo 仲條正義 (1933–2021) | Shiseido's *Hanatsubaki*; Shiseido Parlour | Irregular, wobbly geometric letterforms; type as toy |
| Katsumi Asaba 浅葉克己 (1940–) | Seibu and Suntory campaigns; long-time Tokyo TDC chairman; research into Dongba pictographic script | Pictographic/ideographic letter play |
| Makoto Saito, Shin Matsunaga, U.G. Sato, Masuteru Aoba | Photographic collage (Saito), bold color geometry (Matsunaga), pun/peace posters (U.G. Sato, Aoba) | Reference set for single-idea posters |

### Contemporary (1990s–now)

| Designer | Known for | System angle |
| --- | --- | --- |
| Kenya Hara 原研哉 (1958–) | Muji art direction from 2002; *White*; Nagano 1998 Olympics programmes | Emptiness, hairline type, margin as structure |
| Taku Satoh 佐藤卓 (1955–) | Meiji Oishii Gyunyu packaging; 21_21 Design Sight | Everyday-object typography |
| Kashiwa Sato 佐藤可士和 (1965–) | Uniqlo brand system | Square-modular katakana/Latin logotypes |
| Hideki Nakajima 中島英樹 (1961–) | Ryuichi Sakamoto releases; *Cut* magazine | Rule-based layered Latin type, tiny/huge scale jumps |
| Kazunari Hattori 服部一成 (1964–) | *Ryuko Tsushin* art direction; idiosyncratic ad typography | Deliberately "off" spacing and naive shapes |
| Shinnoske Sugisaki, Toshiyasu Nanbu | Osaka typographic posters | Transparency and layered type |
| Yuni Yoshida 吉田ユニ (1980–) | Hand-built photographic illusions | Repetition and substitution patterns |
| Daijiro Ohara 大原大次郎 (1978–), Shun Sasaki 佐々木俊 (1985–) | Hand lettering and kinetic type (Ohara); Japanese typographic posters (Sasaki) | Live type systems for kana/kanji |
| Groovisions, Chie Morimoto (goen°) | Flat character graphics (Groovisions); hand-made campaign art (Morimoto) | Character and texture kits |

### Context

The 1964 Tokyo Olympics design program was the turning point: Kamekura's posters, the pictogram team led by critic Masaru Katsumie, and the Nippon Design Center generation (Kamekura, Tanaka, Nagai, Hara). It made Japanese graphic design internationally visible. Japanese posters are often printed in B1/B0 silkscreen or offset with metallic and fluorescent spot inks, which photographs and scans flatten. Expect color shifts across sources.
