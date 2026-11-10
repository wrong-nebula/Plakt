// What the kit offers: module sets, palettes, constructions, controls,
// arrangements, field patterns and formats. Plain data, no geometry.
export const ENGINE='pages-shapes-v2';
export const SOURCE={id:'163ec2ac135da6e8d52f180c-p0',title:'P.A.G.E.S. / Geneva book fair',credit:'Neo Neo',url:'https://www.instagram.com/p/CoJzXVns1qd/',field:[644,710]};
export const FAMILIES=[
 {id:'discs',name:'Disc constructions',palette:'mint',note:'Round modules, round caps and smooth curves study the reference’s mixed vocabulary.'},
 {id:'lozenges',name:'Lozenge constructions',palette:'lavender',note:'Equal-area lozenges, mitred joins and every curve in three facets. The construction methods remain distinct.'},
 {id:'squares',name:'Soft square constructions',palette:'ice',note:'Rounded squares reshape the nodes, perforations and lenses. Rounded ribbon ends add another soft edge.'}
];
export const PALETTES=[
 {id:'mint',name:'Mint / pine',colors:['#dce5de','#254d44']},
 {id:'lavender',name:'Lavender / aubergine',colors:['#d1c4e0','#572f4b']},
 {id:'ice',name:'Ice / burgundy',colors:['#c8dce9','#843852']},
 {id:'newsprint',name:'Newsprint / black',colors:['#ebe9e3','#1c1c1a']},
 {id:'signal',name:'Black / signal orange',colors:['#151515','#ff5b1f']},
 {id:'cobalt',name:'Cobalt / pale lime',colors:['#2340b8','#e3f4a2']}
];
export const CONSTRUCTIONS=[
 {id:'contour',name:'Contour bands',source:'P',rule:'Alternate ink and ground strokes along the centerline.'},
 {id:'facets',name:'Faceted blades',source:'A',rule:'Each straight piece becomes a two-faced blade, lit from the upper left, with wire edges.'},
 {id:'overlap',name:'Overlap lenses',source:'G',rule:'Every stroke is a closed shape; where two cross at an open angle, the ground shows through.'},
 {id:'perforated',name:'Perforated grid',source:'E',rule:'Modules switch on where the centerline crosses a dot grid; horizontal runs drip tails.'},
 {id:'linked',name:'Linked modules',source:'S',rule:'Repeat modules along the centerline at one spacing; overlaps add ink.'},
 {id:'folded',name:'Folded planes',source:'P',rule:'Sweep a gradient front face into solid side planes.'},
 {id:'rails',name:'Separate rails',source:'E',rule:'Straight or faceted rails stop short of every joint.'},
 {id:'heavy',name:'Squeezed heavy',source:'S',rule:'Squeeze a heavy stroke sideways: verticals thin, curves stay heavy.'}
];
// Controls without `layouts` apply everywhere; the others only where listed.
export const CONTROLS=[
 {key:'detail',label:'Shape detail',min:-2,max:2,step:1,value:0,integer:true},
 {key:'weight',label:'Module weight',min:.75,max:1.2,step:.01,value:1},
 {key:'ribs',label:'Contour bands',min:2,max:5,step:1,value:3,integer:true},
 {key:'tails',label:'Perforation tails',min:0,max:1,step:.01,value:.9},
 {key:'bevel',label:'Fold depth',min:.08,max:.28,step:.01,value:.18},
 {key:'nodes',label:'Linked modules',min:12,max:28,step:1,value:18,integer:true},
 {key:'gap',label:'Spacing',min:0,max:.6,step:.01,value:.12,layouts:['composition']},
 {key:'density',label:'Field density',min:.5,max:2,step:.05,value:1,layouts:['field']},
 {key:'size',label:'Shape size',min:.5,max:1.3,step:.01,value:.84,layouts:['field']}
];
export const LAYOUTS=[
 {id:'atlas',name:'Shape atlas',note:'The 2023 collage with the first five items in the P, A, G, E and S positions. Fewer items repeat.'},
 {id:'specimen',name:'Shape specimen',note:'Every item through all eight constructions.'},
 {id:'composition',name:'Composition',note:'The items at one common height, as large as the format allows.'},
 {id:'field',name:'Shape field',note:'The items repeat across a grid. Mixed constructions rotate along the diagonals.'},
 {id:'source',name:'Source atlas',note:'The reference letters, where each construction comes from. Items do not apply.'}
];
export const PATTERNS=[
 {id:'repeat',name:'Repeat',note:'Every cell keeps its item’s orientation.'},
 {id:'turn',name:'Quarter turns',note:'Each diagonal turns a further 90°.'},
 {id:'mirror',name:'Mirror tiles',note:'Alternate columns mirror; alternate rows flip upside down.'},
 {id:'scatter',name:'Scatter',note:'Each cell takes a fixed pseudo-random turn and mirror.'}
];
export const FORMATS=[
 {id:'poster',name:'Poster 2:3',width:667,height:1000},
 {id:'a-series',name:'A series',width:707,height:1000},
 {id:'square',name:'Square',width:1000,height:1000},
 {id:'story',name:'Story 9:16',width:563,height:1000},
 {id:'landscape',name:'Landscape 16:9',width:1778,height:1000},
 {id:'billboard',name:'Billboard 3:1',width:3000,height:1000}
];
export const DEFAULT_SHAPES=['spiral','star','lattice','ring','wave'];
export const MAX_ITEMS=24;
