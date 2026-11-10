/* Shock burst — shape system study after six posters in the local library: the 51.
 * Solothurner Filmtage (caption @solothurnerfilmtage), Streit Festival (@samsteiner.ch,
 * @wanjaadamzorn, @keibo_ratvuer), ECAL guide (@arthurseguin), Indicateur de performances
 * (TM David Mamie, Nicola Todeschini), Satoshi Kon at Filmpodium (@moritzfurger) and
 * Dishcomfort at the Aargauer Kunsthaus (repost @atlas_studio_zurich).
 * A burst is a run of spikes round a centre. Every spike draws its own seeded length,
 * width, lean and valley depth; its sides bow by a curvature and curl by a swirl. Bursts
 * nest inward or echo outward, layer in rows, scatters and orbits, or split at a centre
 * into mirrored halves, mirrored or pinwheel quadrants, or free shards that pull apart;
 * a part can also be a comb of spikes rising from the sheet edge. Copy is fitted inside
 * the burst by its horizontal chords. Outputs: poster SVG, plotter centrelines with
 * hatching that respects what covers it, and ink separations with line screens for
 * gradients. Nothing is traced from the posters.
 */
import {FONTS} from './fonts.mjs';
import ClipperLib from 'clipper-lib';
export const ENGINE='shock-burst-v1';
export const SOURCES=[
 {index:938,id:'cd6f72ff26c6bbca09fb00da-p0',family:'twin',title:'51. Solothurner Filmtage, 2016',credit:'@solothurnerfilmtage (caption tags #raffinerie, #uldry)',construction:'Two irregular bursts side by side, a thick black outline and one blue-to-orange gradient across both, over the type'},
 {index:669,id:'94728ba0f6310cc71d2dc6e5-p0',family:'shard',title:'Streit Festival, 2021',credit:'@samsteiner.ch, @wanjaadamzorn and @keibo_ratvuer for @streitfestival',construction:'The sheet split at its centre into four parts: spike fans above, spike combs rising from the edges below'},
 {index:998,id:'db6f46f4e087ca6091e8e51c-p0',family:'quadrant',title:'ECAL guide',credit:'@arthurseguin / @ecal_ch',construction:'One burst mirrored into four quadrants, its two colours swapped in alternate quadrants'},
 {index:105,id:'195083a7e3c9fe89d39431e0-p0',family:'bubble',title:'Indicateur de performances, Grütli 2020–22',credit:'TM David Mamie and Nicola Todeschini for @legrutli_artsvivants',construction:'A burst with scalloped, inward-curved sides, outlined, holding copy and covering the type behind it'},
 {index:121,id:'1c2f4ec7e5b67aee7161bb12-p0',family:'splash',title:'Satoshi Kon, Filmpodium 2023',credit:'@moritzfurger for @filmpodium',construction:'A one-sided splash of long needle spikes, a re-seeded burst nested inside'},
 {index:252,id:'37e4e069b2e964b10caec82b-p0',family:'scrawl',title:'Dishcomfort, Aargauer Kunsthaus 2025',credit:'Repost by @atlas_studio_zurich',construction:'A black burst crossed by white, re-seeded outline echoes, copy in its core'}
];
export const FORMATS={a:{name:'A series',w:728,h:1030},poster:{name:'Poster 2:3',w:700,h:1050},story:{name:'Story 9:16',w:608,h:1080},square:{name:'Square',w:900,h:900},wide:{name:'Wide 16:9',w:1280,h:720}};
export const FONT_LIST=Object.entries(FONTS).map(([id,f])=>({id,name:f.name,license:f.license}));
// Module catalogue: every option value with its label. Engine and editor share it.
const INK={line:'Line ink',paper:'Paper (knocked out)',fill:'Fill ink',accent:'Accent ink'};
export const LABELS={
 split:{none:'Whole bursts',halves:'Mirrored halves',quadrants:'Mirrored quadrants',pinwheel:'Pinwheel quadrants',shards:'Free shards'},
 motif:{burst:'Burst',comb:'Combs from the edges',mixed:'Bursts above, combs below'},
 parts:{same:'Same colours',invert:'Swap colours in alternate parts'},
 symmetry:{none:'None',m3:'3-way mirror',m4:'4-way mirror',m6:'6-way mirror',m8:'8-way mirror'},
 layout:{row:'Row',column:'Column',scatter:'Scatter',orbit:'Orbit',stack:'Stack'},merge:{none:'Separate',union:'Union: one outline',interference:'Interference: overlaps cut out'},
 fill:{none:'None (outline only)',solid:'Solid',linear:'Linear gradient',radial:'Radial gradient'},
 echo:{alternate:'Alternate inks',step:'Step from fill to accent',outline:'Outlines inside',same:'Same ink'},
 copy:{inside:'Inside the burst',across:'Across the sheet, crossing the burst',ring:'Round a ring inside the burst',none:'None'},fit:{fit:'Fit',stretch:'Stretch rows to the burst'},copyInk:INK,
 sheet:{none:'None',top:'Top',bottom:'Bottom',split:'Top and bottom',spread:'Spread over the sheet'},sheetLayer:{over:'Over the bursts',under:'Under the bursts'},sheetFit:{uniform:'One size',rows:'Each row to the width'},sheetInk:INK,crossing:{same:'Same ink',paper:'Paper (knocked out)',fill:'Fill ink',line:'Line ink',accent:'Accent ink'},infoPlace:{none:'None',bottom:'Bottom',top:'Top'},
 plotEdges:{centre:'Centrelines',passes:'Outline width in pen passes'},hatchStyle:{lines:'Parallel',cross:'Crosshatch',none:'None'},sepMode:{spot:'One sheet per colour',tints:'Steps as tints of two inks'},screenShape:{lines:'Line screen',dots:'Halftone dots'},
 format:Object.fromEntries(Object.entries(FORMATS).map(([k,f])=>[k,f.name])),font:Object.fromEntries(Object.entries(FONTS).map(([k,f])=>[k,f.name]))};
export const OPTIONS=Object.fromEntries(Object.entries(LABELS).map(([k,v])=>[k,Object.keys(v)]));
export const OUTPUTS=['poster','plotter','riso'];
// Output settings: they shape the plotter file, the separations and the riso preview, never the poster.
export const OUTPUT_KEYS={pen:'plotter',hatch:'plotter',plotEdges:'plotter',hatchStyle:'plotter',screen:'separations',sepMode:'separations',screenShape:'separations',misregister:'riso',grain:'riso'};
const base={spikes:18,inner:.55,size:.9,aspect:1,rotate:0,cx:.5,cy:.5,seed:7,length:.5,width:.5,lean:.4,valley:.2,tip:0,jag:0,outlier:0,teeth:0,fork:0,bend:0,spray:0,sprayAngle:0,curve:0,swirl:0,
 count:1,spread:.5,nest:1,nestStep:.7,nestTwist:0,nestSeed:0,gap:0,outline:0,echoWeight:2,gradAngle:0,glow:0,copySize:1,pad:14,tracking:0,leading:1,sheetSize:.7,margin:26,infoSize:1,frame:0,pen:1.1,hatch:4.5,screen:3.2,misregister:1.5,grain:.35};
