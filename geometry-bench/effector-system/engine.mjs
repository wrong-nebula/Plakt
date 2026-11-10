// Effectors: elements (grids, rules, dashes, rings, type, imported SVG) become clones.
// Effectors change each clone's position, scale, rotation, colour and depth through a field;
// modifiers then bend the finished outlines point by point. Everything is plain filled outlines.
import ClipperLib from 'clipper-lib';
import {FONTS} from './fonts.mjs';
import {COLOURS,MAX_COLOURS,isColourValue,colourPass,paintSVG} from './colour.mjs';
export {COLOURS,COLOUR_NAMES,COLOUR_TARGETS,RAMPS,BLENDS,colourHex} from './colour.mjs';
import {METHODS as DITHERS,dither as ditherGrid,blur as blurGrid,coverage as coverGrid} from '../heavy-dither-system/dither.mjs';
export const ENGINE='effectors-v1';
const TAU=Math.PI*2,DEG=Math.PI/180;
const hyp=(x,y)=>Math.sqrt(x*x+y*y),clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v,mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t),wrap180=a=>((a+180)%360+360)%360-180;

export const FORMATS={poster:{name:'Poster 1:√2',w:1000,h:1414},feed:{name:'Feed 4:5',w:1000,h:1250},square:{name:'Square',w:1000,h:1000},story:{name:'Story 9:16',w:1000,h:1778},wide:{name:'Landscape 16:9',w:1778,h:1000}};
// Paper, ink, accent. Ink clears 4.5:1 on paper in every preset.
export const PALETTES={
 acid:{name:'Night / acid',colors:['#07070a','#f1f0ea','#d7ff3a']},
 neon:{name:'Neon',colors:['#06050c','#3df5ff','#ff2bd6']},
 signal:{name:'Signal',colors:['#0b0b0b','#ffffff','#ff3b1f']},
 ultra:{name:'Ultramarine',colors:['#1c1cf0','#f4f4f0','#00ff9c']},
 mono:{name:'Graphite',colors:['#161618','#d9d9d4','#ff5a1f']},
 paper:{name:'Paper / ink',colors:['#ecebe6','#111114','#1d3de6']},
 ice:{name:'Ice / ink',colors:['#e6efff','#0a1440','#ff3d6e']},
 concrete:{name:'Concrete / orange',colors:['#d8d8d4','#161616','#ff4f00']},
 sun:{name:'Cream / vermilion',colors:['#f3ede0','#141210','#e5341d']}
};
export const FONT_LIST=Object.entries(FONTS).map(([id,f])=>({id,name:f.name,license:f.license,source:f.source}));

// Parameter specs drive normalization, the editor's controls and the verification sweep.
const R=(id,name,min,max,step,def,unit='')=>({id,name,type:'range',min,max,step,def,unit});
const S=(id,name,options,def)=>({id,name,type:'select',options,def});
const T=(id,name,def=false)=>({id,name,type:'toggle',def});
const X=(id,name,def,max)=>({id,name,type:'text',def,max});
const SHAPE_OPTIONS=[['square','Square'],['round','Rounded'],['circle','Circle'],['diamond','Diamond'],['pill','Pill'],['cross','Cross'],['triangle','Triangle'],['ring','Ring'],['eye','Eye'],['hexagon','Hexagon'],['star','Star']];
const FONT_OPTIONS=FONT_LIST.map(f=>[f.id,f.name]);
const SPEED=(def=1)=>R('cycles','Speed',0,4,1,def,'per loop');
const FORM=S('form','Waveform',[['sine','Sine'],['triangle','Zigzag'],['square','Square'],['saw','Saw']],'sine');

export const LAYERS={
 grid:{name:'Grid',about:'Cells in rows and columns.',params:[R('cols','Columns',3,90,1,24),R('aspect','Cell aspect',.25,4,.05,1),R('gap','Gap',0,.92,.01,.18),S('shape','Cell',SHAPE_OPTIONS,'square'),T('stagger','Stagger rows')]},
 lines:{name:'Rules',about:'Parallel rules, whole or cut into segments.',params:[S('direction','Direction',[['vertical','Vertical'],['horizontal','Horizontal']],'vertical'),R('count','Rules',3,160,1,40),R('weight','Weight',.04,.95,.01,.2),R('segments','Segments',1,80,1,1),R('segGap','Segment gap',0,.9,.01,.3),S('cap','Ends',[['flat','Flat'],['round','Round']],'flat')]},
 dashes:{name:'Dashes',about:'Rows of dashes with seeded lengths.',params:[R('rows','Rows',4,90,1,32),R('length','Dash length',.5,8,.1,2.2),R('density','Density',.15,1,.01,.55),R('weight','Weight',.08,.95,.01,.42)]},
 rings:{name:'Rings',about:'Concentric rings, whole or cut into arcs.',params:[R('count','Rings',2,60,1,14),R('weight','Weight',.05,.95,.01,.45),R('segments','Outer arcs',1,96,1,36),R('segGap','Arc gap',0,.9,.01,.25),S('fill','Reach',[['fit','Fit'],['cover','Cover the page']],'fit')]},
 text:{name:'Text',about:'Set type; every letter, word or line is one element.',params:[X('text','Text','EFFECT/ORS',80),S('font','Font',FONT_OPTIONS,'archivo'),S('unit','Elements',[['letters','Letters'],['words','Words'],['lines','Lines']],'letters'),R('size','Size',.2,1,.01,1),R('leading','Leading',.7,1.8,.01,1.08),R('tracking','Tracking',-.1,.4,.005,0),S('align','Align',[['left','Left'],['center','Centre'],['right','Right']],'center'),S('valign','Vertical',[['top','Top'],['center','Centre'],['bottom','Bottom']],'center')]},
 matrix:{name:'Type matrix',about:'A grid whose cells draw letters.',params:[X('text','Text','MATRIX',40),S('font','Font',FONT_OPTIONS,'archivo'),R('cols','Columns',12,120,1,60),S('shape','Cell',SHAPE_OPTIONS,'circle'),R('gap','Gap',0,.9,.01,.12),S('mode','Cells',[['mask','Inside the letters'],['coverage','Sized by coverage']],'mask'),R('ghost','Cells outside',0,1,.01,0),R('leading','Leading',.7,1.8,.01,1.05),R('size','Size',.2,1,.01,1)]},
 scatter:{name:'Scatter',about:'Seeded loose elements: confetti, stars, specks.',params:[R('count','Count',10,3000,1,400),R('size','Size',2,120,.5,14,'u'),R('variation','Size variation',0,1,.01,.6),S('shape','Shape',SHAPE_OPTIONS,'circle'),S('spread','Spread',[['even','Even'],['random','Random']],'even'),T('turn','Random turns')]},
 artwork:{name:'Artwork (SVG)',about:'Any filled SVG, such as an export from another system.',params:[S('split','Elements',[['shapes','Each shape'],['elements','Each SVG element']],'shapes'),S('colors','Colours',[['original','Original'],['palette','Palette']],'original'),T('ground','Keep its background',true),R('size','Size',.2,1,.01,1)]}
};
export const LAYER_COMMON=[T('on','Visible',true),R('opacity','Opacity',.05,1,.01,1),S('color','Colour',[['ink','Ink'],['accent','Accent'],['paper','Paper']],'ink'),S('area','Area',[['margin','Inside margins'],['bleed','Full bleed']],'margin')];

export const EFFECTORS={
 pinch:{name:'Pinch',about:'Shrinks elements in the field; positive grows them.',params:[R('amount','Amount',-1,2,.01,-.8)]},
 stretch:{name:'Stretch',about:'Scales width and height separately.',params:[R('width','Width',-1,3,.01,1.5),R('height','Height',-1,3,.01,0)]},
 twist:{name:'Twist',about:'Turns elements, or aims them at the field centre.',params:[S('mode','Mode',[['turn','Turn'],['aim','Aim at the centre'],['orbit','Around the centre']],'aim'),R('angle','Angle',-360,360,1,0,'°')]},
 watch:{name:'Watch',about:'Eye pupils look at the field centre; anything can turn to face it.',params:[R('look','Look',-1,1,.01,1),R('turn','Turn to face',0,1,.01,0)]},
 settle:{name:'Settle',about:'Scattered elements fall into place inside the field.',params:[S('mode','Mode',[['settle','Field settles'],['scatter','Field scatters']],'settle'),R('scatter','Scatter',0,6,.05,1.6,'cells'),S('axis','Axis',[['both','Both'],['x','Horizontal'],['y','Vertical']],'x'),R('spin','Spin',0,180,1,0,'°'),R('drift','Drift',0,4,1,0,'per loop')]},
 warp:{name:'Warp',about:'A lens: positions spread from the centre and elements magnify.',params:[R('amount','Amount',-1,1.5,.01,.6),R('grow','Magnify',0,1.5,.01,.8)]},
 pillars:{name:'Pillars',about:'Lifts elements into solid columns; walls fill the gap.',params:[R('height','Height',0,400,1,120,'u'),R('angle','Direction',-180,180,1,-90,'°'),R('shade','Wall shade',0,1,.01,.55)]},
 repel:{name:'Repel',about:'Pushes elements away from the centre; negative attracts.',params:[R('distance','Distance',-300,300,1,90,'u')]},
 shift:{name:'Shift',about:'Slides elements in one direction.',params:[R('distance','Distance',-400,400,1,80,'u'),R('angle','Direction',-180,180,1,0,'°')]},
 wave:{name:'Wave',about:'A travelling sine wave through position, size, rotation or colour.',params:[S('channel','Moves',[['position','Position'],['scale','Size'],['rotation','Rotation'],['tone','Colour']],'position'),R('amount','Amount',0,1,.01,.3),R('wavelength','Wavelength',60,2000,10,420,'u'),R('angle','Direction',-180,180,1,0,'°'),FORM,SPEED()]},
 jitter:{name:'Jitter',about:'Seeded random offsets, turns and sizes.',params:[R('move','Move',0,150,1,18,'u'),R('turn','Turn',0,180,1,25,'°'),R('size','Size',0,1,.01,.2),SPEED(0)]},
 spin:{name:'Spin',about:'Rotation over the loop, delayed with distance from the centre.',params:[R('turns','Turns',-4,4,1,1,'per loop'),R('lag','Lag',0,3,.01,.8)]},
 tone:{name:'Tone',about:'Blends towards the accent colour and fades.',params:[R('color','Accent',-1,1,.01,1),R('fade','Fade',0,1,.01,0)]},
 flow:{name:'Flow',about:'Carries elements along a swirling flow field, optionally turning them with it.',params:[R('distance','Distance',0,400,1,90,'u'),R('scale','Detail',.3,10,.1,2.4),R('align','Turn with the flow',0,1,.01,.8),SPEED(1)]},
 recolour:{name:'Recolour',about:'Picks elements by pattern and turns them to the accent, or knocks them out.',params:[S('pattern','Pattern',[['random','Random'],['checker','Checker'],['rows','Rows'],['columns','Columns']],'random'),R('share','Random share',0,1,.01,.3),S('to','Turns to',[['accent','Accent'],['paper','Paper (knock out)']],'accent')]},
 snap:{name:'Snap',about:'Quantizes angles and sizes inside the field.',params:[R('angle','Angle step',0,90,1,45,'°'),R('levels','Size levels',0,8,1,0)]}
};
// Kinds: point modifiers move every outline point; cut modifiers clip and copy outlines;
// outline modifiers rebuild each element's own shape before it is placed.
export const MODIFIER_KINDS={point:'Bend the outlines',poly:'Cut, mirror and repeat',shape:'Rebuild the outline'};
export const MODIFIERS={
 lens:{name:'Lens',kind:'point',about:'Bulges outlines out from the centre; negative pinches them.',params:[R('amount','Amount',-1,1.5,.01,.55)]},
 twirl:{name:'Twirl',kind:'point',about:'Swirls outlines around the centre.',params:[R('angle','Angle',-720,720,1,180,'°')]},
 ripple:{name:'Ripple',kind:'point',about:'Concentric waves out from the centre.',params:[R('amplitude','Amplitude',0,80,.5,14,'u'),R('wavelength','Wavelength',10,400,1,90,'u'),FORM,SPEED()]},
 wave:{name:'Wave',kind:'point',about:'Bends outlines along a sine, zigzag, square or saw wave.',params:[R('amplitude','Amplitude',0,160,.5,30,'u'),R('wavelength','Wavelength',40,2000,10,500,'u'),R('angle','Direction',-180,180,1,0,'°'),FORM,SPEED()]},
 turbulence:{name:'Turbulence',kind:'point',about:'Smooth noise displacement.',params:[R('amplitude','Amplitude',0,160,.5,24,'u'),R('scale','Detail',.5,24,.1,4),SPEED()]},
 shear:{name:'Shear',kind:'point',about:'Slants outlines across an axis.',params:[R('amount','Amount',-1.5,1.5,.01,.4),R('angle','Direction',-180,180,1,0,'°')]},
 taper:{name:'Taper',kind:'point',about:'Widens one end of an axis and narrows the other.',params:[R('amount','Amount',-1.5,1.5,.01,.6),R('angle','Axis',-180,180,1,90,'°')]},
 pixelate:{name:'Pixelate',kind:'point',about:'Snaps outline points to a grid.',params:[R('size','Cell',1,80,.5,16,'u')]},
 displace:{name:'Displace',kind:'point',about:'Lifts outlines by the field’s height: ridges, strata, terrain.',params:[R('amount','Height',-400,400,1,-140,'u'),R('angle','Direction',-180,180,1,90,'°')]},
 bend:{name:'Bend',kind:'point',about:'Bends everything into an arch; the field size wraps through the angle.',params:[R('angle','Bend',-360,360,1,90,'°'),R('axis','Axis',-180,180,1,0,'°')]},
 polar:{name:'Polar',kind:'point',about:'Rolls the page into a disc: across runs around, down runs inward.',params:[R('span','Span',30,1080,1,360,'°'),R('hole','Centre hole',0,.95,.01,.15),R('spiral','Spiral',-1,1,.01,0),R('turn','Turn',-180,180,1,0,'°'),T('flip','Top row inside')]},
 spherize:{name:'Spherize',kind:'point',about:'Wraps outlines round a sphere or a cylinder; negative pinches to the rim.',params:[S('shape','Shape',[['sphere','Sphere'],['vertical','Vertical cylinder'],['horizontal','Horizontal cylinder']],'sphere'),R('amount','Amount',-1,1,.01,1)]},
 ribbon:{name:'Ribbon',kind:'point',about:'Twists a strip round its own axis until it shows its back.',params:[R('twist','Twist',-720,720,1,180,'°'),R('axis','Axis',-180,180,1,0,'°'),SPEED(1)]},
 envelope:{name:'Envelope',kind:'point',about:'Warps a box: arc, bulge, shell, flag or rise; negative squeezes.',params:[S('style','Style',[['bulge','Bulge'],['arc','Arc'],['upper','Shell upper'],['lower','Shell lower'],['flag','Flag'],['rise','Rise']],'bulge'),R('amount','Amount',-1,1,.01,.5),R('height','Box height',.1,2,.01,.5)]},
 perspective:{name:'Perspective',kind:'point',about:'Tilts the plane away in depth towards a vanishing point.',params:[R('tilt','Tilt',-80,80,1,-50,'°'),R('axis','Hinge',-180,180,1,0,'°'),R('distance','Viewing distance',.4,6,.05,1.6)]},
 melt:{name:'Melt',kind:'point',about:'Drips and smears outlines unevenly in one direction.',params:[R('length','Length',0,600,1,140,'u'),R('width','Drip width',4,200,1,36,'u'),R('angle','Direction',-180,180,1,90,'°'),SPEED(0)]},
 fold:{name:'Fold',kind:'point',about:'Folds the page back along a line, in perspective.',params:[R('angle','Fold',-180,180,1,65,'°'),R('axis','Fold line',-180,180,1,0,'°')]},
 roughen:{name:'Roughen',kind:'point',about:'Erodes edges into a torn or photocopied outline.',params:[R('amount','Amount',0,40,.5,5,'u'),R('grain','Grain',1,40,.5,6,'u'),SPEED(0)]},
 petal:{name:'Petal',kind:'point',about:'Pushes each element’s outline in and out in lobes round its own centre, like pucker and bloat.',params:[R('lobes','Lobes',2,24,1,6),R('amount','Amount',-1,1,.01,.3),SPEED(0)]},
 swirl:{name:'Swirl',kind:'point',about:'Twists each element round its own centre, most in the middle.',params:[R('angle','Angle',-720,720,1,140,'°')]},
 zigzag:{name:'Zigzag edge',kind:'poly',about:'Serrates or scallops every edge with regular ridges.',params:[R('size','Size',0,40,.5,6,'u'),R('spacing','Ridge spacing',2,80,.5,12,'u'),S('style','Ridges',[['sharp','Sharp'],['smooth','Smooth']],'sharp')]},
 tiles:{name:'Tiles',kind:'poly',about:'Chops outlines on a square grid and knocks each tile out of place.',params:[R('size','Tile',6,400,1,60,'u'),R('offset','Offset',0,200,1,22,'u'),S('pattern','Pattern',[['random','Random'],['alternate','Alternate'],['wave','Wave']],'random'),S('axis','Moves',[['both','Both ways'],['x','Sideways'],['y','Up and down']],'both'),R('tone','Recoloured tiles',0,1,.01,0),SPEED(0)]},
 dial:{name:'Dial',kind:'poly',about:'Cuts concentric rings round the centre and turns each one, like a combination lock.',params:[R('width','Ring width',6,400,1,70,'u'),R('angle','Turn',-180,180,1,25,'°'),S('pattern','Pattern',[['alternate','Alternate'],['random','Random'],['wave','Wave'],['ramp','Ramp']],'alternate'),SPEED(0)]},
 burst:{name:'Burst',kind:'poly',about:'Cuts wedges round the centre and pushes them out, like an exploded pie.',params:[R('sectors','Wedges',3,48,1,12),R('offset','Push',-200,300,1,40,'u'),R('turn','Turn',-90,90,.5,0,'°'),R('angle','Start angle',-180,180,1,0,'°'),S('pattern','Pattern',[['alternate','Alternate'],['even','Every wedge'],['random','Random'],['wave','Wave']],'alternate'),SPEED(1)]},
 repeat:{name:'Repeat',kind:'poly',about:'Steps and repeats the whole page in a grid of tiles, mirrored and recoloured.',params:[R('cols','Columns',1,8,1,2),R('rows','Rows',1,8,1,2),R('gap','Gap',0,.4,.01,.04),S('mirror','Mirror',[['none','None'],['x','Across'],['y','Down'],['both','Both']],'none'),R('tone','Alternate colour',-1,1,.01,1)]},
 shadow:{name:'Shadow',kind:'poly',about:'Casts a long or drop shadow behind every outline.',params:[S('style','Style',[['long','Long'],['drop','Drop']],'long'),R('length','Length',0,600,1,90,'u'),R('angle','Direction',-180,180,1,45,'°'),R('tone','Colour shift',-1,1,.01,1),R('opacity','Opacity',0,1,.01,.6)]},
 mirror:{name:'Mirror',kind:'poly',about:'Keeps one side of an axis and reflects it onto the other.',params:[R('angle','Axis',-180,180,1,0,'°'),S('keep','Keep',[['a','Upper side'],['b','Lower side']],'a')]},
 kaleido:{name:'Kaleidoscope',kind:'poly',about:'Cuts a wedge and repeats it round the centre.',params:[R('segments','Segments',2,24,1,6),S('mode','Mode',[['mirror','Mirrored wedges'],['rotate','Rotated wedges'],['copies','Whole copies']],'mirror'),R('angle','Start angle',-180,180,1,-90,'°')]},
 echo:{name:'Echo',kind:'poly',about:'Repeats outlines in steps: trails, tunnels and colour offsets.',params:[R('copies','Copies',1,24,1,6),R('distance','Step',-200,200,1,24,'u'),R('angle','Direction',-180,180,1,45,'°'),R('scale','Scale step',.5,1.5,.01,1),R('turn','Turn step',-90,90,.5,0,'°'),R('tone','Colour shift',-1,1,.01,1),R('fade','Fade',0,1,.01,.4)]},
 slice:{name:'Slice',kind:'poly',about:'Cuts outlines into bands and slides each band.',params:[R('height','Band',4,400,1,40,'u'),R('angle','Angle',-180,180,1,0,'°'),R('offset','Offset',-300,300,1,40,'u'),R('gap','Gap',0,.9,.01,0),S('pattern','Pattern',[['alternate','Alternate'],['random','Random'],['wave','Wave'],['ramp','Ramp']],'alternate'),SPEED(0)]},
 shatter:{name:'Shatter',kind:'poly',about:'Cuts outlines along seeded lines and pulls the pieces apart.',params:[R('cuts','Cuts',1,8,1,3),R('gap','Gap',0,200,1,30,'u'),R('spin','Spin',0,60,.5,6,'°')]},
 screen:{name:'Screen',kind:'shape',about:'Rebuilds each outline as a print screen of dots, squares, crosses or lines; outside the field it stays solid.',params:[S('pattern','Pattern',[['dots','Dots'],['squares','Squares'],['crosses','Crosses'],['lines','Lines']],'dots'),R('pitch','Pitch',3,80,.5,12,'u'),R('size','Size',.1,1.2,.01,.75),R('angle','Angle',-90,90,1,45,'°'),S('fit','Edges',[['centre','Cell centres'],['coverage','Sized by coverage']],'coverage')]},
 dither:{name:'Dither',kind:'shape',about:'Rebuilds each outline as a heavy 1-bit dither: edges spread into pixel gradients, fills lighten into patterns and grain breaks them up; outside the field it stays solid.',params:[S('method','Dither',Object.entries(DITHERS).map(([k,d])=>[k,d.name]),'atkinson'),R('pixel','Pixel',2,60,.5,8,'u'),R('spread','Edge spread',0,240,1,28,'u'),R('tone','Lighten fills',0,1,.01,.25),R('relief','Relief',0,1,.01,.6),R('light','Light from',-180,180,1,-135,'°'),R('grain','Grain',0,1,.01,.35),R('contrast','Contrast',.3,4,.05,1.3),R('order','Ordered checks',0,1,.01,0),S('mark','Pixels',[['pixel','Square pixels'],['led','LED (gapped)'],['dot','Dots'],['scan','Scan lines']],'pixel'),S('grid','Pixel grid',[['page','Page (shared by every element)'],['element','Each element']],'page')]},
 weight:{name:'Weight',kind:'shape',about:'Thickens or thins every outline by an offset; the field sets how much.',params:[R('amount','Offset',-40,60,.5,8,'u'),S('join','Corners',[['miter','Sharp'],['round','Round']],'miter')]},
 round:{name:'Round',kind:'shape',about:'Rounds convex corners, inner corners, or both.',params:[R('radius','Radius',0,80,.5,14,'u'),S('corners','Corners',[['outer','Outer'],['inner','Inner'],['both','Both']],'outer')]},
 outline:{name:'Outline',kind:'shape',about:'Keeps only a band along each edge: inside, centred or outside.',params:[R('width','Width',.5,60,.5,6,'u'),S('position','Position',[['inside','Inside'],['centre','Centred'],['outside','Outside (halo)']],'inside'),S('join','Corners',[['miter','Sharp'],['round','Round']],'miter')]},
 inline:{name:'Inline',kind:'shape',about:'Turns each outline into concentric contour bands; the field sets how many.',params:[R('rings','Rings',1,12,1,4),R('step','Spacing',1,80,.5,10,'u'),R('weight','Band weight',.1,.95,.01,.55),S('join','Corners',[['round','Round'],['miter','Sharp']],'round')]}
};
export const EFFECT_COMMON=[T('on','On',true),R('strength','Strength',0,1,.01,1)];
// A group combines bending and cutting modifiers. Its field and strength mask every child, so a group fades as one.
// Chain feeds each child the last one's result; Add and Average move each point by the children's summed or mean
// displacements, measured from the same starting point. Cutting children always run in order, after the blend.
export const GROUP={name:'Group',about:'Combines modifiers: chained, or their displacements added or averaged. The group’s field masks them all.',
 params:[S('op','Combine',[['chain','Chain: each feeds the next'],['add','Add displacements'],['average','Average displacements']],'chain')]};
