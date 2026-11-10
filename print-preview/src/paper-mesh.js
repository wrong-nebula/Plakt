import * as THREE from 'three';
import { paperHeight, paperThickness, widths, paper } from './settings.js';

export function makePaperGeometry(s, aspect = Math.SQRT2) {
  const w = widths[s.size], h = w * aspect;
  const geometry = new THREE.PlaneGeometry(w, h, 144, 204);
  const position = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) position.setZ(i, paperHeight(uv.getX(i), uv.getY(i), s));
  geometry.computeVertexNormals();
  return geometry;
}

export function makeEdges(s, aspect) {
  const vertices = [], uv = [], w = widths[s.size], h = w*aspect, thickness = paperThickness(s);
  const corners = [[0,0],[1,0],[1,1],[0,1],[0,0]];
  const point = (u,v,back) => [(u-0.5)*w,(v-0.5)*h,paperHeight(u,v,s)-(back ? thickness : 0)];
  for (let edge=0;edge<4;edge++) for (let i=0;i<160;i++) {
    const [a,b]=[corners[edge],corners[edge+1]];
    const u=a[0]+(b[0]-a[0])*i/160, v=a[1]+(b[1]-a[1])*i/160;
    const u2=a[0]+(b[0]-a[0])*(i+1)/160, v2=a[1]+(b[1]-a[1])*(i+1)/160;
    vertices.push(...point(u,v,false),...point(u,v,true),...point(u2,v2,false),...point(u2,v2,false),...point(u,v,true),...point(u2,v2,true));
    for(let t=0;t<6;t++) uv.push(i/160,t%2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals(); return geometry;
}

export function updatePaper(group, printMaterial, fiber, pasteMap, s, aspect) {
  while(group.children.length) {
    const object=group.children[0]; group.remove(object); object.geometry?.dispose();
    if(object.material !== printMaterial) object.material?.dispose();
  }
  const geometry=makePaperGeometry(s,aspect);
  const front=new THREE.Mesh(geometry,printMaterial); front.castShadow=true;front.receiveShadow=true;group.add(front);
  const backGeo=geometry.clone();
  const bp=backGeo.attributes.position;
  for(let i=0;i<bp.count;i++) bp.setZ(i,bp.getZ(i)-paperThickness(s));
  const back=new THREE.Mesh(backGeo,new THREE.MeshStandardMaterial({color:paper[s.stock].color,roughness:0.92,bumpMap:fiber,bumpScale:paper[s.stock].bump,side:THREE.BackSide}));
  back.castShadow=true;group.add(back);
  const edges=new THREE.Mesh(makeEdges(s,aspect),new THREE.MeshStandardMaterial({color:paper[s.stock].color,roughness:0.95,side:THREE.DoubleSide}));group.add(edges);
  const w=widths[s.size],h=w*aspect;
  // The studio sheet is mounted clean; the visible paste perimeter belongs to street walls.
  if(s.mounting==='paste'&&!['display','studio'].includes(s.environment)) {
    const paste = new THREE.Mesh(new THREE.PlaneGeometry(w+0.009+s.glue*0.008,h+0.009+s.glue*0.008),new THREE.MeshPhysicalMaterial({
      color:'#c8c1a5',roughness:0.65-s.damp*0.45,transparent:true,opacity:0.08+s.glue*0.16,
      bumpMap:pasteMap,bumpScale:0.0005*s.glue,depthWrite:false,clearcoat:s.damp*0.5,
    }));
    paste.position.z=0.0007; paste.renderOrder=1;group.add(paste);
  }
  if(s.mounting==='tape'&&s.environment!=='display') for(const [u,v,angle] of [[0,1,-0.5],[1,1,0.5],[0,0,0.5],[1,0,-0.5]]) {
    const tape=new THREE.Mesh(new THREE.PlaneGeometry(w*0.18,0.024),new THREE.MeshPhysicalMaterial({color:'#e8d5a2',roughness:0.7,transparent:true,opacity:0.74,side:THREE.DoubleSide}));
    tape.position.set((u-0.5)*w*0.95,(v-0.5)*h*0.96,paperHeight(u,v,s)+0.0007);
    tape.rotation.z=angle; tape.castShadow=true; group.add(tape);
  }
}