const opts={split:'none',motif:'burst',parts:'same',symmetry:'none',layout:'row',merge:'none',crossing:'same',infoPlace:'none',plotEdges:'centre',hatchStyle:'lines',sepMode:'spot',screenShape:'lines',fill:'solid',echo:'alternate',copy:'inside',fit:'fit',copyInk:'line',sheet:'none',sheetLayer:'over',sheetFit:'uniform',sheetInk:'line',format:'a',font:'archivo'};
// Palette roles: paper, fill (bursts), line (outlines, copy), accent (gradient end, alternate levels and layers).
export const FAMILIES=[
 {id:'twin',name:'Twin shock',after:'51. Solothurner Filmtage, @solothurnerfilmtage',text:'SHOCK',sheetText:'SOLO/THURNER/FILM/TAGE',colors:['#f1f0eb','#3a6fe2','#111111','#f0662a'],
  set:{...opts,fill:'linear',copy:'none',sheet:'split',sheetLayer:'under',params:{...base,count:2,spread:.48,spikes:12,inner:.42,size:.88,aspect:1.4,cy:.5,seed:16,length:.55,width:.8,lean:.75,valley:.5,outline:11,gradAngle:0,sheetSize:1,margin:16,leading:1}},
  note:'Two irregular bursts side by side, each with a heavy black outline, share one blue-to-orange gradient and cover the type behind them.'},
 {id:'quadrant',name:'Mirror quadrants',after:'new — construction after ECAL guide',text:'GUIDE',sheetText:'SPLIT/SIGNAL',colors:['#2a12ff','#ff1f7a','#ffffff','#ff1f7a'],
  set:{...opts,split:'quadrants',parts:'invert',copy:'none',sheet:'split',font:'unbounded',params:{...base,spikes:14,inner:.18,size:.95,seed:3,length:.35,width:.6,lean:.35,valley:.4,sheetSize:.55,margin:22}},
  note:'One quarter of a burst is mirrored into all four quadrants; alternate quadrants swap violet and pink, so the star reads as a checker.'},
 {id:'shard',name:'Shard quarters',after:'new — construction after Streit Festival',text:'STREIT',sheetText:'LOUD/NIGHTS',colors:['#09090c','#ff2d4a','#ffffff','#ffd21f'],
  set:{...opts,split:'shards',motif:'mixed',copy:'none',sheet:'top',font:'serif',params:{...base,spikes:30,inner:0,size:1.25,cx:.5,cy:.56,seed:21,length:.55,width:.85,lean:.7,valley:0,tip:.55,sheetSize:.55,margin:20,leading:.95}},
  note:'The sheet splits at a centre into four free shards: fans of red wedges above, combs rising from the edges below.'},
 {id:'bubble',name:'Shout bubble',after:'new — construction after Indicateur de performances',text:'SAY IT/LOUDER',sheetText:'SPEAK/OUT/LOUD/NOW',colors:['#0c0b12','#0c0b12','#c4ff3d','#7b4dff'],
  set:{...opts,sheet:'spread',sheetLayer:'under',sheetFit:'rows',sheetInk:'accent',font:'anton',params:{...base,spikes:15,inner:.82,size:.98,cy:.55,seed:4,length:.55,width:.5,lean:.35,valley:.2,curve:-.62,outline:3.5,pad:20,sheetSize:1,margin:16,leading:1}},
  note:'A speech burst with scalloped, inward-curved sides covers violet type and holds its own copy in lime.'},
 {id:'splash',name:'Splash',after:'new — construction after Satoshi Kon, Filmpodium',text:'EYE',sheetText:'NIGHT/VISION',colors:['#050507','#f4f4ef','#9fb2ff','#ff5c9e'],
  set:{...opts,copy:'none',sheet:'split',font:'unbounded',params:{...base,spikes:26,inner:.4,size:1.35,cx:.44,cy:.55,aspect:.95,seed:12,length:.55,width:.9,lean:.75,valley:.35,spray:.6,sprayAngle:310,curve:-.4,nest:2,nestStep:.5,nestSeed:.85,sheetSize:.6,margin:24}},
  note:'Long needle spikes spray to one side; a pink, re-seeded burst sits inside the white one.'},
 {id:'scrawl',name:'Echo scrawl',after:'new — construction after Dishcomfort, Aargauer Kunsthaus',text:'NOISE/FLOOR',sheetText:'',colors:['#ff4a12','#0b0b0b','#f4f4f4','#0b0b0b'],
  set:{...opts,echo:'outline',params:{...base,spikes:22,inner:.62,size:1.18,aspect:1.15,seed:9,length:.8,width:.9,lean:.85,valley:.6,curve:.12,swirl:.18,nest:7,nestStep:.88,nestSeed:1,echoWeight:2.2,pad:10}},
  note:'A black burst is crossed by six white outline echoes, each re-seeded, so its edge seems scribbled; the copy sits in the core.'},
 {id:'neon',name:'Neon shock',after:'new — electro',text:'AFTER/DARK',sheetText:'',colors:['#07060c','#07060c','#3df5ff','#ff3df2'],
  set:{...opts,fill:'none',echo:'same',copyInk:'accent',font:'unbounded',params:{...base,spikes:20,inner:.66,size:1.08,seed:5,length:.45,width:.6,lean:.5,valley:.3,nest:4,nestStep:.78,nestSeed:.3,outline:3,glow:2.4,pad:16}},
  note:'Four outlined, slightly re-seeded bursts nest inside one another in glowing cyan around magenta copy.'},
 {id:'rave',name:'Rave flyer',after:'new — acid',text:'RAVE/26.06',sheetText:'',colors:['#111111','#ffe600','#111111','#ff2bd6'],
  set:{...opts,layout:'scatter',params:{...base,count:3,spread:.75,spikes:16,inner:.62,size:.9,seed:31,length:.5,width:.7,lean:.6,valley:.3,outline:4,pad:10}},
  note:'Three scattered bursts in acid yellow and pink overlap with black outlines; the copy is set in the first.'},
 {id:'sun',name:'Sun fan',after:'new — radial',text:'SUN',sheetText:'SUN/RISE',colors:['#1d0638','#ffe14d','#ffe14d','#ff3b30'],
  set:{...opts,fill:'radial',copy:'none',sheet:'split',params:{...base,spikes:22,inner:0,size:1.12,cy:.5,seed:8,length:.25,width:.9,lean:.6,valley:0,tip:.75,sheetSize:.5,margin:30}},
  note:'Wedges of uneven width with slanted ends fan from one point, yellow at the core and red at the tips; the type sits on the violet beyond them.'},
 {id:'pinwheel',name:'Pinwheel',after:'new — rotation',text:'SPIN',sheetText:'SPIN/CYCLE',colors:['#ff3b1f','#0a0a0a','#ffffff','#0a0a0a'],
  set:{...opts,split:'pinwheel',parts:'invert',copy:'none',sheet:'split',font:'mono',params:{...base,spikes:20,inner:.3,size:.95,seed:14,length:.4,width:.5,lean:.3,valley:.3,curve:.15,swirl:.55,sheetSize:.5,margin:24}},
  note:'One curled quarter turns four times round the centre; alternate quarters swap red and black.'},
 {id:'ice',name:'Ice shards',after:'new — cold',text:'FROST',sheetText:'FROST/BITE',colors:['#04070e','#7ef6ff','#ffffff','#2a6bff'],
  set:{...opts,split:'shards',fill:'linear',echo:'outline',copy:'none',sheet:'split',sheetInk:'line',font:'bebas',params:{...base,spikes:22,inner:.35,size:.62,cy:.5,seed:6,length:.6,width:.7,lean:.6,valley:.5,gap:22,nest:3,nestStep:.66,echoWeight:1.4,gradAngle:90,outline:1.5,sheetSize:.62,margin:24}},
  note:'Four free shards pull apart from the centre; each fades from ice blue to deep blue and carries two outline echoes.'},
 {id:'halo',name:'Shock rings',after:'new — echo',text:'BASS/DROP',sheetText:'',colors:['#08070d','#ff2fd0','#ff9ff0','#ff2fd0'],
  set:{...opts,echo:'outline',copyInk:'paper',params:{...base,spikes:18,inner:.64,size:.52,seed:19,length:.45,width:.5,lean:.4,valley:.2,nest:6,nestStep:1.27,nestSeed:.2,echoWeight:2,glow:1.8,pad:8}},
  note:'A small magenta burst sends five outline echoes outward like a shock wave; the copy is knocked out of it.'},
 {id:'comic',name:'Pow',after:'new — comic',text:'POW!',sheetText:'',colors:['#1f5cff','#ffe600','#111111','#ff2b2b'],
  set:{...opts,params:{...base,spikes:14,inner:.64,size:1,seed:2,length:.5,width:.6,lean:.55,valley:.25,nest:2,nestStep:.7,nestSeed:.6,outline:7,pad:10}},
  note:'A yellow burst round a red one, both heavily outlined in black, on blue: the comic shout.'},
 {id:'flare',name:'Heat flare',after:'new — flame',text:'HEAT',sheetText:'',colors:['#0d0405','#ffe14d','#0d0405','#ff2a00'],
  set:{...opts,fill:'radial',echo:'same',params:{...base,spikes:26,inner:.5,size:1.25,cy:.58,seed:27,length:.7,width:.8,lean:.6,valley:.3,spray:.55,sprayAngle:270,curve:-.2,swirl:.35,nest:3,nestStep:.66,nestSeed:.5,pad:8}},
  note:'Curled spikes flare upward from a yellow core to red tips, three bursts deep.'},
 {id:'glitch',name:'Split shift',after:'new — offset',text:'CUT/UP',sheetText:'CUT/UP',colors:['#f2f0ea','#111111','#ff2d2d','#111111'],
  set:{...opts,split:'halves',parts:'invert',copy:'none',sheet:'split',font:'bebas',params:{...base,spikes:18,inner:.45,size:.85,seed:10,length:.55,width:.7,lean:.5,valley:.35,gap:20,sheetSize:.7,margin:20}},
  note:'A mirrored burst splits down the middle; the halves pull apart and swap black and paper.'},
 {id:'chrome',name:'Chrome spike',after:'new — metal',text:'METAL',sheetText:'',colors:['#0a0a0c','#f7f7f7','#0a0a0c','#5a606b'],
  set:{...opts,fill:'linear',font:'unbounded',params:{...base,spikes:24,inner:.66,size:1.15,seed:23,length:.6,width:.8,lean:.8,valley:.25,curve:-.3,nest:4,nestStep:.82,nestSeed:.25,gradAngle:90,outline:1.2,pad:8}},
  note:'Four nested bursts with alternating silver gradients read as polished metal.'},
 {id:'cluster',name:'Burst cluster',after:'new — confetti',text:'POP',sheetText:'POP/UP',colors:['#111111','#3dff8b','#f4f4f4','#ff3d7f'],
  set:{...opts,layout:'scatter',copy:'none',sheet:'split',params:{...base,count:6,spread:.95,spikes:12,inner:.55,size:.5,seed:40,length:.5,width:.7,lean:.6,valley:.3,outline:3,sheetSize:.55,margin:24}},
  note:'Six small bursts of different seeds scatter in green and pink with white outlines; the type takes the top and bottom.'},
 {id:'vortex',name:'Vortex',after:'new — spiral',text:'VORTEX',sheetText:'',colors:['#000000','#00f0ff','#ffffff','#2400ff'],
  set:{...opts,echo:'step',font:'unbounded',params:{...base,spikes:40,inner:.68,size:1.05,seed:13,length:.4,width:.4,lean:.3,valley:.2,curve:.1,swirl:.7,nest:6,nestStep:.82,nestTwist:12,pad:8,copySize:.7}},
  note:'Curled spikes turn a little more in each of six nested bursts, stepping from cyan outside to ultramarine at the core.'},
 {id:'stamp',name:'Ink stamp',after:'new — print',text:'LAST/CALL',sheetText:'',colors:['#f1ede4','#ff2a1f','#111111','#ff2a1f'],
  set:{...opts,copyInk:'paper',font:'anton',params:{...base,spikes:32,inner:.8,size:.95,seed:1,length:.35,width:.3,lean:.2,valley:.1,jag:.65,pad:14}},
  note:'A red seal with alternating long and short spikes; the copy is knocked out to the paper.'},
 {id:'fusion',name:'Barbed union',after:'new — merged',text:'FUSE',sheetText:'FUSION/NIGHT',colors:['#0b0b10','#00e5ff','#ffffff','#ff2bd6'],
  set:{...opts,fill:'linear',merge:'union',copy:'none',sheet:'split',crossing:'paper',font:'unbounded',params:{...base,count:2,spread:.5,spikes:13,inner:.45,size:1.3,aspect:1,seed:16,length:.55,width:.8,lean:.7,valley:.5,teeth:.55,outline:5,gradAngle:0,sheetSize:.75,margin:22}},
  note:'Two barbed bursts merge into one outline under a cyan-to-magenta gradient; where the type crosses them it is knocked out to black.'},
 {id:'needle',name:'Needle spray',after:'new — outliers',text:'NEEDLE/DROP',sheetText:'',colors:['#060608','#f2f2ec','#e8ff3d','#ff4fa0'],
  set:{...opts,copy:'across',crossing:'paper',font:'bebas',params:{...base,spikes:40,inner:.38,size:.92,seed:33,length:.5,width:.9,lean:.7,valley:.3,outlier:.9,bend:.35,curve:-.35,spray:.35,sprayAngle:300,nest:2,nestStep:.5,nestSeed:.8,copySize:.92}},
  note:'Forty needles, a few shooting far past the rest and hooking as they go; the copy crosses the sheet in acid yellow and turns black over the white.'},
 {id:'thorn',name:'Thorn crown',after:'new — forks and teeth',text:'THORN',sheetText:'',colors:['#c6ff00','#0b0b0b','#f4f4f4','#0b0b0b'],
  set:{...opts,echo:'outline',params:{...base,spikes:18,inner:.62,size:1.05,seed:44,length:.6,width:.8,lean:.6,valley:.4,fork:.75,teeth:.6,nest:3,nestStep:.8,nestSeed:.7,echoWeight:2,pad:12}},
  note:'Every spike forks into prongs and grows barbs; two white echoes run inside the black, on acid green.'},
 {id:'phase',name:'Interference',after:'new — merged',text:'PHASE',sheetText:'PHASE/SHIFT',colors:['#0a0820','#ff3dbd','#ffffff','#3df5ff'],
  set:{...opts,layout:'orbit',merge:'interference',copy:'none',sheet:'split',font:'unbounded',params:{...base,count:4,spread:.42,spikes:16,inner:.55,size:.78,seed:51,length:.5,width:.6,lean:.5,valley:.3,glow:1.2,sheetSize:.55,margin:24}},
  note:'Four bursts in orbit cut each other out where they overlap, leaving an interference pattern in pink.'},
 {id:'kaleido',name:'Kaleido',after:'new — six-way mirror',text:'KALEIDO/SCOPE',sheetText:'',colors:['#08050f','#ff2bd6','#ffffff','#2a00ff'],
  set:{...opts,symmetry:'m6',echo:'step',copy:'ring',font:'unbounded',params:{...base,spikes:36,inner:.55,size:1.05,seed:61,length:.5,width:.6,lean:.6,valley:.3,teeth:.3,nest:5,nestStep:.78,copySize:.95,pad:10}},
  note:'A six-way mirrored burst, five levels stepping from magenta to violet, with the copy running round a ring inside it.'},
 {id:'crystal',name:'Snow crystal',after:'new — eight-way mirror',text:'SUB/ZERO',sheetText:'SUB/ZERO',colors:['#04081a','#04081a','#bfefff','#ffffff'],
  set:{...opts,symmetry:'m8',fill:'none',echo:'same',copy:'none',sheet:'bottom',font:'bebas',params:{...base,spikes:32,inner:.38,size:.84,cy:.42,seed:71,length:.4,width:.3,lean:.2,valley:.3,fork:.55,teeth:.6,nest:3,nestStep:.66,outline:2,glow:2,sheetSize:.8,margin:26}},
  note:'An eight-way mirrored burst with forked, barbed spikes, drawn three deep in glowing ice-blue lines.'},
 {id:'triskel',name:'Hook spin',after:'new — three-way mirror',text:'TURN',sheetText:'',colors:['#f2efe6','#e8241f','#111111','#111111'],
  set:{...opts,symmetry:'m3',copyInk:'paper',params:{...base,spikes:15,inner:.35,size:1,seed:81,length:.4,width:.5,lean:.3,valley:.2,bend:.85,swirl:.2,nest:2,nestStep:.55,nestTwist:20,pad:8}},
  note:'Three mirrored arms of hooked spikes turn round a black core; the copy is knocked out of it.'},
 {id:'corner',name:'Corner blast',after:'new — bleed',text:'BLAST',sheetText:'BLAST/OFF',info:'SA 04.07.2026 / HALLE 3 ZÜRICH / 22–06 UHR',colors:['#101010','#ff5a1f','#ffffff','#ffd21f'],
  set:{...opts,fill:'radial',copy:'none',sheet:'bottom',infoPlace:'bottom',params:{...base,spikes:30,inner:.3,size:2.3,cx:1.02,cy:-.02,seed:91,length:.5,width:.8,lean:.6,valley:.3,outlier:.6,sheetSize:.7,margin:136}},
  note:'A burst centred off the corner sends its spikes across the sheet; the type and an info line sit on the dark below.'},
 {id:'cross',name:'Crossing',after:'new — type across',text:'CROSS/FADE',sheetText:'',info:'CLUB NIGHT / EVERY FRIDAY',colors:['#0d0d0d','#ff2fd0','#ffffff','#ff2fd0'],
  set:{...opts,copy:'across',crossing:'paper',infoPlace:'bottom',font:'anton',params:{...base,spikes:22,inner:.5,size:1.1,aspect:1.3,rotate:10,seed:101,length:.55,width:.7,lean:.5,valley:.3,teeth:.25,copySize:.96}},
  note:'Giant type runs across the sheet in white and turns black where it crosses the magenta burst.'},
 {id:'chant',name:'Ring chant',after:'new — copy round a ring',text:'LOUDER/LOUDER',sheetText:'',colors:['#ffe600','#111111','#ffe600','#ff2b2b'],
  set:{...opts,copy:'ring',params:{...base,spikes:26,inner:.72,size:1.1,seed:111,length:.45,width:.5,lean:.4,valley:.3,jag:.4,nest:2,nestStep:.42,pad:12}},
  note:'A black burst with a red core; the copy chants round a ring between them.'}
];
// Controls carry when (all options must match), unless (dimmed when all match), need (a parameter above a value) and any (one of several gates).
const SPLIT=['halves','quadrants','pinwheel','shards'],ANY_TEXT={copy:['none'],sheet:['none'],infoPlace:['none']};
export const CONTROLS=[
 {key:'spikes',label:'Spikes',group:'burst',min:3,max:72,step:1},
 {key:'inner',label:'Valley depth (inner radius)',group:'burst',min:0,max:.95,step:.01},
 {key:'size',label:'Size',group:'burst',min:.2,max:2.5,step:.01},
 {key:'aspect',label:'Aspect',group:'burst',min:.3,max:3,step:.01,unless:{split:SPLIT,motif:['comb']}},
 {key:'rotate',label:'Rotation',group:'burst',min:0,max:360,step:1,when:{split:['none']}},
 {key:'cx',label:'Centre across',group:'burst',min:-.25,max:1.25,step:.01},
 {key:'cy',label:'Centre down',group:'burst',min:-.25,max:1.25,step:.01},
 {key:'seed',label:'Seed',group:'jitter',min:0,max:999,step:1},
 {key:'length',label:'Length jitter',group:'jitter',min:0,max:1,step:.01},
 {key:'width',label:'Width jitter',group:'jitter',min:0,max:1,step:.01},
 {key:'lean',label:'Angle jitter (lean)',group:'jitter',min:0,max:1,step:.01},
 {key:'valley',label:'Valley jitter',group:'jitter',min:0,max:1,step:.01,need:{inner:0}},
 {key:'tip',label:'Tip width',group:'jitter',min:0,max:1,step:.01},
 {key:'jag',label:'Short every other spike',group:'jitter',min:0,max:1,step:.01},
 {key:'spray',label:'Spray to one side',group:'jitter',min:0,max:1,step:.01},
 {key:'sprayAngle',label:'Spray direction',group:'jitter',min:0,max:360,step:1,need:{spray:0}},
 {key:'curve',label:'Side curvature',group:'jitter',min:-.8,max:.8,step:.01},
 {key:'swirl',label:'Swirl',group:'jitter',min:-.8,max:.8,step:.01},
 {key:'outlier',label:'Long outliers',group:'character',min:0,max:1,step:.01},
 {key:'bend',label:'Bend (hooked needles)',group:'character',min:-1,max:1,step:.01},
 {key:'fork',label:'Forked tips',group:'character',min:0,max:1,step:.01},
 {key:'teeth',label:'Side teeth',group:'character',min:0,max:1,step:.01},
 {key:'count',label:'Bursts',group:'layers',min:1,max:6,step:1,when:{split:['none']}},
 {key:'spread',label:'Spread',group:'layers',min:0,max:1,step:.01,when:{split:['none']},need:{count:1}},
 {key:'nest',label:'Nested levels',group:'layers',min:1,max:10,step:1},
 {key:'nestStep',label:'Level scale',group:'layers',min:.3,max:1.8,step:.01,need:{nest:1}},
 {key:'nestTwist',label:'Level twist',group:'layers',min:-60,max:60,step:1,when:{split:['none']},need:{nest:1}},
 {key:'nestSeed',label:'Re-seed levels',group:'layers',min:0,max:1,step:.01,need:{nest:1}},
 {key:'gap',label:'Pull parts apart',group:'split',min:0,max:80,step:1,unless:{split:['none']}},
 {key:'outline',label:'Outline',group:'paint',min:0,max:30,step:.5},
 {key:'echoWeight',label:'Echo line',group:'paint',min:.5,max:12,step:.1,when:{echo:['outline']},unless:{fill:['none']},need:{nest:1}},
 {key:'gradAngle',label:'Gradient direction',group:'paint',min:0,max:360,step:1,when:{fill:['linear']}},
 {key:'glow',label:'Glow',group:'paint',min:0,max:8,step:.1},
 {key:'copySize',label:'Copy size',group:'copy',min:.2,max:1,step:.01,unless:{copy:['none']}},
 {key:'pad',label:'Copy clearance',group:'copy',min:0,max:60,step:1,when:{copy:['inside','ring']}},
 {key:'tracking',label:'Tracking',group:'copy',min:-.15,max:.6,step:.005,unless:ANY_TEXT},
 {key:'leading',label:'Row spacing',group:'copy',min:.7,max:2,step:.01,unless:ANY_TEXT},
 {key:'sheetSize',label:'Sheet type size',group:'layout',min:.2,max:1,step:.01,unless:{sheet:['none']}},
 {key:'margin',label:'Sheet type margin',group:'layout',min:0,max:200,step:1,unless:{sheet:['none']}},
 {key:'infoSize',label:'Info size',group:'layout',min:.6,max:2,step:.01,unless:{infoPlace:['none']}},
 {key:'frame',label:'Paper frame',group:'layout',min:0,max:90,step:1},
 {key:'pen',label:'Pen width',group:'output',min:.4,max:4,step:.05},
 {key:'hatch',label:'Hatch spacing',group:'output',min:2,max:14,step:.1},
 {key:'screen',label:'Screen pitch',group:'output',min:2,max:10,step:.1},
 {key:'misregister',label:'Misregistration',group:'output',min:0,max:6,step:.1},
 {key:'grain',label:'Ink grain',group:'output',min:0,max:1,step:.01}
];
// Options that only apply to some modules, in the same form.
export const GATES={motif:{unless:{split:['none']}},parts:{unless:{split:['none']}},symmetry:{when:{split:['none']}},layout:{when:{split:['none']},need:{count:1}},merge:{when:{split:['none']},need:{count:1}},echo:{need:{nest:1},unless:{fill:['none']}},
 fit:{when:{copy:['inside']}},copyInk:{unless:{copy:['none']}},sheetInk:{any:[{unless:{sheet:['none']}},{unless:{infoPlace:['none']}}]},sheetFit:{unless:{sheet:['none']}},sheetLayer:{unless:{sheet:['none']}},
 crossing:{any:[{when:{copy:['across']}},{when:{sheetLayer:['over']},unless:{sheet:['none']}}]},font:{unless:ANY_TEXT}};
