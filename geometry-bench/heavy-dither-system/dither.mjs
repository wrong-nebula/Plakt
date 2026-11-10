// Dither core shared by the Heavy dither shape system and the effector engine's Dither modifier.
// A grid of ink values (0 = paper, 1 = full ink) becomes a grid of levels 0 … levels−1. Ordered
// methods read a threshold keyed by the cell's page index (i0 + i, j0 + j), so neighbouring grids
// that share a lattice also share a pattern. Error diffusion runs serpentine; Order mixes a Bayer
// threshold into it, so mid-tones fall into checks while edges stay noisy.
export const METHODS={
 atkinson:{name:'Atkinson',kind:'diffuse',div:8,taps:[[1,0,1],[2,0,1],[-1,1,1],[0,1,1],[1,1,1],[0,2,1]]},
 floyd:{name:'Floyd–Steinberg',kind:'diffuse',div:16,taps:[[1,0,7],[-1,1,3],[0,1,5],[1,1,1]]},
 jarvis:{name:'Jarvis–Judice–Ninke',kind:'diffuse',div:48,taps:[[1,0,7],[2,0,5],[-2,1,3],[-1,1,5],[0,1,7],[1,1,5],[2,1,3],[-2,2,1],[-1,2,3],[0,2,5],[1,2,3],[2,2,1]]},
 stucki:{name:'Stucki',kind:'diffuse',div:42,taps:[[1,0,8],[2,0,4],[-2,1,2],[-1,1,4],[0,1,8],[1,1,4],[2,1,2],[-2,2,1],[-1,2,2],[0,2,4],[1,2,2],[2,2,1]]},
 burkes:{name:'Burkes',kind:'diffuse',div:32,taps:[[1,0,8],[2,0,4],[-2,1,2],[-1,1,4],[0,1,8],[1,1,4],[2,1,2]]},
 sierra:{name:'Sierra lite',kind:'diffuse',div:4,taps:[[1,0,2],[-1,1,1],[0,1,1]]},
 bayer2:{name:'Bayer 2×2',kind:'ordered'},
 bayer4:{name:'Bayer 4×4',kind:'ordered'},
 bayer8:{name:'Bayer 8×8',kind:'ordered'},
 cluster:{name:'Clustered dot',kind:'ordered'},
 lines:{name:'Line screen',kind:'ordered'},
 blue:{name:'Blue noise',kind:'ordered'},
 white:{name:'White noise',kind:'ordered'},
 threshold:{name:'Threshold',kind:'ordered'}
};
// Bayer matrices by recursion; thresholds sit at cell centres, (m + .5) / n², so 0 and 1 stay exact.
function bayer(n){let m=[[0]];while(m.length<n){const k=m.length,o=[];for(let y=0;y<2*k;y++){o.push([]);for(let x=0;x<2*k;x++)o[y].push(4*m[y%k][x%k]+[[0,2],[3,1]][y<k?0:1][x<k?0:1]);}m=o;}
 const N=n*n;return m.map(r=>r.map(v=>(v+.5)/N));}
const B2=bayer(2),B4=bayer(4),B8=bayer(8);
// A clustered-dot cell grows from its centre, like a newspaper halftone on a square grid.
const C4=[[12,5,6,13],[4,0,1,7],[11,3,2,8],[15,10,9,14]].map(r=>r.map(v=>(v+.5)/16));
const L4=[[0,0,0,0],[1,1,1,1],[2,2,2,2],[3,3,3,3]].map(r=>r.map(v=>(v+.5)/4));
const fract=x=>x-Math.floor(x),mod=(a,n)=>((a%n)+n)%n;
function hash(a,b,c){let h=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul(c|0,2246822519))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return ((h^(h>>>16))>>>0)/4294967296;}
// Threshold in [0, 1) for page cell (i, j).
export function threshold(method,i,j,seed=1){switch(method){
 case 'bayer2':return B2[mod(j,2)][mod(i,2)];case 'bayer4':return B4[mod(j,4)][mod(i,4)];case 'bayer8':return B8[mod(j,8)][mod(i,8)];
 case 'cluster':return C4[mod(j,4)][mod(i,4)];case 'lines':return L4[mod(j,4)][mod(i,4)];
 // Interleaved gradient noise: a cheap blue-ish noise with no low-frequency clumps.
 case 'blue':return fract(52.9829189*fract(.06711056*(i+seed*7)+.00583715*(j+seed*3)));
 case 'white':return hash(i,j,seed);
 default:return .5;}}
