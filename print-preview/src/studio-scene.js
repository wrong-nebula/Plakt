import * as THREE from 'three';

// Seamless backdrop rolls as linear albedo: a slightly grey "white" lets lit paper read brighter than the sweep.
export const sweeps = { white:{albedo:0.7,name:'White'}, grey:{albedo:0.16,name:'Grey'}, black:{albedo:0.022,name:'Black'} };
export const softboxWidth = softness => 0.6 + softness * 1.4;
export const studioCenterY = height => Math.max(1.5, 0.95 + height / 2);
const radius = 0.7;
// Approximate ambient irradiance at the sheet from the room environment below, relative to the key and fill.
const ambient = albedo => 0.5 * albedo * 0.45 + 0.06 * (0.25 + albedo);

// Exact form factor of a polygon fully above the receiver's horizon (Lambert's edge integral).
export function formFactor(point, normal, corners) {
  const sum = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  corners.forEach((corner, i) => {
    a.subVectors(corner, point).normalize(); b.subVectors(corners[(i + 1) % corners.length], point).normalize();
    c.crossVectors(a, b); const sin = c.length();
    if (sin > 1e-9) sum.addScaledVector(c, Math.atan2(sin, a.dot(b)) / sin);
  });
  return Math.abs(sum.dot(normal)) / (2 * Math.PI);
}