export const applies=(c,state)=>{const g=typeof c==='string'?GATES[c]??{}:c;if(g.any&&!g.any.some(x=>applies(x,state)))return false;return (!g.when||Object.entries(g.when).every(([k,v])=>v.includes(state[k])))&&!(g.unless&&Object.entries(g.unless).every(([k,v])=>v.includes(state[k])))&&(!g.need||Object.entries(g.need).every(([k,v])=>state.params[k]>v));};
export const n=v=>Math.round(v*100)/100;
const n1=v=>Math.round(v*10)/10,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,TAU=Math.PI*2,D2R=Math.PI/180;
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),lin=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
export const luminance=h=>{const [r,g,b]=rgb(h).map(lin);return .2126*r+.7152*g+.0722*b;};
export const contrast=(a,b)=>{const [x,y]=[luminance(a),luminance(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
const mix=(a,b,t)=>'#'+rgb(a).map((v,i)=>Math.round(lerp(v,rgb(b)[i],t)).toString(16).padStart(2,'0')).join('');
const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
// A seeded value in [0, 1) per key. Keys name the spike, not its place in a list, so sliders do not reshuffle the burst.
const rnd=(...k)=>{let h=0x2545f491;for(const v of k){h=Math.imul(h^(v|0),0x9e3779b1);h^=h>>>15;h=Math.imul(h,0x85ebca77);h^=h>>>13;}h=Math.imul(h^h>>>16,0xc2b2ae3d);return ((h^h>>>16)>>>0)/4294967296;};

// Text: any character of the chosen face. '/' or a line break starts a row.
export const LIMITS={text:{rows:4,chars:32},sheetText:{rows:4,chars:48},info:{rows:3,chars:90}};
export function normalizeText(input,font='archivo',fallback,limit=LIMITS.text,allowEmpty=false){
 const t=String(input??'').normalize('NFC').replace(/[‘’`´]/g,"'").replace(/\r?\n/g,'/').replace(/\s*\/\s*/g,'/').replace(/[ \t]+/g,' ').replace(/^\/+|\/+$/g,'').trim();
 if(!t){if(allowEmpty)return '';if(fallback!==undefined)return fallback;throw new Error('Type at least one character.');}
 const glyphs=FONTS[font]?.glyphs??{},bad=[...new Set([...t].filter(ch=>ch!=='/'&&!glyphs[ch]))];if(bad.length)throw new Error(`Not in ${FONTS[font]?.name??font}: ${bad.join(' ')}`);
 const rows=t.split('/');if(rows.length>limit.rows)throw new Error(`Use at most ${limit.rows} rows.`);if(rows.some(r=>!r.trim()))throw new Error('Rows cannot be empty.');
 if([...t.replace(/[ /]/g,'')].length>limit.chars)throw new Error(`Use at most ${limit.chars} characters.`);return rows.map(r=>r.trim()).join('/');}
const safeText=(v,font,d,limit,empty)=>{try{return normalizeText(v,font,d,limit,empty&&v==='');}catch{try{return normalizeText(d,font,'',limit,true);}catch{return '';}}};

const clampNum=(v,c,d)=>Number.isFinite(+v)&&v!==null&&v!==''&&typeof v!=='boolean'?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):d;
export function resolve(input={}){const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,params={};
 for(const c of CONTROLS)params[c.key]=clampNum(input.params?.[c.key],c,set.params[c.key]);
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k],font=pick('font');
 const colors=Array.isArray(input.colors)&&input.colors.length===4&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 return {engine:ENGINE,family:family.id,text:safeText(input.text,font,family.text,LIMITS.text),sheetText:safeText(input.sheetText??family.sheetText,font,family.sheetText,LIMITS.sheetText,true),info:safeText(input.info??family.info??'',font,family.info??'',LIMITS.info,true),
  stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,...Object.fromEntries(Object.keys(OPTIONS).map(k=>[k,pick(k)])),params,colors};}

// Glyph outlines: parsed once per face and character, flattened in font units.
const parsed=new Map();
function contours(font,ch){const key=font+'\u0000'+ch;if(parsed.has(key))return parsed.get(key);
 const tok=FONTS[font].glyphs[ch].d.match(/[MLQCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)||[],list=[];let i=0,cmd=null,cur=null;
 const take=k=>{const a=[];for(let j=0;j<k;j++)a.push([+tok[i+2*j],+tok[i+2*j+1]]);i+=2*k;return a;};
 while(i<tok.length){if(/[MLQCZ]/.test(tok[i]))cmd=tok[i++];else if(!cmd){i++;continue;}
  if(cmd==='M'){cur={start:take(1)[0],segs:[]};list.push(cur);cmd='L';}else if(cmd==='Z')cmd=null;else cur.segs.push([cmd,...take({L:1,Q:2,C:3}[cmd])]);}
 parsed.set(key,list);return list;}
function flatten(c,tol){const pts=[c.start];let p=c.start;
 for(const [k,...q] of c.segs){if(k==='L'){pts.push(q[0]);p=q[0];continue;}
  const P=[p,...q],d2=(a,b,e)=>Math.hypot(a[0]-2*b[0]+e[0],a[1]-2*b[1]+e[1]),dd=k==='Q'?d2(P[0],P[1],P[2]):Math.max(d2(P[0],P[1],P[2]),d2(P[1],P[2],P[3])),m=clamp(Math.ceil(Math.sqrt(dd/(4*tol))),1,48);
  for(let s=1;s<=m;s++){const t=s/m,u=1-t;pts.push(k==='Q'?[0,1].map(a=>u*u*P[0][a]+2*u*t*P[1][a]+t*t*P[2][a]):[0,1].map(a=>u*u*u*P[0][a]+3*u*u*t*P[1][a]+3*u*t*t*P[2][a]+t*t*t*P[3][a]));}
  p=P[P.length-1];}
 return pts;}
// Rows of glyphs in font units with their ink box; the box always spans the cap height.
function rowsOf(text,font,tracking){const F=FONTS[font];return text.split('/').map(row=>{let x=0;const glyphs=[];
 for(const ch of row){if(ch!==' ')glyphs.push({ch,x,cs:contours(font,ch).map(c=>({c,pts:flatten(c,1.5)}))});x+=F.glyphs[ch].adv+tracking*1000;}
 let x0=Infinity,x1=-Infinity,y0=-F.capHeight,y1=0;for(const g of glyphs)for(const {pts} of g.cs)for(const [a,b] of pts){x0=Math.min(x0,a+g.x);x1=Math.max(x1,a+g.x);y0=Math.min(y0,b);y1=Math.max(y1,b);}
 if(!glyphs.length){x0=0;x1=Math.max(1,x);}return {glyphs,x0,x1,y0,y1,w:Math.max(1,x1-x0)};});}
// Glyph outlines of a placed row: t gives the scale (sx, sy), the row origin x and the baseline y.
const placeRow=(row,t)=>row.glyphs.map(g=>{const X=a=>t.x+t.sx*(a+g.x),Y=b=>t.y+t.sy*b,pt=([a,b])=>n1(X(a))+' '+n1(Y(b));
 return {ch:g.ch,d:g.cs.map(({c})=>'M'+pt(c.start)+c.segs.map(([k,...q])=>k+q.map(pt).join(' ')).join('')+'Z').join(''),rings:g.cs.map(({pts})=>pts.map(([a,b])=>[X(a),Y(b)]))};});

// One run of spikes over angles a0..a1 at unit radius. An open run has a valley at each end, on the mirror axes.
// Valleys move by the width jitter, so spikes differ in width; tips lean inside their base by the angle jitter.
// A tip width cuts each tip into a slanted end; as the valleys reach the centre the spikes become wedges.
const tipWidth=P=>Math.max(P.tip,.3*(1-Math.min(1,P.inner/.12)));
function spikeRun(P,rand,a0,a1,k,closed){const span=a1-a0,step=span/k,va=[],vr=[],al=P.sprayAngle*D2R,dir=a=>(1+Math.cos(a-al))/2,pts=[],tw=tipWidth(P);
 for(let j=0;j<=k;j++){const fixed=!closed&&(j===0||j===k),a=a0+(j+(fixed?0:(rand(j,1)-.5)*P.width*.92))*step;va.push(a);vr.push(Math.min(.97,P.inner*(1+P.valley*(rand(j,2)-.5)*1.3))*(1-P.spray*.5*(1-dir(a))));}
 if(closed){va[k]=va[0]+span;vr[k]=vr[0];}
 for(let j=0;j<k;j++){const lo=va[j],hi=va[j+1],a=(lo+hi)/2+(rand(j,3)-.5)*P.lean*(hi-lo)*.9,v=(vr[j]+vr[j+1])/2,d=dir(a);
  let lf=(1-P.length*rand(j,4))*((1-P.spray)+P.spray*d*d);if(j%2)lf*=1-P.jag*.85;lf*=1+P.outlier*2.6*rand(j,6)**7;const r=Math.max(v+.02,v+(1-v)*lf);pts.push({a:lo,r:vr[j]});
  if(tw>0){const h=tw*(hi-lo)*.48;pts.push({a:clamp(a-h,lo+1e-3,hi),r,tip:true},{a:clamp(a+h,lo,hi-1e-3),r:Math.max(v+.02,r*(1-.3*tw*rand(j,5))),tip:true,cap:true});}else pts.push({a,r,tip:true});}
 if(!closed)pts.push({a:va[k],r:vr[k]});
 return dress(pts.map(p=>({x:p.r*Math.cos(p.a),y:p.r*Math.sin(p.a),tip:!!p.tip,cap:p.cap})),P,rand,1);}
// A comb: spikes rising from an edge at x = W toward x = 0, along 0 ≤ y ≤ H. The base closes beyond the edge.
function combRun(P,rand,W,H,k,depth,e){const step=H/k,ys=[],dv=[],pts=[],al=P.sprayAngle*D2R,tw=P.tip;
 for(let j=0;j<=k;j++){const fixed=j===0||j===k;ys.push((j+(fixed?0:(rand(j,1)-.5)*P.width*.92))*step);dv.push(depth*Math.min(.97,P.inner*(1+P.valley*(rand(j,2)-.5)*1.3)));}
 ys[0]=-e;for(let j=0;j<k;j++){const lo=ys[j],hi=ys[j+1],y=(Math.max(0,lo)+hi)/2+(rand(j,3)-.5)*P.lean*(hi-lo)*.9,v=(dv[j]+dv[j+1])/2,d=(1+Math.cos(Math.atan2(y,W-v)-al))/2;
  let lf=(1-P.length*rand(j,4))*((1-P.spray)+P.spray*d*d);if(j%2)lf*=1-P.jag*.85;lf*=1+P.outlier*2.6*rand(j,6)**7;const t=Math.max(v+depth*.02,v+(depth-v)*lf);pts.push({x:W-dv[j],y:lo});
  if(tw>0){const h=tw*(hi-lo)*.48;pts.push({x:W-t,y:clamp(y-h,lo,hi),tip:true},{x:W-Math.max(v+depth*.02,t*(1-.3*tw*rand(j,5))),y:clamp(y+h,lo,hi),tip:true,cap:true});}else pts.push({x:W-t,y,tip:true});}
 pts.push({x:W-dv[k],y:ys[k]},{x:W+4,y:ys[k]+4,base:true},{x:W+4,y:-e,base:true});return dress(pts,P,rand,-1);}
// Spike character on a run of points (valleys, tips, cut ends). Bend hooks each tip toward the side it leans from and bows both
// sides with it; a fork splits a tip into two prongs (or notches a cut end); teeth put sawtooth barbs on the sides, pointing to
// the tip. Spikes keep their seeded index, so values stay put while sliders move. orient turns (dy, −dx) into the outward normal.
function dress(pts,P,rand,orient){if(!P.bend&&!P.fork&&!P.teeth)return pts;const out=[],n=pts.length;let j=0;
 const spike=(A,T,C,B)=>{const mx=(A.x+B.x)/2,my=(A.y+B.y)/2,len=Math.hypot(T.x-mx,T.y-my)||1e-9,u=[(T.x-mx)/len,(T.y-my)/len];
  let wx=B.x-A.x,wy=B.y-A.y;const dd=wx*u[0]+wy*u[1];wx-=dd*u[0];wy-=dd*u[1];const wl=Math.hypot(wx,wy)||1e-9,w=[wx/wl,wy/wl],base=Math.hypot(B.x-A.x,B.y-A.y);
  const hook=-P.bend*len*.45,mv=q=>({...q,x:q.x+w[0]*hook,y:q.y+w[1]*hook});let top=[mv(T),...(C?[mv(C)]:[])];
  if(P.fork>0&&rand(j,7)<P.fork*1.4){const depth=len*P.fork*.55,t=top[0];
   if(top.length===2){const c=top[1];top=[t,{x:(t.x+c.x)/2-u[0]*depth,y:(t.y+c.y)/2-u[1]*depth,extra:true},c];}
   else{const half=Math.min(base*.4,len*.45)*P.fork,back=len*.22*P.fork*rand(j,8);
    top=[{...t,x:t.x-w[0]*half,y:t.y-w[1]*half},{x:t.x-u[0]*depth,y:t.y-u[1]*depth,extra:true},{x:t.x+w[0]*half-u[0]*back,y:t.y+w[1]*half-u[1]*back,tip:true,prong:true}];}}
  const tooth=(p,q,ch,rising)=>{if(!(P.teeth>0&&rand(j,ch)<P.teeth*1.5))return [];const dx=q.x-p.x,dy=q.y-p.y,L=Math.hypot(dx,dy)||1e-9,nx=dy/L*orient,ny=-dx/L*orient;
   const s0=.3+.25*rand(j,ch+1),s1=s0+.12+.08*rand(j,ch+2),h=L*P.teeth*(.1+.14*rand(j,ch+3)),at=t=>({x:p.x+dx*t,y:p.y+dy*t,extra:true,sharp:true}),a=at(s0),b=at(s1),barb=rising?b:a;
   return [a,{x:barb.x+nx*h,y:barb.y+ny*h,extra:true,sharp:true},b];};
  const r=[...tooth(A,top[0],10,true),...top,...tooth(top.at(-1),B,20,false)];j++;return r;};
 for(let i=0;i<n;i++){const p=pts[i];if(!p.tip){out.push(p);continue;}
  const A=pts[(i-1+n)%n],C=pts[i+1]?.cap?pts[i+1]:null,B=pts[(i+(C?2:1))%n];if(C)i++;out.push(...spike(A,p,C,B));}
 return out;}
// Quadratic sides between points: each bows along its outward normal by the curvature, rising sides by curve + swirl, falling sides by curve − swirl.
// Bend adds to the swirl. Cut tips, teeth and the closing base stay straight.
function sidesOf(pts,P,orient){const segs=[],n=pts.length;
 for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n],dx=b.x-a.x,dy=b.y-a.y,c=a.base||b.base||b.cap||a.sharp||b.sharp?0:clamp(P.curve+(b.tip?1:-1)*(P.swirl+P.bend*.6),-1,1)*.46*orient;
  segs.push([a.x,a.y,(a.x+b.x)/2+dy*c,(a.y+b.y)/2-dx*c,b.x,b.y]);}
 return segs;}
// The leading point of each spike, and the valleys between spikes (not teeth, notches or a comb's base).
const tipPoint=p=>p.tip&&!p.cap&&!p.prong,valleyPoint=p=>!p.tip&&!p.extra&&!p.base;
const mapSegs=(segs,f,rev)=>{const out=segs.map(s=>{const [a,b]=f(s[0],s[1]),[c,d]=f(s[2],s[3]),[e,g]=f(s[4],s[5]);return rev?[e,g,c,d,a,b]:[a,b,c,d,e,g];});return rev?out.reverse():out;};
const CL=ClipperLib,SCALE=100,toPaths=rings=>rings.map(r=>r.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)}))),fromPaths=paths=>paths.filter(q=>q.length>2).map(q=>q.map(v=>[v.X/SCALE,v.Y/SCALE]));
// Boolean operations on rings with Clipper on a 0.01 px grid: union (nonzero), xor (even-odd), and the subject's intersection
// with or difference from a clip.
function boolean(rings,op,clip){const c=new CL.Clipper(),out=new CL.Paths(),nz=CL.PolyFillType.pftNonZero;c.AddPaths(toPaths(rings),CL.PolyType.ptSubject,true);if(clip)c.AddPaths(toPaths(clip),CL.PolyType.ptClip,true);
 c.Execute({union:CL.ClipType.ctUnion,xor:CL.ClipType.ctUnion,and:CL.ClipType.ctIntersection,minus:CL.ClipType.ctDifference}[op],out,op==='xor'?CL.PolyFillType.pftEvenOdd:nz,nz);return fromPaths(out);}
const ringsPath=rings=>rings.map(r=>'M'+r.map(p=>n1(p[0])+' '+n1(p[1])).join('L')+'Z').join(''),rectRing=r=>[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]];
const pathOf=segs=>'M'+n1(segs[0][0])+' '+n1(segs[0][1])+segs.map(s=>{const straight=Math.hypot(s[2]-(s[0]+s[4])/2,s[3]-(s[1]+s[5])/2)<.05;return straight?'L'+n1(s[4])+' '+n1(s[5]):'Q'+n1(s[2])+' '+n1(s[3])+' '+n1(s[4])+' '+n1(s[5]);}).join('')+'Z';
function ringOf(segs){const pts=[];for(const s of segs){const dev=Math.hypot(s[2]-(s[0]+s[4])/2,s[3]-(s[1]+s[5])/2),m=dev<.3?1:clamp(Math.ceil(Math.sqrt(dev)*1.6),2,16);
 for(let i=0;i<m;i++){const t=i/m,u=1-t;pts.push([u*u*s[0]+2*u*t*s[2]+t*t*s[4],u*u*s[1]+2*u*t*s[3]+t*t*s[5]]);}}return pts;}

// n-way mirror: a run over half a wedge, reflected across the wedge's edge and turned round the centre n times. The aspect
// stretches the finished outline.
function mirrored(P,rand,R,sa,fold){const a=Math.PI/fold,half=spikeRun(P,rand,0,a,Math.max(1,Math.round(P.spikes/(2*fold))),false).map(p=>({...p,x:p.x*R,y:p.y*R})),base=sidesOf(half,P,1).slice(0,-1);
 const turn=(x,y,t)=>[x*Math.cos(t)-y*Math.sin(t),x*Math.sin(t)+y*Math.cos(t)],pieces=[],pts=[],st=(x,y)=>[x*sa,y/sa];
 for(let m=0;m<fold;m++){const t=2*a*m,f1=(x,y)=>turn(x,y,t),f2=(x,y)=>{const [u,v]=turn(x,-y,2*a);return turn(u,v,t);};pieces.push(mapSegs(base,f1,false),mapSegs(base,f2,true));
  for(const p of half){const [x,y]=f1(p.x,p.y);pts.push({...p,x,y});}for(const p of [...half].reverse()){const [x,y]=f2(p.x,p.y);pts.push({...p,x,y});}}
 return {segs:mapSegs(close(chain(pieces),null),st,false),pts:pts.map(p=>{const [x,y]=st(p.x,p.y);return {...p,x,y};})};}
// Layer placement for whole bursts: a single burst always sits at the centre.
function layerPlace(state,F,C,i,n){const P=state.params,u=Math.min(F.w,F.h),r=ch=>rnd(P.seed,i,99,7,0,ch);if(n===1)return {x:C[0],y:C[1],k:1,rot:0};
 const t=i/(n-1)-.5,s=P.spread;
 switch(state.layout){case 'row':return {x:C[0]+t*s*F.w,y:C[1]+(r(1)-.5)*s*u*.14,k:1,rot:r(2)*360};
  case 'column':return {x:C[0]+(r(1)-.5)*s*u*.14,y:C[1]+t*s*F.h,k:1,rot:r(2)*360};
  // Scatter: a sunflower spiral with seeded jitter, so bursts spread over the sheet; the first stays near the centre at full size.
  case 'scatter':{const a=i*2.39996+r(5)*TAU,d=Math.sqrt((i+.35*r(1))/n)*s;return {x:C[0]+Math.cos(a)*d*F.w*.48,y:C[1]+Math.sin(a)*d*F.h*.48,k:i?.45+.4*r(4):1,rot:r(2)*360};}
  case 'orbit':{const a=TAU*i/n-Math.PI/2;return {x:C[0]+Math.cos(a)*s*u*.4,y:C[1]+Math.sin(a)*s*u*.4,k:1,rot:r(2)*360};}
  default:return {x:C[0]+t*s*u*.5,y:C[1]+t*s*u*.5,k:.82**i,rot:r(2)*360};}}

// Geometry of every burst and part, in drawing order, plus what the stages and the copy need.
function bursts(state,F){const P=state.params,C=[F.x+P.cx*F.w,F.y+P.cy*F.h],nest=P.nest,sa=Math.sqrt(P.aspect),shapes=[];
 const rands=(layer,level,part)=>(j,ch)=>{const a=rnd(P.seed,layer,0,part,j,ch);return level&&P.nestSeed?lerp(a,rnd(P.seed,layer,level,part,j,ch),P.nestSeed):a;};
 const order=[...Array(nest).keys()].sort((a,b)=>P.nestStep**b-P.nestStep**a);
 if(state.split==='none'){const Rb=P.size*.5*Math.min(F.w,F.h);
  const fold={m3:3,m4:4,m6:6,m8:8}[state.symmetry]??0;
  for(let i=0;i<P.count;i++){const L=layerPlace(state,F,C,i,P.count);
   for(const l of order){const R=Rb*L.k*P.nestStep**l,rand=rands(i,l,0),{pts,segs}=fold?mirrored(P,rand,R,sa,fold):(()=>{const pts=spikeRun(P,rand,0,TAU,P.spikes,true).map(p=>({...p,x:p.x*R*sa,y:p.y*R/sa}));return {pts,segs:sidesOf(pts,P,1)};})();
    const rot=(P.rotate+L.rot+l*P.nestTwist)*D2R,cs=Math.cos(rot),sn=Math.sin(rot),f=(x,y)=>[L.x+x*cs-y*sn,L.y+x*sn+y*cs];
    shapes.push({layer:i,level:l,part:0,kind:'burst',segs:mapSegs(segs,f,false),centre:[L.x,L.y],R:R*Math.max(sa,1/sa),frame:{R,sa,rot},
     tips:pts.filter(tipPoint).map(p=>f(p.x,p.y)),valleys:pts.filter(valleyPoint).map(p=>f(p.x,p.y))});}}
  // Merged bursts: each level's layers become one outline, their union or their interference (overlaps cut out, even-odd).
  if(state.merge!=='none'&&P.count>1){const merged=order.map(l=>{const group=shapes.filter(s=>s.level===l),s0=group.find(s=>s.layer===0);
    return {...s0,rings:boolean(group.map(s=>ringOf(s.segs)),state.merge==='union'?'union':'xor'),members:group.length,tips:group.flatMap(s=>s.tips),R:Math.max(...group.map(s=>s.R))};});
   return {C,shapes:merged,parts:1,container:merged.find(s=>s.level===0)};}
  return {C,shapes,parts:1,container:shapes.find(s=>s.layer===0&&s.level===0)};}
 // Split: parts are quadrants q0 (+x +y), q1 (−x +y), q2 (−x −y), q3 (+x −y) in angular order, or halves (right, left). The split centre stays on the sheet.
 C[0]=clamp(C[0],F.x+1,F.x+F.w-1);C[1]=clamp(C[1],F.y+1,F.y+F.h-1);
 const halves=state.split==='halves',pin=state.split==='pinwheel',np=halves?2:4,sign=halves?[[1,1],[-1,1]]:[[1,1],[-1,1],[-1,-1],[1,-1]],ext=[F.x+F.w-C[0],C[0]-F.x,F.y+F.h-C[1],C[1]-F.y];
 const reach=Math.max(...[[F.x,F.y],[F.x+F.w,F.y],[F.x,F.y+F.h],[F.x+F.w,F.y+F.h]].map(([x,y])=>Math.hypot(x-C[0],y-C[1]))),Rb=P.size*reach;
 const Wx=pin?Math.max(...ext):Math.max(ext[0],ext[1]),Hy=halves?ext[2]+ext[3]:pin?Wx:Math.max(ext[2],ext[3]);
 const motifOf=q=>state.motif==='mixed'?(halves?(q?'comb':'burst'):(q<2?'comb':'burst')):state.motif;
 const clip=state.parts==='invert'||P.gap>0,g=P.gap/2,k=Math.max(1,Math.round(P.spikes/np));
 // A part's run is drawn in q0's frame (the right half for halves). Mirrored and pinwheel parts share one run per motif; free shards draw their own.
 const runOf=(q,l)=>{const m=motifOf(q),key=state.split==='shards'?q:(state.motif==='mixed'&&m==='burst'?3:0),rand=rands(0,l,key);
  if(m==='comb'){const vertical=state.split==='shards'&&q%2===1,W=vertical?Hy:Wx,depth=Math.min(1.25,P.size*.72)*W*P.nestStep**l;
   let segs=sidesOf(combRun(P,rand,W,vertical?Wx:Hy,k,depth,clip?0:.8),P,-1);if(vertical)segs=mapSegs(segs,(x,y)=>[y,x],false);if(halves)segs=mapSegs(segs,(x,y)=>[x,y-ext[3]],false);return {segs,comb:true,pts:[],R:Rb};}
  const R=Rb*P.nestStep**l,[a0,a1]=halves?[-Math.PI/2,Math.PI/2]:[0,Math.PI/2],pts=spikeRun(P,rand,a0,a1,k,false).map(p=>({...p,x:p.x*R*sa,y:p.y*R/sa}));
  return {segs:sidesOf(pts,P,1).slice(0,-1),comb:false,pts,R:R*Math.max(sa,1/sa)};};
 // The map from q0's frame into part q, and whether it reverses the run so that runs chain round the centre in angular order.
 const toPart=q=>pin?[(x,y)=>{const cs=[1,0,-1,0][q],sn=[0,1,0,-1][q];return [x*cs-y*sn,x*sn+y*cs];},false]:[(x,y)=>[x*sign[q][0],y*sign[q][1]],sign[q][0]*sign[q][1]<0];
 const place=(q,l,off)=>{const r=runOf(q,l),[f,rev]=toPart(q),d=off?[sign[q][0]*g,sign[q][1]*g]:[0,0],at=(x,y)=>{const [a,b]=f(x,y);return [C[0]+a+d[0],C[1]+b+d[1]];};
  return {...r,q,hub:[C[0]+d[0],C[1]+d[1]],segs:mapSegs(r.segs,at,rev&&!r.comb),tips:r.pts.filter(tipPoint).map(p=>at(p.x,p.y)),valleys:r.pts.filter(valleyPoint).map(p=>at(p.x,p.y))};};
 const rect=q=>{const [sx,sy]=sign[q],x0=sx>0?C[0]+g:F.x,x1=sx>0?F.x+F.w:C[0]-g,y0=halves?F.y:sy>0?C[1]+g:F.y,y1=halves?F.y+F.h:sy>0?F.y+F.h:C[1]-g;return {x:x0,y:y0,w:Math.max(0,x1-x0),h:Math.max(0,y1-y0)};};
 // Neighbouring burst runs chain into one outline (joined straight where they do not meet) and close through the centre,
 // unless they go all the way round; parts that pull apart or change colour stay separate.
 const groupsOf=runs=>{if(clip)return runs.map(r=>[r]);const gs=[];let cur=[];for(const r of runs){if(r.comb){if(cur.length)gs.push(cur);cur=[];gs.push([r]);}else cur.push(r);}if(cur.length)gs.push(cur);
  if(gs.length>1&&!gs[0][0].comb&&!gs.at(-1)[0].comb&&gs[0][0].q===0&&gs.at(-1).at(-1).q===np-1)gs[0]=[...gs.pop(),...gs[0]];return gs;};
 const outline=(group,full)=>{const segs=chain(group.map(r=>r.segs));return full?close(segs,null):close(segs,group[0].hub);};
 for(const l of order){const runs=[...Array(np).keys()].map(q=>place(q,l,true));
  for(const gr of groupsOf(runs)){const r=gr[0],full=gr.length===np;
   shapes.push({layer:0,level:l,part:gr.length===1?r.q:-1,kind:r.comb?'comb':'burst',segs:r.comb?r.segs:outline(gr,full),centre:[C[0],C[1]],R:r.R,clip:clip?rect(r.q):null,
    tips:gr.flatMap(x=>x.tips),valleys:gr.flatMap(x=>x.valleys),frame:{R:r.R,sa,rot:0,quarter:r.q,halves}});}}
 // The copy fits in the whole level-0 outline, even when the parts pull apart; with combs it takes the middle of the sheet.
 let container=null;if([...Array(np).keys()].every(q=>motifOf(q)==='burst')){const runs=[...Array(np).keys()].map(q=>place(q,0,false));container={segs:close(chain(runs.map(r=>r.segs)),null),centre:C,valleys:runs.flatMap(r=>r.valleys)};}
 return {C,shapes,parts:np,rect,container,sign,halves};}
const join=(a,b)=>[a[4],a[5],(a[4]+b[0])/2,(a[5]+b[1])/2,b[0],b[1]];
const chain=list=>{const segs=[];for(const s of list){const last=segs.at(-1);if(last&&Math.hypot(last[4]-s[0][0],last[5]-s[0][1])>.05)segs.push(join(last,s[0]));segs.push(...s);}return segs;};
const close=(segs,hub)=>{const e=segs.at(-1),s=segs[0];if(hub){const h=[0,0,0,0,hub[0],hub[1]];return [...segs,join(e,[hub[0],hub[1]]),join(h,s)];}return Math.hypot(e[4]-s[0],e[5]-s[1])>.05?[...segs,join(e,s)]:segs;};

// Horizontal chord of a polygon (edges ax ay bx by …) through the point (x, y), by nonzero winding.
function chord(E,y,x){const xs=[];for(let i=0;i<E.length;i+=4){const ay=E[i+1],by=E[i+3];if((ay<=y)!==(by<=y))xs.push([E[i]+(y-ay)*(E[i+2]-E[i])/(by-ay),by>ay?1:-1]);}
 xs.sort((a,b)=>a[0]-b[0]);let w=0,L=null;for(let m=0;m<xs.length;m++){w+=xs[m][1];if(w&&L===null)L=xs[m][0];if(!w&&L!==null){if(L<=x&&x<=xs[m][0])return [L,xs[m][0]];L=null;}}return null;}
const edgesOf=rings=>{const e=[];for(const r of rings)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];e.push(a[0],a[1],b[0],b[1]);}return Float64Array.from(e);};
export function inside(E,x,y){let w=0;for(let i=0;i<E.length;i+=4){const ax=E[i],ay=E[i+1],bx=E[i+2],by=E[i+3];if(ay<=y){if(by>y&&(bx-ax)*(y-ay)-(x-ax)*(by-ay)>0)w++;}else if(by<=y&&(bx-ax)*(y-ay)-(x-ax)*(by-ay)<0)w--;}return w!==0;}
export function distance(E,x,y){let d=Infinity;for(let i=0;i<E.length;i+=4){const ax=E[i],ay=E[i+1],dx=E[i+2]-ax,dy=E[i+3]-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);d=Math.min(d,Math.hypot(ax+t*dx-x,ay+t*dy-y));}return d;}
// Fits the copy inside a polygon and the sheet: rows share one height and centre in their own chord (fit), or stretch to fill it.
// A chord's ends move linearly between outline vertices and can jump only at one, so measuring a row's band at its ends
// and just above and below every vertex height inside it is exact. The largest height that clears the outline by the clearance on every side is found by bisection.
function fitCopy(rows,E,anchor,P,mode,cap,F){const k=rows.length,lead=P.leading*1.2,vy=Float64Array.from(E.filter((_,i)=>i%4===1)).sort(),from=y=>{let a=0,b=vy.length;while(a<b){const m=(a+b)>>1;if(vy[m]<y)a=m+1;else b=m;}return a;};
 const place=s=>{const Hb=cap*s*(1+(k-1)*lead),top=anchor[1]-Hb/2,out=[];
  for(let i=0;i<k;i++){const r=rows[i],y=top+cap*s*(1+i*lead),y0=y+r.y0*s-P.pad,y1=y+r.y1*s+P.pad;let L=-Infinity,R=Infinity;
   if(y0<F.y||y1>F.y+F.h)return null;const at=[y0,y1];for(let j=from(y0);j<vy.length&&vy[j]<y1;j++)at.push(Math.max(y0,vy[j]-1e-4),Math.min(y1,vy[j]+1e-4));
   for(const yy of at){const c=chord(E,yy,anchor[0]);if(!c)return null;L=Math.max(L,c[0],F.x);R=Math.min(R,c[1],F.x+F.w);}
   const avail=R-L-2*P.pad;if(avail<r.w*s*(mode==='stretch'?.45:1))return null;const sx=mode==='stretch'?Math.min(avail/r.w,s*2.4):s;out.push({x:(L+R)/2-(r.x0+r.w/2)*sx,y,sx,sy:s});}
  return out;};
 let lo=0,hi=E.length?4000/cap:0,best=null;
 for(let i=0;i<26;i++){const s=(lo+hi)/2,p=place(s);if(p){lo=s;best=p;}else hi=s;}
 if(!best)return [];const p=place(lo*P.copySize);return p??best;}
// Sheet type: rows share the size of the longest (one size) or each fills the width, up to a height set by the type size.
function sheetLayout(state,F,rows,cap){const P=state.params,m=P.margin,Wa=Math.max(20,F.w-2*m),maxH=P.sheetSize*F.h*.24,k=rows.length,lead=P.leading;
 const own=rows.map(r=>Math.min(Wa/r.w,maxH/(r.y1-r.y0))),one=Math.min(...own),s=state.sheetFit==='rows'?own:own.map(()=>one),h=rows.map((r,i)=>(r.y1-r.y0)*s[i]),gap=i=>cap*s[i]*.16*lead+cap*s[i]*(lead-1)*.6,out=[];
 const put=(i,top)=>{out[i]={x:F.x+m+(Wa-rows[i].w*s[i])/2-rows[i].x0*s[i],y:top-rows[i].y0*s[i],sx:s[i],sy:s[i]};};
 const stack=(ids,top)=>{let y=top;for(const i of ids){put(i,y);y+=h[i]+gap(i);}},up=(ids,bottom)=>{let y=bottom;for(const i of [...ids].reverse()){y-=h[i];put(i,y);y-=gap(i);}};
 const all=[...Array(k).keys()],mode=state.sheet;
 if(mode==='top')stack(all,F.y+m);else if(mode==='bottom')up(all,F.y+F.h-m);
 else if(mode==='split'){const t=Math.ceil(k/2);stack(all.slice(0,t),F.y+m);up(all.slice(t),F.y+F.h-m);}
 else{const total=h.reduce((a,b)=>a+b,0),free=F.h-2*m-total,gp=k>1?free/(k-1):0;let y=k>1?F.y+m:F.y+(F.h-total)/2;for(const i of all){put(i,y);y+=h[i]+gp;}}
 return out;}

// The whole scene for one stage: grounds, bursts, copy, and the stage-1 skeleton.
function scene(state,W,H){const P=state.params,m=P.frame,F={x:m,y:m,w:Math.max(40,W-2*m),h:Math.max(40,H-2*m)},B=bursts(state,F),font=FONTS[state.font],cap=font.capHeight;
 const c=state.colors,inks={paper:c[0],fill:c[1],line:c[2],accent:c[3]},items=[],uid=hashText(JSON.stringify(state)+W+'x'+H).toString(36);
 const [gx1,gy1,gx2,gy2]=(()=>{const a=P.gradAngle*D2R,u=[Math.cos(a),Math.sin(a)],cx=F.x+F.w/2,cy=F.y+F.h/2,t=Math.abs(u[0])*F.w/2+Math.abs(u[1])*F.h/2;return [cx-u[0]*t,cy-u[1]*t,cx+u[0]*t,cy+u[1]*t];})();
 // Paint of one burst level: layers alternate fill and accent when solid; nested levels follow the echo.
 const paintOf=(layer,l)=>{if(state.fill==='none')return null;const deep=P.nest>1;if(deep&&state.echo==='outline'&&l>0)return null;
  let a='fill',b='accent';if(state.fill==='solid'&&layer%2)[a,b]=[b,a];
  let tint=null;if(deep&&state.echo==='alternate'&&l%2)[a,b]=[b,a];if(deep&&state.echo==='step'){const t=l/(P.nest-1);tint={a,b,t};[a,b]=[mix(inks[a],inks[b],t),mix(inks[b],inks[a],t)];}
  if(state.fill==='solid')return tint?{ink:a,tint}:{ink:a};if(state.fill==='linear')return {grad:'linear',a,b,x1:gx1,y1:gy1,x2:gx2,y2:gy2};return {grad:'radial',a,b};};
 const strokeOf=(l,filled)=>{if(state.fill==='none')return P.outline>0?{ink:'line',w:P.outline}:null;if(P.nest>1&&state.echo==='outline'&&l>0)return {ink:'line',w:P.echoWeight};return filled&&P.outline>0?{ink:'line',w:P.outline}:null;};
 const invert=state.split!=='none'&&state.parts==='invert',oddPart=q=>invert&&q%2===1;
 if(invert)for(let q=0;q<B.parts;q++)if(oddPart(q)){const r=B.rect(q),segs=rectSegs(r.x,r.y,r.w,r.h);items.push({role:'ground',d:pathOf(segs),rings:[ringOf(segs)],fill:radialAt(paintOf(0,0),B.C,B.shapes[0]?.R??100)});}
 // Sheet type, the copy and the info line.
 const sheetRows=state.sheet!=='none'&&state.sheetText?rowsOf(state.sheetText,state.font,P.tracking):[],sheetT=sheetRows.length?sheetLayout(state,F,sheetRows,cap):[];
 const sheetGlyphs=sheetRows.flatMap((r,i)=>placeRow(r,sheetT[i]));
 // The copy container is the burst's own boundary: a union removes edges where hooked or curled spikes cross over one another.
 const Cn=B.container??{segs:rectSegs(F.x+F.w*.18,F.y+F.h*.3,F.w*.64,F.h*.4),centre:B.C,valleys:[]},Crings=Cn.rings??boolean([ringOf(Cn.segs)],'union'),CE=edgesOf(Crings);
 const anchor=Cn.valleys.length>2?(()=>{let x=0,y=0;for(const v of Cn.valleys){x+=v[0];y+=v[1];}const a=[x/Cn.valleys.length,y/Cn.valleys.length];return inside(CE,a[0],a[1])?a:Cn.centre;})():Cn.centre;
 let copyRows=[],copyT=[],copyGlyphs=[],ring=null;
 if(state.copy==='inside'||state.copy==='across'){copyRows=rowsOf(state.text,state.font,P.tracking);copyT=state.copy==='inside'?fitCopy(copyRows,CE,anchor,P,state.fit,cap,F):acrossLayout(state,F,copyRows,cap,anchor);copyGlyphs=copyT.length?copyRows.flatMap((r,i)=>placeRow(r,copyT[i])):[];}
 else if(state.copy==='ring'){ring=ringCopy(state,CE,anchor,cap);copyGlyphs=ring.glyphs;}
 const infoRows=state.infoPlace!=='none'&&state.info?rowsOf(state.info,state.font,P.tracking):[],infoT=infoRows.length?infoLayout(state,F,infoRows,cap):[],infoGlyphs=infoRows.flatMap((r,i)=>placeRow(r,infoT[i]));
 const textItems=(glyphs,ink)=>glyphs.map(g=>({role:'type',d:g.d,rings:g.rings,fill:{ink},ch:g.ch}));
 if(state.sheetLayer==='under')items.push(...textItems(sheetGlyphs,state.sheetInk));
 for(const s of B.shapes){const odd=oddPart(s.part),p0=paintOf(s.layer,s.level),fill=odd?(s.level===0?{ink:'paper'}:paintOf(s.layer,s.level-1)):p0,stroke=strokeOf(s.level,!!fill);
  if(!fill&&!stroke)continue;items.push({role:'burst',shape:s,d:s.rings?ringsPath(s.rings):pathOf(s.segs),rings:s.rings??[ringOf(s.segs)],fill:radialAt(fill,s.centre,s.R),stroke,clip:s.clip,glow:P.glow>0});}
 // Type crossing a burst: the parts inside the union of the bursts take the crossing ink, cut exactly with Clipper.
 const crossCopy=state.copy==='across'&&state.crossing!=='same',crossSheet=state.sheetLayer==='over'&&state.sheet!=='none'&&state.crossing!=='same';
 const area=crossCopy||crossSheet?boolean(items.filter(i=>i.role==='burst').flatMap(i=>i.clip?boolean(i.rings,'and',[rectRing(i.clip)]):i.rings),'union'):null;
 const crossItems=(glyphs,ink)=>glyphs.flatMap(g=>{const out=boolean(g.rings,'minus',area),inn=boolean(g.rings,'and',area);
  return [...(out.length?[{role:'type',d:ringsPath(out),rings:out,fill:{ink},ch:g.ch,crossable:true}]:[]),...(inn.length?[{role:'type',d:ringsPath(inn),rings:inn,fill:{ink:state.crossing},ch:g.ch,cross:true,crossable:true}]:[])];});
 if(state.sheetLayer==='over')items.push(...(crossSheet?crossItems(sheetGlyphs,state.sheetInk):textItems(sheetGlyphs,state.sheetInk)));
 items.push(...(crossCopy?crossItems(copyGlyphs,state.copyInk):textItems(copyGlyphs,state.copyInk)),...textItems(infoGlyphs,state.sheetInk));
 return {F,B,items,inks,uid,anchor,container:Crings,containerEdges:CE,copyT,copyRows,copyGlyphs,ring,sheetGlyphs,sheetT,sheetRows,infoGlyphs,infoT,infoRows,cap,area};}
// Copy across the sheet: one size, the longest row as wide as the copy size allows, the block centred on the burst and kept on the sheet.
function acrossLayout(state,F,rows,cap,anchor){const P=state.params,k=rows.length,lead=P.leading*1.2,s=Math.min(F.w*.94*P.copySize/Math.max(...rows.map(r=>r.w)),F.h*.3/cap),Hb=cap*s*(1+(k-1)*lead),top=clamp(anchor[1]-Hb/2,F.y,F.y+F.h-Hb);
 return rows.map((r,i)=>({x:F.x+(F.w-r.w*s)/2-r.x0*s,y:top+cap*s*(1+i*lead),sx:s,sy:s}));}
// Copy round a ring inside the burst: the copy repeats, joined by asterisks, round a circle about the anchor with letters
// upright to the outside. Every glyph point stays within the largest disc about the anchor that clears the outline by the clearance.
function ringCopy(state,E,anchor,cap){const P=state.params,rIn=distance(E,anchor[0],anchor[1])-P.pad,none={glyphs:[],h:0};if(!(rIn>12))return none;
 const F=FONTS[state.font],str=state.text.split('/').join(' * ')+' * ',row=rowsOf(str,state.font,P.tracking)[0],s=rIn*.3*P.copySize/cap;let half=0,rise=cap;
 const mid=row.glyphs.map(g=>{let x0=Infinity,x1=-Infinity;for(const {pts} of g.cs)for(const [a,b] of pts){x0=Math.min(x0,a);x1=Math.max(x1,a);rise=Math.max(rise,-b);}half=Math.max(half,(x1-x0)/2*s);return (x0+x1)/2;});
 const top=Math.sqrt(Math.max(0,rIn*rIn-half*half)),rb=top-rise*s;if(rb<rise*s*.3)return none;
 const adv=[...str].reduce((a,ch)=>a+F.glyphs[ch].adv+P.tracking*1000,0)*s,reps=Math.max(1,Math.floor(TAU*rb/adv)),k=TAU*rb/(reps*adv),glyphs=[];
 for(let rep=0;rep<reps;rep++)row.glyphs.forEach((g,i)=>{const phi=-Math.PI/2+(rep*adv+(g.x+mid[i])*s)*k/rb,cs=Math.cos(phi),sn=Math.sin(phi);
  const X=([a,b])=>{const dx=(a-mid[i])*s,r=rb-b*s;return [anchor[0]+r*cs-dx*sn,anchor[1]+r*sn+dx*cs];},pt=q=>{const [x,y]=X(q);return n1(x)+' '+n1(y);};
  glyphs.push({ch:g.ch,d:g.cs.map(({c})=>'M'+pt(c.start)+c.segs.map(([kk,...q])=>kk+q.map(pt).join(' ')).join('')+'Z').join(''),rings:g.cs.map(({pts})=>pts.map(X))});});
 return {glyphs,h:cap*s,rb,top};}
// Info lines: small rows set flush left in the top or bottom corner, one size, scaled down only to fit the width.
function infoLayout(state,F,rows,cap){const P=state.params,inset=Math.max(14,F.w*.03),s=Math.min(P.infoSize*F.h*.022/cap,...rows.map(r=>(F.w-2*inset)/r.w)),pitch=cap*s*1.5*P.leading,k=rows.length;
 return rows.map((r,i)=>({x:F.x+inset-r.x0*s,y:state.infoPlace==='top'?F.y+inset+cap*s+i*pitch:F.y+F.h-inset-(k-1-i)*pitch,sx:s,sy:s}));}
const radialAt=(p,c,R)=>p&&p.grad==='radial'?{...p,cx:c[0],cy:c[1],r:R}:p;
const rectSegs=(x,y,w,h)=>[[x,y,x+w/2,y,x+w,y],[x+w,y,x+w,y+h/2,x+w,y+h],[x+w,y+h,x+w/2,y+h,x,y+h],[x,y+h,x,y+h/2,x,y]];

// Ink of a paint in one output: poster colours, flat stage colours, or one separation (black, or white to knock out).
function colourOf(ink,ctx){if(ctx.sep)return ink===ctx.sep?'#000000':'#ffffff';return ink.startsWith('#')?ink:ctx.inks[ink];}
function svgPaint(p,ctx,defs,item){if(!p)return 'none';
 if(p.ink){if(ctx.sep&&ctx.tints&&p.tint){const {a,b,t}=p.tint;if(ctx.sep!==a&&ctx.sep!==b)return '#ffffff';ctx.screens.push({item,p:{uniform:true,cov:ctx.sep===b?t:1-t}});return '#ffffff';}return colourOf(p.ink,ctx);}
 if(ctx.flat)return colourOf(p.a,ctx);
 if(ctx.sep){if(p.a!==ctx.sep&&p.b!==ctx.sep)return '#ffffff';if(p.a===ctx.sep&&p.b===ctx.sep)return '#000000';ctx.screens.push({item,p});return '#ffffff';}
 const key=JSON.stringify(p),id=ctx.grads.get(key)??(()=>{const id=`g${ctx.uid}-${ctx.grads.size}`;ctx.grads.set(key,id);
  defs.push(p.grad==='linear'?`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}"><stop offset="0" stop-color="${colourOf(p.a,ctx)}"/><stop offset="1" stop-color="${colourOf(p.b,ctx)}"/></linearGradient>`
   :`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}"><stop offset="0" stop-color="${colourOf(p.a,ctx)}"/><stop offset="1" stop-color="${colourOf(p.b,ctx)}"/></radialGradient>`);return id;})();
 return `url(#${id})`;}
// A screen in one separation, inside the box: line screens band a linear gradient across its direction and a radial one in
// rings, each band as wide as the ink's share; halftone dots sit on a grid at the ink's angle with an area equal to the share.
// A flat tint is a line screen at the ink's angle.
const SCREEN_ANGLE={paper:0,fill:15,line:45,accent:75},disc=(x,y,r)=>`M${n1(x-r)} ${n1(y)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2*r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2*r)} 0Z`;
function screen(p,sep,box,pitch,shape){const out=[],[x0,y0,x1,y1]=box,mine=t=>p.b===sep?t:1-t;
 const share=p.uniform?()=>p.cov:p.grad==='linear'?(x,y)=>{const dx=p.x2-p.x1,dy=p.y2-p.y1;return mine(clamp(((x-p.x1)*dx+(y-p.y1)*dy)/(dx*dx+dy*dy||1),0,1));}:(x,y)=>mine(clamp(Math.hypot(x-p.cx,y-p.cy)/p.r,0,1));
 if(shape==='dots'||p.uniform){const ang=(SCREEN_ANGLE[sep]??30)*D2R,u=[Math.cos(ang),Math.sin(ang)],v=[-u[1],u[0]],cs=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]],pu=cs.map(([x,y])=>x*u[0]+y*u[1]),pv=cs.map(([x,y])=>x*v[0]+y*v[1]);
  const [i0,i1,j0,j1]=[Math.floor(Math.min(...pu)/pitch),Math.ceil(Math.max(...pu)/pitch),Math.floor(Math.min(...pv)/pitch),Math.ceil(Math.max(...pv)/pitch)];
  if(shape==='dots'){for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const x=u[0]*i*pitch+v[0]*j*pitch,y=u[1]*i*pitch+v[1]*j*pitch,r=pitch*Math.min(.75,Math.sqrt(share(x,y)/Math.PI));if(r>.15)out.push(disc(x,y,r));}}
  else{const w=p.cov*pitch;if(w>=.15)for(let j=j0;j<=j1;j++){const c=(j+.5)*pitch,q=[[i0*pitch,c-w/2],[i1*pitch,c-w/2],[i1*pitch,c+w/2],[i0*pitch,c+w/2]].map(([a,b])=>[u[0]*a+v[0]*b,u[1]*a+v[1]*b]);out.push('M'+q.map(z=>n1(z[0])+' '+n1(z[1])).join('L')+'Z');}}
  return `<path d="${out.join('')}" fill="#000000"/>`;}
 // Bands only where they cross the box, each just long enough to span it.
 if(p.grad==='linear'){const dx=p.x2-p.x1,dy=p.y2-p.y1,L=Math.hypot(dx,dy)||1,u=[dx/L,dy/L],v=[-u[1],u[0]],cs=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]],du=cs.map(([x,y])=>(x-p.x1)*u[0]+(y-p.y1)*u[1]),dv=cs.map(([x,y])=>(x-p.x1)*v[0]+(y-p.y1)*v[1]),v0=Math.min(...dv)-2,v1=Math.max(...dv)+2;
  for(let d=Math.max(0,Math.floor(Math.min(...du)/pitch)*pitch);d<Math.min(L,Math.max(...du)+pitch);d+=pitch){const w=mine((d+pitch/2)/L)*pitch;if(w<.15)continue;const c=[p.x1+u[0]*(d+pitch/2),p.y1+u[1]*(d+pitch/2)],q=[[-w/2,v0],[w/2,v0],[w/2,v1],[-w/2,v1]].map(([a,b])=>[c[0]+u[0]*a+v[0]*b,c[1]+u[1]*a+v[1]*b]);
   out.push('M'+q.map(z=>n1(z[0])+' '+n1(z[1])).join('L')+'Z');}return `<path d="${out.join('')}" fill="#000000"/>`;}
 for(let r=0;r<p.r+pitch;r+=pitch){const w=mine(Math.min(1,(r+pitch/2)/p.r))*pitch;if(w<.15)continue;for(const rr of [r+pitch/2-w/2,r+pitch/2+w/2])if(rr>0)out.push(disc(p.cx,p.cy,rr));}
 return `<path d="${out.join('')}" fill="#000000" fill-rule="evenodd"/>`;}