// values: Float32Array of ink (cols × rows, row-major). Returns Uint8Array of levels (0 = paper).
export function dither(values,cols,rows,{method='atkinson',levels=2,order=0,seed=1,i0=0,j0=0}={}){
 const n=Math.max(2,Math.min(8,levels|0)),top=n-1,q=new Uint8Array(cols*rows),M=METHODS[method]||METHODS.atkinson;
 if(M.kind==='ordered'){for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i,v=values[k];if(!(v>0)){q[k]=0;continue;}if(v>=1){q[k]=top;continue;}
   const s=v*top,b=Math.floor(s);q[k]=Math.min(top,b+(s-b>threshold(method,i0+i,j0+j,seed)?1:0));}
  return q;}
 // Error diffusion over two working rows plus the kernel's depth; error never leaks past the grid.
 const e=new Float32Array(values),{div,taps}=M;
 for(let j=0;j<rows;j++){const rev=j%2===1;
  for(let s=0;s<cols;s++){const i=rev?cols-1-s:s,k=j*cols+i,x=e[k];
   const t=order?(B8[mod(j0+j,8)][mod(i0+i,8)]-.5)*order:0,lv=Math.max(0,Math.min(top,Math.round((x+t/top)*top)));q[k]=lv;
   const err=x-lv/top;if(!err)continue;
   for(const [dx,dy,w] of taps){const ii=rev?i-dx:i+dx,jj=j+dy;if(ii<0||ii>=cols||jj>=rows)continue;e[jj*cols+ii]+=err*w/div;}}}
 return q;}
// Separable box blur, applied twice (a tent kernel). Radius in cells; edges clamp.
export function blur(values,cols,rows,radius){const r=Math.round(radius);if(r<1)return values;let a=Float32Array.from(values),b=new Float32Array(a.length);
 const pass=(src,dst,horizontal)=>{const len=horizontal?cols:rows,lines=horizontal?rows:cols,w=2*r+1;
  for(let l=0;l<lines;l++){const at=p=>horizontal?l*cols+Math.max(0,Math.min(cols-1,p)):Math.max(0,Math.min(rows-1,p))*cols+l;let acc=0;
   for(let p=-r;p<=r;p++)acc+=src[at(p)];
   for(let p=0;p<len;p++){dst[horizontal?l*cols+p:p*cols+l]=acc/w;acc+=src[at(p+r+1)]-src[at(p-r)];}}};
 for(let k=0;k<2;k++){pass(a,b,true);pass(b,a,false);}return a;}
// Exact horizontal coverage of filled polygons (nonzero winding) on a cell grid. Each cell row is sampled
// at `sub` scanlines; spans add their overlap with every cell they cross. Polygons are flat [x0,y0,x1,y1,…]
// arrays in the grid's units; cell (i, j) covers [x0 + i·pw, x0 + (i+1)·pw) × [y0 + j·ph, y0 + (j+1)·ph).
export function coverage(polys,cols,rows,{x0=0,y0=0,pw=1,ph=pw,sub=4}={}){
 const R=rows*sub,cross=Array.from({length:R},()=>[]),cov=new Float32Array(cols*rows),dv=ph/sub;
 for(const p of polys){const n=p.length;if(n<6)continue;
  for(let a=0;a<n;a+=2){const b=a+2<n?a+2:0,ya=p[a+1],yb=p[b+1];if(ya===yb)continue;const lo=Math.min(ya,yb),hi=Math.max(ya,yb),dir=yb>ya?1:-1;
   const k0=Math.max(0,Math.ceil((lo-y0)/dv-.5)),k1=Math.min(R-1,Math.ceil((hi-y0)/dv-.5)-1);
   for(let k=k0;k<=k1;k++){const v=y0+(k+.5)*dv;cross[k].push(p[a]+(p[b]-p[a])*(v-ya)/(yb-ya),dir);}}}
 const w=1/(pw*sub);
 for(let k=0;k<R;k++){const c=cross[k];if(!c.length)continue;const idx=[];for(let m=0;m<c.length;m+=2)idx.push(m);idx.sort((m,o)=>c[m]-c[o]);
  const row=Math.floor(k/sub)*cols;let wind=0,start=0;
  for(const m of idx){const was=wind;wind+=c[m+1];if(!was&&wind)start=c[m];else if(was&&!wind){const xa=(start-x0)/pw,xb=(c[m]-x0)/pw;if(xb<=0||xa>=cols)continue;
    const ia=Math.max(0,Math.floor(xa)),ib=Math.min(cols-1,Math.floor(xb));
    for(let i=ia;i<=ib;i++){const o=Math.min(xb,i+1)-Math.max(xa,i);if(o>0)cov[row+i]+=o*pw*w;}}}}
 for(let k=0;k<cov.length;k++)if(cov[k]>1)cov[k]=1;
 return cov;}
