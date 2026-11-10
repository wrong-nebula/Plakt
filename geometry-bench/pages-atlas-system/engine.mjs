/* P.A.G.E.S. — a shape construction kit after Neo Neo.
 * The 2023 poster sets each letter with a different construction. Here those
 * constructions become shape treatments. The kit is split by concern:
 *   shapes.mjs         parametric centerline shapes
 *   geometry.mjs       skeleton runs and the Clipper outline kernel
 *   constructions.mjs  the eight constructions and the source letters
 *   arrangements.mjs   atlas, specimen, composition, field and kit strip
 *   catalog.mjs        module sets, palettes, controls, layouts, formats
 * This file resolves a state, renders it and is the public API.
 * Contours and extensions are interpretations, not recovered production files.
 */
import {ENGINE,SOURCE,FAMILIES,PALETTES,CONSTRUCTIONS,CONTROLS,LAYOUTS,PATTERNS,FORMATS,DEFAULT_SHAPES,MAX_ITEMS} from './catalog.mjs';
import {SHAPES,GROUPS} from './shapes.mjs';
import {construct,aspectOf as aspect,overlapParts,overlap,nodesFor,bitmapFor,perforationNodes,shapePath,modulePath,G_PARTS,S_NODES} from './constructions.mjs';
import {atlas,specimen,composition,field,strip,consFor,ORDER} from './arrangements.mjs';
import {esc,rect,fingerprint,context} from './svg.mjs';
export {ENGINE,SOURCE,FAMILIES,PALETTES,CONSTRUCTIONS,CONTROLS,LAYOUTS,PATTERNS,FORMATS,DEFAULT_SHAPES,MAX_ITEMS,SHAPES,GROUPS,G_PARTS,S_NODES,bitmapFor,perforationNodes,shapePath,modulePath};
const SOURCE_LETTERS=['P','A','G','E','S'];
export const isShape=t=>Object.hasOwn(SHAPES,t);
// A shape id names an upright item; source letters stay strings.
const specOf=x=>typeof x==='string'&&isShape(x)?{shape:x,turn:0,flip:false}:x;
// Items: shape ids, or {shape, construction, turn, flip}. `construction` is
// 'auto' (follow the arrangement) or one of the eight.
export function normalizeItems(list){
 const raw=Array.isArray(list)?list:String(list??'').split(/[\s,]+/).filter(Boolean),items=raw.map(x=>{const o=typeof x==='string'?{shape:x}:x??{},shape=String(o.shape??'').trim().toLowerCase();if(!isShape(shape))throw new Error(`“${o.shape??x}” is not in the shape catalog.`);return {shape,construction:CONSTRUCTIONS.some(c=>c.id===o.construction)?o.construction:'auto',turn:((Math.round(Number(o.turn)||0)%4)+4)%4,flip:!!o.flip};});
 if(!items.length)throw new Error('Choose at least one shape.');if(items.length>MAX_ITEMS)throw new Error(`Use up to ${MAX_ITEMS} items.`);return items;
}
export function resolve(input={}){
 const v1=input.engine==='pages-atlas-v1',family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],params={},pick=(list,v,f)=>list.some(x=>x.id===v)?v:f,palette=pick(PALETTES,input.palette,family.palette),color=(c,f)=>/^#[a-f\d]{6}$/i.test(c??'')?c:f;
 for(const c of CONTROLS){const v=Number(input.params?.[c.key]??c.value);params[c.key]=Math.max(c.min,Math.min(c.max,Number.isFinite(v)?v:c.value));if(c.integer)params[c.key]=Math.round(params[c.key]);}
 return {engine:ENGINE,version:2,items:normalizeItems(input.items??input.shapes??DEFAULT_SHAPES),layout:v1?'source':pick(LAYOUTS,input.layout,'atlas'),construction:input.construction==='mixed'?'mixed':pick(CONSTRUCTIONS,input.construction,'mixed'),pattern:pick(PATTERNS,input.pattern,'repeat'),format:pick(FORMATS,input.format,'poster'),family:family.id,palette,params,colors:PALETTES.find(p=>p.id===palette).colors.map((c,i)=>color(input.colors?.[i],c)),invert:!!input.invert,stage:Math.max(1,Math.min(4,Math.round(Number(input.stage)||4)))};
}
export const aspectOf=(c,spec,input)=>aspect(c,specOf(spec),input?.params&&input.items?input:resolve(input));
// `page` ({width, height, margin}) overrides the format of the non-atlas layouts.
export function render(input={},page){const state=resolve(input),isAtlas=state.layout==='atlas'||state.layout==='source',format=FORMATS.find(f=>f.id===state.format),W=isAtlas?644:page?.width??format.width,H=isAtlas?710:page?.height??format.height,ctx=context(state,'pa'+fingerprint(JSON.stringify(state)),H),five=state.layout==='source'?SOURCE_LETTERS:[0,1,2,3,4].map(i=>state.items[i%state.items.length]);
 const out=isAtlas?atlas(state,five,ctx):state.layout==='specimen'?specimen(state,ctx,W,H):state.layout==='composition'?composition(state,ctx,W,H,page?.margin):field(state,ctx,W,H),shown=isAtlas?five:state.items,names=shown.map(t=>typeof t==='string'?t:SHAPES[t.shape].name.toLowerCase()).join(', ');
 const how=isAtlas||state.layout==='specimen'?'all eight constructions':state.items.every(i=>i.construction==='auto')?(state.construction==='mixed'?'mixed constructions':CONSTRUCTIONS.find(c=>c.id===state.construction).name.toLowerCase()):'per-item constructions';
 const desc=state.layout==='source'?`P.A.G.E.S. ${state.family} source atlas: contour ribs, exclusive-or overlaps, linked modules, perforations and folded planes. Manual study after Neo Neo.`:`${LAYOUTS.find(l=>l.id===state.layout).name} of ${names} in ${state.family}, ${how}. Shape kit after Neo Neo.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${out.width}" height="${out.height}" viewBox="0 0 ${out.width} ${out.height}" role="img" aria-label="${esc(desc)}"><title>${isAtlas?'P.A.G.E.S. — modular specimen atlas':'P.A.G.E.S. — shape kit'}</title><desc>${esc(desc)}</desc>${rect(0,0,out.width,out.height,ctx.paper)}${out.body}</svg>`;
 return {svg,state,width:out.width,height:out.height,features:{family:state.family,palette:state.palette,stage:state.stage,layout:state.layout,shapes:state.layout==='source'?[]:shown.map(t=>t.shape),items:state.layout==='source'?[]:shown.map(t=>({...t})),construction:state.construction,pattern:state.layout==='field'?state.pattern:null,format:isAtlas?'atlas':page?'custom':state.format,constructionMethods:CONSTRUCTIONS.map(c=>c.name.toLowerCase()),sourceSet:state.layout==='source',grid:out.grid}};
}
// One spec in one construction as a fragment inside a caller's frame
// (boards and tests). A spec is a shape id, an item or a source letter.
export function glyphSVG(c,spec,input,frame,small){const state=resolve(input),s=specOf(spec);return construct(c,s,frame,context(state,'pg'+fingerprint(c+JSON.stringify(s)+JSON.stringify(state)+JSON.stringify(frame)),frame.h*4),small);}
// A square thumbnail of a shape or item in the state's construction (overlap
// lenses when mixed), or in `c` when given.
export function thumbnail(spec,input={},size=72,c){const state=resolve(input),s=specOf(spec),con=c??(s.construction&&s.construction!=='auto'?s.construction:state.construction==='mixed'?'overlap':state.construction),a=aspect(con,s,state),w=a>=1?size*.9:size*.9*a,h=w/a,ctx=context({...state,stage:3},'pt'+fingerprint(con+JSON.stringify(s)+JSON.stringify(state)+size),size*4);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" aria-hidden="true">${construct(con,s,{x:(size-w)/2,y:(size-h)/2,w,h},ctx)}</svg>`;}
// A kit strip: item `index` through all eight constructions.
export function kit(input={},index=0){const state=resolve(input),item=state.items[Math.max(0,Math.min(state.items.length-1,index))],ctx=context(state,'pk'+fingerprint(JSON.stringify(state)+index),500);return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="215" viewBox="0 0 1200 215" role="img" aria-label="${esc(SHAPES[item.shape].name)} in all eight constructions">${strip(state,item,ctx)}</svg>`;}
// Inspection helpers for tests and the editor.
export function organicParts(spec,input={},frame={x:0,y:0,w:100,h:116}){return overlapParts(specOf(spec),frame,resolve(input));}
export function organicGlyph(spec,input,ink,frame={x:0,y:0,w:100,h:116}){return overlap(specOf(spec),frame,{state:resolve(input),ink,paper:'none',hair:.5});}
export function linkedNodes(spec,input={}){const s=resolve(input);return nodesFor(specOf(spec),s.params.nodes,s.params.detail);}
export const constructionFor=(state,index)=>consFor(state,state.items[index],index);
export {ORDER};
