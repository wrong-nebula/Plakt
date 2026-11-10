#include <metal_stdlib>
using namespace metal;

struct GlassObject {
    float4 center;
    float4 dimensions;
    float4 optical;
    float4 tint;
    float4 axisX;
    float4 axisY;
    float4 axisZ;
};
// tile: x first row offset of this pass, z row stride, w rows per offset; a pass renders every z-th row
// starting at offsets x, x + 1, … so each pass covers the whole poster evenly.
// shading: x studio (0 dark, 1 light, 2 poster colors), y paper shadow strength, z light spread (radians),
//          w shadow-map margin beyond each poster edge (in poster widths and heights).
// tone: mean linear poster color. shadowMap: x columns, y rows, z shadow rays per cell side,
// w 1 to write glass coverage into the output alpha.
// lighting: x light intensity, y studio brightness, z poster mip level, w perspective camera height (0 = straight down).
struct Uniforms { float4 viewport; float4 controls; float4 lighting; uint4 tile; float4 shading; float4 tone; float4 shadowMap; };
struct Hit { float t; float3 normal; int object; };
constant float epsilon = 0.000015;
constant sampler posterSampler(coord::normalized, address::clamp_to_edge, filter::linear, mip_filter::linear);
constant sampler shadowSampler(coord::normalized, address::clamp_to_edge, filter::linear);
constant sampler studioSampler(coord::normalized, s_address::repeat, t_address::clamp_to_edge, filter::linear);

float random(thread uint &state) {
    state ^= state << 13; state ^= state >> 17; state ^= state << 5;
    return float(state & 0x00ffffffu) / 16777216.0f;
}

