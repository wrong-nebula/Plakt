import * as THREE from 'three';

export function displayDimensions(width,height) {
  const legHeight=height*0.46;
  return {legHeight,totalHeight:height+legHeight,centerY:legHeight+height/2};
}

export function displayFrame(width,height) {
  const group=new THREE.Group();group.name='Flush metal city poster display';
  const {legHeight}=displayDimensions(width,height);
  const outerX=width/2+0.0035,outerY=height/2+0.0035;
  const innerX=width/2-0.0007,innerY=height/2-0.0007;
  const shape=new THREE.Shape();
  shape.moveTo(-outerX,-outerY);shape.lineTo(outerX,-outerY);shape.lineTo(outerX,outerY);shape.lineTo(-outerX,outerY);shape.closePath();
  const aperture=new THREE.Path();
  aperture.moveTo(-innerX,-innerY);aperture.lineTo(-innerX,innerY);aperture.lineTo(innerX,innerY);aperture.lineTo(innerX,-innerY);aperture.closePath();shape.holes.push(aperture);
  const metal=new THREE.MeshPhysicalMaterial({color:'#343b3c',metalness:0.8,roughness:0.38,anisotropy:0.18,clearcoat:0.12});
  // The poster is flush with a 4.2 mm visible lip; the enclosure's depth sits behind it.
  const depth=width*0.06;
  const rim=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:depth+0.0026,bevelEnabled:true,bevelSize:0.0002,bevelThickness:0.0002,bevelSegments:2,steps:1}),metal);
  rim.position.z=-depth;rim.castShadow=true;rim.receiveShadow=true;group.add(rim);
  const backing=new THREE.Mesh(new THREE.BoxGeometry(width+0.007,height+0.007,depth),metal);
  backing.position.z=-depth/2;backing.castShadow=true;group.add(backing);
  for(const x of [-1,1]) {
    const post=new THREE.Mesh(new THREE.BoxGeometry(width*0.052,legHeight+0.08,width*0.078),metal);
    post.position.set(x*width*0.042,-height/2-legHeight/2+0.04,-depth-width*0.039-0.002);
    post.castShadow=true;post.receiveShadow=true;group.add(post);
  }
  // An invisible receiver gives the posts a soft grounding shadow without adding a floor or horizon.
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(width*6,width*6),new THREE.ShadowMaterial({color:'#000000',opacity:0.12,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-height/2-legHeight+0.001;shadow.receiveShadow=true;group.add(shadow);
  return group;
}

export function displayBackdrop() {
  const material=new THREE.ShaderMaterial({
    uniforms:{dark:{value:0},view:{value:new THREE.Vector4(0,0,1,1)}},depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}',
    fragmentShader:`varying vec2 vUv; uniform float dark; uniform vec4 view;
      void main(){
        vec2 uv=view.xy+vUv*view.zw;
        vec2 p=(uv-vec2(0.46,0.58))*vec2(1.0,0.80);
        float falloff=smoothstep(0.0,0.78,length(p));
        vec3 light=mix(vec3(3.2),vec3(0.72),falloff);
        vec3 shade=mix(vec3(0.028),vec3(0.002),falloff);
        // Interpolate in log space so a grey backdrop sits between white and black in exposure.
        gl_FragColor=vec4(exp(mix(log(light),log(shade),dark)),1.0);
      }`,
  });
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  mesh.name='Seamless gradient backdrop';mesh.frustumCulled=false;mesh.renderOrder=-1000;
  return mesh;
}

export function displayEnvironment(pmrem) {
  const scene=new THREE.Scene();scene.background=new THREE.Color(0.12,0.12,0.12);
  for(const [x,y,z,w,h,intensity] of [[-3,1.5,3,2.8,5,5],[3.5,0.5,2,1,4,2.5],[0,4,-1,5,3,3]]) {
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(intensity,intensity,intensity),side:THREE.DoubleSide,toneMapped:false}));
    panel.position.set(x,y,z);panel.lookAt(0,0,0);scene.add(panel);
  }
  const target=pmrem.fromScene(scene,0.045);
  scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  return target;
}