// Rings offset by d (outward when positive), for plotting an outline's width in pen passes.
function offsetRings(rings,d){const run=sg=>{const co=new CL.ClipperOffset(2,25),out=new CL.Paths();co.AddPaths(toPaths(rings),CL.JoinType.jtMiter,CL.EndType.etClosedPolygon);co.Execute(out,sg*d*SCALE);return out;};
 const area=ps=>ps.reduce((a,q)=>a+CL.Clipper.Area(q),0),before=area(toPaths(rings));let out=run(1);if((d>0)!==(Math.abs(area(out))>Math.abs(before)))out=run(-1);return fromPaths(out);}

// Plotter: one centreline per visible edge and hatching per ink, cut wherever a later shape covers them.
// Cover is decided on a 1 px raster of shape ids (nonzero winding), so lines stop within a pixel of what hides them.
function plotter(sc,W,H,state){const P=state.params,ids=new Int32Array(W*H),items=sc.items.filter(it=>it.role!=='ground'||it.fill);
 const fillRaster=(rings,id,clip)=>{const rows=new Map();for(const r of rings)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];if(a[1]===b[1])continue;const lo=Math.max(0,Math.ceil(Math.min(a[1],b[1])-.5)),hi=Math.min(H-1,Math.floor(Math.max(a[1],b[1])-.5));
   for(let y=lo;y<=hi;y++){const yy=y+.5;if((a[1]<=yy)===(b[1]<=yy))continue;const x=a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]);(rows.get(y)??rows.set(y,[]).get(y)).push([x,b[1]>a[1]?1:-1]);}}
  for(const [y,xs] of rows){if(clip&&(y+.5<clip.y||y+.5>clip.y+clip.h))continue;xs.sort((p,q)=>p[0]-q[0]);let w=0;for(let m=0;m<xs.length-1;m++){w+=xs[m][1];if(!w)continue;let x0=Math.ceil(xs[m][0]-.5),x1=Math.floor(xs[m+1][0]-.5);if(clip){x0=Math.max(x0,Math.ceil(clip.x-.5));x1=Math.min(x1,Math.floor(clip.x+clip.w-.5));}
   for(let x=Math.max(0,x0);x<=Math.min(W-1,x1);x++)ids[y*W+x]=id;}}};
 const ringsOf=it=>it.rings;
 items.forEach((it,i)=>{if(it.fill)fillRaster(ringsOf(it),i+1,it.clip);});
 const idAt=(x,y)=>{const i=Math.floor(x),j=Math.floor(y);return i<0||j<0||i>=W||j>=H?-1:ids[j*W+i];};
 const F=sc.F,inF=(x,y)=>x>=F.x-.5&&y>=F.y-.5&&x<=F.x+F.w+.5&&y<=F.y+F.h+.5,lines=new Map(),push=(ink,pts)=>{if(pts.length>1)(lines.get(ink)??lines.set(ink,[]).get(ink)).push(pts);};
 // Visible: a boundary point shows when a pixel beside it belongs to this shape or to one under it.
 const walk=(pts,ok,ink,closed)=>{let cur=[];const seq=closed?[...pts,pts[0]]:pts;for(let i=0;i<seq.length-1;i++){const a=seq[i],b=seq[i+1],m=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.2));
  for(let s=0;s<m;s++){const p=[lerp(a[0],b[0],s/m),lerp(a[1],b[1],s/m)];if(ok(p)){cur.push(p);}else{push(ink,cur);cur=[];}}}const e=seq.at(-1);if(ok(e))cur.push(e);push(ink,cur);};
 items.forEach((it,i)=>{const own=i+1,clip=it.clip,inClip=([x,y])=>inF(x,y)&&(!clip||(x>=clip.x-.5&&x<=clip.x+clip.w+.5&&y>=clip.y-.5&&y<=clip.y+clip.h+.5));
  const ok=p=>inClip(p)&&[[0,0],[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const v=idAt(p[0]+dx,p[1]+dy);return v>=0&&v<=own;});
  // Edges: a centreline, or an outline's full width in passes one pen apart.
  const edgeInk=it.stroke?it.stroke.ink:it.fill?.ink??it.fill?.a;if(it.role!=='ground'&&edgeInk&&edgeInk!=='paper'){const w=it.stroke?.w??0,np=state.plotEdges==='passes'&&w>P.pen*1.5?Math.round(w/P.pen):1;
   for(let k=0;k<np;k++){const d=(k-(np-1)/2)*w/np;for(const r of Math.abs(d)<1e-6?ringsOf(it):offsetRings(ringsOf(it),d))walk(r,ok,edgeInk,true);}}
  // Hatching: one angle per ink; a gradient keeps a share of its lines by an ordered threshold, so density follows the ink.
  const p=it.fill;if(!p||state.hatchStyle==='none')return;const parts=p.ink?[[p.ink,()=>1]]:[[p.a,t=>1-t],[p.b,t=>t]];
  for(const [ink,share,turn] of parts.flatMap(q=>state.hatchStyle==='cross'?[[...q,0],[...q,Math.PI/2]]:[[...q,0]])){if(ink==='paper')continue;const a=hatchAngle(ink)+turn,u=[Math.cos(a),Math.sin(a)],v=[-u[1],u[0]],pitch=P.hatch,R=Math.hypot(W,H),c=[W/2,H/2];
   const tOf=p.ink?null:p.grad==='linear'?(x,y)=>clamp(((x-p.x1)*(p.x2-p.x1)+(y-p.y1)*(p.y2-p.y1))/((p.x2-p.x1)**2+(p.y2-p.y1)**2||1),0,1):(x,y)=>clamp(Math.hypot(x-p.cx,y-p.cy)/p.r,0,1);
   const [bx0,by0,bx1,by1]=bounds(ringsOf(it));for(let k=-Math.ceil(R/pitch/2);k<=Math.ceil(R/pitch/2);k++){const th=((k*5%8+8)%8+.5)/8,o=[c[0]+v[0]*k*pitch,c[1]+v[1]*k*pitch];
    // Only the stretch of the line that crosses the shape's box is walked.
    const ts=[];for(const [x,y] of [[bx0,by0],[bx1,by0],[bx0,by1],[bx1,by1]])ts.push((x-o[0])*u[0]+(y-o[1])*u[1]);const vs=[bx0,bx1].flatMap(x=>[by0,by1].map(y=>(x-o[0])*v[0]+(y-o[1])*v[1]));if(Math.min(...vs)>0||Math.max(...vs)<0)continue;
    const t0=Math.min(...ts),t1=Math.max(...ts),A=[o[0]+u[0]*t0,o[1]+u[1]*t0],Bp=[o[0]+u[0]*t1,o[1]+u[1]*t1];
    walk([A,Bp],q=>inClip(q)&&idAt(q[0],q[1])===own&&(!tOf||share(tOf(q[0],q[1]))>=th),ink,false);}}});
 return lines;}