export const MAX_CHILDREN=8;
export const FIELD=[S('shape','Shape',[['radial','Radial'],['linear','Linear'],['ring','Ring'],['box','Box'],['noise','Noise'],['conic','Angle sweep'],['all','Everywhere']],'radial'),
 S('drive','Motion',[['static','Still'],['orbit','Orbit'],['sweep','Sweep'],['wander','Wander'],['pulse','Pulse'],['rotate','Rotate']],'static'),T('follow','Follow the pointer',true),
 R('x','Centre x',0,1,.001,.5),R('y','Centre y',0,1,.001,.5),R('radius','Size',.02,1.5,.01,.35),R('softness','Softness',0,1,.01,.7),R('angle','Angle',-180,180,1,0,'°'),
 R('travel','Travel',0,.8,.01,.25),R('cycles','Cycles',1,4,1,1,'per loop'),R('scale','Noise detail',.5,12,.1,3),R('steps','Steps',0,12,1,0),T('invert','Invert')];
// Which field controls matter for a given shape and motion.
export function fieldRelevant(id,f){
 if(id==='angle')return ['linear','box','conic'].includes(f.shape)||['sweep','rotate'].includes(f.drive);
 if(id==='scale')return f.shape==='noise';
 if(id==='softness'||id==='radius')return f.shape!=='all'&&f.shape!=='conic'&&!(id==='radius'&&f.shape==='noise');
 if(id==='travel')return ['orbit','sweep','wander'].includes(f.drive);
 if(id==='cycles')return f.drive!=='static';
 if(id==='steps')return f.shape!=='all';
 return true;}
export function layerRelevant(id,L){
 if(id==='segGap')return L.segments>1;
 if(id==='cap')return L.type==='lines';
 return true;}

// ---------------------------------------------------------------- numbers, noise, colour
// Seeded value in [0, 1). The final >>>0 matters: XOR yields a signed 32-bit integer.
function hash(...n){let h=2166136261>>>0;for(const v of n){h=Math.imul(h^(v|0),16777619)>>>0;h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;}return (h>>>0)/4294967296;}
export function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const PERM=(()=>{const r=rng(1337),p=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));[p[i],p[j]]=[p[j],p[i]];}return Uint8Array.from([...p,...p]);})();
const GRAD=[[1,0],[-1,0],[0,1],[0,-1],[.7071,.7071],[-.7071,.7071],[.7071,-.7071],[-.7071,-.7071]];
function noise2(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,X=xi&255,Y=yi&255;
 const g=(i,j,dx,dy)=>{const v=GRAD[PERM[PERM[X+i]+Y+j]&7];return v[0]*dx+v[1]*dy;};
 const u=xf*xf*xf*(xf*(xf*6-15)+10),v=yf*yf*yf*(yf*(yf*6-15)+10);
 return mix(mix(g(0,0,xf,yf),g(1,0,xf-1,yf),u),mix(g(0,1,xf,yf-1),g(1,1,xf-1,yf-1),u),v)*1.41;}