// PCG hash: decorrelates the random streams of neighbouring shadow-map cells.
uint hash(uint value) {
    uint state = value * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

float3 keyLight(constant Uniforms &u) {
    float azimuth = u.controls.z, elevation = u.controls.w;
    return float3(cos(azimuth) * cos(elevation), sin(azimuth) * cos(elevation), sin(elevation));
}

// Exact unpolarized dielectric Fresnel; Snell's law handles total internal reflection.
float fresnel(float cosine, float etaI, float etaT) {
    float sinT2 = (etaI / etaT) * (etaI / etaT) * max(0.0f, 1.0f - cosine * cosine);
    if (sinT2 >= 1.0f) return 1.0f;
    float cosT = sqrt(1.0f - sinT2);
    float parallel = (etaT * cosine - etaI * cosT) / max(1e-7f, etaT * cosine + etaI * cosT);
    float perpendicular = (etaI * cosine - etaT * cosT) / max(1e-7f, etaI * cosine + etaT * cosT);
    return 0.5f * (parallel * parallel + perpendicular * perpendicular);
}

float3 microfacet(float3 n, float roughness, thread uint &rng) {
    if (roughness < 0.0001f) return n;
    float alpha = max(0.0001f, roughness * roughness);
    float u = min(0.9999f, random(rng));
    float cosTheta = sqrt((1.0f - u) / (1.0f + (alpha * alpha - 1.0f) * u));
    float sinTheta = sqrt(max(0.0f, 1.0f - cosTheta * cosTheta));
    float phi = 6.2831853f * random(rng);
    float3 tangent = normalize(cross(abs(n.z) < 0.99f ? float3(0, 0, 1) : float3(0, 1, 0), n));
    return normalize(n * cosTheta + (tangent * cos(phi) + cross(n, tangent) * sin(phi)) * sinTheta);
}

bool clipPlane(float3 n, float distance, float3 o, float3 d,
               thread float &nearT, thread float &farT,
               thread float3 &nearN, thread float3 &farN) {
    float denom = dot(n, d);
    float signedDistance = dot(n, o) - distance;
    if (abs(denom) < 1e-8f) return signedDistance <= 0;
    float t = -signedDistance / denom;
    if (denom < 0 && t > nearT) { nearT = t; nearN = n; }
    if (denom > 0 && t < farT) { farT = t; farN = n; }
    return nearT <= farT;
}

// Signed distance to a rounded cube (1), prism (2) or cylinder (3) in its own unscaled frame, with half
// extents h and edge radius r. The prism matches the analytic one: inradius h.x / 2, flat side down.
float roundedDistance(float3 p, float3 h, float r, int shape) {
    if (shape == 1) {
        float3 q = abs(p) - (h - r);
        return length(max(q, 0.0f)) + min(max(q.x, max(q.y, q.z)), 0.0f) - r;
    }
    float flat;
    if (shape == 3) {
        flat = length(p.xy) - (h.x - r);
    } else {
        const float k = 1.7320508f;
        float side = (0.5f * h.x - r) * k;  // half the side length of the triangle shrunk by r
        float2 q = float2(abs(p.x) - side, p.y + side / k);
        if (q.x + k * q.y > 0) q = float2(q.x - k * q.y, -k * q.x - q.y) / 2;
        q.x -= clamp(q.x, -2 * side, 0.0f);
        flat = -length(q) * sign(q.y);
    }
    float2 w = float2(flat, abs(p.z) - (h.z - r));
    return min(max(w.x, w.y), 0.0f) + length(max(w, 0.0f)) - r;
}

// Entry and exit through the unrounded cube (1), prism (2) or cylinder (3) in its scaled unit frame, with
// the face normals there; empty when `far` is smaller than `near`.
struct Interval { float near; float far; float3 nearNormal; float3 farNormal; };
Interval sharpInterval(float3 o, float3 d, int shape) {
    float nearT = -1e20f, farT = 1e20f;
    float3 nearN(0), farN(0);
    Interval empty = { 1, -1, float3(0), float3(0) };
    bool valid = true;
    if (shape == 3) {
        float a = dot(d.xy, d.xy), b = dot(o.xy, d.xy), c = dot(o.xy, o.xy) - 1;
        if (a < 1e-10f) {
            valid = c <= 0;
        } else {
            float discriminant = b * b - a * c;
            if (discriminant < 0) return empty;
            float root = sqrt(discriminant);
            nearT = (-b - root) / a; farT = (-b + root) / a;
            nearN = float3((o + d * nearT).xy, 0); farN = float3((o + d * farT).xy, 0);
        }
    } else if (shape == 1) {
        valid = clipPlane(float3(1,0,0), 1, o,d,nearT,farT,nearN,farN)
            && clipPlane(float3(-1,0,0), 1, o,d,nearT,farT,nearN,farN)
            && clipPlane(float3(0,1,0), 1, o,d,nearT,farT,nearN,farN)
            && clipPlane(float3(0,-1,0), 1, o,d,nearT,farT,nearN,farN);
    } else {
        valid = clipPlane(float3(0,-1,0), 0.5f, o,d,nearT,farT,nearN,farN)
            && clipPlane(float3(0.8660254f,0.5f,0), 0.5f, o,d,nearT,farT,nearN,farN)
            && clipPlane(float3(-0.8660254f,0.5f,0), 0.5f, o,d,nearT,farT,nearN,farN);
    }
    valid = valid && clipPlane(float3(0,0,1), 1, o,d,nearT,farT,nearN,farN)
        && clipPlane(float3(0,0,-1), 1, o,d,nearT,farT,nearN,farN);
    return valid ? Interval { nearT, farT, nearN, farN } : empty;
}

// A rounded solid lies inside its sharp version and both are convex, so the sharp interval brackets the
// one crossing. On flat faces the sharp crossing is already exact; near edges a golden-section search finds
// the ray's closest approach and bisection the crossing. Every case uses a fixed, small number of steps.
Hit intersectRounded(float3 origin, float3 direction, constant GlassObject &object, int index) {
    float3x3 rotation(object.axisX.xyz, object.axisY.xyz, object.axisZ.xyz);
    float3 h = object.dimensions.xyz;
    float3 o = transpose(rotation) * (origin - object.center.xyz), d = transpose(rotation) * direction;
    float r = object.axisX.w;
    int shape = int(object.center.w);
    Hit miss = { 1e20f, float3(0), index };
    Interval span = sharpInterval(o / h, d / h, shape);
    if (span.near > span.far || span.far < epsilon) return miss;
    float start = max(span.near, 1e-4f), end = span.far, t;
    if (span.near <= 1e-4f && roundedDistance(o + d * 1e-4f, h, r, shape) < 0) {
        if (roundedDistance(o + d * end, h, r, shape) <= 1e-5f) {
            return Hit { end, normalize(rotation * (span.farNormal / h)), index };  // flat face: exact already
        } else {
            float low = 1e-4f, high = end;
            for (int i = 0; i < 22; ++i) {
                float middle = 0.5f * (low + high);
                if (roundedDistance(o + d * middle, h, r, shape) < 0) low = middle; else high = middle;
            }
            t = 0.5f * (low + high);
        }
    } else if (span.near > 1e-4f && roundedDistance(o + d * start, h, r, shape) <= 1e-5f) {
        return Hit { start, normalize(rotation * (span.nearNormal / h)), index };  // flat face: exact already
    } else {
        float a = start, b = end;
        float x1 = b - 0.618034f * (b - a), x2 = a + 0.618034f * (b - a);
        float f1 = roundedDistance(o + d * x1, h, r, shape), f2 = roundedDistance(o + d * x2, h, r, shape);
        for (int i = 0; i < 24 && min(f1, f2) >= 0; ++i) {
            if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - 0.618034f * (b - a); f1 = roundedDistance(o + d * x1, h, r, shape); }
            else { a = x1; x1 = x2; f1 = f2; x2 = a + 0.618034f * (b - a); f2 = roundedDistance(o + d * x2, h, r, shape); }
        }
        if (min(f1, f2) >= 0) return miss;  // the ray only clips a corner the rounding removed
        float low = start, high = f1 < f2 ? x1 : x2;
        for (int i = 0; i < 22; ++i) {
            float middle = 0.5f * (low + high);
            if (roundedDistance(o + d * middle, h, r, shape) > 0) low = middle; else high = middle;
        }
        t = 0.5f * (low + high);
    }
    float3 p = o + d * t;
    const float2 e = float2(1, -1) * 2e-4f;
    float3 n = e.xyy * roundedDistance(p + e.xyy, h, r, shape) + e.yyx * roundedDistance(p + e.yyx, h, r, shape)
             + e.yxy * roundedDistance(p + e.yxy, h, r, shape) + e.xxx * roundedDistance(p + e.xxx, h, r, shape);
    return Hit { t, normalize(rotation * n), index };
}