// A pen for each ink: inks too pale to see on white paper are drawn darker.
const penOf=c=>contrast(c,'#ffffff')<1.8?mix(c,'#000000',.55):c;
const hatchAngle=ink=>({fill:Math.PI/4,accent:-Math.PI/4,line:0}[ink]??(parseInt(ink.slice(1),16)%180)*D2R);
const bounds=rings=>{let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(const r of rings)for(const [x,y] of r){a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);}return [a,b,c,d];};
// Ramer–Douglas–Peucker on an open polyline: no dropped point lies more than eps from the line that replaces it.
function simplifyLine(pts,eps=.25){if(pts.length<3)return pts;const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const stack=[[0,pts.length-1]];
 while(stack.length){const [i,j]=stack.pop(),[ax,ay]=pts[i],[bx,by]=pts[j],dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy);let k=-1,dmax=eps;
  for(let m=i+1;m<j;m++){const d=L>1e-9?Math.abs((pts[m][0]-ax)*dy-(pts[m][1]-ay)*dx)/L:Math.hypot(pts[m][0]-ax,pts[m][1]-ay);if(d>dmax){dmax=d;k=m;}}if(k>0){keep[k]=1;stack.push([i,k],[k,j]);}}
 return pts.filter((_,i)=>keep[i]);}