const isHex=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
const hexRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const MIX_CACHE=new Map();
function mixHex(a,b,t){if(t<=0)return a;if(t>=1)return b;const k=a+b+t;let v=MIX_CACHE.get(k);if(!v){const A=hexRGB(a),B=hexRGB(b);v='#'+A.map((x,i)=>Math.round(mix(x,B[i],t)).toString(16).padStart(2,'0')).join('');if(MIX_CACHE.size>20000)MIX_CACHE.clear();MIX_CACHE.set(k,v);}return v;}
export function contrast(a,b){const L=h=>{const [r,g,bb]=hexRGB(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*bb;};const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

// ---------------------------------------------------------------- polygons
// Polygons are flat [x0,y0,x1,y1,…] arrays, implicitly closed.
export function polyArea(p){let a=0;const n=p.length;for(let i=0;i<n;i+=2){const j=i+2<n?i+2:0;a+=p[i]*p[j+1]-p[j]*p[i+1];}return a/2;}
function reversePoly(p){const n=p.length,q=new Array(n);for(let i=0;i<n;i+=2){q[n-2-i]=p[i];q[n-1-i]=p[i+1];}return q;}
export function bboxOf(polys){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const p of polys)for(let i=0;i<p.length;i+=2){const x=p[i],y=p[i+1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return [x0,y0,x1,y1];}
export function winding(polys,x,y){let w=0;for(const p of polys){const n=p.length;for(let i=0;i<n;i+=2){const j=i+2<n?i+2:0,x1=p[i],y1=p[i+1],x2=p[j],y2=p[j+1],c=(x2-x1)*(y-y1)-(x-x1)*(y2-y1);if(y1<=y){if(y2>y&&c>0)w++;}else if(y2<=y&&c<0)w--;}}return w;}
function resample(p,L){const out=[],n=p.length;
 // Never more than 4,000 points per polygon, however far a copy has been scaled up.
 let per=0;for(let i=0;i<n;i+=2){const j=i+2<n?i+2:0;per+=hyp(p[j]-p[i],p[j+1]-p[i+1]);}if(per/L>4000)L=per/4000;for(let i=0;i<n;i+=2){const j=i+2<n?i+2:0,ax=p[i],ay=p[i+1],bx=p[j],by=p[j+1],k=Math.ceil(hyp(bx-ax,by-ay)/L);out.push(ax,ay);for(let s=1;s<k;s++)out.push(ax+(bx-ax)*s/k,ay+(by-ay)*s/k);}return out;}
const ellipse=(rx,ry,n)=>{const p=[];for(let i=0;i<n;i++){const a=i/n*TAU;p.push(Math.cos(a)*rx,Math.sin(a)*ry);}return p;};
function roundRect(hw,hh,r){r=Math.min(r,hw,hh);const p=[],n=6;for(const [cx,cy,a0] of [[hw-r,-hh+r,-90],[hw-r,hh-r,0],[-hw+r,hh-r,90],[-hw+r,-hh+r,180]])for(let i=0;i<=n;i++){const a=(a0+90*i/n)*DEG;p.push(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}return p;}
const segsFor=(w,h)=>Math.round(clamp(Math.sqrt(Math.max(w,h))*3.2,10,64));

// SVG path data → flattened closed contours, all commands including arcs.
const PATH_TOKEN=/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
export function flattenPath(d,tol=1){
 const tok=String(d||'').match(PATH_TOKEN)||[],out=[];let i=0,cmd='',x=0,y=0,sx=0,sy=0,px=0,py=0,cur=null,prev='';
 const isNum=()=>i<tok.length&&!/^[A-Za-z]$/.test(tok[i]),num=()=>parseFloat(tok[i++]);
 const end=()=>{if(cur){if(cur.length>=4&&cur[0]===cur[cur.length-2]&&cur[1]===cur[cur.length-1])cur.length-=2;if(cur.length>=6)out.push(cur);}cur=null;};
 const to=(nx,ny)=>{if(!cur)cur=[x,y];cur.push(nx,ny);x=nx;y=ny;};
 const steps=len=>Math.max(2,Math.min(48,Math.ceil(Math.sqrt(len/tol)*1.2)));
 const cubic=(x1,y1,x2,y2,x3,y3)=>{const x0=x,y0=y,n=steps(hyp(x1-x0,y1-y0)+hyp(x2-x1,y2-y1)+hyp(x3-x2,y3-y2));for(let k=1;k<=n;k++){const t=k/n,u=1-t;to(u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3);}px=x2;py=y2;};
 const quad=(x1,y1,x2,y2)=>{const x0=x,y0=y,n=steps(hyp(x1-x0,y1-y0)+hyp(x2-x1,y2-y1));for(let k=1;k<=n;k++){const t=k/n,u=1-t;to(u*u*x0+2*u*t*x1+t*t*x2,u*u*y0+2*u*t*y1+t*t*y2);}px=x1;py=y1;};
 while(i<tok.length){if(!isNum())cmd=tok[i++];else if(!cmd){i++;continue;}const C=cmd.toUpperCase(),rel=cmd!==C,ox=rel?x:0,oy=rel?y:0;
  switch(C){
   case 'M':{const nx=num()+ox,ny=num()+oy;end();cur=[nx,ny];x=sx=nx;y=sy=ny;cmd=rel?'l':'L';break;}
   case 'L':to(num()+ox,num()+oy);break;
   case 'H':to(num()+ox,y);break;
   case 'V':to(x,num()+oy);break;
   case 'C':{const a=num()+ox,b=num()+oy,c=num()+ox,e=num()+oy;cubic(a,b,c,e,num()+ox,num()+oy);break;}
   case 'S':{const r=/[CS]/.test(prev),a=r?2*x-px:x,b=r?2*y-py:y,c=num()+ox,e=num()+oy;cubic(a,b,c,e,num()+ox,num()+oy);break;}
   case 'Q':{const a=num()+ox,b=num()+oy;quad(a,b,num()+ox,num()+oy);break;}
   case 'T':{const r=/[QT]/.test(prev),a=r?2*x-px:x,b=r?2*y-py:y;quad(a,b,num()+ox,num()+oy);break;}
   case 'A':{const rx=num(),ry=num(),phi=num(),fa=num(),fs=num(),nx=num()+ox,ny=num()+oy;arcTo(x,y,rx,ry,phi,!!fa,!!fs,nx,ny,to);break;}
   case 'Z':end();x=sx;y=sy;cmd='';break;
   default:cmd='';}
  prev=C;if(C!=='C'&&C!=='S'&&C!=='Q'&&C!=='T'){px=x;py=y;}}
 end();return out.filter(p=>p.every(Number.isFinite));}
function arcTo(x1,y1,rx,ry,phi,fa,fs,x2,y2,to){
 if(!rx||!ry||(x1===x2&&y1===y2)){to(x2,y2);return;}rx=Math.abs(rx);ry=Math.abs(ry);const c=Math.cos(phi*DEG),s=Math.sin(phi*DEG),dx=(x1-x2)/2,dy=(y1-y2)/2,xp=c*dx+s*dy,yp=-s*dx+c*dy;
 const l=xp*xp/(rx*rx)+yp*yp/(ry*ry);if(l>1){rx*=Math.sqrt(l);ry*=Math.sqrt(l);}
 const num=rx*rx*ry*ry-rx*rx*yp*yp-ry*ry*xp*xp,den=rx*rx*yp*yp+ry*ry*xp*xp;let co=Math.sqrt(Math.max(0,num/den));if(fa===fs)co=-co;
 const cxp=co*rx*yp/ry,cyp=-co*ry*xp/rx,cx=c*cxp-s*cyp+(x1+x2)/2,cy=s*cxp+c*cyp+(y1+y2)/2,ang=(ux,uy,vx,vy)=>Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);
 const t1=ang(1,0,(xp-cxp)/rx,(yp-cyp)/ry);let dt=ang((xp-cxp)/rx,(yp-cyp)/ry,(-xp-cxp)/rx,(-yp-cyp)/ry);if(!fs&&dt>0)dt-=TAU;else if(fs&&dt<0)dt+=TAU;
 const n=Math.max(2,Math.ceil(Math.abs(dt)/(TAU/48)));for(let k=1;k<=n;k++){const t=t1+dt*k/n,ex=rx*Math.cos(t),ey=ry*Math.sin(t);to(c*ex-s*ey+cx,s*ex+c*ey+cy);}}

// ---------------------------------------------------------------- shapes
// A shape is a set of parts in local units around its own centre. Every shape is oriented so its
// largest contour has positive area; with nonzero filling, clones then never cancel each other.
function finishShape(parts,travel=0){
 let big=null,ba=0;for(const pt of parts)if(!pt.pupil)for(const p of pt.polys){const a=polyArea(p);if(Math.abs(a)>Math.abs(ba)){ba=a;big=p;}}
 if(ba<0)for(const pt of parts)if(!pt.pupil)pt.polys=pt.polys.map(reversePoly);
 for(const pt of parts)if(pt.pupil)pt.polys=pt.polys.map(p=>polyArea(p)<0?reversePoly(p):p);
 const b=bboxOf(parts.flatMap(p=>p.polys));return {parts,travel,r:Math.max(Math.abs(b[0]),Math.abs(b[1]),Math.abs(b[2]),Math.abs(b[3])),dense:null,denseL:0};}
const SHAPES=new Map();
function shapeOf(kind,w,h){const key=`${kind}|${w.toFixed(2)}|${h.toFixed(2)}`;let s=SHAPES.get(key);if(!s){s=makeShape(kind,Math.max(w,.01),Math.max(h,.01));if(SHAPES.size>6000)SHAPES.clear();SHAPES.set(key,s);}return s;}
function makeShape(kind,w,h){const hw=w/2,hh=h/2,m=Math.min(hw,hh),n=segsFor(w,h);
 switch(kind){
  case 'circle':return finishShape([{polys:[ellipse(hw,hh,n)]}]);
  case 'round':return finishShape([{polys:[roundRect(hw,hh,m*.45)]}]);
  case 'pill':return finishShape([{polys:[roundRect(hw,hh,m)]}]);
  case 'diamond':return finishShape([{polys:[[0,-hh,hw,0,0,hh,-hw,0]]}]);
  case 'cross':{const a=w*.17,b=h*.17;return finishShape([{polys:[[-a,-hh,a,-hh,a,-b,hw,-b,hw,b,a,b,a,hh,-a,hh,-a,b,-hw,b,-hw,-b,-a,-b]]}]);}
  case 'triangle':return finishShape([{polys:[[0,-hh,hw,hh,-hw,hh]]}]);
  case 'hexagon':return finishShape([{polys:[[...Array(6).keys()].flatMap(k=>{const a=(-90+60*k)*DEG;return [Math.cos(a)*hw,Math.sin(a)*hh];})]}]);
  case 'star':return finishShape([{polys:[[...Array(10).keys()].flatMap(k=>{const a=(-90+36*k)*DEG,r=k%2?.42:1;return [Math.cos(a)*hw*r,Math.sin(a)*hh*r];})]}]);
  case 'ring':return finishShape([{polys:[ellipse(hw,hh,n),reversePoly(ellipse(hw*.62,hh*.62,n))]}]);
  case 'eye':return finishShape([{polys:[ellipse(hw,hh,n),reversePoly(ellipse(hw*.66,hh*.66,n))]},{polys:[ellipse(hw*.34,hh*.34,Math.max(10,n-6))],pupil:true}],m*.32);
  default:return finishShape([{polys:[[-hw,-hh,hw,-hh,hw,hh,-hw,hh]]}]);}}
function ringShape(r,wt){const key=`ring*|${r.toFixed(2)}|${wt.toFixed(2)}`;let s=SHAPES.get(key);if(!s){const n=Math.round(clamp((r+wt)*TAU/6,24,360));s=finishShape([{polys:[ellipse(r+wt/2,r+wt/2,n),reversePoly(ellipse(Math.max(.01,r-wt/2),Math.max(.01,r-wt/2),n))]}]);SHAPES.set(key,s);}return s;}
function sectorShape(r,wt,span){const key=`sector|${r.toFixed(2)}|${wt.toFixed(2)}|${span.toFixed(4)}`;let s=SHAPES.get(key);if(!s){const n=Math.max(2,Math.ceil(span*(r+wt/2)/5)),p=[];
 for(let k=0;k<=n;k++){const a=-span/2+span*k/n;p.push(Math.cos(a)*(r+wt/2)-r,Math.sin(a)*(r+wt/2));}
 for(let k=n;k>=0;k--){const a=-span/2+span*k/n,ri=Math.max(.01,r-wt/2);p.push(Math.cos(a)*ri-r,Math.sin(a)*ri);}
 s=finishShape([{polys:[p]}]);SHAPES.set(key,s);}return s;}
function denseParts(shape,L){if(shape.denseL!==L){shape.dense=shape.parts.map(pt=>({...pt,polys:pt.polys.map(p=>resample(p,L))}));shape.denseL=L;}return shape.dense;}

// ---------------------------------------------------------------- type
const GLYPHS=new Map();
function glyphPolys(font,ch){const key=font+'|'+ch;let p=GLYPHS.get(key);if(!p){p=flattenPath(FONTS[font].glyphs[ch].d,1.2);GLYPHS.set(key,p);}return p;}
export function normText(t){return String(t??'').replace(/\r/g,'').replace(/\s*\/\s*/g,'\n').split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,8).join('\n');}
function layoutText(text,fontId,box,o={}){
 const font=FONTS[fontId]?fontId:'archivo',F=FONTS[font],trk=(o.tracking||0)*1000;
 const rows=normText(text).split('\n').map(line=>{let x=0,word=0;const gs=[];for(const ch of line){if(ch===' ')word++;const g=F.glyphs[ch];if(!g)continue;gs.push({ch,x,word});x+=g.adv+trk;}return {gs,w:Math.max(1,x-trk)};});
 const cap=F.capHeight,step=cap*(o.leading??1.1),blockH=cap+(rows.length-1)*step,maxW=Math.max(...rows.map(r=>r.w)),k=Math.min(box.w/maxW,box.h/blockH)*(o.size??1);
 const top=o.valign==='top'?box.y:o.valign==='bottom'?box.y+box.h-blockH*k:box.y+(box.h-blockH*k)/2,glyphs=[];let index=0;
 rows.forEach((r,li)=>{const base=top+(cap+li*step)*k,x0=o.align==='left'?box.x:o.align==='right'?box.x+box.w-r.w*k:box.x+(box.w-r.w*k)/2;
  for(const g of r.gs){const src=glyphPolys(font,g.ch);if(src.length)glyphs.push({ch:g.ch,line:li,word:g.word,index,polys:src.map(p=>p.map((v,i)=>i%2?base+v*k:x0+(g.x+v)*k))});index++;}});
 return {glyphs,size:1000*k};}
export function labelPolys(str,{font='grotesk',size=24,x=0,y=0,anchor='start'}={}){
 const F=FONTS[font];let w=0;const gs=[];for(const ch of String(str)){const g=F.glyphs[ch];if(!g)continue;gs.push([ch,w]);w+=g.adv;}
 const k=size/1000,x0=anchor==='middle'?x-w*k/2:anchor==='end'?x-w*k:x;return gs.flatMap(([ch,gx])=>glyphPolys(font,ch).map(p=>p.map((v,i)=>i%2?y+v*k:x0+(gx+v)*k)));}

// ---------------------------------------------------------------- SVG import
const SKIP=new Set(['defs','clippath','mask','pattern','lineargradient','radialgradient','symbol','style','title','desc','metadata','filter','marker','text','script','foreignobject','image','use']);
const NAMED={black:'#000000',white:'#ffffff',red:'#ff0000',green:'#008000',blue:'#0000ff',yellow:'#ffff00',gray:'#808080',grey:'#808080',orange:'#ffa500',purple:'#800080',currentcolor:'#000000'};
function parseColor(v){v=String(v).trim().toLowerCase();if(v==='none'||v==='transparent')return null;if(NAMED[v])return NAMED[v];
 let m=v.match(/^#([0-9a-f]{3})$/);if(m)return '#'+[...m[1]].map(c=>c+c).join('');m=v.match(/^#([0-9a-f]{6})/);if(m)return '#'+m[1];
 m=v.match(/^rgba?\(([^)]+)\)/);if(m){const p=m[1].split(/[\s,/]+/).filter(Boolean).slice(0,3).map(s=>s.endsWith('%')?parseFloat(s)*2.55:parseFloat(s));if(p.length===3&&p.every(Number.isFinite))return '#'+p.map(n=>Math.round(clamp(n,0,255)).toString(16).padStart(2,'0')).join('');}
 return '#808080';}
const attrsOf=s=>{const o={},re=/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;let m;while((m=re.exec(s)))o[m[1]]=m[2]??m[3];if(o.style)for(const decl of o.style.split(';')){const [k,...v]=decl.split(':');if(k&&v.length)o[k.trim()]=v.join(':').trim();}return o;};
const mulM=(m,n)=>[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];
function parseTransform(s){let M=[1,0,0,1,0,0];if(!s)return M;const re=/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;let m;
 while((m=re.exec(s))){const a=m[2].split(/[\s,]+/).filter(Boolean).map(Number);let T=[1,0,0,1,0,0];
  switch(m[1]){case 'matrix':if(a.length===6)T=a;break;case 'translate':T=[1,0,0,1,a[0]||0,a[1]||0];break;case 'scale':T=[a[0]??1,0,0,a[1]??a[0]??1,0,0];break;
   case 'rotate':{const r=(a[0]||0)*DEG,c=Math.cos(r),s2=Math.sin(r),cx=a[1]||0,cy=a[2]||0;T=mulM(mulM([1,0,0,1,cx,cy],[c,s2,-s2,c,0,0]),[1,0,0,1,-cx,-cy]);break;}
   case 'skewX':T=[1,0,Math.tan((a[0]||0)*DEG),1,0,0];break;case 'skewY':T=[1,Math.tan((a[0]||0)*DEG),0,1,0,0];break;}
  M=mulM(M,T);}return M;}
const applyM=(p,m)=>{const q=new Array(p.length);for(let i=0;i<p.length;i+=2){q[i]=m[0]*p[i]+m[2]*p[i+1]+m[4];q[i+1]=m[1]*p[i]+m[3]*p[i+1]+m[5];}return q;};
export function parseSVG(src){
 src=String(src||'').replace(/<!--[\s\S]*?-->/g,'').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g,'').replace(/<\?[\s\S]*?\?>/g,'').replace(/<!DOCTYPE[^>]*>/gi,'');
 const items=[],stack=[{m:[1,0,0,1,0,0],fill:'#000000',rule:'nonzero',hidden:false}],re=/<(\/?)([a-zA-Z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;let viewBox=null,skip=0,m;
 while((m=re.exec(src))){const close=!!m[1],name=m[2].toLowerCase().replace(/^svg:/,''),self=!!m[4],group=['g','svg','a','switch'].includes(name);
  if(close){if(skip){if(SKIP.has(name))skip--;}else if(group&&stack.length>1)stack.pop();continue;}
  if(skip||SKIP.has(name)){if(SKIP.has(name)&&!self)skip++;continue;}
  const A=attrsOf(m[3]),top=stack[stack.length-1],st={...top,m:name==='svg'&&!viewBox?top.m:mulM(top.m,parseTransform(A.transform))};
  if(A.fill!==undefined)st.fill=parseColor(A.fill);if(A['fill-rule'])st.rule=A['fill-rule']==='evenodd'?'evenodd':'nonzero';if(A.display==='none'||A.visibility==='hidden')st.hidden=true;
  if(name==='svg'&&!viewBox){const vb=(A.viewBox||'').trim().split(/[\s,]+/).map(Number);viewBox=vb.length===4&&vb.every(Number.isFinite)&&vb[2]>0&&vb[3]>0?vb:[0,0,parseFloat(A.width)||0,parseFloat(A.height)||0];}
  if(group){if(!self)stack.push(st);continue;}
  if(!st.fill||st.hidden)continue;const n=k=>parseFloat(A[k])||0;let polys=[];
  switch(name){
   case 'path':polys=flattenPath(A.d,.5);break;
   case 'rect':{const w=n('width'),h=n('height'),r=Math.min(n('rx')||n('ry'),w/2,h/2);if(w>0&&h>0)polys=[(r>0?roundRect(w/2,h/2,r):[-w/2,-h/2,w/2,-h/2,w/2,h/2,-w/2,h/2]).map((v,i)=>i%2?v+n('y')+h/2:v+n('x')+w/2)];break;}
   case 'circle':case 'ellipse':{const rx=name==='circle'?n('r'):n('rx'),ry=name==='circle'?n('r'):n('ry');if(rx>0&&ry>0)polys=[ellipse(rx,ry,segsFor(rx*2,ry*2)*2).map((v,i)=>i%2?v+n('cy'):v+n('cx'))];break;}
   case 'polygon':case 'polyline':{const p=(A.points||'').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);if(p.length>=6)polys=[p.slice(0,p.length-p.length%2)];break;}
   default:continue;}
  polys=polys.map(p=>applyM(p,st.m)).filter(p=>p.length>=6);if(polys.length)items.push({polys,fill:st.fill,rule:st.rule});}
 if(!viewBox||!(viewBox[2]>0&&viewBox[3]>0)){const b=items.length?bboxOf(items.flatMap(i=>i.polys)):[0,0,1,1];viewBox=[b[0],b[1],Math.max(1,b[2]-b[0]),Math.max(1,b[3]-b[1])];}
 return {viewBox,items};}
// Groups contours into filled shapes with their holes; even-odd sources are re-oriented for nonzero filling.
export function splitContours(polys,rule,single=false){
 const cs=polys.filter(p=>p.length>=6).map(p=>({p,a:polyArea(p),bb:bboxOf([p])})).filter(c=>Math.abs(c.a)>1e-6).sort((a,b)=>Math.abs(b.a)-Math.abs(a.a)),groups=[];
 for(let i=0;i<cs.length;i++){const c=cs[i];c.parent=null;
  for(let j=i-1;j>=0;j--){const o=cs[j];if(o.bb[0]<=c.bb[0]&&o.bb[1]<=c.bb[1]&&o.bb[2]>=c.bb[2]&&o.bb[3]>=c.bb[3]&&winding([o.p],c.p[0],c.p[1])!==0){c.parent=o;break;}}
  c.depth=c.parent?c.parent.depth+1:0;c.w=(c.parent?c.parent.w:0)+Math.sign(c.a);const filled=rule==='evenodd'?c.depth%2===0:c.w!==0;
  const p=rule==='evenodd'&&(filled?c.a<0:c.a>0)?reversePoly(c.p):c.p;
  if(single){(groups[0]||(groups[0]=[])).push(p);continue;}
  if(filled&&(!c.parent||!c.parent.filled)){c.group=[p];groups.push(c.group);}else{c.group=c.parent?c.parent.group:null;if(c.group)c.group.push(p);else{c.group=[p];groups.push(c.group);}}
  c.filled=filled;}
 return groups;}

// ---------------------------------------------------------------- elements
const clone=(x,y,shape,o={})=>({x,y,shape,rot0:o.rot??0,s0:o.s??1,i:o.i??0,j:o.j??0,color:o.color??null});
const MAX_ART=4000;
const BUILD={
 grid(L,box){const px=box.w/L.cols,rows=Math.max(1,Math.round(box.h/(px*L.aspect))),py=box.h/rows,shape=shapeOf(L.shape,px*(1-L.gap),py*(1-L.gap)),out=[];
  for(let j=0;j<rows;j++){const off=L.stagger&&j%2?px/2:0;for(let i=0;i<L.cols-(off?1:0);i++)out.push(clone(box.x+(i+.5)*px+off,box.y+(j+.5)*py,shape,{i,j}));}
  return {clones:out,pitch:Math.min(px,py)};},
 lines(L,box){const v=L.direction!=='horizontal',across=v?box.w:box.h,along=v?box.h:box.w,p=across/L.count,seg=L.segments,sl=along/seg,len=seg>1?sl*(1-L.segGap):along,shape=shapeOf(L.cap==='round'?'pill':'rect',p*L.weight,len),out=[];
  for(let i=0;i<L.count;i++)for(let j=0;j<seg;j++){const a=(i+.5)*p,b=(j+.5)*sl;out.push(v?clone(box.x+a,box.y+b,shape,{i,j}):clone(box.x+b,box.y+a,shape,{i,j,rot:90}));}
  return {clones:out,pitch:p};},
 dashes(L,box,seed){const py=box.h/L.rows,wt=py*L.weight,avg=py*L.length,gapAvg=avg*(1/L.density-1),r=rng(hash(seed,L.rows,Math.round(L.length*100),Math.round(L.density*100))*4294967296),out=[],right=box.x+box.w;
  for(let j=0;j<L.rows;j++){let x=box.x+r()*Math.max(gapAvg,avg*.2)*.8,guard=0;
   while(guard++<4000){let len=avg*(.35+r()*1.3);const gap=gapAvg*(.4+r()*1.2);if(x+len>right)len=right-x;if(len<wt*.8)break;len=Math.round(len*2)/2;out.push(clone(x+len/2,box.y+(j+.5)*py,shapeOf('rect',len,wt),{i:out.length,j}));x+=len+gap;}}
  return {clones:out,pitch:py};},
 rings(L,box){const cx=box.x+box.w/2,cy=box.y+box.h/2,Rm=L.fill==='cover'?hyp(box.w,box.h)/2:Math.min(box.w,box.h)/2,p=Rm/L.count,wt=p*L.weight,out=[];
  for(let k=0;k<L.count;k++){const r=(k+.5)*p,n=L.segments<=1?1:Math.max(3,Math.round(L.segments*(k+.5)/L.count));
   if(n===1){out.push(clone(cx,cy,ringShape(r,wt),{i:0,j:k}));continue;}
   const sh=sectorShape(r,wt,TAU/n*(1-L.segGap));for(let i=0;i<n;i++){const a=(i+.5)/n*TAU;out.push(clone(cx+Math.cos(a)*r,cy+Math.sin(a)*r,sh,{i,j:k,rot:a/DEG}));}}
  return {clones:out,pitch:p};},
 text(L,box){const lay=layoutText(L.text,L.font,box,L),groups=new Map();
  for(const g of lay.glyphs){const key=L.unit==='lines'?g.line:L.unit==='words'?`${g.line}:${g.word}`:g.index;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(...g.polys);}
  const out=[];for(const polys of groups.values()){const [x0,y0,x1,y1]=bboxOf(polys),cx=(x0+x1)/2,cy=(y0+y1)/2;out.push(clone(cx,cy,finishShape([{polys:polys.map(p=>p.map((v,i)=>i%2?v-cy:v-cx))}]),{i:out.length}));}
  return {clones:out,pitch:lay.size*.6};},
 matrix(L,box){const lay=layoutText(L.text,L.font,box,{leading:L.leading,size:L.size}),gl=lay.glyphs.map(g=>({polys:g.polys,bb:bboxOf(g.polys)}));
  const px=box.w/L.cols,rows=Math.max(1,Math.round(box.h/px)),py=box.h/rows,shape=shapeOf(L.shape,px*(1-L.gap),py*(1-L.gap)),out=[];
  const inside=(x,y)=>{for(const g of gl){const b=g.bb;if(x<b[0]||x>b[2]||y<b[1]||y>b[3])continue;if(winding(g.polys,x,y)!==0)return 1;}return 0;};
  for(let j=0;j<rows;j++)for(let i=0;i<L.cols;i++){const cx=box.x+(i+.5)*px,cy=box.y+(j+.5)*py;let s;
   if(L.mode==='coverage'){let c=0;for(let a=0;a<4;a++)for(let b=0;b<4;b++)c+=inside(cx+(a-1.5)/4*px,cy+(b-1.5)/4*py);s=c?Math.max(Math.sqrt(c/16),L.ghost):0;}else s=inside(cx,cy);
   if(s>0)out.push(clone(cx,cy,shape,{i,j,s}));else if(L.ghost>0)out.push(clone(cx,cy,shape,{i,j,s:L.ghost}));}
  return {clones:out,pitch:Math.min(px,py)};},
 scatter(L,box,seed){const r=rng(hash(seed,L.count,Math.round(L.size*10),991)*4294967296),out=[],n=L.count,even=L.spread==='even',cols=Math.max(1,Math.round(Math.sqrt(n*box.w/box.h))),rows=Math.ceil(n/cols),cw=box.w/cols,ch=box.h/rows;
  for(let k=0;k<n;k++){const x=even?box.x+(k%cols+.15+.7*r())*cw:box.x+r()*box.w,y=even?box.y+(Math.floor(k/cols)+.15+.7*r())*ch:box.y+r()*box.h,s=Math.max(1,Math.round(L.size*(1-L.variation*r())*2)/2);
   out.push(clone(x,y,shapeOf(L.shape,s,s),{i:k%cols,j:Math.floor(k/cols),rot:L.turn?r()*360:0}));}
  return {clones:out,pitch:Math.sqrt(box.w*box.h/n)};},
 artwork(L,box){const art=parseSVG(L.svg);let items=art.items,ground=null;const [vx,vy,vw,vh]=art.viewBox;
  // Leading shapes covering the artboard are its background, not elements; the last one shows. A re-imported export
  // starts with the editor's paper and then the poster's own background.
  while(items.length>1){const b=bboxOf(items[0].polys);if((b[2]-b[0])*(b[3]-b[1])<vw*vh*.97)break;ground=items[0].fill;items=items.slice(1);}
  const k=Math.min(box.w/vw,box.h/vh)*L.size,ox=box.x+(box.w-vw*k)/2-vx*k,oy=box.y+(box.h-vh*k)/2-vy*k,out=[];
  for(const it of items){if(out.length>=MAX_ART)break;const polys=it.polys.map(p=>p.map((v,i)=>i%2?oy+v*k:ox+v*k));
   for(const g of splitContours(polys,it.rule,L.split==='elements')){if(out.length>=MAX_ART)break;const [x0,y0,x1,y1]=bboxOf(g),cx=(x0+x1)/2,cy=(y0+y1)/2;
    out.push(clone(cx,cy,finishShape([{polys:g.map(p=>p.map((v,i)=>i%2?v-cy:v-cx))}]),{i:out.length,color:it.fill}));}}
  return {clones:out,pitch:Math.sqrt(box.w*box.h/Math.max(1,out.length)),ground,truncated:out.length>=MAX_ART};}
};
export function pageOf(state){const f=FORMATS[state.format]||FORMATS.poster;return {W:f.w,H:f.h,M:Math.min(f.w,f.h)};}
function areaBox(L,page){const m=L.area==='bleed'?0:page.M*.06;return {x:m,y:m,w:page.W-2*m,h:page.H-2*m};}
const strHash=s=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h.toString(36)+':'+s.length;};
const LAYER_CACHE=new Map();
// Builds every layer's clones; geometry is cached on the parameters that shape it.
export function prepare(state){const page=pageOf(state);
 return {...page,layers:state.layers.map(L=>{const {on,opacity,color,svg,name,...geo}=L,key=`${state.format}|${state.seed}|${JSON.stringify(geo)}|${L.type==='artwork'?strHash(svg||''):''}`;
  let built=LAYER_CACHE.get(key);
  if(!built){built=BUILD[L.type](L,areaBox(L,page),state.seed);const idn=parseInt(L.id.slice(1))||0;
   built.clones.forEach((c,k)=>{c.r1=hash(state.seed,idn,k,1);c.r2=hash(state.seed,idn,k,2);c.r3=hash(state.seed,idn,k,3);c.r4=hash(state.seed,idn,k,4);});
   if(LAYER_CACHE.size>48)LAYER_CACHE.delete(LAYER_CACHE.keys().next().value);LAYER_CACHE.set(key,built);}
  return {...built,id:L.id,type:L.type,L};})};}

// ---------------------------------------------------------------- fields
export function context(state,scene,t=state.time,pointer=null){return {t,phase:((t/state.loop)%1+1)%1,pointer,W:scene.W,H:scene.H,M:scene.M,loop:state.loop,seed:state.seed};}
// Resolves a field's motion at the current phase. A pointer {x,y,w} pulls following fields by weight w.
export function resolveField(f,ctx){const {W,H,M,phase}=ctx,ang=TAU*f.cycles*phase,tr=f.travel*M;let cx=f.x*W,cy=f.y*H,R=f.radius*M,a=f.angle;const ux=Math.cos(a*DEG),uy=Math.sin(a*DEG);
 switch(f.drive){
  case 'orbit':cx+=Math.cos(ang)*tr;cy+=Math.sin(ang)*tr;break;
  case 'sweep':{const s=Math.sin(ang);cx+=ux*s*tr;cy+=uy*s*tr;break;}
  case 'wander':cx+=(Math.sin(ang+1.3)*.6+Math.sin(2*ang+4.1)*.4)*tr;cy+=(Math.sin(ang+3.7)*.55+Math.sin(3*ang+.6)*.45)*tr;break;
  case 'pulse':R*=.2+.8*(.5-.5*Math.cos(ang));break;
  case 'rotate':a+=360*f.cycles*phase;break;}
 const P=ctx.pointer;if(f.follow&&P){const w=P.w??1;cx=mix(cx,P.x*W,w);cy=mix(cy,P.y*H,w);}
 return {shape:f.shape,cx,cy,R:Math.max(R,1e-6),a,dx:Math.cos(a*DEG),dy:Math.sin(a*DEG),softness:f.softness,invert:f.invert,scale:f.scale,steps:f.steps,M};}
const fall=(d,s)=>{const inner=1-s;if(d<=inner)return 1;if(d>=1)return 0;return smooth(1-(d-inner)/Math.max(s,1e-6));};
export function fieldValue(F,x,y){let v;const s=F.softness;
 switch(F.shape){
  case 'all':v=1;break;
  case 'linear':v=smooth(clamp(.5+((x-F.cx)*F.dx+(y-F.cy)*F.dy)/(F.R*Math.max(s,.02))));break;
  case 'ring':v=smooth(clamp(1-Math.abs(hyp(x-F.cx,y-F.cy)-F.R)/(F.R*Math.max(s,.04)*.5)));break;
  case 'box':{const dx=x-F.cx,dy=y-F.cy;v=fall(Math.max(Math.abs(dx*F.dx+dy*F.dy),Math.abs(dy*F.dx-dx*F.dy))/F.R,s);break;}
  case 'noise':{const q=F.scale/F.M,u=(x-F.cx)*q,w=(y-F.cy)*q;v=smooth(clamp(.5+(noise2(u+11.3,w-7.1)*.65+noise2(u*2.1-3.3,w*2.1+5.9)*.35)/(Math.max(s,.04)*1.2)));break;}
  // Angle sweep: 0 to 1 once round the centre, starting at the field's angle (a conic gradient).
  case 'conic':{const t=(Math.atan2(y-F.cy,x-F.cx)/DEG-F.a)/360;v=t-Math.floor(t);break;}
  default:v=fall(hyp(x-F.cx,y-F.cy)/F.R,s);}
 // Steps posterize the falloff into bands.
 if(F.steps>1)v=Math.round(v*F.steps)/F.steps;
 if(F.invert)v=1-v;
 // A group's field masks its children.
 return F.mask?v*fieldValue(F.mask,x,y)*F.maskK:v;}

// ---------------------------------------------------------------- effectors
// Each clone carries twelve attributes; the editor springs them towards these targets.
export const ATTRS=['x','y','sx','sy','rot','tone','alpha','ex','ey','shade','lx','ly'];
export const NA=ATTRS.length;
const EFFECT={
 pinch(c,f,p){const k=Math.max(0,1+p.amount*f);c.sx*=k;c.sy*=k;},
 stretch(c,f,p){c.sx*=Math.max(0,1+p.width*f);c.sy*=Math.max(0,1+p.height*f);},
 twist(c,f,p,F){if(p.mode==='turn'){c.rot+=p.angle*f;return;}const a=Math.atan2(F.cy-c.y,F.cx-c.x)/DEG+(p.mode==='aim'?90:0)+p.angle;c.rot+=wrap180(a-c.rot)*f;},
 watch(c,f,p,F){const dx=F.cx-c.x,dy=F.cy-c.y,d=hyp(dx,dy)||1,reach=Math.min(1,d/(F.R*.25));c.lx+=dx/d*p.look*f*reach;c.ly+=dy/d*p.look*f*reach;
  if(p.turn>0)c.rot+=wrap180(Math.atan2(dy,dx)/DEG+90-c.rot)*f*p.turn;},
 settle(c,f,p,F,ctx,cl,fv,s){const amt=s*(p.mode==='settle'?1-fv:fv);if(amt<=0)return;const ph=p.drift*ctx.phase,d=p.scatter*ctx.pitch*amt;
  if(p.axis!=='y')c.x+=Math.sin(TAU*(cl.r1+ph))*d;if(p.axis!=='x')c.y+=Math.sin(TAU*(cl.r2+ph))*d;c.rot+=p.spin*Math.sin(TAU*(cl.r3+ph))*amt;},
 warp(c,f,p,F){c.x+=(c.x-F.cx)*p.amount*f;c.y+=(c.y-F.cy)*p.amount*f;const k=Math.max(0,1+p.amount*p.grow*f);c.sx*=k;c.sy*=k;},
 pillars(c,f,p){const h=p.height*f;c.ex+=Math.cos(p.angle*DEG)*h;c.ey+=Math.sin(p.angle*DEG)*h;if(h>.01)c.shade=p.shade;},
 repel(c,f,p,F){let dx=c.x-F.cx,dy=c.y-F.cy;if(F.shape==='linear'){dx=F.dx;dy=F.dy;}const d=hyp(dx,dy);if(d<1e-6)return;let m=p.distance*f;if(m<0&&F.shape!=='linear')m=Math.max(m,-d);c.x+=dx/d*m;c.y+=dy/d*m;},
 shift(c,f,p){c.x+=Math.cos(p.angle*DEG)*p.distance*f;c.y+=Math.sin(p.angle*DEG)*p.distance*f;},
 wave(c,f,p,F,ctx){const ux=Math.cos(p.angle*DEG),uy=Math.sin(p.angle*DEG),w=WAVE[p.form]((c.x*ux+c.y*uy)/p.wavelength-p.cycles*ctx.phase);
  switch(p.channel){case 'scale':{const k=Math.max(0,1+w*p.amount*f);c.sx*=k;c.sy*=k;break;}case 'rotation':c.rot+=w*p.amount*180*f;break;case 'tone':c.tone+=(w*.5+.5)*p.amount*f;break;default:c.x-=uy*p.amount*120*w*f;c.y+=ux*p.amount*120*w*f;}},
 jitter(c,f,p,F,ctx,cl){const ph=p.cycles*ctx.phase;c.x+=Math.sin(TAU*(cl.r1+ph))*p.move*f;c.y+=Math.sin(TAU*(cl.r2+ph))*p.move*f;c.rot+=Math.sin(TAU*(cl.r3+ph))*p.turn*f;const k=Math.max(0,1+Math.sin(TAU*(cl.r4+ph))*p.size*f);c.sx*=k;c.sy*=k;},
 spin(c,f,p,F,ctx){c.rot+=360*(p.turns*ctx.phase-p.lag*hyp(c.x-F.cx,c.y-F.cy)/ctx.M)*f;},
 tone(c,f,p){c.tone+=p.color*f;c.alpha*=Math.max(0,1-p.fade*f);},
 flow(c,f,p,F,ctx){if(f<=0)return;const q=p.scale/ctx.M,a=TAU*p.cycles*ctx.phase,ox=Math.cos(a)*.8,oy=Math.sin(a)*.8,step=p.distance*f/6,h=.01;let dx=0,dy=-1;
  // Curl of a noise field: divergence-free, so elements stream without bunching up.
  for(let k=0;k<6;k++){const u=c.x*q+ox,v=c.y*q+oy,nx=noise2(u,v+h)-noise2(u,v-h),ny=noise2(u-h,v)-noise2(u+h,v),l=hyp(nx,ny);if(l<1e-12)break;dx=nx/l;dy=ny/l;c.x+=dx*step;c.y+=dy*step;}
  if(p.align>0)c.rot+=wrap180(Math.atan2(dy,dx)/DEG+90-c.rot)*p.align*f;},
 recolour(c,f,p,F,ctx,cl){const pick=p.pattern==='checker'?(cl.i+cl.j)%2===0:p.pattern==='rows'?cl.j%2===0:p.pattern==='columns'?cl.i%2===0:cl.r4<p.share;if(!pick)return;
  if(p.to==='paper')c.alpha*=1-f;else c.tone+=(1-c.tone)*f;},
 snap(c,f,p){if(f<.5)return;if(p.angle>0)c.rot=Math.round(c.rot/p.angle)*p.angle;if(p.levels>0){const q=v=>Math.round(v*p.levels)/p.levels;c.sx=q(c.sx);c.sy=q(c.sy);}}
};
const targets=(item,L)=>item.target==='all'||item.target===L.id;
export function evaluate(scene,state,ctx){
 const effs=state.effectors.filter(e=>e.on&&e.strength>0).map(e=>({e,F:resolveField(e.field,ctx),fn:EFFECT[e.type]}));
 return scene.layers.map(L=>{const list=effs.filter(x=>targets(x.e,L)),n=L.clones.length,A=new Float64Array(n*NA),pctx={...ctx,pitch:L.pitch};
  for(let k=0;k<n;k++){const cl=L.clones[k],c={x:cl.x,y:cl.y,sx:cl.s0,sy:cl.s0,rot:cl.rot0,tone:0,alpha:1,ex:0,ey:0,shade:0,lx:0,ly:0};
   for(const {e,F,fn} of list){const fv=fieldValue(F,c.x,c.y);fn(c,fv*e.strength,e,F,pctx,cl,fv,e.strength);}
   const o=k*NA;A[o]=c.x;A[o+1]=c.y;A[o+2]=c.sx;A[o+3]=c.sy;A[o+4]=c.rot;A[o+5]=c.tone;A[o+6]=c.alpha;A[o+7]=c.ex;A[o+8]=c.ey;A[o+9]=c.shade;A[o+10]=c.lx;A[o+11]=c.ly;}
  return A;});}

// ---------------------------------------------------------------- modifiers
const frac=x=>x-Math.floor(x);
// Period-1 waveforms that start at 0 and peak at a quarter period (square starts high).
const WAVE={sine:x=>Math.sin(TAU*x),triangle:x=>2*Math.abs(2*frac(x-.25)-1)-1,square:x=>frac(x)<.5?1:-1,saw:x=>2*frac(x+.5)-1};
// Point modifiers move one outline point P=[x,y] in place, weighted by the field at that point.
// K is the element being drawn: its centre and radius after effectors.
const MODIFY={
 lens(P,f,p,F){P[0]+=(P[0]-F.cx)*p.amount*f;P[1]+=(P[1]-F.cy)*p.amount*f;},
 twirl(P,f,p,F){const a=p.angle*DEG*f,c=Math.cos(a),s=Math.sin(a),dx=P[0]-F.cx,dy=P[1]-F.cy;P[0]=F.cx+dx*c-dy*s;P[1]=F.cy+dx*s+dy*c;},
 ripple(P,f,p,F,ctx){const dx=P[0]-F.cx,dy=P[1]-F.cy,d=hyp(dx,dy);if(d<1e-6)return;const w=WAVE[p.form](d/p.wavelength-p.cycles*ctx.phase)*p.amplitude*f;P[0]+=dx/d*w;P[1]+=dy/d*w;},
 wave(P,f,p,F,ctx){const ux=Math.cos(p.angle*DEG),uy=Math.sin(p.angle*DEG),w=WAVE[p.form]((P[0]*ux+P[1]*uy)/p.wavelength-p.cycles*ctx.phase)*p.amplitude*f;P[0]-=uy*w;P[1]+=ux*w;},
 turbulence(P,f,p,F,ctx){const q=p.scale/ctx.M,a=TAU*p.cycles*ctx.phase,ox=Math.cos(a)*.7,oy=Math.sin(a)*.7,u=P[0]*q+ox,v=P[1]*q+oy;P[0]+=noise2(u,v)*p.amplitude*f;P[1]+=noise2(u+31.7,v-17.3)*p.amplitude*f;},
 shear(P,f,p,F){const ux=Math.cos(p.angle*DEG),uy=Math.sin(p.angle*DEG),v=-(P[0]-F.cx)*uy+(P[1]-F.cy)*ux;P[0]+=ux*v*p.amount*f;P[1]+=uy*v*p.amount*f;},
 taper(P,f,p,F){const ux=Math.cos(p.angle*DEG),uy=Math.sin(p.angle*DEG),dx=P[0]-F.cx,dy=P[1]-F.cy,along=(dx*ux+dy*uy)/F.R,across=-dx*uy+dy*ux,k=p.amount*along*f;P[0]+=-uy*across*k;P[1]+=ux*across*k;},
 pixelate(P,f,p){const s=p.size*f;if(s<.25)return;P[0]=Math.round(P[0]/s)*s;P[1]=Math.round(P[1]/s)*s;},
 // The field itself is the height map: a radial field raises a hill, noise raises terrain.
 displace(P,f,p){const a=p.angle*DEG;P[0]+=Math.cos(a)*p.amount*f;P[1]+=Math.sin(a)*p.amount*f;},
 // Distance along the axis becomes angle round a centre of curvature; the field size wraps through the bend.
 bend(P,f,p,F){const ang=p.angle*DEG*f;if(Math.abs(ang)<1e-5)return;const ux=Math.cos(p.axis*DEG),uy=Math.sin(p.axis*DEG),dx=P[0]-F.cx,dy=P[1]-F.cy,s=dx*ux+dy*uy,t=-dx*uy+dy*ux,rho=F.R/ang,r=rho-t,th=s/rho,ns=r*Math.sin(th),nt=rho-r*Math.cos(th);P[0]=F.cx+ns*ux-nt*uy;P[1]=F.cy+ns*uy+nt*ux;},
 polar(P,f,p,F,ctx){const th=((P[0]/ctx.W-.5)*p.span+p.turn-90)*DEG,v=clamp(P[1]/ctx.H,-.5,1.5),Ri=F.R*p.hole,r=Math.max(0,(p.flip?mix(Ri,F.R,v):mix(F.R,Ri,v))-p.spiral*(P[0]/ctx.W)*F.R);P[0]=mix(P[0],F.cx+Math.cos(th)*r,f);P[1]=mix(P[1],F.cy+Math.sin(th)*r,f);},
 spherize(P,f,p,F){const R=F.R,a=p.amount*f;if(Math.abs(a)<1e-4)return;const dx=P[0]-F.cx,dy=P[1]-F.cy;
  const map=d=>d>=R?d:a>0?mix(d,R*Math.sin(d/R*Math.PI/2),a):mix(d,R*Math.asin(d/R)*2/Math.PI,-a);
  if(p.shape==='vertical'){P[0]=F.cx+Math.sign(dx)*map(Math.abs(dx));return;}if(p.shape==='horizontal'){P[1]=F.cy+Math.sign(dy)*map(Math.abs(dy));return;}
  const d=hyp(dx,dy);if(d<1e-9)return;const k=map(d)/d;P[0]=F.cx+dx*k;P[1]=F.cy+dy*k;},
 ribbon(P,f,p,F,ctx){const ux=Math.cos(p.axis*DEG),uy=Math.sin(p.axis*DEG),dx=P[0]-F.cx,dy=P[1]-F.cy,s=dx*ux+dy*uy,nt=(-dx*uy+dy*ux)*mix(1,Math.cos(p.twist*DEG*s/F.R+TAU*p.cycles*ctx.phase),f);P[0]=F.cx+s*ux-nt*uy;P[1]=F.cy+s*uy+nt*ux;},
 // The field size is the box's half-width; its half-height is that times the box height.
 envelope(P,f,p,F){const H=F.R*p.height,u=clamp((P[0]-F.cx)/F.R,-1,1),t=clamp(((P[1]-F.cy)/H+1)/2),b=1-u*u;let top=-b,bot=b;
  switch(p.style){case 'arc':bot=-b;break;case 'upper':bot=0;break;case 'lower':top=0;break;case 'flag':top=bot=Math.sin(Math.PI*u)*.5;break;case 'rise':top=bot=-u*.5;break;}
  P[1]+=mix(top,bot,t)*p.amount*H*f;},
 perspective(P,f,p,F,ctx){const ux=Math.cos(p.axis*DEG),uy=Math.sin(p.axis*DEG),dx=P[0]-F.cx,dy=P[1]-F.cy,s=dx*ux+dy*uy,t=-dx*uy+dy*ux,tl=p.tilt*DEG*f,D=p.distance*ctx.M,k=D/Math.max(D+t*Math.sin(tl),D*.08),ns=s*k,nt=t*Math.cos(tl)*k;P[0]=F.cx+ns*ux-nt*uy;P[1]=F.cy+ns*uy+nt*ux;},
 // Drip lengths come from 1D noise across the direction; the far side of each element drips most.
 melt(P,f,p,F,ctx,K){const ux=Math.cos(p.angle*DEG),uy=Math.sin(p.angle*DEG),w=clamp(.5+((P[0]-K.x)*ux+(P[1]-K.y)*uy)/(2*Math.max(K.r,1))),g=Math.max(0,noise2((-P[0]*uy+P[1]*ux)/p.width+5.3,ctx.seed*.37+.5)*1.6-.15);
  const d=p.length*g*g*w*w*f*(p.cycles?.5-.5*Math.cos(TAU*p.cycles*ctx.phase):1);P[0]+=ux*d;P[1]+=uy*d;},
 // Beyond the fold line the page turns away in depth by the fold angle (past 90° it lies back over the front).
 fold(P,f,p,F,ctx){const ux=Math.cos(p.axis*DEG),uy=Math.sin(p.axis*DEG),dx=P[0]-F.cx,dy=P[1]-F.cy,t=-dx*uy+dy*ux;if(t<=0)return;const s=dx*ux+dy*uy,a=p.angle*DEG*f,D=2.5*ctx.M,k=D/Math.max(D+t*Math.sin(a),D*.1),ns=s*k,nt=t*Math.cos(a)*k;P[0]=F.cx+ns*ux-nt*uy;P[1]=F.cy+ns*uy+nt*ux;},
 petal(P,f,p,F,ctx,K){const dx=P[0]-K.x,dy=P[1]-K.y,k=1+p.amount*f*Math.sin(p.lobes*Math.atan2(dy,dx)+TAU*p.cycles*ctx.phase);P[0]=K.x+dx*k;P[1]=K.y+dy*k;},
 swirl(P,f,p,F,ctx,K){const dx=P[0]-K.x,dy=P[1]-K.y,a=p.angle*DEG*f*Math.max(0,1-hyp(dx,dy)/Math.max(K.r,1e-6));if(!a)return;const c=Math.cos(a),s=Math.sin(a);P[0]=K.x+dx*c-dy*s;P[1]=K.y+dx*s+dy*c;},
 roughen(P,f,p,F,ctx){const q=1/p.grain,a=TAU*p.cycles*ctx.phase,x=P[0]*q+Math.cos(a)*.6,y=P[1]*q+Math.sin(a)*.6,m=p.amount*f;P[0]+=(noise2(x,y)*.65+noise2(x*2.9+4.1,y*2.9)*.35)*m;P[1]+=(noise2(x-9.2,y+4.4)*.65+noise2(x*2.9,y*2.9-6.3)*.35)*m;}
};
// Keeps the part of a polygon where nx·x+ny·y ≥ d (Sutherland–Hodgman against one half-plane).
function clipHalf(p,nx,ny,d){const n=p.length,out=[];if(n<6)return null;let px=p[n-2],py=p[n-1],pv=nx*px+ny*py-d;
 for(let i=0;i<n;i+=2){const x=p[i],y=p[i+1],v=nx*x+ny*y-d;if((v>=0)!==(pv>=0)){const t=pv/(pv-v);out.push(px+(x-px)*t,py+(y-py)*t);}if(v>=0)out.push(x,y);px=x;py=y;pv=v;}
 return out.length>=6?out:null;}
// Clips a polygon by a convex polygon, one half-plane per edge.
function clipConvex(p,hull){const n=hull.length,sg=polyArea(hull)>0?1:-1;let q=p;for(let i=0;i<n&&q;i+=2){const j=i+2<n?i+2:0,ex=hull[j]-hull[i],ey=hull[j+1]-hull[i+1],nx=-ey*sg,ny=ex*sg;q=clipHalf(q,nx,ny,nx*hull[i]+ny*hull[i+1]);}return q;}
// Makes a set of outlines paint positively. The test is the net signed area: never negative for correctly oriented
// outlines with their holes (and cancelling pairs, such as a ring's outer and subtracted inner disc), always negative
// for an inverted set. Testing only the largest polygon could flip a set whose largest pieces cancel exactly.
function oriented(polys){let net=0;for(const q of polys)net+=polyArea(q);return net<0?polys.map(reversePoly):polys;}
// Affine maps [a,b,c,d,e,f]: x'=ax+cy+e, y'=bx+dy+f. Reflections reverse point order to keep orientation.
const rotM=(cx,cy,th,s=1,ox=0,oy=0)=>{const c=Math.cos(th)*s,n=Math.sin(th)*s;return [c,n,-n,c,cx-c*cx+n*cy+ox,cy-n*cx-c*cy+oy];};
const refM=(cx,cy,a)=>{const ux=Math.cos(a),uy=Math.sin(a),A=ux*ux-uy*uy,B=2*ux*uy;return [A,B,B,-A,cx-A*cx-B*cy,cy-B*cx+A*cy];};
function aff(polys,m,rev){return polys.map(p=>{const n=p.length,q=new Array(n);for(let i=0;i<n;i+=2){const x=p[i],y=p[i+1],X=m[0]*x+m[2]*y+m[4],Y=m[1]*x+m[3]*y+m[5];if(rev){q[n-2-i]=X;q[n-1-i]=Y;}else{q[i]=X;q[i+1]=Y;}}return q;});}
// Cut modifiers take groups [{polys, dt (colour shift), da (opacity)}] and return new groups.
// Their field is read once, at the element's centre.
const CUT={
 mirror(G,f,p,F){if(f<.5)return G;const a=p.angle*DEG,sg=p.keep==='b'?1:-1,nx=-Math.sin(a)*sg,ny=Math.cos(a)*sg,d=nx*F.cx+ny*F.cy,m=refM(F.cx,F.cy,a),out=[];
  for(const g of G){const kept=g.polys.map(q=>clipHalf(q,nx,ny,d)).filter(Boolean);if(kept.length)out.push({...g,polys:kept},{...g,polys:aff(kept,m,true)});}return out;},
 kaleido(G,f,p,F){if(f<.5)return G;const N=p.segments,w=TAU/N,a0=p.angle*DEG,out=[];
  if(p.mode==='copies'){for(let k=0;k<N;k++)for(const g of G)out.push({...g,polys:k?aff(g.polys,rotM(F.cx,F.cy,k*w),false):g.polys});return out;}
  const a1=a0+w,n1x=-Math.sin(a0),n1y=Math.cos(a0),n2x=Math.sin(a1),n2y=-Math.cos(a1),d1=n1x*F.cx+n1y*F.cy,d2=n2x*F.cx+n2y*F.cy,ref=refM(F.cx,F.cy,a1);
  for(const g of G){const wedge=g.polys.map(q=>{const c=clipHalf(q,n1x,n1y,d1);return c&&clipHalf(c,n2x,n2y,d2);}).filter(Boolean);if(!wedge.length)continue;const flip=p.mode==='mirror'?aff(wedge,ref,true):null;
   for(let k=0;k<N;k++){const odd=flip&&k%2===1,turn=odd?(k-1)*w:k*w,src=odd?flip:wedge;out.push({...g,polys:turn?aff(src,rotM(F.cx,F.cy,turn),false):src});}}
  return out;},
 echo(G,f,p,F){const a=p.angle*DEG,n=p.copies,out=[];
  for(let k=n;k>=1;k--){const t=k/n,m=rotM(F.cx,F.cy,p.turn*DEG*k*f,Math.pow(p.scale,k*f),Math.cos(a)*p.distance*k*f,Math.sin(a)*p.distance*k*f);for(const g of G)out.push({polys:aff(g.polys,m,false),dt:g.dt+p.tone*t,da:g.da*Math.max(0,1-p.fade*t)});}
  return out.concat(G);},
 slice(G,f,p,F,ctx,K){const a=p.angle*DEG,ux=Math.cos(a),uy=Math.sin(a),nx=-uy,ny=ux,h=p.height,gp=p.gap*h/2,base=nx*F.cx+ny*F.cy,kc=nx*K.x+ny*K.y,out=[];
  const pat=b=>p.pattern==='random'?hash(ctx.seed,b,977)*2-1:p.pattern==='wave'?Math.sin(TAU*(b*.13-p.cycles*ctx.phase)):p.pattern==='ramp'?b*.25:b%2?1:-1;
  for(const g of G){const bands=new Map();
   for(const q of g.polys){let lo=Infinity,hi=-Infinity;for(let i=0;i<q.length;i+=2){const v=nx*q[i]+ny*q[i+1];if(v<lo)lo=v;if(v>hi)hi=v;}
    for(let b=Math.floor((lo-base)/h),b1=Math.floor((hi-base)/h);b<=b1;b++){const c1=clipHalf(q,nx,ny,base+b*h+gp),c=c1&&clipHalf(c1,-nx,-ny,-(base+(b+1)*h-gp));if(c){if(!bands.has(b))bands.set(b,[]);bands.get(b).push(c);}}}
   // Each band reads the field on its own centre line, so a linear field can grade the offsets.
   for(const [b,polys] of bands){const mid=base+(b+.5)*h,s=pat(b)*p.offset*fieldValue(F,K.x+nx*(mid-kc),K.y+ny*(mid-kc))*p.strength;out.push({...g,polys:s?aff(polys,[1,0,0,1,ux*s,uy*s],false):polys});}}
  return out;},
 // Ridges alternate (sharp) or follow a sine (smooth) along each outline's own normals.
 zigzag(G,f,p){const a=p.size*f;if(a<.05)return G;const smooth=p.style==='smooth',step=p.spacing/(smooth?6:2);
  return G.map(g=>({...g,polys:g.polys.map(q=>{const r=resample(q,step),n=r.length/2,o=new Array(r.length);let arc=0;
   for(let i=0;i<n;i++){const ip=(i+n-1)%n,inx=(i+1)%n,tx=r[inx*2]-r[ip*2],ty=r[inx*2+1]-r[ip*2+1],l=hyp(tx,ty)||1;if(i)arc+=hyp(r[i*2]-r[ip*2],r[i*2+1]-r[ip*2+1]);
    const k=a*(smooth?Math.sin(TAU*arc/p.spacing):i%2?1:-1);o[i*2]=r[i*2]+ty/l*k;o[i*2+1]=r[i*2+1]-tx/l*k;}return o;})}));},
 tiles(G,f,p,F,ctx){const h=p.size,out=[],pat=(i,j,salt)=>p.pattern==='alternate'?((i+j)%2?1:-1):p.pattern==='wave'?Math.sin(TAU*((i+j)*.15-p.cycles*ctx.phase)+salt):hash(ctx.seed,i,j,salt)*2-1;
  for(const g of G){const cells=new Map();
   for(const q of g.polys){const [x0,y0,x1,y1]=bboxOf([q]);
    for(let i=Math.floor((x0-F.cx)/h);i<=Math.floor((x1-F.cx)/h);i++)for(let j=Math.floor((y0-F.cy)/h);j<=Math.floor((y1-F.cy)/h);j++){const lx=F.cx+i*h,ly=F.cy+j*h;
     let c=clipHalf(q,1,0,lx);c=c&&clipHalf(c,-1,0,-(lx+h));c=c&&clipHalf(c,0,1,ly);c=c&&clipHalf(c,0,-1,-(ly+h));if(!c)continue;const key=i+','+j;if(!cells.has(key))cells.set(key,{i,j,polys:[]});cells.get(key).polys.push(c);}}
   for(const {i,j,polys} of cells.values()){const d=p.offset*fieldValue(F,F.cx+(i+.5)*h,F.cy+(j+.5)*h)*p.strength,sx=p.axis==='y'?0:pat(i,j,61)*d,sy=p.axis==='x'?0:pat(j,i,63)*d;
    out.push({polys:sx||sy?aff(polys,[1,0,0,1,sx,sy],false):polys,dt:g.dt+(hash(ctx.seed,i,j,67)<p.tone?1:0),da:g.da});}}
  return out;},
 // Rings an element sits wholly inside turn as one piece; elements across rings are cut with Clipper.
 // A ring is one disc minus a smaller one. Each disc (or, away from the centre, the sector of it the element
 // covers) is convex, so the half-plane clipper cuts it; the inner cut is reversed so nonzero filling subtracts it.
 // Turning by ring is a per-point rule, so each polygon is cut on its own: one that sits inside a single ring just
 // turns, and holes cut alongside their outlines stay consistent (a screened letter's dots rarely need cutting).
 dial(G,f,p,F,ctx){const h=p.width,cx=F.cx,cy=F.cy;
  const pat=b=>p.pattern==='random'?hash(ctx.seed,b,71)*2-1:p.pattern==='wave'?Math.sin(TAU*(b*.17-p.cycles*ctx.phase)):p.pattern==='ramp'?b/6:b%2?1:-1;
  const turn=b=>p.angle*DEG*pat(b)*fieldValue(F,cx+(b+.5)*h,cy)*p.strength,place=(polys,b)=>{const a=turn(b);return a?aff(polys,rotM(cx,cy,a),false):polys;};
  return G.map(g=>{const out=[];
   for(const q of g.polys){let r0=Infinity,r1=0;for(let i=0;i<q.length;i+=2){const d=hyp(q[i]-cx,q[i+1]-cy);if(d<r0)r0=d;if(d>r1)r1=d;}
    const [x0,y0,x1,y1]=bboxOf([q]),around=cx>=x0&&cx<=x1&&cy>=y0&&cy<=y1;if(around)r0=0;const b0=Math.floor(r0/h),b1=Math.floor(r1/h);
    if(b0===b1){out.push(...place([q],b0));continue;}
    let a0=0,a1=TAU;if(!around){const first=Math.atan2(q[1]-cy,q[0]-cx);let lo=0,hi=0;for(let i=0;i<q.length;i+=2){const d=((Math.atan2(q[i+1]-cy,q[i]-cx)-first+3*Math.PI)%TAU)-Math.PI;if(d<lo)lo=d;if(d>hi)hi=d;}a0=first+lo-.02;a1=first+hi+.02;}
    const disc=r=>{const pts=[];if(around){const n=Math.round(clamp(r*TAU/10,16,240));for(let k=0;k<n;k++){const a=k/n*TAU;pts.push(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}return pts;}
     const n=Math.max(3,Math.ceil((a1-a0)*r/10));pts.push(cx,cy);for(let k=0;k<=n;k++){const a=a0+(a1-a0)*k/n;pts.push(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}return pts;};
    // A ring is the disc out to its outer radius minus the disc to its inner one, the latter reversed so nonzero filling subtracts it.
    let inner=b0>0?clipConvex(q,disc(b0*h)):null;
    for(let b=b0;b<=b1;b++){const outer=b===b1?q:clipConvex(q,disc((b+1)*h));if(outer)out.push(...place(inner?[outer,reversePoly(inner)]:[outer],b));inner=outer;}}
   return {...g,polys:out};});},
 burst(G,f,p,F,ctx){const N=p.sectors,w=TAU/N,a0=p.angle*DEG,cx=F.cx,cy=F.cy,out=[];
  const amt=k=>p.pattern==='even'?1:p.pattern==='random'?hash(ctx.seed,k,73):p.pattern==='wave'?.5+.5*Math.sin(TAU*(k/N*2-p.cycles*ctx.phase)):k%2?1:0;
  // An element erased earlier (Weight thinning it away, say) arrives with no outlines.
  for(const g of G){if(!g.polys.length)continue;const [x0,y0,x1,y1]=bboxOf(g.polys);let k0=0,k1=N-1;
   if(!(cx>=x0&&cx<=x1&&cy>=y0&&cy<=y1)){const first=Math.atan2(g.polys[0][1]-cy,g.polys[0][0]-cx);let lo=0,hi=0;
    for(const q of g.polys)for(let i=0;i<q.length;i+=2){const d=((Math.atan2(q[i+1]-cy,q[i]-cx)-first+3*Math.PI)%TAU)-Math.PI;if(d<lo)lo=d;if(d>hi)hi=d;}
    k0=Math.floor((first+lo-a0)/w);k1=Math.floor((first+hi-a0)/w);}
   for(let kk=k0;kk<=k1;kk++){const k=((kk%N)+N)%N,a=a0+k*w,b=a+w,n1x=-Math.sin(a),n1y=Math.cos(a),n2x=Math.sin(b),n2y=-Math.cos(b),d1=n1x*cx+n1y*cy,d2=n2x*cx+n2y*cy;
    const polys=g.polys.map(q=>{const c=clipHalf(q,n1x,n1y,d1);return c&&clipHalf(c,n2x,n2y,d2);}).filter(Boolean);if(!polys.length)continue;
    const m=amt(k)*f,mid=a+w/2;out.push({...g,polys:m?aff(polys,rotM(cx,cy,p.turn*DEG*m,1,Math.cos(mid)*p.offset*m,Math.sin(mid)*p.offset*m),false):polys});}}
  return out;},
 repeat(G,f,p,F,ctx){if(f<.5)return G;const {W,H}=ctx,s=Math.min(1/p.cols,1/p.rows),tw=W*s,th=H*s,ox=(W-p.cols*tw)/2,oy=(H-p.rows*th)/2,k=s*(1-p.gap),out=[];
  for(let j=0;j<p.rows;j++)for(let i=0;i<p.cols;i++){const fx=(p.mirror==='x'||p.mirror==='both')&&i%2===1,fy=(p.mirror==='y'||p.mirror==='both')&&j%2===1,kx=fx?-k:k,ky=fy?-k:k;
   const m=[kx,0,0,ky,ox+(i+.5)*tw-kx*W/2,oy+(j+.5)*th-ky*H/2];for(const g of G)out.push({polys:aff(g.polys,m,fx!==fy),dt:g.dt+p.tone*((i+j)%2),da:g.da});}
  return out;},
 shadow(G,f,p){const l=p.length*f;if(l<.05)return G;const dx=Math.cos(p.angle*DEG)*l,dy=Math.sin(p.angle*DEG)*l;
  return G.map(g=>({polys:p.style==='long'?sweep(g.polys,dx,dy):aff(g.polys,[1,0,0,1,dx,dy],false),dt:g.dt+p.tone,da:g.da*p.opacity})).concat(G);},
 shatter(G,f,p,F,ctx){if(f<1e-3)return G;const gap=p.gap*f/2,out=[],lines=[];
  for(let l=0;l<p.cuts;l++){const th=hash(ctx.seed,l,31)*Math.PI,nx=Math.cos(th),ny=Math.sin(th);lines.push([nx,ny,nx*F.cx+ny*F.cy+(hash(ctx.seed,l,37)*2-1)*F.R*.6]);}
  for(const g of G){let pieces=[{polys:g.polys,ox:0,oy:0,sig:1}];
   for(const [nx,ny,d] of lines){const next=[];for(const pc of pieces){const A=[],B=[];for(const q of pc.polys){const a=clipHalf(q,nx,ny,d),b=clipHalf(q,-nx,-ny,-d);if(a)A.push(a);if(b)B.push(b);}
     if(A.length)next.push({polys:A,ox:pc.ox+nx*gap,oy:pc.oy+ny*gap,sig:pc.sig*2+1});if(B.length)next.push({polys:B,ox:pc.ox-nx*gap,oy:pc.oy-ny*gap,sig:pc.sig*2});}pieces=next;}
   for(const pc of pieces){const [x0,y0,x1,y1]=bboxOf(pc.polys);out.push({...g,polys:aff(pc.polys,rotM((x0+x1)/2,(y0+y1)/2,(hash(ctx.seed,pc.sig,41)*2-1)*p.spin*f*DEG,1,pc.ox,pc.oy),false)});}}
  return out;}
};
// Inline rebuilds an element's own outline as concentric bands, before it is placed. Cached per shape.
// Outline modifiers share Clipper: each shape's outline is unioned once, then offset and recombined.
// Results are cached per shape and per quantized setting, so animation only re-places them.
const CK=64,CLIP_BASE=new WeakMap(),REBUILT=new WeakMap(),EMPTY={parts:[],travel:0,r:0,dense:null,denseL:0};
function clipBase(shape){let b=CLIP_BASE.get(shape);if(b)return b;const src=[];
 for(const pt of shape.parts)if(!pt.pupil)for(const q of pt.polys){const path=[];for(let i=0;i<q.length;i+=2)path.push({X:Math.round(q[i]*CK),Y:Math.round(q[i+1]*CK)});src.push(path);}
 b=ClipperLib.Clipper.SimplifyPolygons(src,ClipperLib.PolyFillType.pftNonZero);CLIP_BASE.set(shape,b);return b;}
function offsetPaths(paths,delta,join='round'){if(!delta||!paths.length)return paths;const {ClipperOffset,JoinType,EndType}=ClipperLib,co=new ClipperOffset(2,.2*CK),sol=[];
 co.AddPaths(paths,join==='miter'?JoinType.jtMiter:JoinType.jtRound,EndType.etClosedPolygon);co.Execute(sol,delta*CK);return sol;}
const flatPath=path=>path.flatMap(v=>[v.X/CK,v.Y/CK]);
// The region a set of outlines paints under nonzero filling, as shapes: each an outline (positive) with its holes.
// Colour modifiers paint shape by shape, and cut modifiers leave overlapping pieces of opposite winding that only
// add up correctly as one path, so they are resolved first.
function paintedShapes(polys){const {Clipper,ClipType,PolyType,PolyFillType}=ClipperLib,c=new Clipper(),sol=[];
 c.AddPaths(polys.filter(q=>q.length>=6).map(q=>{const p=[];for(let i=0;i<q.length;i+=2)p.push({X:Math.round(q[i]*CK),Y:Math.round(q[i+1]*CK)});return p;}),PolyType.ptSubject,true);
 // Plain paths, not a PolyTree: building the tree is quadratic in the number of outlines. After the union every
 // hole lies strictly inside its outline, so a point test against outlines found through a coarse grid places it.
 c.Execute(ClipType.ctUnion,sol,PolyFillType.pftNonZero,PolyFillType.pftNonZero);
 const rings=sol.map(flatPath).filter(q=>q.length>=6).map(q=>({q,a:polyArea(q),bb:bboxOf([q])}));if(!rings.length)return [];
 const big=rings.reduce((m,r)=>Math.abs(r.a)>Math.abs(m.a)?r:m),sign=Math.sign(big.a)||1,outer=rings.filter(r=>Math.sign(r.a)===sign),holes=rings.filter(r=>Math.sign(r.a)!==sign);
 const fix=q=>sign>0?q:reversePoly(q),out=outer.map(o=>[fix(o.q)]);if(!holes.length)return out;
 let X0=Infinity,Y0=Infinity,X1=-Infinity,Y1=-Infinity;for(const o of outer){X0=Math.min(X0,o.bb[0]);Y0=Math.min(Y0,o.bb[1]);X1=Math.max(X1,o.bb[2]);Y1=Math.max(Y1,o.bb[3]);}
 const N=Math.max(1,Math.min(64,Math.round(Math.sqrt(outer.length)))),sx=N/Math.max(X1-X0,1e-9),sy=N/Math.max(Y1-Y0,1e-9),gi=(v,o,k)=>Math.min(N-1,Math.max(0,Math.floor((v-o)*k))),grid=new Map();
 outer.forEach((o,i)=>{for(let j=gi(o.bb[1],Y0,sy);j<=gi(o.bb[3],Y0,sy);j++)for(let k=gi(o.bb[0],X0,sx);k<=gi(o.bb[2],X0,sx);k++){const key=k+N*j;let l=grid.get(key);if(!l)grid.set(key,l=[]);l.push(i);}});
 for(const h of holes){let best=-1,area=Infinity;const n=h.q.length/2;
  for(const f of [0,.25,.5,.75]){const v=Math.floor(f*n)*2,x=h.q[v],y=h.q[v+1];
   for(const i of grid.get(gi(x,X0,sx)+N*gi(y,Y0,sy))||[]){const o=outer[i],oa=Math.abs(o.a);if(oa<area&&x>=o.bb[0]&&x<=o.bb[2]&&y>=o.bb[1]&&y<=o.bb[3]&&winding([o.q],x,y)!==0){best=i;area=oa;}}
   if(best>=0)break;}
  if(best>=0)out[best].push(fix(h.q));}
 return out;}
// A band between two nested outlines: the outer paths as they are, the inner ones reversed so nonzero filling empties them.
const band=(outer,inner)=>[...outer.map(flatPath),...inner.map(q=>reversePoly(flatPath(q)))];
function rebuild(shape,key,make){let c=REBUILT.get(shape);if(!c){c=new Map();REBUILT.set(shape,c);}let s=c.get(key);if(s)return s;
 const polys=make().filter(q=>q.length>=6);s=polys.length?finishShape([{polys},...shape.parts.filter(pt=>pt.pupil)],shape.travel):EMPTY;c.set(key,s);return s;}
function inlineShape(shape,p,rings){return rebuild(shape,`inline|${rings}|${p.step}|${p.weight}|${p.join}`,()=>{const base=clipBase(shape),out=[];
 // Deeper rings only shrink further, so the first empty inset ends the loop.
 for(let k=0;k<rings;k++){const outer=offsetPaths(base,-k*p.step,p.join);if(!outer.length)break;out.push(...band(outer,offsetPaths(base,-(k+p.weight)*p.step,p.join)));}return out;});}
// Screen rebuilds an outline as dots, squares, crosses or line spans on a rotated grid. The field level
// (0–16) blends dot size from overlapping-solid at the edge of the field to the set size inside it.
const SCREEN=new WeakMap();
function screenShape(shape,p,level){let cache=SCREEN.get(shape);if(!cache){cache=new Map();SCREEN.set(shape,cache);}const key=`${p.pattern}|${p.pitch}|${p.size}|${p.angle}|${p.fit}|${level}`;let s=cache.get(key);if(s)return s;
 // The grid is capped by widening the pitch: at most 12,000 cells, and fewer for complex outlines, so that cells ×
 // samples × outline points stays near thirty million point tests.
 const src=shape.parts.filter(pt=>!pt.pupil).flatMap(pt=>pt.polys),b=bboxOf(src),span=Math.max(1,(b[2]-b[0])*(b[3]-b[1])),npts=src.reduce((n,q)=>n+q.length/2,0);
 const cells=clamp(3e7/(Math.max(1,npts)*(p.fit==='coverage'?9:1)),1500,12000);
 const a=p.angle*DEG,ca=Math.cos(a),sa=Math.sin(a),P=Math.max(p.pitch,Math.sqrt(span*2/cells)),out=[],k=level/16;
 const rp=shape.parts.filter(pt=>!pt.pupil).flatMap(pt=>pt.polys).map(q=>{const r=new Array(q.length);for(let i=0;i<q.length;i+=2){r[i]=q[i]*ca+q[i+1]*sa;r[i+1]=-q[i]*sa+q[i+1]*ca;}return r;});
 // Each cell test only walks polygons whose box holds the point; screening a screen stays fast.
 const boxes=rp.map(q=>bboxOf([q])),inside=(u,v)=>{let w=0;for(let i=0;i<rp.length;i++){const b=boxes[i];if(u<b[0]||u>b[2]||v<b[1]||v>b[3])continue;w+=winding([rp[i]],u,v);}return w!==0;};
 const [u0,v0,u1,v1]=bboxOf(rp),back=pts=>{const q=new Array(pts.length);for(let i=0;i<pts.length;i+=2){q[i]=pts[i]*ca-pts[i+1]*sa;q[i+1]=pts[i]*sa+pts[i+1]*ca;}return q;};
 if(p.pattern==='lines'){const h=P*mix(1.02,p.size,k)/2;
  for(let v=Math.floor(v0/P)*P+P/2;v<v1;v+=P){const xs=[];
   for(const q of rp){const n=q.length;for(let i=0;i<n;i+=2){const j=i+2<n?i+2:0,ya=q[i+1],yb=q[j+1];if((ya<=v)!==(yb<=v))xs.push([q[i]+(q[j]-q[i])*(v-ya)/(yb-ya),yb>ya?1:-1]);}}
   xs.sort((m,n)=>m[0]-n[0]);let w=0,start=0;for(const [x,d] of xs){const was=w;w+=d;if(!was&&w)start=x;else if(was&&!w&&x-start>1e-6)out.push(back([start,v-h,x,v-h,x,v+h,start,v+h]));}}}
 else{const full=mix(1.25,p.size,k),n=Math.round(clamp(P*full*1.4,8,24));
  for(let v=Math.floor(v0/P)*P+P/2;v<v1;v+=P)for(let u=Math.floor(u0/P)*P+P/2;u<u1;u+=P){
   let c;if(p.fit==='coverage'){c=0;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)c+=inside(u+i*P/3,v+j*P/3);c=Math.sqrt(c/9);}else c=inside(u,v)?1:0;if(!c)continue;
   const r=P*full*c/2,t=r*.34;
   out.push(back(p.pattern==='squares'?[u-r,v-r,u+r,v-r,u+r,v+r,u-r,v+r]:p.pattern==='crosses'?[u-t,v-r,u+t,v-r,u+t,v-t,u+r,v-t,u+r,v+t,u+t,v+t,u+t,v+r,u-t,v+r,u-t,v+t,u-r,v+t,u-r,v-t,u-t,v-t]:ellipse(r,r,n).map((z,i)=>i%2?z+v:z+u)));}}
 s=out.length?finishShape([{polys:out},...shape.parts.filter(pt=>pt.pupil)],shape.travel):shape;cache.set(key,s);return s;}
// Dither rebuilds an outline as a dither of its own coverage, blurred by the edge spread, lit, lightened and grained.
// The blurred coverage is scaled to its own peak, so a stroke thinner than the spread keeps a solid spine. Relief
// lights the edge ramps like a volume: edges facing the light thin out, the far ones darken. The field level (0–16)
// scales spread, lightening, relief and grain, so towards the field's edge the pixels close up into the solid shape.
// On the page grid, cell (i, j) is the page pixel at i·P, j·P: elements that touch share one lattice and one ordered
// pattern. The grid stops a blur's reach past the outline, so no cell outside it ever prints.
const DITHER=new WeakMap();
function ditherShape(shape,p,level,x,y){let cache=DITHER.get(shape);if(!cache){cache=new Map();DITHER.set(shape,cache);}
 const page=p.grid==='page',ox=page?Math.round(x*100)/100:0,oy=page?Math.round(y*100)/100:0;
 const key=`${p.method}|${p.pixel}|${p.spread}|${p.tone}|${p.relief}|${p.light}|${p.grain}|${p.contrast}|${p.order}|${p.mark}|${level}|${ox}|${oy}`;let s=cache.get(key);if(s)return s;if(cache.size>4096)cache.clear();
 const k=level/16,src=shape.parts.filter(pt=>!pt.pupil).flatMap(pt=>pt.polys),b=bboxOf(src),reach=p.spread*k;
 // Past 60,000 cells (20,000 for dots and LEDs) the pixel widens, so a page-sized shape stays drawable.
 let P=p.pixel;const area=(b[2]-b[0]+2*reach+4*P)*(b[3]-b[1]+2*reach+4*P),cap=p.mark==='dot'||p.mark==='led'?2e4:6e4;if(area/(P*P)>cap)P=Math.sqrt(area/cap);
 const r=reach/(2*P),m=Math.ceil(2*r)+1,i0=Math.floor((b[0]+ox)/P)-m,j0=Math.floor((b[1]+oy)/P)-m,cols=Math.floor((b[2]+ox)/P)+m-i0+1,rows=Math.floor((b[3]+oy)/P)+m-j0+1,gx=i0*P-ox,gy=j0*P-oy;
 const cb=blurGrid(coverGrid(src,cols,rows,{x0:gx,y0:gy,pw:P,ph:P}),cols,rows,r);let peak=0;for(const c of cb)if(c>peak)peak=c;
 const v=new Float32Array(cb.length),fill=1-p.tone*k,g=p.grain*k*1.2,gs=Math.max(3*P,30),lx=Math.cos(p.light*DEG),ly=Math.sin(p.light*DEG),rel=p.relief*k*(Math.round(r)*2+1)/(2*(peak||1));
 const at=(i,j)=>cb[Math.max(0,Math.min(rows-1,j))*cols+Math.max(0,Math.min(cols-1,i))];
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const c=j*cols+i;if(cb[c]<1e-4)continue;
  // The coverage gradient points inward; where it faces the light the edge is lit and thins out.
  const lit=rel?clamp(((at(i+1,j)-at(i-1,j))*lx+(at(i,j+1)-at(i,j-1))*ly)*rel,-1,1):0;let t=cb[c]/peak*clamp(fill+lit*.8,0,1.5);
  if(g){const X=(i0+i+.5)*P/gs,Y=(j0+j+.5)*P/gs;t*=1+g*(noise2(X,Y)*.65+noise2(X*2.7+19,Y*2.7+7)*.35);}
  v[c]=clamp(.5+(t-.5)*p.contrast);}
 const q=ditherGrid(v,cols,rows,{method:p.method,order:p.order,seed:7,i0,j0}),out=[],h=P/2;
 for(let j=0;j<rows;j++){const y0=gy+j*P,row=j*cols;
  if(p.mark==='pixel'||p.mark==='scan'){const ya=p.mark==='scan'?y0+P*.16:y0,yb=p.mark==='scan'?y0+P*.7:y0+P;
   for(let i=0;i<cols;){if(!q[row+i]){i++;continue;}let e=i;while(e<cols&&q[row+e])e++;const xa=gx+i*P,xb=gx+e*P;out.push([xa,ya,xb,ya,xb,yb,xa,yb]);i=e;}}
  else for(let i=0;i<cols;i++)if(q[row+i]){const u=gx+(i+.5)*P,w=y0+h;
   if(p.mark==='dot')out.push(ellipse(h*.96,h*.96,10).map((z,n)=>n%2?z+w:z+u));else{const a=h*.74;out.push([u-a,w-a,u+a,w-a,u+a,w+a,u-a,w+a]);}}}
 s=out.length?finishShape([{polys:out},...shape.parts.filter(pt=>pt.pupil)],shape.travel):EMPTY;cache.set(key,s);return s;}
// Outline modifiers run on each element's own shape before it is placed, reading the field at its centre.
const q16=f=>Math.round(clamp(f)*16)/16;
// Offsetting needs a union of the whole outline; past 8,000 points or 150 contours (a screened shape, say) it is skipped.
const COMPLEXITY=new WeakMap();
function complexity(shape){let c=COMPLEXITY.get(shape);if(c===undefined){let n=0,k=0;for(const pt of shape.parts)for(const q of pt.polys){n+=q.length/2;k++;}c=k>150?Infinity:n;COMPLEXITY.set(shape,c);}return c;}
const OUTLINE={
 inline(shape,p,f){const rings=Math.round(p.rings*f);return rings>=1?inlineShape(shape,p,rings):shape;},
 // Weight grows or thins every outline by an offset, like a heavier or lighter cut of the same letters.
 weight(shape,p,f){const d=p.amount*q16(f);return Math.abs(d)<.05?shape:rebuild(shape,`weight|${d}|${p.join}`,()=>offsetPaths(clipBase(shape),d,p.join).map(flatPath));},
 // Round shrinks and regrows (convex corners) or grows and shrinks (inner corners) with round joins.
 // Round shrinks and regrows (convex corners) or grows and shrinks (inner corners). Strokes thinner than the
 // radius would vanish, so a shape that would lose over 40% of its area retries at half and a quarter radius.
 round(shape,p,f){const r=p.radius*q16(f);if(r<.05)return shape;return rebuild(shape,`round|${r}|${p.corners}`,()=>{const base=clipBase(shape),area=ps=>ps.reduce((s,q)=>s+polyArea(q),0),whole=Math.abs(area(base.map(flatPath)));
  for(const k of [1,.5,.25]){let b=base;const rr=r*k;if(p.corners!=='inner')b=offsetPaths(offsetPaths(b,-rr),rr);if(p.corners!=='outer')b=offsetPaths(offsetPaths(b,rr),-rr);const out=b.map(flatPath);if(Math.abs(area(out))>=whole*.6)return out;}
  return base.map(flatPath);});},
 // Outline keeps only a band along the edge: inside, centred on or outside the original outline.
 outline(shape,p,f){const w=p.width*q16(f);if(w<.05)return shape;return rebuild(shape,`outline|${w}|${p.position}|${p.join}`,()=>{const b=clipBase(shape),o=p.position==='inside'?0:p.position==='outside'?w:w/2;
  return band(offsetPaths(b,o,p.join),offsetPaths(b,o-w,p.join));});},
 screen(shape,p,f){const level=Math.round(clamp(f)*16);return level?screenShape(shape,p,level):shape;},
 dither(shape,p,f,x,y){const level=Math.round(clamp(f)*16);return level?ditherShape(shape,p,level,x,y):shape;}
};
// Screen and Dither scan their outline row by row, so they take any outline, a screened or dithered one too.
const RASTER=new Set(['screen','dither']);
// Extrusion walls: each edge swept along e becomes a quad, all oriented positively, plus the far copy.
function sweep(face,ex,ey){const out=[];
 // Walls are oriented one by one; the far copy keeps the outline's own orientation, made positive as a whole,
 // so a flipped outline (Ribbon, Fold) still fills instead of cancelling its walls.
 for(const p of oriented(face)){const n=p.length;for(let i=0;i<n;i+=2){const j=i+2<n?i+2:0,ax=p[i],ay=p[i+1],bx=p[j],by=p[j+1],cr=(bx-ax)*ey-(by-ay)*ex;if(Math.abs(cr)<1e-9)continue;
   out.push(cr>0?[ax,ay,bx,by,bx+ex,by+ey,ax+ex,ay+ey]:[ax,ay,ax+ex,ay+ey,bx+ex,by+ey,bx,by]);}
  out.push(p.map((v,i)=>i%2?v+ey:v+ex));}
 return out;}
// Turns evaluated clones into draw operations: {fill, a, polys}, in paint order, consecutive fills merged.
export function compose(scene,state,attrs,ctx){
 const [paper,ink,accent]=state.colors,ops=[],P=[0,0],Q=[0,0],K={x:0,y:0,r:1},W=scene.W,H=scene.H,stats={points:0,culled:0,dropped:0,skipped:0,work:0};
 const mods=modifierSteps(state.modifiers,ctx);
 // Every polygon is checked once on the way out: non-finite ones are dropped; runaway ones (past ten million units,
 // like a copy scaled up 24 times) and ones wholly a page away are culled.
 const push=(fill,a,poly)=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<poly.length;i+=2){const x=poly[i],y=poly[i+1];if(!Number.isFinite(x)||!Number.isFinite(y)){stats.dropped++;return;}if(Math.abs(x)>1e7||Math.abs(y)>1e7){stats.culled++;return;}if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  if(x1<-W||x0>2*W||y1<-H||y0>2*H){stats.culled++;return;}stats.points+=poly.length/2;const o=ops[ops.length-1];if(o&&o.fill===fill&&o.a===a&&o.layer===layer)o.polys.push(poly);else ops.push({fill,a,polys:[poly],layer});};
 // Operations remember their element, so colour modifiers can pick them out.
 let layer=null;
 scene.layers.forEach((Ly,li)=>{const L=Ly.L,A=attrs[li];if(!L.on||!A)return;const n=Ly.clones.length;layer=Ly.id;
  const list=mods.filter(x=>x.kind!=='shape'&&targets(x.m,Ly)),outline=mods.filter(x=>x.kind==='shape'&&targets(x.m,Ly)),nm=list.length;
  let lastPoint=-1;list.forEach((x,i)=>{if(x.kind==='point'||x.kind==='blend')lastPoint=i;});
  // Bending needs points along straight edges; Roughen asks for its own, finer spacing.
  const step=Math.min(scene.M*.006,...list.flatMap(x=>x.kind==='blend'?x.points:[x]).filter(x=>x.m.type==='roughen').map(x=>x.m.grain/2)),dense=lastPoint>=0;
  // An artwork's own background is its paper, so colour modifiers aimed at the paper reach an imported poster too.
  if(L.type==='artwork'&&L.ground&&Ly.ground){layer='paper';push(Ly.ground,1,[0,0,scene.W,0,scene.W,scene.H,0,scene.H]);layer=Ly.id;}
  const base=L.color==='accent'?accent:L.color==='paper'?paper:ink,toward=L.color==='accent'?ink:accent,tones=Array.from({length:33},(_,t)=>mixHex(base,toward,t/32));
  let order=[...Array(n).keys()],sx0=0,sy0=0,lifted=false;for(let k=0;k<n;k++){const ex=A[k*NA+7],ey=A[k*NA+8];sx0+=ex;sy0+=ey;if(Math.abs(ex)+Math.abs(ey)>.3)lifted=true;}
  // Lifted elements paint from far to near along the lift, so nearer walls cover farther ones.
  if(lifted)order.sort((a,b)=>(A[b*NA]*sx0+A[b*NA+1]*sy0)-(A[a*NA]*sx0+A[a*NA+1]*sy0));
  for(const k of order){const o=k*NA,x=A[o],y=A[o+1],sx=A[o+2],sy=A[o+3],a=A[o+6]*L.opacity;if(a<.004||Math.abs(sx)<1e-4||Math.abs(sy)<1e-4)continue;
   const cl=Ly.clones[k],rot=A[o+4]*DEG,cs=Math.cos(rot),sn=Math.sin(rot),ex=A[o+7],ey=A[o+8],tone=A[o+5],up=Math.abs(ex)+Math.abs(ey)>.3;
   // Screen and Dither stop rebuilding once the frame passes the point budget; later elements stay solid.
   let shape=cl.shape;for(const om of outline){if(RASTER.has(om.m.type)?stats.points>POINT_BUDGET:complexity(shape)>8000){stats.skipped++;continue;}shape=OUTLINE[om.m.type](shape,om.m,fieldValue(om.F,x,y)*om.m.strength,x,y);}
   // Weight can thin an element away and Dither can lighten one away; an element with no outline paints nothing.
   if(!shape.parts.length)continue;
   let lx=A[o+10],ly=A[o+11];const ll=hyp(lx,ly);if(ll>1){lx/=ll;ly/=ll;}const tr=shape.travel*(Math.abs(sx)+Math.abs(sy))/2,face=[];
   const a11=cs*sx,a12=-sn*sy,a21=sn*sx,a22=cs*sy,parts=dense?denseParts(shape,step):shape.parts,lift=nm?0:1;
   for(let pi=0;pi<parts.length;pi++){const part=parts[pi],tx=x+ex*lift+(part.pupil?lx*tr:0),ty=y+ey*lift+(part.pupil?ly*tr:0);
    for(let qi=0;qi<part.polys.length;qi++){const p=part.polys[qi],len=p.length,q=new Array(len);for(let i=0;i<len;i+=2){const u=p[i],v=p[i+1];q[i]=tx+a11*u+a12*v;q[i+1]=ty+a21*u+a22*v;}face.push(q);}}
   let G=[{polys:face,dt:0,da:1}];
   if(nm){K.x=x;K.y=y;K.r=shape.r*Math.max(Math.abs(sx),Math.abs(sy));
    for(let j=0;j<nm;j++){const md=list[j];
     if(md.kind==='point'){for(const g of G)for(const q of g.polys)for(let i=0;i<q.length;i+=2){P[0]=q[i];P[1]=q[i+1];const f=fieldValue(md.F,P[0],P[1])*md.m.strength;if(f>1e-5){md.fn(P,f,md.m,md.F,ctx,K);q[i]=P[0];q[i+1]=P[1];}}}
     else if(md.kind==='blend'){const n=md.points.length,avg=md.op==='average';
      for(const g of G)for(const q of g.polys)for(let i=0;i<q.length;i+=2){const x0=q[i],y0=q[i+1],mask=fieldValue(md.F,x0,y0)*md.m.strength;if(mask<=1e-5)continue;let dx=0,dy=0;
       for(const c of md.points){P[0]=x0;P[1]=y0;const f=fieldValue(c.F,x0,y0)*c.m.strength;if(f>1e-5){c.fn(P,f,c.m,c.F,ctx,K);dx+=P[0]-x0;dy+=P[1]-y0;}}
       if(avg){dx/=n;dy/=n;}q[i]=x0+dx*mask;q[i+1]=y0+dy*mask;}}
     // Copying modifiers stop multiplying once a frame passes its point budget; the frame reports what it skipped.
     // Copies far off the page are only culled when painted, so the work done on the way counts too.
     else if(COPIES.has(md.m.type)&&(stats.points+groupPoints(G)*growth(md.m,G)>POINT_BUDGET||stats.work+groupPoints(G)*growth(md.m,G)>WORK_BUDGET)){stats.skipped++;continue;}
     else{G=md.fn(G,fieldValue(md.F,x,y)*md.m.strength,md.m,md.F,ctx,K);if(j<lastPoint)G=G.map(g=>({...g,polys:g.polys.map(q=>resample(q,step))}));stats.work+=groupPoints(G);}}
    // Bending can turn an element inside out (Ribbon, Fold, Bend, Petal); paint it the right way round.
    G=G.map(g=>({...g,polys:oriented(g.polys)}));
    if(ex||ey)for(const g of G)for(const q of g.polys)for(let i=0;i<q.length;i+=2){q[i]+=ex;q[i+1]+=ey;}}
   for(const g of G){const t32=Math.round(clamp(tone+g.dt)*32),aq=Math.round(clamp(a*g.da)*50)/50;if(aq<.004||!g.polys.length)continue;
    const fill=cl.color&&L.colors!=='palette'?mixHex(cl.color,toward,t32/32):tones[t32];
    if(up){const wall=mixHex(fill,paper,A[o+9]);for(const w of sweep(g.polys,-ex,-ey))push(wall,aq,w);}
    for(const q of g.polys)push(fill,aq,q);}}});
 ops.stats=stats;
 // Colour modifiers run last and only repaint: flat fills, or gradients sampled from their fields.
 return state.colours?.length?colourPass(ops,state,scene,ctx,{resolveField,fieldValue,clipConvex,bboxOf,polyArea,paintedShapes}):ops;}