Hit intersect(float3 origin, float3 direction, constant GlassObject &object, int index) {
    if (object.axisX.w > 0 && object.center.w > 0.5f) return intersectRounded(origin, direction, object, index);
    float3x3 rotation(object.axisX.xyz, object.axisY.xyz, object.axisZ.xyz);
    float3 o = transpose(rotation) * (origin - object.center.xyz) / object.dimensions.xyz;
    float3 d = transpose(rotation) * direction / object.dimensions.xyz;
    float t = 1e20f;
    float3 n = float3(0);
    int shape = int(object.center.w);
    if (shape == 0) {
        float a = dot(d, d), b = dot(o, d), c = dot(o, o) - 1;
        float discriminant = b * b - a * c;
        if (discriminant >= 0) {
            float root = sqrt(discriminant);
            float first = (-b - root) / a, second = (-b + root) / a;
            t = first > epsilon ? first : (second > epsilon ? second : 1e20f);
            n = o + d * t;
        }
    } else if (shape == 3) {
        float a = dot(d.xy, d.xy), b = dot(o.xy, d.xy), c = dot(o.xy, o.xy) - 1;
        float discriminant = b * b - a * c;
        if (a > 1e-10f && discriminant >= 0) {
            for (int side = 0; side < 2; ++side) {
                float candidate = (-b + (side == 0 ? -1 : 1) * sqrt(discriminant)) / a;
                float3 p = o + d * candidate;
                if (candidate > epsilon && candidate < t && abs(p.z) <= 1) {
                    t = candidate; n = float3(p.xy, 0);
                }
            }
        }
        if (abs(d.z) > 1e-8f) {
            for (int side = -1; side <= 1; side += 2) {
                float candidate = (float(side) - o.z) / d.z;
                float3 p = o + d * candidate;
                if (candidate > epsilon && candidate < t && dot(p.xy, p.xy) <= 1) {
                    t = candidate; n = float3(0, 0, side);
                }
            }
        }
    } else {
        float nearT = -1e20f, farT = 1e20f;
        float3 nearN(0), farN(0);
        bool valid = true;
        if (shape == 1) {
            valid = clipPlane(float3(1,0,0), 1, o,d,nearT,farT,nearN,farN)
                && clipPlane(float3(-1,0,0), 1, o,d,nearT,farT,nearN,farN)
                && clipPlane(float3(0,1,0), 1, o,d,nearT,farT,nearN,farN)
                && clipPlane(float3(0,-1,0), 1, o,d,nearT,farT,nearN,farN);
        } else {
            // Equilateral triangle in XY, extruded along Z.
            valid = clipPlane(float3(0,-1,0), 0.5f, o,d,nearT,farT,nearN,farN)
                && clipPlane(float3(0.8660254f,0.5f,0), 0.5f, o,d,nearT,farT,nearN,farN)
                && clipPlane(float3(-0.8660254f,0.5f,0), 0.5f, o,d,nearT,farT,nearN,farN);
        }
        valid = valid && clipPlane(float3(0,0,1), 1, o,d,nearT,farT,nearN,farN)
            && clipPlane(float3(0,0,-1), 1, o,d,nearT,farT,nearN,farN);
        if (valid && farT > epsilon) {
            bool outside = nearT > epsilon;
            t = outside ? nearT : farT; n = outside ? nearN : farN;
        }
    }
    return Hit { t, normalize(rotation * (n / object.dimensions.xyz)), index };
}

