// Small SVG helpers shared by the constructions and arrangements.
export const n=x=>+(+x).toFixed(3);
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const path=(d,c,extra='')=>`<path d="${d}" fill="${c}" ${extra}/>`;
export const line=(d,ink,w,extra='')=>path(d,'none',`stroke="${ink}" stroke-width="${n(w)}" ${extra}`);
export const rect=(x,y,w,h,c,extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}" ${extra}/>`;
export function fingerprint(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
export const jitter=s=>parseInt(fingerprint(s),36)%1000/1000;
// A drawing context: resolved state, ground and ink, hairline width and a
// generator of ids unique within one SVG.
export function context(state,id,height){const [paper,ink]=state.invert?[state.colors[1],state.colors[0]]:state.colors;let k=0;return {state,paper,ink,hair:height/1100,uid:p=>`${id}-${p}${k++}`};}