// Stage 1, the skeleton: base ellipse and valley radius, spokes to the tips, the inner polygon, the copy box and the split axes.
function skeleton(sc,ink,P){const out=[],B=sc.B,F=sc.F;
 const ell=(s,k)=>{const {R,sa,rot}=s.frame,cs=Math.cos(rot),sn=Math.sin(rot),pts=[];for(let i=0;i<64;i++){const a=TAU*i/64,x=Math.cos(a)*R*k*sa,y=Math.sin(a)*R*k/sa;pts.push([s.centre[0]+x*cs-y*sn,s.centre[1]+x*sn+y*cs]);}return pts;};
 for(const s of B.shapes.filter(s=>s.level===0)){
  if(s.kind==='burst'&&s.frame.quarter===undefined)for(const k of [1,P.inner])if(k>0)out.push(`<path d="${line(ell(s,k))}Z" fill="none" stroke="${ink}" stroke-width=".8" stroke-dasharray="3 4"/>`);
  for(const t of s.tips)out.push(`<path d="M${n1(s.centre[0])} ${n1(s.centre[1])}L${n1(t[0])} ${n1(t[1])}" stroke="${ink}" stroke-width=".6" stroke-opacity=".55"/>`);
  if(s.valleys.length>1)out.push(`<path d="${line(s.valleys)}${s.kind==='burst'&&s.part<=0?'Z':''}" fill="none" stroke="#ff3b6b" stroke-width="1.2"/>`);
  out.push(...s.tips.map(t=>`<circle cx="${n1(t[0])}" cy="${n1(t[1])}" r="2.6" fill="${ink}"/>`),...s.valleys.map(v=>`<circle cx="${n1(v[0])}" cy="${n1(v[1])}" r="2" fill="#ff3b6b"/>`));
  if(s.kind==='comb')out.push(`<path d="${pathOf(s.segs)}" fill="none" stroke="${ink}" stroke-width=".8" stroke-dasharray="3 4"/>`);}
 if(B.parts>1){const [cx,cy]=B.C;out.push(`<path d="M${n1(cx)} ${F.y}V${F.y+F.h}${B.halves?'':`M${F.x} ${n1(cy)}H${F.x+F.w}`}" stroke="#ff3b6b" stroke-width="1" stroke-dasharray="8 5"/>`);}
 if(sc.ring?.h)out.push(...[sc.ring.rb,sc.ring.top].map(r=>`<circle cx="${n1(sc.anchor[0])}" cy="${n1(sc.anchor[1])}" r="${n1(r)}" fill="none" stroke="#2f6bff" stroke-width="1" stroke-dasharray="5 4"/>`));
 for(const t of [...sc.copyT.map((t,i)=>({t,r:sc.copyRows[i]})),...sc.sheetT.map((t,i)=>({t,r:sc.sheetRows[i]})),...sc.infoT.map((t,i)=>({t,r:sc.infoRows[i]}))]){const {t:q,r}=t;out.push(`<rect x="${n1(q.x+r.x0*q.sx)}" y="${n1(q.y+r.y0*q.sy)}" width="${n1(r.w*q.sx)}" height="${n1((r.y1-r.y0)*q.sy)}" fill="none" stroke="#2f6bff" stroke-width="1" stroke-dasharray="5 4"/>`);}
 out.push(`<path d="M${n1(sc.anchor[0]-7)} ${n1(sc.anchor[1])}h14M${n1(sc.anchor[0])} ${n1(sc.anchor[1]-7)}v14" stroke="#2f6bff" stroke-width="1.4"/>`);
 return out.join('');}