// three.js r187 RoomEnvironment (from model-viewer's EnvironmentScene), evaluated analytically from its
// origin: a white room lit by one point light, six grey boxes on the floor (entries 0–5) and six emissive
// wall and ceiling panels (entries 6–11).
// Values are three.js's, y-up, with the scene's -3.5 y offset applied.
struct RoomBox { float3 center; float3 extent; float yaw; float emission; };
constant float3 roomCenter = float3(-0.757f, 9.719f, 0.717f);
constant float3 roomHalf = float3(15.8565f, 14.1525f, 14.2955f);
constant float3 roomLamp = float3(0.418f, 12.699f, 0.300f);
constant RoomBox roomBoxes[12] = {
    { float3(-10.906f, -1.491f, 1.846f), float3(1.164f, 3.9525f, 2.3255f), -0.195f, 0 },
    { float3(-5.607f, -4.254f, -0.758f), float3(0.985f, 0.767f, 1.9775f), 0.994f, 0 },
    { float3(6.167f, -2.643f, 7.803f), float3(1.9635f, 3.1425f, 1.8435f), 0.561f, 0 },
    { float3(-2.017f, -3.482f, 6.124f), float3(1.001f, 2.283f, 1.032f), 0.333f, 0 },
    { float3(2.291f, -4.256f, -2.621f), float3(0.773f, 0.776f, 0.748f), -0.286f, 0 },
    { float3(-2.193f, -3.869f, -5.547f), float3(1.9375f, 1.7435f, 1.493f), 0.516f, 0 },
    { float3(-16.116f, 10.870f, 8.208f), float3(0.05f, 1.214f, 1.3695f), 0, 50 },
    { float3(-16.109f, 14.521f, -8.207f), float3(0.05f, 1.2125f, 1.3755f), 0, 50 },
    { float3(14.904f, 8.698f, -1.832f), float3(0.075f, 2.1325f, 3.1655f), 0, 17 },
    { float3(-0.462f, 5.390f, 14.520f), float3(2.19f, 2.7205f, 0.044f), 0, 43 },
    { float3(3.235f, 7.986f, -12.541f), float3(1.25f, 1.0f, 0.05f), 0, 20 },
    { float3(0.0f, 16.5f, 0.0f), float3(0.5f, 0.05f, 0.5f), 0, 100 },
};

// Slab test against a box centred at the origin; returns (entry, exit) distances and face normals.
float2 slab(float3 origin, float3 direction, float3 extent, thread float3 &entryNormal, thread float3 &exitNormal) {
    float3 safe = select(direction, copysign(float3(1e-6f), direction), abs(direction) < 1e-6f);
    float3 t0 = (-extent - origin) / safe, t1 = (extent - origin) / safe;
    float3 nearest = min(t0, t1), farthest = max(t0, t1);
    float entry = max(max(nearest.x, nearest.y), nearest.z), leave = min(min(farthest.x, farthest.y), farthest.z);
    int entryAxis = entry == nearest.x ? 0 : (entry == nearest.y ? 1 : 2);
    int leaveAxis = leave == farthest.x ? 0 : (leave == farthest.y ? 1 : 2);
    entryNormal = float3(0); entryNormal[entryAxis] = -sign(safe[entryAxis]);
    exitNormal = float3(0); exitNormal[leaveAxis] = sign(safe[leaveAxis]);
    return float2(entry, leave);
}

// Radiance seen from the room's origin; panel emission and wall light are scaled separately.
float3 roomEnvironment(float3 direction, float3 albedo, float wallScale, float panelScale) {
    float3 entryNormal, exitNormal;
    float nearest = slab(-roomCenter, direction, roomHalf, entryNormal, exitNormal).y;
    float wallDistance = nearest;
    float3 normal = -exitNormal;
    // The floor boxes stay below about 15° of elevation from the origin, so steeper lookups skip them.
    for (int i = 0; i < (direction.y < 0.26f ? 6 : 0); ++i) {
        float c = cos(roomBoxes[i].yaw), s = sin(roomBoxes[i].yaw);
        float3 origin = -roomBoxes[i].center;
        float3 localOrigin(origin.x * c - origin.z * s, origin.y, origin.x * s + origin.z * c);
        float3 localDirection(direction.x * c - direction.z * s, direction.y, direction.x * s + direction.z * c);
        float2 t = slab(localOrigin, localDirection, roomBoxes[i].extent, entryNormal, exitNormal);
        if (t.x > 0 && t.x <= t.y && t.x < nearest) {
            nearest = t.x;
            normal = float3(entryNormal.x * c + entryNormal.z * s, entryNormal.y, -entryNormal.x * s + entryNormal.z * c);
        }
    }
    // three.js physically based point light: inverse square with its smooth 28-unit cutoff, Lambertian walls.
    float3 toLamp = roomLamp - direction * nearest;
    float range = length(toLamp);
    float falloff = pow(saturate(1 - pow(range / 28.0f, 4.0f)), 2.0f) / max(range * range, 0.01f);
    float3 wall = albedo * (wallScale * 900.0f * falloff * max(0.0f, dot(normal, toLamp / range)) / 3.14159265f);
    // Wall panels as soft-edged rectangles: three.js blurs RoomEnvironment by 0.04 radians when it builds
    // its PMREM, so panel edges fade over the angle to the rectangle instead of cutting off.
    float coverage = 0, emission = 0;
    for (int i = 6; i < 12; ++i) {
        float3 extent = roomBoxes[i].extent, center = roomBoxes[i].center;
        int axis = extent.x < extent.y && extent.x < extent.z ? 0 : (extent.y < extent.z ? 1 : 2);
        if (abs(direction[axis]) < 1e-4f) continue;
        float t = center[axis] / direction[axis];
        if (t <= 0 || t > wallDistance + 1) continue;
        float3 offset = direction * t - center;
        float2 face = axis == 0 ? offset.yz : (axis == 1 ? offset.xz : offset.xy);
        float2 size = axis == 0 ? extent.yz : (axis == 1 ? extent.xz : extent.xy);
        float2 q = abs(face) - size;
        float outside = length(max(q, 0.0f)) + min(max(q.x, q.y), 0.0f);
        float share = 1 - smoothstep(-0.15f, 0.15f, outside / t);  // about ±3σ of that 0.04-radian Gaussian
        if (share * roomBoxes[i].emission > coverage * emission) { coverage = share; emission = roomBoxes[i].emission; }
    }
    return mix(wall, float3(emission * panelScale), coverage);
}

