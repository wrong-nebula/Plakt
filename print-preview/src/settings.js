export const defaults = Object.freeze({
  environment: 'studio', backdrop: 'white', keyAngle: -38, softness: 0.55, fillLight: 0.35, surface: 'concrete', hour: 16.5, latitude: 35.7, day: 172,
  cloud: 0.18, exposure: 1, indoorTemperature: 4000, indoorIntensity: 2.5, exteriorLight: 1.5,
  stock: 'uncoated', gsm: 140, size: 'City', mounting: 'paste', wrinkles: 0.28,
  curl: 0.25, glue: 0.5, damp: 0.12, process: 'offset', registration: 0.12,
  ink: 0.9, lpi: 110, finish: 'none', mask: 'dark', spotColor: '#d1a85b',
  finishAmount: 0.9, wear: 0.08, quality: 'high', renderSize: '4k', showMask: false,
});

const enums = {
  environment: ['studio', 'display', 'courtyard', 'gallery'], backdrop: ['white', 'grey', 'black'], surface: ['concrete', 'brick', 'plaster'],
  stock: ['uncoated', 'coated', 'newsprint', 'cotton'], size: ['City', 'A2', 'A1', 'A0'],
  mounting: ['paste', 'tape', 'floating'], process: ['digital', 'offset', 'riso'],
  finish: ['none', 'metallic', 'gold', 'silver', 'holographic', 'varnish'],
  mask: ['dark', 'accent', 'all', 'custom'], quality: ['standard', 'high'],
  renderSize: ['viewport','4k','8k','12k'],
};
const ranges = {
  hour: [0, 24], latitude: [-65, 65], day: [1, 365], cloud: [0, 1], exposure: [0.3, 2],
  indoorTemperature: [2700, 6500], indoorIntensity: [0, 8], exteriorLight: [0, 5], gsm: [60, 350], wrinkles: [0, 1],
  curl: [0, 1], glue: [0, 1], damp: [0, 1], registration: [0, 1.5], ink: [0.4, 1.3],
  lpi: [35, 180], finishAmount: [0, 1], wear: [0, 1], keyAngle: [-80, 80], softness: [0, 1], fillLight: [0, 1],
};
export function sanitize(input = {}) {
  const result = { ...defaults };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  for (const [key, choices] of Object.entries(enums)) if (choices.includes(input[key])) result[key] = input[key];
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) result[key] = Math.min(max, Math.max(min, input[key]));
  }
  if (typeof input.spotColor === 'string' && /^#[0-9a-f]{6}$/i.test(input.spotColor)) result.spotColor = input.spotColor;
  if (typeof input.showMask === 'boolean') result.showMask = input.showMask;
  return result;
}

export function restorePreferences(input) {
  // Preferences saved before the studio set adopt it once as the default scene; print settings are kept.
  if(input&&typeof input==='object'&&!Object.hasOwn(input,'keyAngle'))return sanitize({...input,environment:'studio'});
  return sanitize(input);
}

export const widths = { City: 0.900, A2: 0.420, A1: 0.594, A0: 0.841 };
export const paper = {
  uncoated: { color: '#f4f0e5', roughness: 0.88, bump: 0.000035, density: 850 },
  coated: { color: '#faf9f5', roughness: 0.32, bump: 0.000008, density: 1200 },
  newsprint: { color: '#d8cdb2', roughness: 0.96, bump: 0.000060, density: 650 },
  cotton: { color: '#f0e8d7', roughness: 0.94, bump: 0.000085, density: 700 },
};

// Solar time (not civil time): declination and hour angle drive a real sun vector.
export function solarPosition(hour, latitude, day) {
  const radians = Math.PI / 180;
  const lat = latitude * radians;
  const declination = 23.44 * radians * Math.sin(2 * Math.PI * (284 + day) / 365);
  const angle = (hour - 12) * 15 * radians;
  const y = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(angle);
  // Positive z faces the poster's wall. Rotate the courtyard slightly west of south.
  const east = -Math.cos(declination) * Math.sin(angle);
  const south = Math.sin(lat) * Math.cos(declination) * Math.cos(angle) - Math.cos(lat) * Math.sin(declination);
  const wallAngle = 28 * radians;
  return { x: east * Math.cos(wallAngle) + south * Math.sin(wallAngle), y,
    z: -east * Math.sin(wallAngle) + south * Math.cos(wallAngle), elevation: Math.asin(Math.max(-1, Math.min(1, y))) / radians };
}

export function paperThickness(settings) { return settings.gsm / 1000 / paper[settings.stock].density; }

// All lengths are metres. Same function is used by front, back, edge and paste meshes.
export function paperHeight(u, v, s) {
  const stuck = s.mounting === 'paste';
  const base = stuck ? 0.0018 + s.glue * 0.0006 : s.mounting === 'tape' ? 0.008 : 0.035;
  const wave = Math.sin(u * 18 + v * 7) * Math.sin(v * 22 - u * 6) * 0.0016
    + Math.sin(u * 42 + v * 13) * 0.00032;
  if(s.environment==='display')return 0.002+wave*s.wrinkles*0.08*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
  const edge = Math.pow(Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2, 18);
  const corner = Math.pow(u, 10) * Math.pow(1 - v, 10);
  // A clean sheet in the studio: gentle cockle and edge lift, without the street poster's crease.
  if(s.environment==='studio')return base + wave * s.wrinkles * (stuck ? 0.3 : 0.9) + s.curl * (edge * 0.006 + corner * 0.02) * (stuck ? 0.3 : 1);
  const ridge = Math.exp(-Math.pow((u - 0.34 - Math.sin(v * 8) * 0.026) * 65, 2)) * Math.sin(v * Math.PI) * 0.004;
  const curl = s.curl * (edge * 0.010 + corner * 0.043) * (stuck ? 0.55 : 1);
  return base + (wave + ridge) * s.wrinkles * (stuck ? 0.65 : 1.8) + curl;
}