const POINT_BUDGET=6e5,WORK_BUDGET=2.5e6,COPIES=new Set(['echo','kaleido','repeat','burst','tiles','dial','slice','shatter','shadow','mirror','zigzag']);
const groupPoints=G=>G.reduce((n,g)=>n+g.polys.reduce((m,q)=>m+q.length/2,0),0);
// How many times a copying modifier can multiply the points it is given, at most.
function growth(p,G){switch(p.type){case 'echo':return p.copies+1;case 'kaleido':return p.segments;case 'repeat':return p.cols*p.rows;case 'shatter':return 1<<Math.min(p.cuts,10);case 'shadow':return p.style==='long'?6:2;case 'mirror':return 2;
 case 'zigzag':{let per=0;for(const g of G)for(const q of g.polys)for(let i=0;i<q.length;i+=2){const j=i+2<q.length?i+2:0;per+=hyp(q[j]-q[i],q[j+1]-q[i+1]);}return Math.max(1,per/(p.spacing/(p.style==='smooth'?6:2))/Math.max(1,groupPoints(G)));}
 default:return 3;}}
// Turns the modifier list into execution steps. Chain groups flatten into their children with the group's field as
// a mask; Add and Average groups become one blend step for their bending children, then their cutting children.
function modifierSteps(list,ctx){const out=[],mk=(m,mask)=>{const F=resolveField(m.field,ctx);if(mask){F.mask=mask.F;F.maskK=mask.m.strength;}return {m,F,kind:MODIFIERS[m.type].kind,fn:MODIFY[m.type]||CUT[m.type]};};
 for(const m of list){if(!m.on||m.strength<=0)continue;
  if(m.type!=='group'){out.push(mk(m));continue;}
  const g={m,F:resolveField(m.field,ctx)},kids=(m.children||[]).filter(c=>c.on&&c.strength>0&&MODIFIERS[c.type]&&MODIFIERS[c.type].kind!=='shape');
  if(m.op==='chain'){for(const c of kids)out.push({...mk(c,g),m:{...c,target:m.target}});continue;}
  const points=kids.filter(c=>MODIFIERS[c.type].kind==='point').map(c=>mk(c));if(points.length)out.push({kind:'blend',op:m.op,m,F:g.F,points});
  for(const c of kids.filter(c=>MODIFIERS[c.type].kind==='poly'))out.push({...mk(c,g),m:{...c,target:m.target}});}
 return out;}
