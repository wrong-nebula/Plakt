# Fonts and inspired event briefs

The font collection contains 20 Google Fonts families / 57 original TTF assets and 110 weight, width and slant profiles. The official `google/fonts` revision is pinned to `86aced91de05cd4f96a06838124cca45be337b2b`. Original OFL licenses and metadata accompany the files. A profile stores its actual file checksum, PostScript descriptor and variable axes; rendering validates the checksum and uses explicit optical size. Fonts register inside the app, not globally.

An 85-dimensional normalized descriptor combines category/style metadata, weight, width, slant, glyph metrics and specimen raster bands. Separate 768-dimensional Apple Vision revision-2 vectors use the same three-line specimen for every profile. Family centroids and nearest profiles support automatic face choice. These are descriptive similarities, not learned historical font identification. `output/font-library-v2` is the verified specimen index; v1 is superseded because its specimen text origin carried between rows and optical size was implicit.

```sh
python3 scripts/fetch-google-fonts.py --family 'Your Google Fonts family'
./scripts/build.sh
./dist/poster fonts index --out output/font-library-next
./dist/poster fonts list
./dist/poster fonts nearest --profile PROFILE-ID
```

The 22 default briefs cover art, architecture, literature, performance, orchestral/jazz concerts, design, photography and film. Eight originate in inspected library posters: Dance First Think Later, Positions at EPFL Archizoom, Horizons at Villa Bernasconi, the Museum für Gestaltung reopening, an OSR concert, Das Wort at Strauhof, Bibliotopia and Nuit de la Photo.

The current briefs **rewrite the title, programme and dates**, while using real locations. They are clearly labeled **Concept brief · real location**. They are not announcements of actual bookings. Original factual references live in `content-references.json`; concept briefs store `inspiredByID`, original reference dates, source-poster ID where available, URLs and evidence explaining their role. Concept poster footers avoid original event ticket links.

“Mix inspired briefs” rotates deterministically by seed, using a different brief for each direction and holding its copy constant across the five judging rounds. Choosing a specific brief freezes it; editing any field turns it into custom copy. New source genomes retain full copy and brief provenance, use curated display phrases, and preserve alphanumeric content including dates in the information layer.

```sh
./dist/poster briefs list
./dist/poster library breed --library library --out output/concept-study --brief mixed --rounds 5 --count 8
./dist/poster library breed --library library --out output/archizoom-study --brief concept-positions-2022 --rounds 5
```

The native app exposes the same brief library, Google Fonts browser and editable content. The current reference metadata is dated November 7, 2026. Dates in the concept copy deliberately differ from those references.