function sweepGeometry(width = 9, height = 4.2, depth = 7, steps = 40) {
  // Profile in (y, z, normal y, normal z): wall, a quarter-cylinder cove, then floor toward the camera.
  const profile = [[height, 0, 0, 1]];
  for (let i = 0; i <= steps; i++) {
    const a = i / steps * Math.PI / 2;
    profile.push([radius - radius * Math.sin(a), radius - radius * Math.cos(a), Math.sin(a), Math.cos(a)]);
  }
  profile.push([0, depth, 1, 0]);
  const position = [], normal = [], uv = [], index = [];
  let length = 0;
  profile.forEach(([y, z, ny, nz], k) => {
    if (k) length += Math.hypot(y - profile[k - 1][0], z - profile[k - 1][1]);
    for (const side of [0, 1]) { position.push((side - 0.5) * width, y, z); normal.push(0, ny, nz); uv.push(side, length / 12); }
    if (k) { const a = 2 * k - 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

// The sheet is the only occluder in the set, so shadows are traced against it exactly instead of
// from shadow maps: each softbox is sampled as a real area, and ambient light loses the sheet's form factor.
const sweepGLSL = /* glsl */`
uniform vec3 sOccCenter;
uniform vec3 sOccU;
uniform vec3 sOccV;
uniform vec3 sKeyPosition;
uniform vec2 sKeyGrid;
float sJitter() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }
vec3 sEdge(vec3 a, vec3 b) {
  vec3 c = cross(a, b); float s = length(c);
  return s > 1e-7 ? c * atan(s, dot(a, b)) / s : vec3(0.0);
}
// Fraction of a rectangular light (centre, half-extent vectors, view space) not hidden by the sheet.
float sVisibility(vec3 p, vec3 lc, vec3 lu, vec3 lv) {
  vec3 c = (viewMatrix * vec4(sOccCenter, 1.0)).xyz, u = mat3(viewMatrix) * sOccU, v = mat3(viewMatrix) * sOccV, n = cross(u, v);
  float side = dot(n, c - p), uu = 1.0 / dot(u, u), vv = 1.0 / dot(v, v);
  vec2 lo = vec2(1e9), hi = vec2(-1e9);
  int crossings = 0;
  for (int k = 0; k < 4; k++) {
    vec3 d = lc + (k == 1 || k == 2 ? lu : -lu) + (k > 1 ? lv : -lv) - p;
    float t = side / dot(n, d);
    if (t > 0.0 && t < 1.0) { crossings++; vec3 h = p + t * d - c; vec2 ab = vec2(dot(h, u) * uu, dot(h, v) * vv); lo = min(lo, ab); hi = max(hi, ab); }
  }
  if (crossings == 0) return 1.0;
  // Every corner crosses: the footprint is convex, so its corners decide clear sky and full umbra.
  if (crossings == 4) {
    if (hi.x < -1.0 || lo.x > 1.0 || hi.y < -1.0 || lo.y > 1.0) return 1.0;
    if (lo.x > -1.0 && hi.x < 1.0 && lo.y > -1.0 && hi.y < 1.0) return 0.0;
  }
  // Penumbra: stratified, jittered samples over the softbox.
  float hidden = 0.0, j = sJitter();
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    vec2 s = (vec2(float(x), float(y)) + fract(vec2(j, j * 1.6180339) + vec2(float(y), float(x)) * 0.618034)) / 4.0 - 1.0;
    vec3 d = lc + s.x * lu + s.y * lv - p;
    float t = side / dot(n, d);
    if (t > 0.0 && t < 1.0) { vec3 h = p + t * d - c; hidden += step(abs(dot(h, u) * uu), 1.0) * step(abs(dot(h, v) * vv), 1.0); }
  }
  return 1.0 - hidden / 64.0;
}
// A gridded key throws a pool of light; the wide fill is a bare bounce.
float sGrid(vec3 p, vec3 lc, vec3 lu, vec3 lv) {
  if (distance(lc, (viewMatrix * vec4(sKeyPosition, 1.0)).xyz) > 0.01) return 1.0;
  return mix(0.25, 1.0, smoothstep(sKeyGrid.y, sKeyGrid.x, dot(normalize(p - lc), normalize(cross(lv, lu)))));
}
// Ambient reaching the sweep: the hemisphere minus what the sheet covers.
float sOpen(vec3 p, vec3 n) {
  vec3 c = (viewMatrix * vec4(sOccCenter, 1.0)).xyz, u = mat3(viewMatrix) * sOccU, v = mat3(viewMatrix) * sOccV;
  vec3 q0 = c - u - v - p, q1 = c + u - v - p, q2 = c + u + v - p, q3 = c - u + v - p;
  vec3 f = (sEdge(normalize(q0), normalize(q1)) + sEdge(normalize(q1), normalize(q2)) + sEdge(normalize(q2), normalize(q3)) + sEdge(normalize(q3), normalize(q0))) / 6.2831853;
  float z = dot(f, n); if (z < 0.0) { f = -f; z = -z; }
  bool above = min(min(dot(q0, n), dot(q1, n)), min(dot(q2, n), dot(q3, n))) > 0.0;
  float l = length(f), covered = above ? z : max((l * l + z) / (l + 1.0), 0.0);
  return 1.0 - clamp(covered, 0.0, 1.0);
}
`;

const shadowedRectLights = THREE.ShaderChunk.lights_fragment_begin.replace(
  'RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
  `{
    vec3 sDiffuse = reflectedLight.directDiffuse, sSpecular = reflectedLight.directSpecular;
    RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
    float sLit = sVisibility(geometryPosition, rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight)
      * sGrid(geometryPosition, rectAreaLight.position, rectAreaLight.halfWidth, rectAreaLight.halfHeight);
    reflectedLight.directDiffuse = mix(sDiffuse, reflectedLight.directDiffuse, sLit);
    reflectedLight.directSpecular = mix(sSpecular, reflectedLight.directSpecular, sLit);
  }`);

export class StudioSet {
  constructor() {
    this.group = new THREE.Group(); this.group.name = 'Studio softboxes'; this.group.visible = false;
    this.key = new THREE.RectAreaLight('#ffffff', 1, 1, 1); this.key.name = 'Gridded key softbox';
    this.fill = new THREE.RectAreaLight('#ffffff', 1, 1, 1); this.fill.name = 'Fill bounce';
    this.group.add(this.key, this.fill);
    this.uniforms = {
      sOccCenter: { value: new THREE.Vector3() }, sOccU: { value: new THREE.Vector3() }, sOccV: { value: new THREE.Vector3() },
      sKeyPosition: { value: new THREE.Vector3() }, sKeyGrid: { value: new THREE.Vector2(Math.cos(0.55), Math.cos(1.35)) },
    };
    this.environments = new Map();
  }

  sweep(tone) {
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setScalar(sweeps[tone].albedo), roughness: 0.94, metalness: 0 });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', sweepGLSL + '\nvoid main() {')
        .replace('#include <lights_fragment_begin>', shadowedRectLights)
        .replace('#include <lights_fragment_end>', `{ float sAmbient = sOpen(geometryPosition, geometryNormal); irradiance *= sAmbient; iblIrradiance *= sAmbient; radiance *= sAmbient; }
          #include <lights_fragment_end>`);
    };
    material.customProgramCacheKey = () => 'posterlab-studio-sweep-v1';
    const mesh = new THREE.Mesh(sweepGeometry(), material); mesh.name = 'Seamless studio sweep';
    return mesh;
  }

  // Softboxes are placed around the sheet and normalised so the light reaching its centre stays constant
  // as they move or grow, like a photographer metering the key.
  light(s, center, width, height, standoff) {
    const radians = Math.PI / 180, angle = s.keyAngle * radians;
    const occluder = this.uniforms;
    occluder.sOccCenter.value.set(center.x, center.y, center.z + standoff);
    occluder.sOccU.value.set(width / 2, 0, 0); occluder.sOccV.value.set(0, height / 2, 0);
    const place = (light, azimuth, elevation, distance, w, h) => {
      light.width = w; light.height = h;
      light.position.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(distance).add(center);
      light.lookAt(center); light.updateMatrixWorld();
      const corners = [[1, -1], [-1, -1], [-1, 1], [1, 1]].map(([x, y]) => new THREE.Vector3(x * w / 2, y * h / 2, 0).applyMatrix4(light.matrixWorld));
      return formFactor(center, new THREE.Vector3(0, 0, 1), corners);
    };
    const size = softboxWidth(s.softness), reach = 2.3 + width * 0.5;
    const keyForm = place(this.key, angle, 24 * radians, reach, size, size * 1.35);
    const fillForm = place(this.fill, (s.keyAngle <= 0 ? 1 : -1) * 58 * radians, 6 * radians, reach + 0.4, 1.8, 2.3);
    const total = s.indoorIntensity / 2.5, key = total * Math.max(0.2, 1 - ambient(sweeps[s.backdrop].albedo)) / (1 + s.fillLight);
    this.key.intensity = key / keyForm; this.fill.intensity = key * s.fillLight / fillForm;
    this.uniforms.sKeyPosition.value.copy(this.key.position);
  }

  // A dim room around the set: the lit sweep floor below, dark walls and ceiling elsewhere.
  environment(pmrem, tone) {
    if (!this.environments.has(tone)) {
      const scene = new THREE.Scene(), albedo = sweeps[tone].albedo;
      const room = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 14), [0.12, 0.12, 0.06, 0.12, 0.14, 0.12].map(v =>
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(v * (0.25 + albedo)), side: THREE.BackSide })));
      room.position.y = 2;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(albedo * 0.45) }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -1.45;
      scene.add(room, floor);
      this.environments.set(tone, pmrem.fromScene(scene, 0.04));
      scene.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) m.dispose(); });
    }
    return this.environments.get(tone);
  }

  background(tone) { return new THREE.Color().setScalar(sweeps[tone].albedo * 0.12); }
  dispose() { for (const target of this.environments.values()) target.dispose(); this.environments.clear(); }
}