// Field positions for the editor's overlay.
export function fieldGizmos(state,ctx){const out=[],add=(list,cat,items)=>items.forEach((e,index)=>{if(!e.on)return;const F=resolveField(e.field,ctx);
  out.push({list,index,name:e.type==='group'?GROUP.name:cat[e.type].name,...F,follow:e.field.follow,drive:e.field.drive});if(e.type==='group')add(`${list}.${index}.children`,cat,e.children||[]);});
 add('effectors',EFFECTORS,state.effectors);add('modifiers',MODIFIERS,state.modifiers);add('colours',COLOURS,state.colours||[]);return out;}

// ---------------------------------------------------------------- SVG out
const fmt=v=>{const r=Math.round(v*10)/10;return Object.is(r,-0)?'0':String(r);};
export function polysToD(polys){let d='';for(const p of polys){if(p.length<6)continue;d+='M'+fmt(p[0])+' '+fmt(p[1])+'L';for(let i=2;i<p.length;i+=2)d+=(i>2?' ':'')+fmt(p[i])+' '+fmt(p[i+1]);d+='Z';}return d;}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function describe(state){const L=state.layers.map(l=>LAYERS[l.type].name+(l.type==='text'||l.type==='matrix'?` “${normText(l.text).replace(/\n/g,' / ')}”`:'')),E=state.effectors.filter(e=>e.on).map(e=>EFFECTORS[e.type].name),M=state.modifiers.filter(m=>m.on).map(m=>m.type==='group'?`${GROUP.params[0].options.find(o=>o[0]===m.op)[1].split(':')[0]} (${(m.children||[]).filter(c=>c.on).map(c=>MODIFIERS[c.type].name).join(' + ')})`:MODIFIERS[m.type].name);
 const Cl=(state.colours||[]).filter(c=>c.on).map(c=>COLOURS[c.type].name);
 return `${L.join(', ')||'No elements'}${E.length?`; effectors: ${E.join(', ')}`:''}${M.length?`; modifiers: ${M.join(', ')}`:''}${Cl.length?`; colour: ${Cl.join(', ')}`:''}.`;}
