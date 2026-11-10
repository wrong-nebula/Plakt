import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, sanitize, restorePreferences, solarPosition, paperThickness, paperHeight, widths } from '../src/settings.js';
import { makePaperGeometry, makeEdges } from '../src/paper-mesh.js';
import { formFactor, softboxWidth, studioCenterY } from '../src/studio-scene.js';
import * as THREE from 'three';

test('persisted settings reject unknown values, nonfinite numbers and injected colors',()=>{
  const value=sanitize({environment:'remote',hour:Infinity,gsm:99999,wrinkles:-20,finish:'gold',spotColor:'url(https://example.com)',mask:'custom',extra:'ignored'});
  assert.equal(value.environment,defaults.environment);assert.equal(value.hour,defaults.hour);
  assert.equal(value.gsm,350);assert.equal(value.wrinkles,0);assert.equal(value.finish,'gold');
  assert.equal(value.spotColor,defaults.spotColor);assert.equal(value.mask,'custom');assert.equal('extra' in value,false);
  assert.deepEqual(sanitize(null),defaults);assert.deepEqual(sanitize([]),defaults);
});

test('solar position follows latitude, season and day/night on a unit sphere',()=>{
  assert.ok(solarPosition(12,35.7,172).elevation>75);
  assert.ok(solarPosition(12,35.7,355).elevation<32);
  assert.ok(solarPosition(0,35.7,172).elevation<0);
  assert.ok(solarPosition(12,-35.7,355).elevation>75);
  for(const h of [0,7,12,18,24]) {const p=solarPosition(h,35.7,172);assert.ok(Math.abs(p.x*p.x+p.y*p.y+p.z*p.z-1)<1e-10);}
});

test('paper has physical thickness from grammage and stock density',()=>{
  const standard=paperThickness(defaults);
  assert.ok(standard>0.0001&&standard<0.0003);
  assert.equal(paperThickness({...defaults,gsm:280}),standard*2);
  assert.ok(paperThickness({...defaults,stock:'cotton'})>standard);
});

test('paper deformation is deterministic and keeps all mount types above the wall',()=>{
  for(const mounting of ['paste','tape','floating'])for(const wrinkles of [0,1]) {
    const settings={...defaults,environment:'courtyard',mounting,wrinkles,curl:1};
    for(let i=0;i<=20;i++)for(let j=0;j<=20;j++) {
      const z=paperHeight(i/20,j/20,settings);assert.ok(Number.isFinite(z)&&z>0);
      assert.equal(z,paperHeight(i/20,j/20,settings));
    }
  }
  assert.ok(paperHeight(1,0,{...defaults,environment:'courtyard',curl:1})>paperHeight(0.5,0.5,{...defaults,environment:'courtyard',curl:1}));
});

test('display frames clamp the paper edges and migrate old scene preferences without deleting print settings',()=>{
  assert.equal(defaults.environment,'studio');assert.equal(defaults.backdrop,'white');
  for(const u of [0,1])for(const v of [0,0.5,1])assert.equal(paperHeight(u,v,{...defaults,environment:'display',curl:1,wrinkles:1}),0.002);
  for(const saved of [{environment:'courtyard',process:'riso',gsm:250},{environment:'display',backdrop:'black',process:'riso',gsm:250}]) {
    const restored=restorePreferences(saved);
    assert.equal(restored.environment,'studio');assert.equal(restored.gsm,250);assert.equal(restored.process,'riso');
    assert.equal(restorePreferences({...restored,environment:'gallery'}).environment,'gallery');
  }
  assert.equal(restorePreferences({environment:'display',backdrop:'black'}).backdrop,'black');
});

test('studio sheet hangs clean: no street crease, and each mount sets its standoff from the sweep',()=>{
  const studio={...defaults,environment:'studio',curl:0,wrinkles:0};
  const street={...studio,environment:'courtyard',wrinkles:1};
  const crease=0.34+Math.sin(4)*0.026,lift=s=>paperHeight(crease,0.5,s)-paperHeight(crease+0.05,0.5,s);
  assert.ok(lift(street)>0.0015);assert.ok(Math.abs(lift({...studio,wrinkles:1}))<0.0005);
  const gap=mounting=>paperHeight(0.5,0.5,{...studio,mounting});
  assert.ok(gap('paste')<gap('tape')&&gap('tape')<gap('floating'));
  assert.equal(sanitize({keyAngle:-200,softness:4,fillLight:-1,backdrop:'grey'}).keyAngle,-80);
  assert.equal(sanitize({softness:4}).softness,1);assert.equal(sanitize({fillLight:-1}).fillLight,0);assert.equal(sanitize({backdrop:'grey'}).backdrop,'grey');
});

test('softbox form factors are exact, so studio light can be metered at the sheet',()=>{
  const point=new THREE.Vector3(),normal=new THREE.Vector3(0,0,1),square=(half,z)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>new THREE.Vector3(x*half,y*half,z));
  // A plane filling the hemisphere sees all of it; a small far square approaches A/(πd²).
  assert.ok(Math.abs(formFactor(point,normal,square(1e6,1))-1)<1e-4);
  assert.ok(Math.abs(formFactor(point,normal,square(0.01,10))-0.0004/(Math.PI*100))<1e-9);
  // Unit square at distance 1, centred on the normal: analytic value 0.2394.
  assert.ok(Math.abs(formFactor(point,normal,square(0.5,1))-0.23936)<1e-4);
  assert.ok(softboxWidth(0)<softboxWidth(1));assert.ok(studioCenterY(2.4)-1.2>0.7);
});

test('paper mesh and thickness edges meet at the same deformed boundary',()=>{
  const settings={...defaults,size:'A1',curl:0.8,wrinkles:0.6},aspect=1.25;
  const front=makePaperGeometry(settings,aspect),edges=makeEdges(settings,aspect);
  const point=edges.attributes.position;
  assert.ok(Math.abs(point.getX(0)+widths.A1/2)<1e-7);
  assert.ok(Math.abs(point.getY(0)+widths.A1*aspect/2)<1e-7);
  assert.ok(Math.abs(point.getZ(0)-paperHeight(0,0,settings))<1e-8);
  assert.ok(Math.abs(point.getZ(0)-point.getZ(1)-paperThickness(settings))<1e-8);
  for(const geometry of [front,edges])for(const attribute of ['position','normal'])assert.ok(geometry.attributes[attribute].array.every(Number.isFinite));
  assert.equal(edges.attributes.position.count,4*160*6);front.dispose();edges.dispose();
});