// Light and poster-colored studios: the room turned toward the key light, in three.js units.
float3 roomStudio(float3 direction, constant Uniforms &u) {
    // Turn the room so its two strongest wall panels sit toward the key light, matching the shadows.
    float turn = 3.14159265f - u.controls.z, c = cos(turn), s = sin(turn);
    float2 level(direction.x * c - direction.y * s, direction.x * s + direction.y * c);
    float3 roomDirection = normalize(float3(level.x, direction.z, -level.y));
    float3 albedo = float3(1);
    if (u.shading.x > 1.5f) {
        float3 tone = u.tone.rgb / max(0.001f, max(u.tone.r, max(u.tone.g, u.tone.b)));
        albedo = mix(tone, float3(1), 0.25f);
    }
    // Studio brightness 1 and Light intensity 1 match RoomEnvironment at exposure 1.
    return roomEnvironment(roomDirection, albedo, u.lighting.y, u.lighting.x);
}

// Equirectangular studio map: u is azimuth around the up axis, v the angle from straight up.
float3 equirectDirection(float2 uv) {
    float phi = (uv.x * 2 - 1) * M_PI_F, theta = uv.y * M_PI_F;
    return float3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
}
float2 equirectUV(float3 direction) {
    return float2(atan2(direction.y, direction.x) / (2 * M_PI_F) + 0.5f, acos(clamp(direction.z, -1.0f, 1.0f)) / M_PI_F);
}

// Bakes the room once per render, as three.js bakes RoomEnvironment into a PMREM, so the path tracer
// samples a texture instead of carrying the room's geometry (which slowed every path by about a third).
kernel void bakeStudio(constant Uniforms &u [[buffer(1)]], texture2d<float, access::write> map [[texture(0)]],
                       uint2 texel [[thread_position_in_grid]]) {
    if (texel.x >= map.get_width() || texel.y >= map.get_height()) return;
    float2 uv = (float2(texel) + 0.5f) / float2(map.get_width(), map.get_height());
    map.write(float4(roomStudio(equirectDirection(uv), u), 1), texel);
}

float3 studio(float3 direction, constant Uniforms &u, texture2d<float> room) {
    if (u.shading.x < 0.5f) {
        // Dark studio: the original softbox, rim light and dim room.
        float3 light = keyLight(u);
        float3 tangent = normalize(cross(light, float3(0,1,0)));
        float3 bitangent = cross(light, tangent);
        float facing = max(0.0f, dot(direction, light));
        float horizontal = dot(direction, tangent), vertical = dot(direction, bitangent);
        float key = exp(-pow(abs(horizontal) / 0.24f, 8.0f) - pow(abs(vertical) / 0.48f, 8.0f)) * pow(facing, 8.0f);
        float3 fill = normalize(float3(-light.x, -light.y, 0.35f));
        float rim = pow(max(0.0f, dot(direction, fill)), 55.0f);
        float dim = u.lighting.y * (0.05f + 0.3f * max(0.0f, direction.z));
        return float3(dim) + u.lighting.x * (float3(2.8f, 2.75f, 2.65f) * key + float3(0.55f,0.65f,0.8f) * rim);
    }
    return room.sample(studioSampler, equirectUV(direction)).rgb;
}

// Light reflected from the studio. In the light and poster-colored studios it is tone-mapped with three.js's
// NeutralToneMapping, as three.js displays RoomEnvironment, so walls read as soft greys and panels as
// highlights. The poster's own pixels are never tone-mapped.
float3 studioLight(float3 color, constant Uniforms &u) {
    if (u.shading.x < 0.5f) return color;
    const float startCompression = 0.8f - 0.04f, desaturation = 0.15f;
    float x = min(color.r, min(color.g, color.b));
    float offset = x < 0.08f ? x - 6.25f * x * x : 0.04f;
    color -= offset;
    float peak = max(color.r, max(color.g, color.b));
    if (peak < startCompression) return color;
    float d = 1 - startCompression;
    float newPeak = 1 - d * d / (peak + d - startCompression);
    color *= newPeak / peak;
    float g = 1 - 1 / (desaturation * (peak - newPeak) + 1);
    return mix(color, float3(newPeak), g);
}

// Paper brightness from the shadow map: 1 in full light, lower where glass blocks the key light.
float3 paperLight(float2 spot, texture2d<float> shadow, constant Uniforms &u) {
    if (u.shading.y <= 0) return float3(1);
    float2 uv(spot.x + 0.5f, 0.5f - spot.y / u.viewport.y);
    float2 mapUV = (uv + u.shading.w) / (1 + 2 * u.shading.w);
    return 1 - u.shading.y * (1 - shadow.sample(shadowSampler, mapUV).rgb);
}