export function toSVG(ops,state,scene){
 let body=`<rect width="${scene.W}" height="${scene.H}" fill="${state.colors[0]}"/>`;
 let n=0;for(const op of ops){const d=polysToD(op.polys);if(!d)continue;let fill=op.fill;
  // A colour modifier's gradient is written just before the path it paints.
  if(op.paint){const id='p'+(n++);body+=paintSVG(op.paint,id,fmt);fill=`url(#${id})`;}
  body+=`<path d="${d}" fill="${fill}"${op.a<1?` fill-opacity="${op.a}"`:''}/>`;}
 const title=RECIPES[state.recipe]?.name||'Effector study',desc=describe(state);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.W}" height="${scene.H}" viewBox="0 0 ${scene.W} ${scene.H}" role="img" aria-label="${esc(desc)}"><title>${esc(title)}</title><desc>${esc(desc)}</desc>${body}</svg>`;}
export function render(input,{t,pointer=null}={}){const state=normalize(input),scene=prepare(state),ctx=context(state,scene,t??state.time,pointer),attrs=evaluate(scene,state,ctx),ops=compose(scene,state,attrs,ctx);return {svg:toSVG(ops,state,scene),state,ops,scene,attrs};}

// ---------------------------------------------------------------- recipes
const F=(o={})=>o;
export const RECIPES={
 'lens-type':{name:'Lens',about:'A lens bulges the headline and the dot screen under it.',palette:'acid',
  layers:[{id:'L1',type:'grid',cols:44,gap:.6,shape:'circle',opacity:.4,area:'bleed'},{id:'L2',type:'text',text:'LENS/TYPE',font:'archivo'}],
  modifiers:[{type:'lens',amount:.7,field:F({radius:.32,softness:1,drive:'wander',travel:.22})}]},
 pinch:{name:'Pinch',about:'Cells shrink around the pointer.',palette:'acid',
  layers:[{id:'L1',type:'grid',cols:28,gap:.1}],effectors:[{type:'pinch',amount:-.9,field:F({radius:.3,softness:.9,drive:'wander',travel:.22})}]},
 twist:{name:'Twist',about:'Rule segments turn to point at the field.',palette:'signal',
  layers:[{id:'L1',type:'lines',count:34,segments:24,segGap:.35,weight:.16}],effectors:[{type:'twist',mode:'aim',field:F({radius:.4,softness:.85,drive:'orbit',travel:.22})}]},
 watch:{name:'Watch',about:'A field of eyes follows the pointer.',palette:'paper',
  layers:[{id:'L1',type:'grid',cols:14,gap:.16,shape:'eye'}],effectors:[{type:'watch',look:1,field:F({shape:'all',drive:'wander',travel:.34})}]},
 settle:{name:'Settle',about:'Scattered dashes fall into columns where the field passes.',palette:'ice',
  layers:[{id:'L1',type:'grid',cols:12,aspect:.24,gap:.32,shape:'square'}],effectors:[{type:'settle',scatter:1.1,axis:'x',spin:6,drift:1,field:F({shape:'linear',angle:90,radius:.5,softness:1,drive:'sweep',travel:.45})}]},
 warp:{name:'Warp',about:'A magnifier pushes dots apart and enlarges them.',palette:'neon',
  layers:[{id:'L1',type:'grid',cols:30,gap:.58,shape:'square'}],effectors:[{type:'warp',amount:.7,grow:1,field:F({radius:.34,softness:1,drive:'orbit',travel:.2})}]},
 pillars:{name:'Pillars',about:'Discs rise into columns under the field.',palette:'concrete',
  layers:[{id:'L1',type:'grid',cols:16,gap:.3,shape:'circle'}],effectors:[{type:'pillars',height:150,angle:-90,shade:.5,field:F({radius:.5,softness:1,drive:'wander',travel:.25})}]},
 extrude:{name:'Extrude',about:'Letters lift on solid walls; the field sets their height.',palette:'mono',
  layers:[{id:'L1',type:'text',text:'DEEP/END',font:'anton',leading:1.02}],effectors:[{type:'pillars',height:90,angle:-125,shade:.62,field:F({radius:.7,softness:1,drive:'orbit',travel:.3})}]},
 'push-back':{name:'Push back',about:'Letters scatter and turn away from the pointer.',palette:'signal',
  layers:[{id:'L1',type:'text',text:'PUSH/BACK',font:'archivo'}],
  effectors:[{type:'repel',distance:150,field:F({radius:.32,softness:.9,drive:'wander',travel:.25})},{type:'twist',mode:'turn',angle:-35,field:F({radius:.32,softness:.9,drive:'wander',travel:.25})},{type:'tone',color:1,field:F({radius:.32,softness:.9,drive:'wander',travel:.25})}]},
 'type-matrix':{name:'Type matrix',about:'Dots that spell a word grow and light up in the field.',palette:'acid',
  layers:[{id:'L1',type:'matrix',text:'PINCH',cols:58,shape:'circle',ghost:.22,gap:.14}],
  effectors:[{type:'pinch',amount:1,field:F({radius:.22,softness:1,drive:'orbit',travel:.24})},{type:'tone',color:1,field:F({radius:.22,softness:1,drive:'orbit',travel:.24})}]},
 halftone:{name:'Halftone wave',about:'Coverage-sized cells breathe in a diagonal wave.',palette:'paper',
  layers:[{id:'L1',type:'matrix',text:'HALF/TONE',font:'syne',cols:70,shape:'square',mode:'coverage',ghost:.08,gap:.06}],
  effectors:[{type:'wave',channel:'scale',amount:.45,wavelength:340,angle:45,cycles:1,field:F({shape:'all',follow:false})},{type:'tone',color:1,field:F({radius:.25,softness:1})}]},
 twirl:{name:'Twirl',about:'Type and rules swirl around a pulsing centre.',palette:'neon',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:60,weight:.14,opacity:.55,area:'bleed'},{id:'L2',type:'text',text:'TWIRL',font:'unbounded'}],
  modifiers:[{type:'twirl',angle:220,field:F({radius:.45,softness:1,drive:'pulse'})}]},
 ripple:{name:'Ripple',about:'Arcs ripple outwards and spin with a lag.',palette:'ultra',
  layers:[{id:'L1',type:'rings',count:16,segments:44,segGap:.3,weight:.42}],
  effectors:[{type:'spin',turns:1,lag:.9,field:F({shape:'all',follow:false})}],
  modifiers:[{type:'ripple',amplitude:10,wavelength:130,cycles:2,field:F({radius:1,softness:1})}]},
 flag:{name:'Flag',about:'Type and rules wave like a flag.',palette:'ice',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:46,weight:.1,opacity:.45,area:'bleed'},{id:'L2',type:'text',text:'SIGNAL/NOISE',font:'grotesk',leading:1.05}],
  modifiers:[{type:'wave',amplitude:42,wavelength:720,angle:0,cycles:1,field:F({shape:'all',follow:false})},{type:'lens',amount:.35,field:F({radius:.25,softness:1,drive:'wander'})}]},
 pixel:{name:'Pixel',about:'A pixel grid snaps everything it passes over.',palette:'signal',
  layers:[{id:'L1',type:'grid',cols:30,gap:.82,shape:'square',opacity:.35,area:'bleed'},{id:'L2',type:'text',text:'PIXEL/DUST',font:'mono'}],
  modifiers:[{type:'pixelate',size:30,field:F({shape:'linear',angle:90,radius:.5,softness:.8,drive:'sweep',travel:.5})}]},
 turbulence:{name:'Turbulence',about:'Rules ripple through drifting noise and colour.',palette:'neon',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:64,weight:.34,area:'bleed'}],
  effectors:[{type:'tone',color:1,field:F({shape:'noise',scale:2.5,softness:.5,drive:'orbit',travel:.2,follow:false})}],
  modifiers:[{type:'turbulence',amplitude:46,scale:3,cycles:1,field:F({shape:'all'})}]},
 'spin-field':{name:'Spin field',about:'Crosses spin in a wave that lags with distance.',palette:'acid',
  layers:[{id:'L1',type:'grid',cols:16,gap:.18,shape:'cross'}],effectors:[{type:'spin',turns:1,lag:1.4,field:F({radius:.9,softness:1})},{type:'snap',angle:15,field:F({shape:'all',follow:false})}]},
 horizon:{name:'Horizon',about:'A taper lays the type down towards a horizon.',palette:'concrete',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:30,weight:.08,opacity:.6,area:'bleed'},{id:'L2',type:'text',text:'HORI/ZON',font:'anton',leading:.98}],
  modifiers:[{type:'taper',amount:.8,angle:90,field:F({shape:'all',follow:false,radius:.7})},{type:'wave',amplitude:18,wavelength:900,cycles:1,field:F({shape:'all',follow:false})}]},
 // Recipes for the modifiers found in the library and Japanese archive survey.
 ridges:{name:'Ridges',about:'Rules lift into a ridge wherever the field passes.',palette:'acid',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:54,weight:.2,area:'bleed'}],
  modifiers:[{type:'displace',amount:-170,field:F({radius:.3,softness:1,drive:'wander',travel:.25})},{type:'turbulence',amplitude:6,scale:7,cycles:1,field:F({shape:'all',follow:false})}]},
 strata:{name:'Strata',about:'Noise terrain lifts stacked bands, graded into the accent.',palette:'neon',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:34,weight:.55,area:'bleed'}],
  effectors:[{type:'tone',color:1,field:F({shape:'linear',angle:90,radius:1.2,softness:1,follow:false})}],
  modifiers:[{type:'displace',amount:-110,field:F({shape:'noise',scale:2.2,softness:1,drive:'orbit',travel:.18,follow:false})}]},
 sunburst:{name:'Sunburst',about:'Vertical rules rolled into a disc become breathing rays.',palette:'sun',
  layers:[{id:'L1',type:'lines',count:72,weight:.5,color:'accent',area:'bleed'}],
  effectors:[{type:'stretch',width:1.1,height:0,field:F({shape:'linear',angle:0,radius:.35,softness:1,drive:'sweep',travel:.5,follow:false})}],
  modifiers:[{type:'polar',span:360,hole:0,field:F({shape:'all',follow:false,radius:1.2})}]},
 cell:{name:'Cell',about:'A dot grid rolled into a disc becomes rings of dots, smallest at the centre.',palette:'ultra',
  layers:[{id:'L1',type:'grid',cols:44,aspect:1.8,gap:.4,shape:'circle',area:'bleed'}],
  effectors:[{type:'pinch',amount:-.85,field:F({shape:'linear',angle:90,radius:1.3,softness:1,follow:false})}],
  modifiers:[{type:'polar',span:360,hole:.04,field:F({shape:'all',follow:false,radius:.47})}]},
 arch:{name:'Arch',about:'A headline bent into an arch.',palette:'ice',
  layers:[{id:'L1',type:'text',text:'OVER THE TOP',font:'anton'}],
  modifiers:[{type:'bend',angle:62,field:F({shape:'all',follow:false,radius:.45})}]},
 globe:{name:'Globe',about:'Type and a grid of rules wrapped round a sphere.',palette:'neon',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:40,weight:.12,opacity:.5,area:'bleed'},{id:'L2',type:'lines',count:28,weight:.12,opacity:.5,area:'bleed'},{id:'L3',type:'text',text:'ROUND/THE/WORLD',font:'unbounded',leading:1}],
  modifiers:[{type:'spherize',field:F({shape:'all',follow:false,radius:.46})}]},
 ribbon:{name:'Ribbon',about:'A line of type twisting like a ribbon until it shows its back.',palette:'acid',
  layers:[{id:'L1',type:'text',text:'TWIST/TURN',font:'anton',leading:.96}],
  modifiers:[{type:'ribbon',twist:150,cycles:1,field:F({shape:'all',follow:false,radius:.45})}]},
 kaleidoscope:{name:'Kaleidoscope',about:'One wedge of spinning letters mirrored round the centre.',palette:'neon',
  layers:[{id:'L1',type:'rings',count:10,segments:30,opacity:.4},{id:'L2',type:'text',text:'MIR/AGE',font:'unbounded',valign:'top',leading:1}],
  effectors:[{type:'spin',turns:1,lag:0,target:'L2',field:F({shape:'all',follow:false})}],
  modifiers:[{type:'kaleido',segments:8,angle:-112,field:F({shape:'all',follow:false})}]},
 cascade:{name:'Cascade',about:'A word echoed upward, shrinking and shifting colour as it recedes.',palette:'acid',
  layers:[{id:'L1',type:'text',text:'DEEPER',font:'archivo',valign:'bottom'}],
  modifiers:[{type:'echo',copies:9,distance:80,angle:-90,scale:.9,tone:1,fade:.55,field:F({shape:'all',follow:false})}]},
 offset:{name:'Offset',about:'Two echoes split the type like misregistered print.',palette:'paper',
  layers:[{id:'L1',type:'text',text:'OFF/SET',font:'syne'}],
  modifiers:[{type:'echo',copies:2,distance:20,angle:-30,tone:1,fade:.35,field:F({radius:.4,softness:1,drive:'wander'})}]},
 scan:{name:'Scan',about:'Type cut into bands that slide in a travelling wave.',palette:'signal',
  layers:[{id:'L1',type:'text',text:'SLICE/SCAN',font:'anton',leading:1}],
  modifiers:[{type:'slice',height:28,offset:60,pattern:'wave',cycles:1,field:F({shape:'linear',angle:90,radius:.9,softness:1,follow:false})}]},
 shatter:{name:'Shatter',about:'A headline cut along seeded lines and pulled apart.',palette:'concrete',
  layers:[{id:'L1',type:'text',text:'BREAK/AWAY',font:'archivo'}],
  modifiers:[{type:'shatter',cuts:4,gap:44,spin:5,field:F({radius:.6,softness:1,drive:'pulse'})}]},
 contours:{name:'Contours',about:'Letters rebuilt as concentric contour bands, then swirled.',palette:'neon',
  layers:[{id:'L1',type:'text',text:'IN/LINE',font:'archivo'}],
  modifiers:[{type:'inline',rings:5,step:11,field:F({shape:'all',follow:false})},{type:'twirl',angle:60,field:F({radius:.5,softness:1,drive:'pulse'})}]},
 melt:{name:'Melt',about:'Type that drips unevenly and recovers.',palette:'acid',
  layers:[{id:'L1',type:'text',text:'MELT/DOWN',font:'anton',leading:1.02}],
  modifiers:[{type:'melt',length:420,width:30,cycles:1,field:F({shape:'all',follow:false})}]},
 crawl:{name:'Crawl',about:'Type and rules tilted back towards a vanishing point.',palette:'mono',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:26,weight:.06,opacity:.5,area:'bleed'},{id:'L2',type:'text',text:'A LONG/WAY/AWAY',font:'grotesk',leading:1.05}],
  modifiers:[{type:'perspective',tilt:-58,distance:1.3,field:F({shape:'all',follow:false})}]},
 reflection:{name:'Reflection',about:'The upper half of every letter mirrored below the axis.',palette:'paper',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:30,weight:.08,opacity:.35,area:'bleed'},{id:'L2',type:'text',text:'MIRROR/IMAGE',font:'bodoni',leading:1.1}],
  modifiers:[{type:'mirror',angle:0,field:F({shape:'all',follow:false,y:.5})},{type:'wave',amplitude:8,wavelength:240,cycles:1,field:F({shape:'linear',angle:90,radius:.25,softness:1,follow:false})}]},
 bulge:{name:'Bulge',about:'A block of type inflated in the middle of its box.',palette:'concrete',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:34,weight:.1,opacity:.35,area:'bleed'},{id:'L2',type:'text',text:'BIG/BULGE/BAND',font:'anton',leading:.98}],
  modifiers:[{type:'envelope',style:'bulge',amount:.45,height:.6,field:F({shape:'all',follow:false,radius:.45})}]},
 torn:{name:'Torn',about:'Edges eroded like a third-generation photocopy, worse towards the foot.',palette:'paper',
  layers:[{id:'L1',type:'text',text:'COPY/OF A/COPY',font:'archivo'}],
  modifiers:[{type:'roughen',amount:10,grain:5,field:F({shape:'linear',angle:90,radius:.9,softness:1,follow:false})}]},
 zigzag:{name:'Zigzag',about:'Rows of dashes bent along a travelling zigzag.',palette:'ultra',
  layers:[{id:'L1',type:'dashes',rows:26,length:3,density:.7,weight:.35,area:'bleed'}],
  modifiers:[{type:'wave',amplitude:26,wavelength:160,form:'triangle',cycles:1,field:F({shape:'all',follow:false})}]},
 // Second set: screens, folds, spirals, flow fields and scattered elements.
 screen:{name:'Screen print',about:'Type rebuilt as a halftone that opens up across the page.',palette:'paper',
  layers:[{id:'L1',type:'text',text:'SCREEN/PRINT',font:'archivo',leading:1}],
  modifiers:[{type:'screen',pitch:17,size:.7,angle:45,field:F({shape:'linear',angle:20,radius:.9,softness:1,follow:false,drive:'sweep',travel:.25})}]},
 'line-screen':{name:'Line screen',about:'Letters drawn in parallel lines, swirled where the pointer is.',palette:'acid',
  layers:[{id:'L1',type:'text',text:'LINE/WORK',font:'anton',leading:1}],
  modifiers:[{type:'screen',pattern:'lines',pitch:9,size:.5,angle:-30,field:F({shape:'all',follow:false})},{type:'twirl',angle:120,field:F({radius:.3,softness:1,drive:'wander',travel:.25})}]},
 fold:{name:'Fold',about:'The lower half of the page folds back in perspective.',palette:'concrete',
  layers:[{id:'L1',type:'grid',cols:20,gap:.5,shape:'circle',opacity:.5,area:'bleed'},{id:'L2',type:'text',text:'FOLD/HERE',font:'anton',leading:1}],
  modifiers:[{type:'fold',angle:62,field:F({shape:'all',follow:false,y:.52,drive:'pulse',cycles:1})}]},
 spiral:{name:'Spiral',about:'A line of type wound into a spiral that turns over the loop.',palette:'sun',
  layers:[{id:'L1',type:'text',text:'AROUND AND AROUND',font:'anton',valign:'top'},{id:'L2',type:'rings',count:22,weight:.12,segments:1,opacity:.3}],
  modifiers:[{type:'polar',target:'L1',span:330,hole:.04,spiral:.55,field:F({shape:'all',follow:false,radius:.47,drive:'rotate'})}]},
 flow:{name:'Flow',about:'Short strokes carried along a swirling flow field.',palette:'neon',
  layers:[{id:'L1',type:'grid',cols:36,aspect:1,gap:.3,shape:'pill',area:'bleed'}],
  effectors:[{type:'stretch',width:-.55,height:.5,field:F({shape:'all',follow:false})},{type:'flow',distance:70,scale:2.2,align:1,cycles:1,field:F({shape:'all',follow:false})},{type:'tone',color:1,field:F({shape:'noise',scale:2,softness:.6,follow:false,drive:'orbit',travel:.2})}]},
 confetti:{name:'Confetti',about:'Scattered stars and dots, spun and partly recoloured.',palette:'signal',
  layers:[{id:'L1',type:'scatter',count:420,size:30,variation:.65,shape:'star',spread:'random',turn:true},{id:'L2',type:'text',text:'PARTY',font:'unbounded'}],
  effectors:[{type:'recolour',share:.35,target:'L1',field:F({shape:'all',follow:false})},{type:'spin',turns:1,lag:1.2,target:'L1',field:F({shape:'all',follow:false})},{type:'repel',distance:110,target:'L1',field:F({radius:.25,softness:.8,drive:'wander',travel:.25})}]},
 checker:{name:'Checker',about:'Alternate cells take the accent; a lens swells them.',palette:'ultra',
  layers:[{id:'L1',type:'grid',cols:14,gap:.06,shape:'square',area:'bleed'}],
  effectors:[{type:'recolour',pattern:'checker',field:F({shape:'all',follow:false})},{type:'warp',amount:.5,grow:.6,field:F({radius:.35,softness:1,drive:'orbit',travel:.2})}]},
 terraces:{name:'Terraces',about:'A stepped field shrinks dots in rings, like contour terraces.',palette:'acid',
  layers:[{id:'L1',type:'grid',cols:34,gap:.12,shape:'circle',area:'bleed'}],
  effectors:[{type:'pinch',amount:-.85,field:F({radius:.6,softness:1,steps:5,drive:'wander',travel:.2})}]},
 honeycomb:{name:'Honeycomb',about:'Hexagons rise into columns under the pointer.',palette:'mono',
  layers:[{id:'L1',type:'grid',cols:15,gap:.12,shape:'hexagon',stagger:true,aspect:.87}],
  effectors:[{type:'pillars',height:120,angle:-90,shade:.55,field:F({radius:.38,softness:1,drive:'orbit',travel:.25})},{type:'tone',color:.8,field:F({radius:.3,softness:1,drive:'orbit',travel:.25})}]},
 starfield:{name:'Starfield',about:'Stars drawn in by a vortex.',palette:'neon',
  layers:[{id:'L1',type:'scatter',count:650,size:26,variation:.75,shape:'star',turn:true,area:'bleed'}],
  effectors:[{type:'twist',mode:'orbit',field:F({radius:.6,softness:1,follow:true})},{type:'repel',distance:-120,field:F({radius:.6,softness:1})}],
  modifiers:[{type:'twirl',angle:200,field:F({radius:.55,softness:1,drive:'pulse'})}]},
 // Third set: offsets, edges, rings, wedges, tiles, repeats and shadows.
 heavy:{name:'Heavy',about:'Letters swell into a heavier weight wherever the field passes.',palette:'acid',
  layers:[{id:'L1',type:'text',text:'HEAVY/WEIGHT',font:'grotesk',leading:1}],
  modifiers:[{type:'weight',amount:26,field:F({radius:.32,softness:1,drive:'wander',travel:.25})}]},
 soft:{name:'Soft',about:'Every corner rounded off, inside and out.',palette:'ice',
  layers:[{id:'L1',type:'grid',cols:22,gap:.55,shape:'cross',opacity:.35,area:'bleed'},{id:'L2',type:'text',text:'SOFT/SERVE',font:'archivo',leading:1}],
  modifiers:[{type:'round',radius:11,corners:'both',target:'L2',field:F({shape:'all',follow:false})}]},
 halo:{name:'Halo',about:'Letters with a glowing outline halo that swells under the pointer.',palette:'neon',
  layers:[{id:'L1',type:'text',text:'HALO',font:'unbounded'},{id:'L2',type:'text',text:'HALO',font:'unbounded',color:'accent'}],
  modifiers:[{type:'outline',width:5,position:'outside',target:'L1',field:F({shape:'all',follow:false})},{type:'weight',amount:30,target:'L1',field:F({radius:.35,softness:1,drive:'orbit',travel:.25})}]},
 jagged:{name:'Jagged',about:'Every edge serrated into sharp ridges.',palette:'signal',
  layers:[{id:'L1',type:'text',text:'SHARP/EDGES',font:'anton',leading:1}],
  modifiers:[{type:'zigzag',size:7,spacing:13,field:F({shape:'linear',angle:0,radius:1,softness:1,follow:false,drive:'sweep',travel:.4})}]},
 petals:{name:'Petals',about:'Discs pucker into spinning lobed flowers.',palette:'sun',
  layers:[{id:'L1',type:'grid',cols:9,gap:.12,shape:'circle',color:'accent'}],
  modifiers:[{type:'petal',lobes:7,amount:.38,cycles:1,field:F({radius:.6,softness:1,drive:'wander',travel:.2})}]},
 swirl:{name:'Swirl',about:'Each letter twisted round its own centre.',palette:'acid',
  layers:[{id:'L1',type:'lines',count:50,weight:.1,opacity:.35,area:'bleed'},{id:'L2',type:'text',text:'SWIRL/LOOP',font:'archivo',leading:1}],
  modifiers:[{type:'swirl',angle:220,target:'L2',field:F({radius:.42,softness:1,drive:'orbit',travel:.2})}]},
 glitch:{name:'Glitch',about:'Type chopped into tiles that jump and change colour.',palette:'signal',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:90,weight:.3,opacity:.25,area:'bleed'},{id:'L2',type:'text',text:'GLITCH/BLOCK',font:'mono',leading:1}],
  modifiers:[{type:'tiles',size:38,offset:26,tone:.12,axis:'x',field:F({shape:'noise',scale:2,softness:.35,follow:false,drive:'orbit',travel:.25})}]},
 dial:{name:'Dial',about:'Rings of type and rules turning against each other like a lock.',palette:'ultra',
  layers:[{id:'L1',type:'rings',count:16,segments:28,segGap:.35,weight:.4,opacity:.55},{id:'L2',type:'text',text:'TURN/THE/DIAL',font:'anton',leading:.95}],
  modifiers:[{type:'dial',width:62,angle:36,pattern:'wave',cycles:1,field:F({shape:'all',follow:false})}]},
 burst:{name:'Burst',about:'The page cut into wedges that pump outwards.',palette:'acid',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:40,weight:.2,opacity:.45,area:'bleed'},{id:'L2',type:'text',text:'BURST',font:'unbounded'}],
  modifiers:[{type:'burst',sectors:16,offset:46,pattern:'wave',cycles:1,field:F({shape:'all',follow:false})}]},
 repeat:{name:'Step and repeat',about:'The page repeated in mirrored, recoloured tiles.',palette:'concrete',
  layers:[{id:'L1',type:'grid',cols:10,gap:.25,shape:'triangle'},{id:'L2',type:'text',text:'AGAIN',font:'archivo'}],
  effectors:[{type:'twist',mode:'aim',field:F({radius:.5,softness:1,drive:'orbit',travel:.25,follow:false})}],
  modifiers:[{type:'repeat',cols:3,rows:3,mirror:'both',gap:.06,field:F({shape:'all',follow:false})}]},
 'long-shadow':{name:'Long shadow',about:'Letters casting long flat shadows, longest where the field is strongest.',palette:'sun',
  layers:[{id:'L1',type:'text',text:'LONG/SHADOW',font:'archivo',leading:1}],
  modifiers:[{type:'shadow',style:'long',length:320,angle:45,tone:1,opacity:1,field:F({shape:'linear',angle:180,radius:1.1,softness:1,follow:false,drive:'sweep',travel:.3})}]},
 'liquid-type':{name:'Liquid type',about:'One group adds a wave, turbulence and a pointer lens into a single fluid warp.',palette:'neon',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:48,weight:.16,opacity:.45,area:'bleed'},{id:'L2',type:'text',text:'FLUID/STATE',font:'unbounded',leading:1}],
  modifiers:[{type:'group',op:'add',field:F({shape:'all',follow:false}),children:[{type:'wave',amplitude:24,wavelength:420,cycles:1,field:F({shape:'all',follow:false})},{type:'turbulence',amplitude:18,scale:3,cycles:1,field:F({shape:'all',follow:false})},{type:'lens',amount:.4,field:F({radius:.3,softness:1,drive:'wander'})}]}]},
 'glitch-scan':{name:'Glitch scan',about:'A chained group: tiles knocked sideways, then sliced into scan lines, fading in with a sweeping field.',palette:'signal',
  layers:[{id:'L1',type:'text',text:'NO/SIGNAL',font:'archivo',leading:1}],
  modifiers:[{type:'group',op:'chain',field:F({shape:'linear',angle:90,radius:.8,softness:1,follow:false,drive:'sweep',travel:.4}),children:[{type:'tiles',size:44,offset:26,axis:'x',tone:.12,field:F({shape:'all',follow:false})},{type:'slice',height:7,gap:.4,offset:5,pattern:'random',field:F({shape:'all',follow:false})}]}]},
 stencil:{name:'Stencil',about:'Letters cut into bands with bridges between, sliding apart.',palette:'mono',
  layers:[{id:'L1',type:'text',text:'STEN/CIL',font:'anton',leading:.98}],
  modifiers:[{type:'slice',height:54,gap:.22,offset:24,pattern:'wave',cycles:1,angle:-12,field:F({shape:'all',follow:false})}]},
 // Dither: the whole page as a coarse 1-bit picture, and a lens of it that follows the pointer.
 'heavy-dither':{name:'Heavy dither',about:'Rings rebuilt as a coarse Atkinson dither, lit like tubes, with knocked-out type dithered more lightly over them.',palette:'sun',
  layers:[{id:'L1',type:'rings',count:7,weight:.55,segments:1,fill:'cover',area:'bleed'},{id:'L2',type:'text',text:'HEAVY/DITHER',font:'archivo',leading:1,color:'paper'}],
  modifiers:[{type:'dither',target:'L1',pixel:10,spread:90,tone:.3,grain:.45,contrast:1.4,order:.25,field:F({shape:'all',follow:false})},
   {type:'dither',target:'L2',pixel:10,spread:20,tone:0,relief:.3,grain:.2,field:F({shape:'all',follow:false})}]},
 'dither-lens':{name:'Dither lens',about:'Type stays solid until the pointer passes; there it falls apart into big pixels.',palette:'acid',
  layers:[{id:'L1',type:'lines',direction:'horizontal',count:18,weight:.5,opacity:1,area:'bleed',color:'accent'},{id:'L2',type:'text',text:'BIT/CRUSH',font:'anton',leading:1}],
  modifiers:[{type:'dither',method:'bayer4',pixel:14,spread:120,tone:.45,grain:.3,mark:'led',field:F({radius:.42,softness:.9,drive:'wander',travel:.25})}]},
 // Colour recipes: colour modifiers only repaint, so each keeps its outlines and changes paint, gradients and light.
 'holo-foil':{name:'Holo foil',about:'Type runs through the rainbow while a band of light sweeps over it.',palette:'neon',
  layers:[{id:'L1',type:'text',text:'HOLO/FOIL',font:'anton',leading:1}],
  colours:[{type:'spectrum',target:'L1',bands:1.4,saturation:.9,cycles:1,field:F({shape:'linear',angle:35,radius:1.2,softness:1,follow:false})},
   {type:'light',target:'L1',brightness:.75,contrast:1.2,field:F({shape:'ring',x:-.2,y:-.1,radius:1.25,softness:.16,drive:'pulse',follow:false})}]},
 'heat-map':{name:'Heat map',about:'A glow follows the pointer and a thermal map turns its light into heat.',palette:'acid',
  layers:[{id:'L1',type:'grid',cols:30,gap:.22,shape:'circle',area:'bleed',opacity:.5},{id:'L2',type:'text',text:'HEAT/SEEK',font:'archivo'}],
  colours:[{type:'light',target:'page',brightness:.85,field:F({radius:.55,softness:1,drive:'wander',travel:.25})},{type:'map',target:'page',ramp:'thermal',field:F({shape:'all',follow:false})}]},
 'sunset':{name:'Sunset',about:'The paper becomes a sky from night to dusk; stars fade towards the horizon.',palette:'acid',
  layers:[{id:'L1',type:'scatter',count:500,size:5,variation:.8,shape:'star',spread:'random',area:'bleed'},{id:'L2',type:'text',text:'AFTER/HOURS',font:'anton',valign:'top',leading:.95}],
  colours:[{type:'gradient',target:'paper',ramp:'sunset',field:F({shape:'linear',angle:90,radius:1.45,softness:1,follow:false})},
   {type:'fade',target:'L1',amount:1,field:F({shape:'linear',angle:90,y:.62,radius:.5,softness:1,follow:false})}]},
 'split-fountain':{name:'Split fountain',about:'A two-ink blend across the rules, posterized into bands like a Riso split fountain.',palette:'paper',
  layers:[{id:'L1',type:'lines',count:56,weight:.55,area:'bleed'},{id:'L2',type:'text',text:'SPLIT/INK',font:'unbounded',color:'paper'}],
  colours:[{type:'gradient',target:'L1',ramp:'colours',from:'#ff2bd6',to:'#ffe83d',field:F({shape:'linear',angle:0,radius:1,softness:1,drive:'sweep',travel:.15,follow:false})},
   {type:'posterize',target:'L1',levels:6,field:F({shape:'all',follow:false})}]},
 negative:{name:'Negative',about:'A hard-edged negative follows the pointer across paper and type alike.',palette:'signal',
  layers:[{id:'L1',type:'matrix',text:'NEG',cols:54,shape:'square',gap:.1},{id:'L2',type:'lines',direction:'horizontal',count:30,weight:.08,opacity:.6,area:'bleed',color:'accent'}],
  colours:[{type:'invert',target:'page',field:F({radius:.3,softness:.04,drive:'orbit',travel:.25})}]},
 chrome:{name:'Chrome',about:'Type mapped onto a chrome ramp, its light rising from the base.',palette:'mono',
  layers:[{id:'L1',type:'text',text:'CHR/OME',font:'unbounded',leading:1}],
  colours:[{type:'light',target:'L1',brightness:-.9,contrast:1.8,field:F({shape:'linear',angle:-90,radius:.6,softness:1,drive:'sweep',travel:.15,follow:false})},
   {type:'map',target:'L1',ramp:'chrome',field:F({shape:'all',follow:false})}]},
 'target-rings':{name:'Target rings',about:'Concentric bands invert everything they cross and ripple out from the pointer.',palette:'signal',
  layers:[{id:'L1',type:'text',text:'OP/TICAL',font:'anton',leading:.95},{id:'L2',type:'grid',cols:14,gap:.5,shape:'circle',opacity:.5,area:'bleed',color:'accent'}],
  colours:[{type:'stripes',target:'page',count:12,width:.5,mode:'invert',cycles:1,field:F({radius:.75,softness:1,drive:'wander',travel:.18})}]},
 'contour-map':{name:'Contour map',about:'Noise read as height: thin contour lines run over paper and type alike.',palette:'paper',
  layers:[{id:'L1',type:'text',text:'TERRA/FORM',font:'syne'}],
  colours:[{type:'stripes',target:'page',count:16,width:.12,mode:'colour',color:'accent',cycles:1,field:F({shape:'noise',scale:2.2,softness:1,follow:false})},
   {type:'warmth',target:'paper',amount:.5,field:F({shape:'linear',angle:90,radius:1.3,softness:1,follow:false})}]},
 'colour-wheel':{name:'Colour wheel',about:'An angle sweep runs the spectrum round the centre in twelve hard wedges, slowly turning.',palette:'neon',
  layers:[{id:'L1',type:'rings',count:16,segments:48,segGap:.2,fill:'cover'},{id:'L2',type:'text',text:'WHEEL',font:'unbounded',color:'paper'}],
  colours:[{type:'spectrum',target:'L1',bands:1,saturation:1,field:F({shape:'conic',steps:12,drive:'rotate',follow:false})}]},
 'riso-plate':{name:'Riso plate',about:'A rainbow separated onto its magenta plate in fluorescent pink, as a Riso drum would print it.',palette:'acid',
  layers:[{id:'L1',type:'grid',cols:22,gap:.18,shape:'circle',area:'bleed'},{id:'L2',type:'text',text:'PLATE/TWO',font:'archivo'}],
  colours:[{type:'gradient',target:'all',ramp:'holo',field:F({shape:'linear',angle:30,radius:1.3,softness:1,drive:'sweep',travel:.2,follow:false})},
   {type:'separation',target:'page',plate:'m',ink:'fluo',field:F({shape:'all',follow:false})}]},
 solarized:{name:'Solarized',about:'Spectrum type; where the pointer passes its lightest colours turn negative, as in a darkroom.',palette:'acid',
  layers:[{id:'L1',type:'text',text:'SUN/BURN',font:'anton',leading:.95}],
  colours:[{type:'spectrum',target:'L1',bands:1.5,saturation:.95,cycles:1,field:F({shape:'linear',angle:60,radius:1.3,softness:1,follow:false})},
   {type:'solarize',target:'page',level:.35,field:F({radius:.45,softness:1,drive:'orbit',travel:.2})}]},
 wipe:{name:'Threshold wipe',about:'A level sweeps across: every element lighter than it turns acid, the rest drops to black.',palette:'mono',
  layers:[{id:'L1',type:'dashes',rows:40,length:3,density:.7,area:'bleed'},{id:'L2',type:'text',text:'1/BIT',font:'unbounded'}],
  effectors:[{type:'wave',channel:'tone',amount:.9,wavelength:700,field:F({shape:'all',follow:false})}],
  colours:[{type:'threshold',target:'all',level:.5,spread:.8,dark:'black',light:'#d7ff3a',field:F({shape:'linear',angle:0,radius:1.1,softness:1,drive:'sweep',travel:.35,follow:false})}]},
 outrun:{name:'Outrun',about:'Every letter its own sunset, from gold at the top to violet below, over a night-to-dusk sky.',palette:'neon',
  layers:[{id:'L1',type:'text',text:'NEON/NIGHTS',font:'anton',leading:.95}],
  colours:[{type:'gradient',target:'paper',ramp:'vapor',field:F({shape:'linear',angle:90,radius:1.6,softness:1,follow:false})},
   {type:'shapegradient',target:'L1',ramp:'sunset',angle:-90,field:F({shape:'all',follow:false})}]},
 'rainbow-type':{name:'Rainbow type',about:'Each letter takes one solid colour of the rainbow; the colours walk along the line as the field sweeps.',palette:'acid',
  layers:[{id:'L1',type:'text',text:'EVERY/LETTER/ITS OWN',font:'archivo',leading:1}],
  colours:[{type:'shapecolour',target:'L1',ramp:'holo',field:F({shape:'linear',angle:20,radius:1.2,softness:1,drive:'sweep',travel:.3,follow:false})}]},
 aurora:{name:'Aurora',about:'Soft blobs of vapour colours drift and melt behind white type.',palette:'neon',
  layers:[{id:'L1',type:'text',text:'AFTER/GLOW',font:'syne',color:'paper'}],
  colours:[{type:'aurora',target:'paper',ramp:'vapor',blobs:6,size:.22,cycles:1,field:F({shape:'all',follow:false})},{type:'tint',target:'L1',color:'white',field:F({shape:'all',follow:false})}]},
 mesh:{name:'Mesh',about:'Four corner colours blend across the paper; the dots take one colour each from where they sit.',palette:'paper',
  layers:[{id:'L1',type:'grid',cols:16,gap:.35,shape:'circle',area:'bleed'},{id:'L2',type:'text',text:'MESH',font:'unbounded',color:'paper'}],
  colours:[{type:'corners',target:'paper',tl:'#ffe83d',tr:'#ff2bd6',bl:'#3df5ff',br:'#2a0b5c',field:F({shape:'all',follow:false})},
   {type:'shapecolour',target:'L1',ramp:'vapor',reverse:true,field:F({shape:'radial',radius:.75,softness:1,drive:'wander',travel:.2})}]},
 'pop-art':{name:'Pop art',about:'Noise colour snapped to five loud hues and three flat tones, like a screenprinted portrait.',palette:'mono',
  layers:[{id:'L1',type:'grid',cols:9,gap:.12,shape:'circle',area:'bleed'},{id:'L2',type:'text',text:'POP',font:'anton'}],
  colours:[{type:'spectrum',target:'page',bands:1.5,mode:'keep',cycles:1,field:F({shape:'noise',scale:1.6,softness:1,follow:false})},{type:'pop',target:'page',hues:5,levels:3,boost:1,field:F({shape:'all',follow:false})}]},
 'night-vision':{name:'Night vision',about:'Everything in phosphor green, brightest where the pointer looks, with rolling scan lines.',palette:'signal',
  layers:[{id:'L1',type:'text',text:'NIGHT/WATCH',font:'grotesk'},{id:'L2',type:'grid',cols:30,gap:.6,shape:'cross',opacity:.5,area:'bleed'}],
  colours:[{type:'light',target:'page',brightness:.5,field:F({radius:.4,softness:1,drive:'wander',travel:.22})},{type:'map',target:'page',ramp:'night',field:F({shape:'all',follow:false})},
   {type:'stripes',target:'page',count:140,width:.4,mode:'colour',color:'black',strength:.35,cycles:2,field:F({shape:'linear',angle:90,radius:1.45,softness:1,follow:false})}]}
};
const ALLF={shape:'all',follow:false};
// Named groups that drop onto any stack: each is one group with its own children.
export const COMBOS={
 'glitch-scan':{name:'Glitch scan',about:'Tiles knocked sideways, then cut into thin scan lines.',group:{type:'group',op:'chain',children:[{type:'tiles',size:44,offset:22,axis:'x',tone:.1,field:ALLF},{type:'slice',height:7,gap:.4,offset:5,pattern:'random',field:ALLF}]}},
 liquid:{name:'Liquid',about:'Wave, turbulence and a lens added into one fluid warp.',group:{type:'group',op:'add',children:[{type:'wave',amplitude:24,wavelength:420,cycles:1,field:ALLF},{type:'turbulence',amplitude:18,scale:3,cycles:1,field:ALLF},{type:'lens',amount:.4,field:{radius:.3,softness:1,follow:true,drive:'wander'}}]}},
 eddies:{name:'Eddies',about:'A ripple and a twirl averaged, so neither wins.',group:{type:'group',op:'average',children:[{type:'ripple',amplitude:24,wavelength:110,cycles:2,field:{radius:.8,softness:1}},{type:'twirl',angle:300,field:{radius:.45,softness:1,drive:'wander'}}]}},
 'kaleido-burst':{name:'Kaleido burst',about:'A mirrored mandala whose wedges pump outwards.',group:{type:'group',op:'chain',children:[{type:'kaleido',segments:8,field:ALLF},{type:'burst',sectors:16,offset:30,pattern:'wave',cycles:1,field:ALLF}]}},
 tunnel:{name:'Tunnel',about:'Echoes shrinking inward while the stack swirls.',group:{type:'group',op:'chain',children:[{type:'echo',copies:10,distance:0,scale:.86,turn:4,tone:1,fade:.3,field:ALLF},{type:'twirl',angle:120,field:{radius:.5,softness:1}}]}},
 misprint:{name:'Misprint',about:'Rough edges, a slight drop shadow and a half-step slip.',group:{type:'group',op:'chain',children:[{type:'roughen',amount:4,grain:5,field:ALLF},{type:'shadow',style:'drop',length:9,angle:30,tone:1,opacity:.85,field:ALLF},{type:'slice',height:120,offset:6,pattern:'random',field:ALLF}]}},
 'folded-flag':{name:'Folded flag',about:'A waving sheet folded back in perspective.',group:{type:'group',op:'chain',children:[{type:'wave',amplitude:30,wavelength:600,cycles:1,field:ALLF},{type:'fold',angle:55,field:{...ALLF,y:.58}}]}},
 'shattered-globe':{name:'Shattered globe',about:'Wrapped round a sphere, then cut and pulled apart.',group:{type:'group',op:'chain',children:[{type:'spherize',field:{...ALLF,radius:.45}},{type:'shatter',cuts:5,gap:26,spin:4,field:{...ALLF,radius:.45}}]}},
 'pop-shadow':{name:'Pop shadow',about:'Zigzag edges with a long shadow, stepped and repeated.',group:{type:'group',op:'chain',children:[{type:'zigzag',size:4,spacing:10,field:ALLF},{type:'shadow',style:'long',length:60,angle:45,tone:1,opacity:1,field:ALLF},{type:'repeat',cols:2,rows:2,field:ALLF}]}}
};
export const DEFAULT_RECIPE='lens-type';
const WORDS=['FIELD','PULSE','DRIFT','ORBIT','NOISE/FLOOR','AFTER/HOURS','LOW/END','GRID/LOCK','STATIC','SIGNAL','FLUX','HALF/LIFE'];