const line=pts=>'M'+pts.map(p=>n1(p[0])+' '+n1(p[1])).join('L');

// Renders a rule. Options: output 'poster' (filled shapes) or 'plotter' (centrelines and hatching, no fills),
// separate: one ink as black on white.
export function render(input={},o={}){const state=resolve(input),fmt=FORMATS[state.format],W=fmt.w,H=fmt.h,stage=state.stage,output=OUTPUTS.includes(o.output)?o.output:'poster',plot=output==='plotter',riso=output==='riso',sep=o.separate,P=state.params;
 const sc=scene(state,W,H),{F,uid,inks}=sc,defs=[`<clipPath id="f${uid}"><rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}"/></clipPath>`],body=[];
 const tints=state.sepMode==='tints',dark=luminance(inks.paper)<.3,ctx={inks,sep,tints,flat:stage===3,uid,grads:new Map(),screens:[]},bursts=sc.items.filter(i=>i.role==='burst');
 const feat={bursts:new Set(bursts.map(i=>i.shape.layer)).size,levels:P.nest,parts:sc.B.parts,shapes:bursts.length,spikes:bursts.reduce((a,i)=>a+i.shape.tips.length,0),glyphs:sc.copyGlyphs.length+sc.sheetGlyphs.length+sc.infoGlyphs.length};
 // Inks to print: every ink a shape uses; dark paper is printed as an ink of its own on white stock; tints fold step colours into their two inks.
 const used=new Set();for(const it of sc.items)if(stage===4||it.role!=='type'){const p=it.fill;if(p?.ink){if(tints&&p.tint){used.add(p.tint.a);used.add(p.tint.b);}else used.add(p.ink);}if(p?.grad){used.add(p.a);used.add(p.b);}if(it.stroke)used.add(it.stroke.ink);}
 used.delete('paper');if(dark)used.add('paper');const rank=k=>{const i=['paper','fill','accent','line'].indexOf(k);return i<0?9:i;},inkList=[...used].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b));
 const lineInk=inks.line===inks.paper?'#888888':inks.line;
 // Shapes in drawing order for one context (poster, flat stage or one separation), glow round the bursts.
 const paintAll=c=>{const out=[];let glowOpen=false;const glow=!c.sep&&stage===4&&P.glow>0;
  if(glow&&!defs.some(d=>d.startsWith(`<filter id="w${uid}"`)))defs.push(`<filter id="w${uid}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${n(P.glow*2.2)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
  for(const it of sc.items){if(it.role==='type'&&stage<4)continue;
   if(glow&&it.role==='burst'&&!glowOpen){out.push(`<g filter="url(#w${uid})">`);glowOpen=true;}if(glowOpen&&it.role!=='burst'){out.push('</g>');glowOpen=false;}
   const fill=svgPaint(it.fill,c,defs,it),screens=c.screens.splice(0),st=it.stroke?` stroke="${colourOf(it.stroke.ink,c)}" stroke-width="${n(it.stroke.w)}" stroke-linejoin="miter" stroke-miterlimit="6"`:'';
   const ca=clipAttr(it,defs,uid);out.push(`<path d="${it.d}" fill="${fill}"${st}${ca}/>`);
   // A gradient or tint in a separation: the shape knocks out in white, then its screen, then its outline again on top.
   for(const {item,p} of screens){const id=`s${uid}-${defs.length}`,[a,b,cc,d]=bounds(item.rings),box=[Math.max(a,F.x),Math.max(b,F.y),Math.min(cc,F.x+F.w),Math.min(d,F.y+F.h)];
    defs.push(`<clipPath id="${id}"><path d="${item.d}"/></clipPath>`);out.push(`<g${ca}><g clip-path="url(#${id})">${screen(p,c.sep,box,P.screen,state.screenShape)}</g></g>`);if(it.stroke)out.push(`<path d="${it.d}" fill="none"${st}${ca}/>`);}}
  if(glowOpen)out.push('</g>');return out.join('');};
 if(plot){const lines=plotter({...sc,items:sc.items.filter(it=>stage===4||it.role!=='type')},W,H,state);
  for(const [ink,runs] of lines)body.push(`<path d="${runs.map(r=>line(simplifyLine(r))).join('')}" fill="none" stroke="${penOf(ink.startsWith('#')?ink:inks[ink])}" stroke-width="${n(P.pen)}" stroke-linecap="round" stroke-linejoin="round" data-ink="${ink}"/>`);}
 else if(riso){// Riso preview: each separation printed in its ink, multiplied over the stock, shifted by a seeded misregistration and mottled by grain.
  inkList.forEach((k,i)=>{const col=k.startsWith('#')?k:inks[k],[r,g,b]=rgb(col).map(v=>n(v/255)),dx=n((rnd(P.seed,i,401)-.5)*2*P.misregister),dy=n((rnd(P.seed,i,402)-.5)*2*P.misregister),gr=P.grain;
   defs.push(`<filter id="r${uid}-${i}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} -0.2126 -0.7152 -0.0722 1 0" result="ink"/>`+
    `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${i+1}" result="noise"/><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${n(-1.6*gr)} 0 0 0 ${n(1+.55*gr)}" result="mask"/><feComposite in="ink" in2="mask" operator="in"/></filter>`);
   body.push(`<g transform="translate(${dx} ${dy})" style="mix-blend-mode:multiply"><g filter="url(#r${uid}-${i})">${k==='paper'?`<rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}" fill="#000000"/>`:''}${paintAll({...ctx,sep:k,flat:false,grads:new Map(),screens:[]})}</g></g>`);});}
 else if(stage===1)body.push(skeleton(sc,lineInk,P));
 else if(stage===2)body.push(bursts.map(it=>`<path d="${it.d}" fill="none" stroke="${lineInk}" stroke-width="1.2"${clipAttr(it,defs,uid)}/>`).join(''));
 else{if(sep==='paper')body.push(`<rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}" fill="#000000"/>`);body.push(paintAll(ctx));}
 const sheet=plot||sep?'#ffffff':riso?(dark?'#ffffff':inks.paper):inks.paper,title=`${state.text.replaceAll('/',' / ')} — shock burst, ${state.family}, ${plot?'plotter':riso?'riso preview':sep?'separation '+sep:['skeleton','outline','shapes','poster'][stage-1]}`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${title.replace(/[<>&]/g,'')}</title><defs>${defs.join('')}</defs><rect width="${W}" height="${H}" fill="${sheet}"/><g clip-path="url(#f${uid})">${body.join('')}</g></svg>`;
 return {svg,state,width:W,height:H,output,inks:inkList,features:{...feat,stage,inks:inkList.length}};}
function clipAttr(it,defs,uid){if(!it.clip)return '';const r=it.clip,id=`c${uid}-${n1(r.x)}-${n1(r.y)}`.replace(/\./g,'_');if(!defs.some(d=>d.includes(`id="${id}"`)))defs.push(`<clipPath id="${id}"><rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}"/></clipPath>`);return ` clip-path="url(#${id})"`;}

// Ink separations for screen or riso printing: one black-on-white sheet per ink of the poster pass. Later shapes knock
// out earlier ones; gradients and tints print as screens in their two inks. Dark paper prints as an ink of its own on white
// stock; light paper and glow stay with the printer.
export function separations(input={}){const r=render({...input,stage:4}),c=r.state.colors,roles={paper:c[0],fill:c[1],line:c[2],accent:c[3]};
 return r.inks.map(k=>({ink:k.startsWith('#')?'step-'+k.slice(1):k,colour:roles[k]??k,svg:render({...input,stage:4},{separate:k}).svg}));}

// The fitted scene of a rule, for checks and other systems: shapes with their outlines, tips and valleys, the copy container and glyphs.
export function geometry(input={}){const state=resolve(input),fmt=FORMATS[state.format],sc=scene(state,fmt.w,fmt.h);
 return {state,field:sc.F,centre:sc.B.C,shapes:sc.B.shapes.map(s=>{const rings=s.rings??[ringOf(s.segs)];return {layer:s.layer,level:s.level,part:s.part,kind:s.kind,ring:rings[0],rings,members:s.members??1,tips:s.tips,valleys:s.valleys,centre:s.centre,clip:s.clip??null};}),
  container:sc.container,containerEdges:sc.containerEdges,anchor:sc.anchor,area:sc.area,copy:sc.copyGlyphs.map(g=>g.rings),sheet:sc.sheetGlyphs.map(g=>g.rings),info:sc.infoGlyphs.map(g=>g.rings),
  copyCap:sc.ring?sc.ring.h:sc.copyT.length?sc.cap*sc.copyT[0].sy:0,sheetCap:sc.sheetT.length?Math.min(...sc.sheetT.map(t=>sc.cap*t.sy)):0,infoCap:sc.infoT.length?sc.cap*sc.infoT[0].sy:0,
  items:sc.items.map(i=>({role:i.role,fill:i.fill,stroke:i.stroke,ch:i.ch,cross:!!i.cross,crossable:!!i.crossable,rings:i.rings,clip:i.clip??null}))};}

// Eight seeds of the current rule on one sheet; data-seed names each cell.
export function seeds(input={},o={}){const state=resolve({...input,stage:4}),count=o.count??8,cols=o.cols??4,fmt=FORMATS[state.format],cw=240,ch=Math.round(cw*fmt.h/fmt.w),gap=12,W=cols*cw+(cols-1)*gap,rows=Math.ceil(count/cols),H=rows*ch+(rows-1)*gap;
 const cells=Array.from({length:count},(_,i)=>{const seed=(state.params.seed+i)%1000,r=render({...state,params:{...state.params,seed}}),x=(i%cols)*(cw+gap),y=Math.floor(i/cols)*(ch+gap);
  return `<svg x="${x}" y="${y}" width="${cw}" height="${ch}" viewBox="0 0 ${fmt.w} ${fmt.h}" data-seed="${seed}">${r.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</svg>`;});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${cells.join('')}</svg>`;}