int medium(uint mask, int count) {
    for (int i = count - 1; i >= 0; --i) if ((mask & (1u << i)) != 0) return i;
    return -1;
}
float refractiveIndex(constant GlassObject *objects, int index, int channel) {
    if (index < 0) return 1;
    if (objects[index].optical.w > 0.5f) return objects[index].dimensions.w;
    return objects[index].dimensions.w + objects[index].optical.y * float(channel - 1);
}

float3 posterColor(texture2d<float> poster, float2 uv, constant Uniforms &u) {
    return poster.sample(posterSampler, uv, level(u.lighting.z)).rgb;
}

// A path waiting to be traced after the current one: the reflected part of a strong internal reflection.
struct Branch { float3 origin; float3 direction; float3 throughput; uint inside; int bounce; bool simplePath; };

// `target` is the pixel's own point on the paper, where an unobstructed camera ray lands.
// `touched` turns true when the path meets glass or lands on paper in a glass shadow, so the pixel differs
// from the plain poster there. Strong reflections inside the glass (or down toward the paper) split the path: the reflected part waits
// on a small stack and is traced after the transmitted part, so both are followed without sampling noise.
float3 trace(float3 origin, float3 direction, float2 target, int channel, thread uint &rng,
             texture2d<float> poster, texture2d<float> shadow, texture2d<float> room,
             constant GlassObject *objects, constant Uniforms &u, thread bool &touched) {
    float3 radiance(0), lit(0);  // light from the studio (tone-mapped later) and from the paper (never tone-mapped)
    float2 originalUV(target.x + 0.5f, 0.5f - target.y / u.viewport.y);
    int count = int(u.controls.x);
    Branch pending[2];
    // At most two split-off paths per sample: each branch could otherwise split again, and mirror-like
    // geometry would multiply the work until the GPU watchdog stops the render.
    int waiting = 0, splits = 0;
    Branch path = { origin, direction, float3(1), 0, 0, false };
    while (true) {
        bool ended = false;
        for (; path.bounce < 32; ++path.bounce) {
            Hit nearest = { 1e20f, float3(0), -1 };
            for (int i = 0; i < count; ++i) {
                Hit hit = intersect(path.origin, path.direction, objects[i], i);
                if (hit.t < nearest.t) nearest = hit;
            }
            float planeT = path.direction.z < -1e-7f ? -path.origin.z / path.direction.z : 1e20f;
            if (planeT > 0 && planeT < nearest.t) {
                float3 p = path.origin + path.direction * planeT;
                float2 uv(p.x + 0.5f, 0.5f - p.y / u.viewport.y);
                float3 ink = path.simplePath || (all(uv >= 0) && all(uv <= 1)) ? posterColor(poster, uv, u) : float3(1);
                float3 light = paperLight(p.xy, shadow, u);
                touched |= any(light < 0.999f);
                lit += path.throughput * ink * light;
                ended = true; break;
            }
            if (nearest.object < 0) {
                if (path.simplePath) lit += path.throughput * (posterColor(poster, originalUV, u) * paperLight(target, shadow, u));
                else radiance += path.throughput * studio(path.direction, u, room);
                ended = true; break;
            }
            touched = true;
            int previous = medium(path.inside, count);
            if (previous >= 0 && objects[previous].optical.w < 0.5f) {
                float3 transmittance = max(objects[previous].tint.rgb, float3(0.005f));
                path.throughput *= exp(log(transmittance) * objects[previous].optical.z * nearest.t * 6.0f);
            }
            float3 p = path.origin + path.direction * nearest.t;
            bool entering = dot(path.direction, nearest.normal) < 0;
            uint nextInside = entering ? (path.inside | (1u << nearest.object)) : (path.inside & ~(1u << nearest.object));
            int next = medium(nextInside, count);
            if (previous == next) { path.inside = nextInside; path.origin = p + path.direction * epsilon * 4; continue; }
            bool simple = objects[nearest.object].optical.w > 0.5f;
            path.simplePath |= simple;
            float etaI = refractiveIndex(objects, previous, channel), etaT = refractiveIndex(objects, next, channel);
            float3 geometric = entering ? nearest.normal : -nearest.normal;
            float3 n = simple ? geometric : microfacet(geometric, objects[nearest.object].optical.x, rng);
            if (dot(n, path.direction) >= -0.0001f) n = geometric;
            float reflection = simple ? 0.0f : fresnel(clamp(-dot(n, path.direction), 0.0f, 1.0f), etaI, etaT);
            float3 transmitted = refract(path.direction, n, etaI / etaT), mirrored = reflect(path.direction, n);
            if (dot(transmitted, transmitted) < 1e-8f) {
                path.direction = mirrored;
            } else if (!simple && (previous >= 0 || mirrored.z < 0)) {
                // Reflections inside the glass, or down toward the paper, show the poster, not the studio.
                float3 reflected = path.throughput * reflection;
                // Rough surfaces blur internal reflections into the transmitted light, so only smooth glass splits.
                bool smooth = objects[nearest.object].optical.x < 0.1f;
                if (smooth && reflection >= 0.12f && waiting < 2 && splits < 2 && max(reflected.r, max(reflected.g, reflected.b)) > 0.01f) {
                    pending[waiting++] = Branch { p + mirrored * epsilon * 4, mirrored, reflected, path.inside, path.bounce + 1, path.simplePath };
                    splits += 1;
                    path.throughput *= 1 - reflection;
                } else if (reflection >= 0.12f) {
                    path.throughput *= 1 - reflection;
                }
                // Weaker reflections stay with the transmitted light, which shows nearly the same poster.
                path.direction = normalize(transmitted);
                path.inside = nextInside;
            } else {
                // Reflections back up into the studio are added directly, so highlights stay free of sampling noise.
                // Skipped when nothing reflects (simple refraction), so the studio never affects those paths.
                if (reflection > 0) radiance += path.throughput * reflection * studio(mirrored, u, room);
                path.throughput *= 1 - reflection;
                path.direction = normalize(transmitted);
                path.inside = nextInside;
            }
            path.origin = p + path.direction * epsilon * 4;
            if (max(path.throughput.r, max(path.throughput.g, path.throughput.b)) < 0.0002f) break;
        }
        if (!ended && path.simplePath) lit += path.throughput * posterColor(poster, originalUV, u) * paperLight(target, shadow, u);
        if (waiting == 0) break;
        path = pending[--waiting];
    }
    return studioLight(radiance, u) + lit;
}