// ---------------------------------------------------------------- state
const MAX_LAYERS=8,MAX_EFFECTORS=12,MAX_MODIFIERS=8,MAX_SVG=4e6;
function normParams(specs,src,dst){for(const p of specs){const v=src?.[p.id];
  switch(p.type){
   case 'range':{let n=Number(v);if(v===null||v===undefined||v===''||!Number.isFinite(n))n=p.def;n=clamp(Math.round(clamp(n,p.min,p.max)/p.step)*p.step,p.min,p.max);dst[p.id]=Number(n.toFixed(6));break;}
   case 'select':dst[p.id]=p.options.some(o=>o[0]===v)?v:p.def;break;
   case 'toggle':dst[p.id]=typeof v==='boolean'?v:p.def;break;
   case 'text':dst[p.id]=typeof v==='string'?v.slice(0,p.max):p.def;break;
   case 'colour':dst[p.id]=isColourValue(v)?v.toLowerCase():p.def;break;}}
 return dst;}
export function recipeState(id){const r=RECIPES[id]||RECIPES[DEFAULT_RECIPE];return {recipe:RECIPES[id]?id:DEFAULT_RECIPE,palette:r.palette,format:'poster',layers:structuredClone(r.layers||[]),effectors:structuredClone(r.effectors||[]),modifiers:structuredClone(r.modifiers||[]),colours:structuredClone(r.colours||[])};}
export function normalize(input={}){
 let src=input&&typeof input==='object'?input:{};
 if(!Array.isArray(src.layers)){const r=recipeState(src.recipe);src={...r,...src,recipe:r.recipe,layers:r.layers,effectors:r.effectors,modifiers:r.modifiers,colours:r.colours};}
 const s={engine:ENGINE,recipe:RECIPES[src.recipe]?src.recipe:'custom',format:FORMATS[src.format]?src.format:'poster'};
 const pal=PALETTES[src.palette],given=Array.isArray(src.colors)&&src.colors.length===3&&src.colors.every(isHex);
 s.palette=pal?src.palette:given?'custom':'acid';s.colors=given?src.colors.map(c=>c.toLowerCase()):(pal||PALETTES.acid).colors.slice();
 s.seed=Number.isInteger(src.seed)?clamp(src.seed,0,999999):1;s.loop=clamp(Math.round((Number(src.loop)||6)*2)/2,2,20);
 const t=Number(src.time);s.time=Number.isFinite(t)?Number((((t%s.loop)+s.loop)%s.loop).toFixed(4)):0;
 s.layers=[];const used=new Set();let next=1;
 for(const l of (Array.isArray(src.layers)?src.layers:[]).slice(0,MAX_LAYERS)){if(!l||!LAYERS[l.type])continue;
  let id=typeof l.id==='string'&&/^L\d{1,4}$/.test(l.id)&&!used.has(l.id)?l.id:null;if(!id){while(used.has('L'+next))next++;id='L'+next;}used.add(id);
  const L={id,type:l.type};if(typeof l.uid==='string')L.uid=l.uid.slice(0,24);normParams(LAYER_COMMON,l,L);normParams(LAYERS[l.type].params,l,L);
  if(l.type==='artwork'){L.svg=typeof l.svg==='string'&&l.svg.length<=MAX_SVG?l.svg:'';L.name=typeof l.name==='string'?l.name.slice(0,120):'';}
  s.layers.push(L);}
 const one=(e,cat,nested)=>{const o={type:e.type};if(typeof e.uid==='string')o.uid=e.uid.slice(0,24);normParams(EFFECT_COMMON,e,o);normParams(e.type==='group'?GROUP.params:cat[e.type].params,e,o);
  o.target=e.target==='all'||!used.has(e.target)?'all':e.target;o.field=normParams(FIELD,e.field,{});
  // Groups hold bending and cutting modifiers, one level deep.
  if(e.type==='group')o.children=nested?[]:(Array.isArray(e.children)?e.children:[]).filter(c=>c&&MODIFIERS[c.type]&&MODIFIERS[c.type].kind!=='shape').slice(0,MAX_CHILDREN).map(c=>one(c,cat,true));return o;};
 const norm=(list,cat,max)=>(Array.isArray(list)?list:[]).filter(e=>e&&(cat[e.type]||(cat===MODIFIERS&&e.type==='group'))).slice(0,max).map(e=>one(e,cat,false));
 s.effectors=norm(src.effectors,EFFECTORS,MAX_EFFECTORS);s.modifiers=norm(src.modifiers,MODIFIERS,MAX_MODIFIERS);
 // Colour modifiers start from their own default field and can also act on the paper ('paper') or on everything ('page').
 s.colours=(Array.isArray(src.colours)?src.colours:[]).filter(e=>e&&COLOURS[e.type]).slice(0,MAX_COLOURS).map(e=>{const o={type:e.type};if(typeof e.uid==='string')o.uid=e.uid.slice(0,24);
  normParams(EFFECT_COMMON,e,o);normParams(COLOURS[e.type].params,e,o);o.target=['all','paper','page'].includes(e.target)||used.has(e.target)?e.target:'all';
  o.field=normParams(FIELD,{...COLOURS[e.type].field,...(e.field&&typeof e.field==='object'?e.field:{})},{});return o;});
 return s;}
