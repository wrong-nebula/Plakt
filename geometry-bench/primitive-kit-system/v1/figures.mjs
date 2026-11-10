// Preset figures. Each is plain text: one row of cell tokens per line and one
// overlay per line (grammar in engine.mjs). Colour roles:
// 0 ground · 1 ink · 2 light · 3 red · 4 blue · 5 green · 6 yellow · 7 sky · 8 violet · 9 pink.
// The source figures are hand-written; owl, oni, kitsune, flower, koi and
// daruma began as silhouettes run through the quantiser, then were edited.
export const PRESETS={
 // Ikko Tanaka, Nihon Buyo (1981): the 3 × 4 grid the kit comes from.
 buyo:{name:'Nihon Buyo',grid:[
  '.    S01    .',
  'S01  B28/2  S01',
  'T21  S02    T11',
  'T34  T35/2  S03'],
 over:['disc 2.46 .57 r.45 c7','band 1.5 1.83 w1 h.19 c9','eye.kabuki 1.113 1.592 r.104 c3 d1 m','lip.bud 1.5 2.47 r.088 c3']},
 // Ikko Tanaka, Kanze Noh (1973): a gold mask in stepped planes.
 noh:{name:'Noh mask',grid:[
  'S01    S01    Q36/1  Q06/1  S01    S01',
  'S01    Q36/1  S06    S06    Q06/1  S01',
  'Q36/1  S06    S06    S06    S03    Q03/1',
  'S06    S06    B12/3  S03    S03    S03',
  'S06    S06    S03    S03    S03    S03',
  'S06    S06    S06    S06    S03    S03',
  'S06    S06    S06    S06    S06    S06',
  'Q26    S06    S06    S06    S06    Q16'],
 over:['brow.moth 1.62 1.85 w.6 c1 m','eye.almond 1.45 3.5 r.62 c1 d6 m','lip.noh 3 6.15 r.82 c1']},
 // Ikko Tanaka, Hanae Mori (1977): triangle wings and scattered confetti.
 butterfly:{name:'Hanae Mori butterfly',grid:[
  'T01  .    .    .    .    T31',
  'S01  T01  .    .    T31  S01',
  'S01  S01  T01  T31  S01  S01',
  'S01  S01  S01  S01  S01  S01',
  '.    T21  S01  S01  T11  .',
  '.    .    W21  W21  .    .'],
 over:['line .42 -.25 e3,2.6 t.012 c1 m','stripes .95 1.45 w1.05 h.46 n3 a22 c8','ring .78 2.42 r.3 i.62 c6','disc 5.32 1.18 r.19 c6','spike 5.3 2.68 w.95 h.24 a-45 c5',
  'ring 4.18 3.2 r.44 i.5 c3','ring 2.62 3.42 r.27 i.44 c4 d5','rect 2.5 4.22 w.24 h.24 c6','spike 1.95 4.72 w.62 h.12 n2 a-78 c3','spike 3.98 4.22 w.58 h.11 n2 a72 c8','ring 4.22 4.85 r.32 i.55 c5'],focus:[3,3]},
 // Ikko Tanaka, Sharaku 200th anniversary (c. 1995): a face under nine circles.
 sharaku:{name:'Sharaku',grid:[
  '.    Q37    Q07    .',
  'Q32  B27/2  B27/2  .',
  'S02  S02    S02    B12',
  'T22  S02    S02    B12',
  '.    .      .      .',
  '.    .      .      .'],
 over:['line 2.62 2.72 e2.86,3 t.012 c1','line 2.4 3.18 e2.28,3.72 t.012 c1','eye.round .78 2.45 r.13 a0 c2 d1','eye.round 1.55 2.42 r.155 a0 c2 d1','brow.arc .72 2.05 w.46 t.075 a-6 c1','brow.arc 1.5 2.0 w.62 t.095 a-4 c1',
  'brow.arc 2.05 .55 w1.85 t.3 a-6 c1','disc 2.75 1.45 r.62 c1','disc 2.85 2.32 r.62 c1','disc 3.25 4.6 r.75 c4','disc 3.3 3.55 r.78 c3','disc 1.15 4.15 r1.38 c5'],focus:[1.4,2.4]},
 // Koji Kato, Mino Shigyo silkscreen (c. 1960): a bird of cut-paper squares on a stand.
 bird:{name:'Cut-paper bird',grid:[
  '.    .    .    .    T28  S02  S02  S07  S02',
  '.    .    .    .    S01  S06  S02  S07  S05',
  '.    .    .    .    T22  S07  S02  S08  S02',
  '.    .    .    .    S02  S04  S07  S02  B12',
  '.    .    .    S02  S09  S09  S07  S02  .',
  '.    .    S07  S02  S07  S02  S08  S02  .',
  'S07  S02  S07  S01  S02  S07  S01  S07  .',
  'S05  .    .    S08  .    S01  .    .    .'],
 over:['spike 4.05 .5 w2.4 h.22 a-90 c2','disc 4.3 .42 r.2 c3','line 5.5 8 e5.5,11.6 t.07 c2','line 5.5 11.6 e4.7,12.6 t.06 c2','line 5.5 11.6 e6.6,12.6 t.06 c2','tri 5.5 12.3 w.75 h.62 c1'],focus:[5,3]},
 owl:{name:'Owl',grid:[
  '.    T04    .      .      T34    .',
  '.    N14    Q24/2  Q14/2  N34    .',
  'C11  S02    S02    S02    S02    C21',
  'Q31  T01/2  T37/2  T07/2  T31/2  Q01',
  'S01  N31/4  S07    S07    N11/4  S01',
  'Q21  B34/1  S07    S07    B14/1  Q11',
  '.    .      N04    N04    .      .'],
 over:['disc 2.02 2.6 r.5 c6 m','disc 2.02 2.6 r.25 c1 m','disc 1.93 2.48 r.08 c2 m','lip.beak 3 3.12 r.34 c3','spike 3 4.55 w.32 h.2 n3 a180 c4','spike 3 5.15 w.32 h.2 n3 a180 c4','tri 2.45 6.9 w.42 h.3 a180 c6 m']},
 cat:{name:'Cat',grid:[
  'T06  .    .    .    .    T36',
  'S06  T06  B06  B06  T36  S06',
  'S06  S06  S06  S06  S06  S06',
  'S06  S06  S06  S06  S06  S06',
  'S06  S06  S06  S06  S06  S06',
  'Q26  S06  S06  S06  S06  Q16'],
 over:['tri .62 .95 w.42 h.8 a-12 c9 m','disc 1.75 2.85 r.42 c5 m','lens 1.75 2.85 w.16 h.68 c1 m','disc 1.64 2.68 r.07 c2 m','tri 3 3.72 w.46 h.32 a180 c9','line 3 3.88 e2.62,4.22 t.06 c1 m',
  'line 1.55 3.82 e.1,3.5 t.04 c1 m','line 1.55 4.05 e.1,4.18 t.04 c1 m','rect 3 5.66 w5.2 h.36 c3','disc 3 5.98 r.26 c2','line 2.85 6.04 e3.15,6.04 t.04 c1']},
 oni:{name:'Oni',grid:[
  '.      B01    Q31    Q01    B01    .',
  'T36    B03/1  Q03/1  Q33/1  B03/1  T06',
  'B33/1  S03    S03    S03    S03    B13/1',
  'B33    S03    S03    S03    S03    B13',
  'H33    S03    S03    S03    S03    H13',
  '.      Q23    S03    S03    Q13    .',
  '.      H33    S03    S03    H13    .'],
 over:['tri .62 .6 w.55 h1.1 a-28 c6 m','brow.line 1.95 2.55 w1.2 t.3 a22 c1 m','eye.round 1.95 3.2 r.4 c6 d1 m','half 3 4.3 r.42 c1','lip.smile 3 4.95 r1 c1','tri 2.42 5 w.26 h.48 a180 c2 m','tri 2.2 5.72 w.22 h.36 c2 m']},
 kitsune:{name:'Kitsune',grid:[
  '.    W02  .    .    W02  .',
  'T32  S02  B02  B02  S02  T02',
  'S02  S02  S02  S02  S02  S02',
  'T22  S02  S02  S02  S02  T12',
  '.    T22  S02  S02  T12  .',
  '.    .    S02  S02  .    .',
  '.    .    T22  T12  .    .'],
 over:['tri 1.5 .66 w.42 h.72 c3 m','eye.slit 1.9 3.3 r.42 a-16 c1 m','brow.arc 1.9 2.62 w1.05 t.12 a-12 c3 m','spike 1.45 3.05 w.7 h.14 a-62 c3 m','lens 3 2.1 w.3 h.85 c3','disc 3 2.62 r.12 c6','stripes 1.2 4.3 w.75 h.42 n3 a-18 c3 m','half 3 6.35 r.32 a180 c1']},
 flower:{name:'Flower',grid:[
  'Q39  H09  Q09',
  'H39  S06  H19',
  'Q29  H29  Q19',
  '.    .    .',
  'L15  .    L05',
  '.    .    .',
  'T24  S04  T14'],
 over:['rect 1.5 4.6 w.16 h3.2 c5','ring 1.5 1.5 r.42 i.5 c3','disc 1.5 1.5 r.12 c1','disc .2 .15 r.14 c6 m']},
 koi:{name:'Koi',grid:[
  '.    .    .    T33  .    .    .',
  'Q33  S03  S02  S03  S02  T02  T33',
  'Q22  S02  S02  S02  S03  T12  T23',
  '.    .    T23  .    .    .    .'],
 over:['eye.round .72 1.72 r.17 a180 c2 d1','line .3 2.3 e-.12,2.75 t.035 c1','half 2.5 1.62 r.22 a180 c7','half 2.5 2.4 r.22 a180 c7','half 3.5 2.4 r.22 a180 c7','ring 5.9 3.7 r.3 i.82 c7','ring .4 .55 r.2 i.8 c7']},
 daruma:{name:'Daruma',grid:[
  '.    Q33    S03    S03    Q03    .',
  'Q33  S03    Q32/3  Q02/3  S03    Q03',
  'S03  Q32/3  S02    S02    Q02/3  S03',
  'S03  S02    S02    S02    S02    S03',
  'S03  Q22/3  S02    S02    Q12/3  S03',
  'S03  S03    Q22/3  Q12/3  S03    S03',
  'Q23  S03    S03    S03    S03    Q13'],
 over:['brow.arc 2.2 2.12 w1.1 t.3 a-8 c1 m','eye.round 2.25 2.78 r.34 c2 d1','disc 3.75 2.78 r.34 c2','ring 3.75 2.78 r.34 i.86 c1','stripes 1.62 3.6 w.6 h.55 n3 a-28 c1 m','lip.smile 3 3.8 r.26 c3','stripes 3 5.85 w2 h.5 n2 c6']}
};
export const PRESET_ORDER=['buyo','noh','butterfly','sharaku','bird','owl','cat','oni','kitsune','flower','koi','daruma'];