// Transmittance of the straight path from the paper toward the key light through physical glass.
// Rays are not bent, so glass casts a transparent, tinted shadow with darker edges and never focuses
// light into caustics: the paper only darkens. Grazing faces and total internal reflection block light.
float3 shadowRay(float3 origin, float3 direction, constant GlassObject *objects, int count) {
    float3 transmittance(1);
    uint inside = 0;
    for (int crossing = 0; crossing < 16; ++crossing) {
        Hit nearest = { 1e20f, float3(0), -1 };
        for (int i = 0; i < count; ++i) {
            if (objects[i].optical.w > 0.5f) continue;  // simple refraction casts no shadow
            Hit hit = intersect(origin, direction, objects[i], i);
            if (hit.t < nearest.t) nearest = hit;
        }
        if (nearest.object < 0) break;
        int previous = medium(inside, count);
        if (previous >= 0) {
            float3 tint = max(objects[previous].tint.rgb, float3(0.005f));
            transmittance *= exp(log(tint) * objects[previous].optical.z * nearest.t * 6.0f);
        }
        bool entering = dot(direction, nearest.normal) < 0;
        uint nextInside = entering ? (inside | (1u << nearest.object)) : (inside & ~(1u << nearest.object));
        int next = medium(nextInside, count);
        if (previous != next) {
            float3 n = entering ? nearest.normal : -nearest.normal;
            float cosine = clamp(-dot(n, direction), 0.0f, 1.0f);
            transmittance *= 1 - fresnel(cosine, refractiveIndex(objects, previous, 1), refractiveIndex(objects, next, 1));
        }
        inside = nextInside;
        origin += direction * (nearest.t + epsilon * 4);
        if (max(transmittance.r, max(transmittance.g, transmittance.b)) < 0.001f) break;
    }
    return transmittance;
}

// Shadow map: average shadow-ray transmittance across each cell and across the key light's cone.
// Cells whose rays meet no glass are exactly 1, so paper away from the glass is untouched.
kernel void castShadows(constant GlassObject *objects [[buffer(0)]], constant Uniforms &u [[buffer(1)]],
                        texture2d<float, access::write> shadow [[texture(0)]], uint2 gridPosition [[thread_position_in_grid]]) {
    // Interleaved rows of cells, like the camera passes, so every pass costs about the same.
    uint2 cell(gridPosition.x, (gridPosition.y % u.tile.w) * u.tile.z + u.tile.x + gridPosition.y / u.tile.w);
    if (cell.x >= uint(u.shadowMap.x) || cell.y >= uint(u.shadowMap.y)) return;
    uint rng = hash(cell.x ^ hash(cell.y + 0x9e3779b9u)) | 1u;
    int count = int(u.controls.x), side = int(u.shadowMap.z);
    float3 key = keyLight(u);
    float3 tangent = normalize(cross(abs(key.z) < 0.99f ? float3(0, 0, 1) : float3(0, 1, 0), key));
    float3 bitangent = cross(key, tangent);
    float3 sum(0);
    for (int ray = 0; ray < side * side; ++ray) {
        float2 mapUV = (float2(cell) + float2(random(rng), random(rng))) / u.shadowMap.xy;
        float2 uv = mapUV * (1 + 2 * u.shading.w) - u.shading.w;
        float3 paper(uv.x - 0.5f, (0.5f - uv.y) * u.viewport.y, 0);
        float cosine = 1 - random(rng) * (1 - cos(u.shading.z));
        float sine = sqrt(max(0.0f, 1 - cosine * cosine)), phi = 6.2831853f * random(rng);
        float3 toLight = normalize(key * cosine + (tangent * cos(phi) + bitangent * sin(phi)) * sine);
        sum += toLight.z > 0 ? shadowRay(paper, toLight, objects, count) : float3(1);
    }
    shadow.write(float4(sum / float(side * side), 1), cell);
}