export const defaults=(specs,extra={})=>normParams(specs,{},{...extra});
// A seeded random combination of elements, effectors and modifiers.
export function shuffle(seed=1,format='poster'){const r=rng(Math.imul(seed|0,2654435761)>>>0||7),pick=a=>a[Math.floor(r()*a.length)];
 const vary=(specs,keep={})=>{const o={};for(const p of specs){if(p.id in keep||p.type==='text')continue;if(p.type==='range'){const span=p.max-p.min;o[p.id]=clamp(p.def+(r()-.5)*span*.45,p.min,p.max);}else if(p.type==='select')o[p.id]=r()<.55?p.def:pick(p.options)[0];else if(p.type==='toggle')o[p.id]=r()<.25?!p.def:p.def;}return {...o,...keep};};
 const base=pick(['grid','grid','lines','dashes','rings','text','matrix']),typed=base==='text'||base==='matrix';
 const layers=[{id:'L1',type:base,...vary(LAYERS[base].params,typed?{text:pick(WORDS),font:pick(FONT_LIST).id,leading:1.05,size:1,tracking:0,ghost:r()<.5?.2:0,cols:40+Math.floor(r()*40)}:{})}];
 if(!typed&&r()<.5){layers[0].opacity=.45;layers.push({id:'L2',type:'text',text:pick(WORDS),font:pick(FONT_LIST).id});}
 const field=()=>({shape:r()<.6?'radial':pick(['linear','ring','box','noise']),drive:pick(['orbit','sweep','wander','pulse','static']),radius:.2+r()*.35,softness:.5+r()*.5,angle:pick([0,45,90,-45]),travel:.15+r()*.25,x:.35+r()*.3,y:.35+r()*.3});
 const effectors=[],kinds=Object.keys(EFFECTORS).filter(k=>k!=='snap');for(let i=0,n=1+Math.floor(r()*3);i<n;i++){const type=pick(kinds);effectors.push({type,...vary(EFFECTORS[type].params),field:field()});}
 const modifiers=r()<.5?[(t=>({type:t,...vary(MODIFIERS[t].params),field:field()}))(pick(Object.keys(MODIFIERS)))]:[];
 return normalize({recipe:'custom',format,palette:pick(Object.keys(PALETTES)),seed:seed%1000,layers,effectors,modifiers});}