// 3×3 binomial blur that hides the sampling noise along soft shadow edges.
kernel void blurShadows(texture2d<float, access::read> raw [[texture(0)]], texture2d<float, access::write> shadow [[texture(1)]],
                        uint2 cell [[thread_position_in_grid]]) {
    int columns = int(raw.get_width()), rows = int(raw.get_height());
    if (int(cell.x) >= columns || int(cell.y) >= rows) return;
    const float taps[3] = { 1, 2, 1 };
    float3 sum(0);
    for (int dy = -1; dy <= 1; ++dy) {
        for (int dx = -1; dx <= 1; ++dx) {
            uint2 neighbour(clamp(int(cell.x) + dx, 0, columns - 1), clamp(int(cell.y) + dy, 0, rows - 1));
            sum += taps[dx + 1] * taps[dy + 1] * raw.read(neighbour).rgb;
        }
    }
    shadow.write(float4(sum / 16, 1), cell);
}

float3 toSRGB(float3 value) {
    value = clamp(value, 0.0f, 1.0f);
    return select(1.055f * pow(value, float3(1.0f / 2.4f)) - 0.055f, value * 12.92f, value <= 0.0031308f);
}

kernel void renderGlass(texture2d<float, access::sample> poster [[texture(0)]],
                        texture2d<float, access::write> output [[texture(1)]],
                        texture2d<float, access::sample> shadow [[texture(2)]],
                        texture2d<float, access::sample> room [[texture(3)]],
                        constant GlassObject *objects [[buffer(0)]],
                        constant Uniforms &u [[buffer(1)]], uint2 gridPosition [[thread_position_in_grid]]) {
    uint2 pixel(gridPosition.x, (gridPosition.y % u.tile.w) * u.tile.z + u.tile.x + gridPosition.y / u.tile.w);
    if (pixel.x >= output.get_width() || pixel.y >= output.get_height()) return;
    float2 uv = (float2(pixel) + 0.5f) / u.viewport.zw;
    // With shadowMap.w set, alpha carries the share of samples that met glass or its shadow (0 = plain poster).
    bool coverage = u.shadowMap.w > 0;
    if (u.controls.x == 0) { output.write(float4(toSRGB(posterColor(poster, uv, u)), coverage ? 0 : 1), pixel); return; }
    uint pixelSeed = hash(pixel.x ^ hash(pixel.y + 0x5bd1e995u));
    // R2 low-discrepancy sub-pixel positions, offset per pixel, cover each pixel evenly with few samples.
    float2 offset = float2(float(pixelSeed & 0xffffu), float(pixelSeed >> 16)) / 65536.0f;
    float3 sum(0);
    int samples = int(u.controls.y), touchedSamples = 0;
    bool dispersion = false;
    for (int i = 0; i < int(u.controls.x); ++i) dispersion |= objects[i].optical.y > 0 && objects[i].optical.w < 0.5f;
    for (int sample = 0; sample < samples; ++sample) {
        float2 jitter = samples == 1 ? float2(0.5f) : fract(offset + float(sample) * float2(0.7548776662f, 0.5698402910f));
        float2 coordinate = (float2(pixel) + jitter) / u.viewport.zw;
        float2 target(coordinate.x - 0.5f, (0.5f - coordinate.y) * u.viewport.y);
        // Straight down, or from a camera above the poster's centre aimed so the paper maps 1:1 to pixels.
        float height = u.lighting.w;
        float3 origin = height > 0 ? float3(0, 0, height) : float3(target, 8.0f);
        float3 direction = height > 0 ? normalize(float3(target, 0) - origin) : float3(0, 0, -1);
        uint seed = hash(pixelSeed + uint(sample) * 0x9e3779b9u) | 1u;
        bool touched = false;
        if (dispersion) {
            // Shared random stream per wavelength reduces color noise on rough glass.
            float3 color;
            for (int channel = 0; channel < 3; ++channel) {
                uint channelRNG = seed;
                color[channel] = trace(origin, direction, target, channel, channelRNG, poster, shadow, room, objects, u, touched)[channel];
            }
            sum += color;
        } else sum += trace(origin, direction, target, 1, seed, poster, shadow, room, objects, u, touched);
        touchedSamples += touched ? 1 : 0;
    }
    output.write(float4(toSRGB(sum / float(samples)), coverage ? float(touchedSamples) / float(samples) : 1), pixel);
}
