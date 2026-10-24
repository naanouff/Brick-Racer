/**
 * Hybrid primary AOVs: one raw sample per traced pixel. HybridTemporal accumulates.
 * `hybridShadowOut`: r = sun visibility (luminance of transmittance), g = camera distance of the
 * primary hit (0 = miss), b = VNDF weight of the reflection sample, a = 1.
 * Shadows off keeps r = 1.
 * `hybridReflOut`: rgb = linear incoming radiance weighted by G2/G1 (no Fresnel; the raster
 * applies FssEss), a = distance to the first reflection hit (0 = no reflection sample).
 * `hybridGiOut`: rgb = linear cosine-weighted incoming radiance (demodulated), a = 1 if sampled.
 * Bindings match `path_trace.compute.wgsl` so `path_trace_common.wgsl` compiles unchanged.
 * Roughness ceiling: `pathTracerTileInfo[14]` as f32 bits, 0 = 0.5.
 */

struct FrameUniforms {
    projectionMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
    inverseViewProjectionMatrix: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    lightMatrix: mat4x4<f32>,
    lightDirection: vec3<f32>,
    lightColor: vec3<f32>,
    ambientLightIntensity: f32,
    debugViewMode: u32,
    totalTime: f32,
    _padding1: f32,
    cascadeSplits: vec4<f32>,
}

struct LightData {
    positionAndRange: vec4<f32>,
    dirAndIntensity: vec4<f32>,
    colorAndType: vec4<f32>,
    params: vec4<f32>,
    tangentAndShape: vec4<f32>,
}

struct LightBuffer {
    ambientColor: vec4<f32>,
    lightCount: u32,
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
    lights: array<LightData>,
}

struct BvhNode {
    bmin: vec3<f32>,
    left: u32,
    bmax: vec3<f32>,
    right: u32,
}

struct PathTracerInstance {
    worldFromObject: mat4x4<f32>,
    objectFromWorld: mat4x4<f32>,
    triBase: u32,
    triCount: u32,
    blasRoot: u32,
    _pad: u32,
}

struct PathTracerMaterial {
    header: vec4<f32>,
    specular: vec4<f32>,
    transmission: vec4<f32>,
    attenuation: vec4<f32>,
    extra: vec4<f32>,
}

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var<storage, read> sceneLights: LightBuffer;

@group(1) @binding(1) var<storage, read> triangles: array<f32>;
@group(1) @binding(2) var<storage, read> pathTracerParams: array<u32>;
@group(1) @binding(3) var hybridShadowOut: texture_storage_2d<rgba16float, write>;
@group(1) @binding(4) var hybridShadowPrev: texture_2d<f32>;
@group(1) @binding(5) var hybridReflOut: texture_storage_2d<rgba16float, write>;
@group(1) @binding(6) var<storage, read> pathTracerEnv: array<f32>;
@group(1) @binding(7) var<storage, read> pathTracerTexSlotFlags: array<u32>;

@group(1) @binding(8) var tAlbedo: texture_2d_array<f32>;
@group(1) @binding(9) var tOrm: texture_2d_array<f32>;
@group(1) @binding(10) var tNormal: texture_2d_array<f32>;
@group(1) @binding(11) var tEmissive: texture_2d_array<f32>;

@group(1) @binding(52) var<storage, read> pathTracerMatFactors: array<f32, 32>;
@group(1) @binding(53) var<storage, read> pathTracerInstances: array<PathTracerInstance>;
@group(1) @binding(54) var<storage, read> pathTracerBvhNodes: array<BvhNode>;
@group(1) @binding(56) var pathTracerSampler: sampler;
@group(1) @binding(57) var<storage, read> pathTracerTileInfo: array<u32>;
@group(1) @binding(58) var envCubemap: texture_cube<f32>;
@group(1) @binding(61) var<storage, read> pathTracerMaterials: array<PathTracerMaterial>;
@group(1) @binding(66) var hybridReflPrev: texture_2d<f32>;
@group(1) @binding(67) var hybridGiOut: texture_storage_2d<rgba16float, write>;
@group(1) @binding(68) var hybridGiPrev: texture_2d<f32>;
@group(1) @binding(69) var hybridLightVisOut: texture_storage_2d<rgba16float, write>;
@group(1) @binding(70) var hybridLightVisPrev: texture_2d<f32>;
@group(1) @binding(71) var<storage, read> hybridHistory: HybridHistoryParams;
@group(1) @binding(72) var hybridGDist: texture_2d<f32>;
@group(1) @binding(73) var hybridGNormal: texture_2d<f32>;
struct EmissiveEntry {
    tri: u32,
    inst: u32,
    cdf: f32,
    area: f32,
}
struct EmissiveCatalog {
    count: u32,
    total_power: f32,
    _pad0: u32,
    _pad1: u32,
    entries: array<EmissiveEntry>,
}
@group(1) @binding(74) var<storage, read> pathTracerEmissive: EmissiveCatalog;

const FLOATS_PER_TRIANGLE = 57u;
const MAX_MAT_TEX_SLOTS = 32u;
const TEX_FLAG_ORM_UV1 = 32u;
const PI = 3.14159265359;
const AO_RAYS = 8u;
const AO_RADIUS = 0.8;
const MAT_SLOT_NONE = 255u;
const BVH_TRI_LEAF_BIT = 0x80000000u;
const BVH_INSTANCE_LEAF = 0xfffffffeu;
const FLAG_USE_BVH = 1u;
const FLAG_ENV_CUBEMAP = 2u;
const FLAG_SOFT_SUN = 4u;
const FLAG_USE_TLAS = 128u;
/** Same index as TILE_INFO_HYBRID_REFL_ROUGH. */
const TILE_HYBRID_REFL_ROUGH = 14u;
const TILE_HYBRID_CLAMP = 15u;
const HYBRID_REFL_ROUGH_DEFAULT = 0.5;
const HYBRID_CLAMP_DEFAULT = 20.0;
const HYBRID_REFL_BOUNCES = 3u;

var<private> hit_instance_index: u32 = 0u;

/** Traversal, BSDF and environment helpers. Bindings above stay in this file. */
#include "path_trace_common.wgsl"

struct HybridHistoryParams {
    viewProj: mat4x4<f32>,
    invViewProj: mat4x4<f32>,
    prevViewProj: mat4x4<f32>,
    prevInvViewProj: mat4x4<f32>,
    cameraPos: vec4<f32>,
    prevCameraPos: vec4<f32>,
    frameIndex: u32,
    historyReset: u32,
    resX: u32,
    resY: u32,
    traceX: u32,
    traceY: u32,
    traceScale: f32,
    offsetX: f32,
    offsetY: f32,
    sigmaZ: f32,
    sigmaN: f32,
    sigmaL: f32,
    alphaMin: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
};

struct HitShade {
    hit: bool,
    pos: vec3<f32>,
    N: vec3<f32>,
    V: vec3<f32>,
    baseColor: vec3<f32>,
    emissive: vec3<f32>,
    metallic: f32,
    roughness: f32,
    F0: vec3<f32>,
    dist: f32,
}

fn luma(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn miss_radiance(rd: vec3<f32>, pathEnv: u32, featureFlags: u32, envIblIntensity: f32) -> vec3<f32> {
    let dir = normalize(rd);
    if (pathEnv < env_layer_count()) {
        return env_equirect(pathEnv, dir) + softbox_emission(pathEnv, dir);
    }
    if ((featureFlags & FLAG_ENV_CUBEMAP) != 0u) {
        return env_sample(dir, envIblIntensity);
    }
    return sky_color(dir);
}

fn orient_hit(
    hitTri: u32,
    bu: f32,
    bv: f32,
    rd: vec3<f32>,
    useTlas: bool,
) -> vec3<f32> {
    let norms = get_triangle_normals(hitTri);
    let bw = 1.0 - bu - bv;
    var n = normalize(norms[0] * bw + norms[1] * bu + norms[2] * bv);
    if (useTlas) {
        n = transform_normal_object_to_world(pathTracerInstances[hit_instance_index].objectFromWorld, n);
    }
    if (dot(n, rd) > 0.0) { n = -n; }
    return n;
}

fn shade_triangle(
    hitTri: u32,
    bu: f32,
    bv: f32,
    rd: vec3<f32>,
    dist: f32,
    ro: vec3<f32>,
    useTlas: bool,
) -> HitShade {
    var s: HitShade;
    s.hit = true;
    s.dist = dist;
    s.pos = ro + rd * dist;
    let hitMat = pathTracerMaterials[get_triangle_material_index(hitTri)];
    let matSlot = material_tex_slot(hitMat);
    let uvs = get_triangle_uvs(hitTri);
    let uvs1 = get_triangle_uvs1(hitTri);
    let tangs = get_triangle_tangents(hitTri);
    let bitans = get_triangle_bitangents(hitTri);
    let bw = 1.0 - bu - bv;
    var hitN = orient_hit(hitTri, bu, bv, rd, useTlas);
    var hitTan = tangs[0] * bw + tangs[1] * bu + tangs[2] * bv;
    var hitBin = bitans[0] * bw + bitans[1] * bu + bitans[2] * bv;
    if (useTlas) {
        let inst = pathTracerInstances[hit_instance_index];
        hitTan = normalize(transform_dir_mat4(inst.worldFromObject, hitTan));
        hitBin = normalize(transform_dir_mat4(inst.worldFromObject, hitBin));
    }
    s.N = build_shading_normal(matSlot, bu, bv, uvs, hitN, hitTan, hitBin);
    if (dot(s.N, rd) > 0.0) { s.N = -s.N; }
    let met0 = get_triangle_metallic(hitTri);
    let rough0 = get_triangle_roughness(hitTri);
    let mr = eval_surface_scalar(matSlot, bu, bv, uvs, uvs1, met0, rough0);
    s.metallic = mr.x;
    s.roughness = mr.y;
    s.baseColor = eval_surface_albedo(matSlot, bu, bv, uvs, get_triangle_base_color(hitTri));
    s.emissive = eval_surface_emissive(matSlot, bu, bv, uvs, get_triangle_emissive(hitTri));
    s.V = normalize(-rd);
    s.F0 = pbr_f0(s.baseColor, s.metallic, dielectric_f0_specular_ext(hitMat));
    return s;
}

fn sign_not_zero(v: f32) -> f32 {
    return select(-1.0, 1.0, v >= 0.0);
}

fn decode_oct(encoded: vec2<f32>) -> vec3<f32> {
    let z = 1.0 - abs(encoded.x) - abs(encoded.y);
    var xy = encoded;
    if (z < 0.0) {
        xy = vec2<f32>(
            (1.0 - abs(encoded.y)) * sign_not_zero(encoded.x),
            (1.0 - abs(encoded.x)) * sign_not_zero(encoded.y)
        );
    }
    return normalize(vec3<f32>(xy, z));
}

fn shade_gbuffer(pixel: vec2<i32>, rd: vec3<f32>) -> HitShade {
    var s: HitShade;
    let dist = textureLoad(hybridGDist, pixel, 0).r;
    if (dist <= 1e-4) {
        s.hit = false;
        return s;
    }
    let packed = textureLoad(hybridGNormal, pixel, 0);
    s.hit = true;
    s.dist = dist;
    s.N = decode_oct(packed.xy);
    if (dot(s.N, rd) > 0.0) { s.N = -s.N; }
    s.pos = frame.cameraPosition + rd * dist;
    s.roughness = max(packed.z, 0.04);
    s.metallic = packed.w;
    s.baseColor = vec3<f32>(0.5);
    s.emissive = vec3<f32>(0.0);
    s.V = normalize(-rd);
    s.F0 = vec3<f32>(0.04);
    return s;
}

/**
 * The G-buffer has no material. One primary ray recovers it; the G-buffer stays the
 * reference surface, and a ray that lands elsewhere keeps the geometric fallback.
 */
fn shade_primary(
    pixel: vec2<i32>,
    rd: vec3<f32>,
    count: u32,
    useBvh: bool,
    useTlas: bool,
    root: u32,
    nodeCount: u32,
) -> HitShade {
    let g = shade_gbuffer(pixel, rd);
    if (!g.hit) { return g; }
    let ro = frame.cameraPosition;
    let h = trace_closest_scene(ro, rd, count, useBvh, useTlas, root, nodeCount);
    if (h.x > 0.0 && h.x < 1e9 && abs(h.x - g.dist) <= 0.02 * max(g.dist, 1.0)) {
        return shade_triangle(u32(h.w), h.y, h.z, rd, h.x, ro, useTlas);
    }
    return g;
}

/** Smith GGX Lambda for a direction at cosine `c` to the normal. */
fn smith_lambda(c: f32, alpha: f32) -> f32 {
    let c2 = max(c * c, 1e-8);
    return 0.5 * (-1.0 + sqrt(1.0 + alpha * alpha * (1.0 - c2) / c2));
}

/**
 * Visible-normal GGX reflection (Heitz 2018).
 * xyz = L, w = sample weight G2(V,L) / G1(V), without Fresnel: the raster applies the
 * split-sum DFG term. A sample below the horizon returns weight 0 and still counts as one spp.
 */
fn sample_vndf_reflect(N: vec3<f32>, V: vec3<f32>, roughness: f32, pixel: vec2<u32>, seed: u32) -> vec4<f32> {
    let alpha = max(roughness * roughness, 1e-3);
    if (roughness * roughness < 1e-3) {
        return vec4<f32>(reflect(-V, N), 1.0);
    }
    let basis = build_orthonormal_basis(N);
    let Vt = vec3<f32>(dot(basis[0], V), dot(basis[1], V), dot(basis[2], V));
    let Vh = normalize(vec3<f32>(alpha * Vt.x, alpha * Vt.y, max(Vt.z, 1e-4)));
    let lensq = Vh.x * Vh.x + Vh.y * Vh.y;
    let T1 = select(
        vec3<f32>(1.0, 0.0, 0.0),
        vec3<f32>(-Vh.y, Vh.x, 0.0) / sqrt(lensq),
        lensq > 1e-6
    );
    let T2 = cross(Vh, T1);
    let r = rand2(pixel, seed);
    let r1 = sqrt(r.x);
    let phi = 2.0 * PI * r.y;
    let t1 = r1 * cos(phi);
    var t2 = r1 * sin(phi);
    let s = 0.5 * (1.0 + Vh.z);
    t2 = (1.0 - s) * sqrt(max(0.0, 1.0 - t1 * t1)) + s * t2;
    let nhz = sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2));
    let Nh = t1 * T1 + t2 * T2 + nhz * Vh;
    let H = normalize(basis * vec3<f32>(alpha * Nh.x, alpha * Nh.y, max(Nh.z, 0.0)));
    let L = reflect(-V, H);
    let NdotL = dot(L, N);
    if (NdotL <= 0.0) {
        return vec4<f32>(L, 0.0);
    }
    let lambdaV = smith_lambda(max(dot(N, V), 1e-4), alpha);
    let lambdaL = smith_lambda(NdotL, alpha);
    return vec4<f32>(L, (1.0 + lambdaV) / (1.0 + lambdaV + lambdaL));
}

/**
 * End-of-path ambient term: albedo * (1 - metal) * E_amb(N), E_amb = cubemap at its last mip
 * (irradiance approximation). Only the last vertex of a path adds it.
 */
fn ambient_end(s: HitShade, featureFlags: u32, envIblIntensity: f32) -> vec3<f32> {
    if ((featureFlags & FLAG_ENV_CUBEMAP) == 0u) {
        return vec3<f32>(0.0);
    }
    let lod = f32(textureNumLevels(envCubemap) - 1u);
    let e = textureSampleLevel(envCubemap, pathTracerSampler, s.N, lod).rgb * envIblIntensity;
    return e * s.baseColor * (1.0 - s.metallic);
}

struct PunctualEval {
    dir: vec3<f32>,
    radiance: vec3<f32>,
    lightT: f32,
    valid: u32,
}

// Directional, point and spot. Attenuation matches getPointLightAttenuation / getSpotLightAttenuation.
fn eval_punctual_light(
    li: u32,
    pos: vec3<f32>,
    pixel: vec2<u32>,
    frameIdx: u32,
    sunAngular: f32,
    softSun: bool,
    jitterRadius: f32,
) -> PunctualEval {
    let rawLight = sceneLights.lights[li];
    let lightType = u32(rawLight.colorAndType.w + 0.1);
    var out: PunctualEval;
    out.valid = 0u;
    if (lightType > 2u) { return out; }
    var L = vec3<f32>(0.0, 1.0, 0.0);
    var radiance = rawLight.colorAndType.rgb * rawLight.dirAndIntensity.w;
    var lightT = 1e10;
    if (lightType == 0u) {
        L = normalize(-rawLight.dirAndIntensity.xyz);
        if (softSun && sunAngular > 0.0) {
            L = sample_cone_around(L, sunAngular, pixel, frameIdx * 401u + li);
        }
    } else {
        var lightPos = rawLight.positionAndRange.xyz;
        if (jitterRadius > 0.0) {
            let axis = normalize(lightPos - pos);
            let r = rand2(pixel, frameIdx * 17u + li * 13u);
            let ang = r.x * 6.2831853;
            let rad = sqrt(r.y) * jitterRadius;
            let up = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(axis.y) > 0.9);
            let tng = normalize(cross(up, axis));
            lightPos += (tng * cos(ang) + cross(axis, tng) * sin(ang)) * rad;
        }
        let offset = lightPos - pos;
        let dist = length(offset);
        if (dist < 1e-4) { return out; }
        L = offset / dist;
        let d = max(dist, 1e-4);
        var att = 1.0 / (d * d);
        let range = rawLight.positionAndRange.w;
        if (range > 0.0) {
            let ratio = d / range;
            att *= max(min(1.0 - ratio * ratio * ratio * ratio, 1.0), 0.0);
        }
        if (att <= 0.0) { return out; }
        if (lightType == 2u) {
            let actualCos = dot(normalize(rawLight.dirAndIntensity.xyz), -L);
            let innerCos = rawLight.params.x;
            let outerCos = rawLight.params.y;
            if (actualCos <= outerCos) { return out; }
            if (actualCos < innerCos) {
                let ang = (actualCos - outerCos) / max(innerCos - outerCos, 1e-4);
                att *= ang * ang;
            }
        }
        radiance *= att;
        lightT = dist - 0.004;
    }
    out.dir = L;
    out.radiance = radiance;
    out.lightT = lightT;
    out.valid = 1u;
    return out;
}

// Rank among shadow-casting point and spot lights of lower index. -1 when this light is not one.
fn punctual_shadow_slot(li: u32) -> i32 {
    let rawLight = sceneLights.lights[li];
    let lightType = u32(rawLight.colorAndType.w + 0.1);
    if ((lightType != 1u && lightType != 2u) || rawLight.params.z <= -0.5) { return -1; }
    var slot = 0;
    for (var j = 0u; j < li; j++) {
        let earlier = sceneLights.lights[j];
        let earlierType = u32(earlier.colorAndType.w + 0.1);
        if ((earlierType == 1u || earlierType == 2u) && earlier.params.z > -0.5) {
            slot += 1;
        }
    }
    return slot;
}

fn punctual_visibility(
    origin: vec3<f32>,
    N: vec3<f32>,
    pixel: vec2<u32>,
    frameIdx: u32,
    count: u32,
    useBvh: bool,
    useTlas: bool,
    root: u32,
    nodeCount: u32,
    sceneFlags: u32,
    sunAngular: f32,
    softSun: bool,
    lightRadius: f32,
) -> vec3<f32> {
    var vis = vec3<f32>(1.0);
    let lightCount = min(sceneLights.lightCount, 8u);
    for (var li = 0u; li < lightCount; li++) {
        let slot = punctual_shadow_slot(li);
        if (slot < 0 || slot > 2) { continue; }
        let lit = eval_punctual_light(li, origin, pixel, frameIdx, sunAngular, softSun, lightRadius);
        let slotU = u32(slot);
        if (lit.valid == 0u || dot(N, lit.dir) <= 0.0) {
            vis[slotU] = 0.0;
            continue;
        }
        let shadowOrigin = origin + N * surface_bias(length(origin));
        vis[slotU] = luma(shadow_transmittance(
            shadowOrigin, lit.dir, count, useBvh, useTlas, root, nodeCount, sceneFlags, lit.lightT
        ));
    }
    return vis;
}

fn direct_at_hit(
    s: HitShade,
    pixel: vec2<u32>,
    frameIdx: u32,
    count: u32,
    useBvh: bool,
    useTlas: bool,
    root: u32,
    nodeCount: u32,
    sceneFlags: u32,
    shadowsOn: bool,
    sunAngular: f32,
    softSun: bool,
    pathEnv: u32,
    featureFlags: u32,
    envIblIntensity: f32,
    clampY: f32,
    emitWeight: f32,
) -> vec3<f32> {
    var Lo = s.emissive * emitWeight;
    let origin = s.pos + s.N * surface_bias(length(s.pos));
    let safeRough = max(s.roughness, 0.04);
    let specProb = clamp(
        0.06 + s.metallic * 0.55 + (1.0 - safeRough) * 0.3 * (1.0 - s.metallic * 0.5),
        0.05,
        0.9
    );
    let eu = rand2(pixel, frameIdx * 19u + 4u);
    let ev = rand2(pixel, frameIdx * 19u + 5u);
    Lo += emissive_nee(
        s.pos, s.N, s.V, s.F0, s.baseColor, s.metallic, safeRough, specProb,
        vec3<f32>(eu.x, eu.y, ev.x), origin, count, useBvh, useTlas, root, nodeCount, sceneFlags, shadowsOn
    );
    let lightCount = min(sceneLights.lightCount, 8u);
    for (var li = 0u; li < lightCount; li++) {
        let lit = eval_punctual_light(li, s.pos, pixel, frameIdx, sunAngular, softSun, 0.0);
        if (lit.valid == 0u || dot(s.N, lit.dir) <= 0.0) { continue; }
        var vis = vec3<f32>(1.0);
        if (shadowsOn) {
            vis = shadow_transmittance(origin, lit.dir, count, useBvh, useTlas, root, nodeCount, sceneFlags, lit.lightT);
        }
        Lo += opaque_f_cos(s.N, s.V, lit.dir, s.F0, s.baseColor, s.metallic, safeRough) * vis * lit.radiance;
    }
    if (pathEnv < env_layer_count()) {
        let r = rand2(pixel, frameIdx * 307u + 9u);
        let samp = sample_env(pathEnv, r.x, r.y);
        if (samp.pdf > 1e-6 && dot(s.N, samp.dir) > 0.0) {
            var envVis = vec3<f32>(1.0);
            if (shadowsOn) {
                envVis = shadow_transmittance(origin, samp.dir, count, useBvh, useTlas, root, nodeCount, sceneFlags, 1e10);
            }
            Lo += opaque_f_cos(s.N, s.V, samp.dir, s.F0, s.baseColor, s.metallic, safeRough)
                * env_equirect(pathEnv, samp.dir) * envVis / samp.pdf;
        }
    }
    return firefly_clamp_contrib(Lo, clampY);
}

fn sun_visibility(
    origin: vec3<f32>,
    N: vec3<f32>,
    pixel: vec2<u32>,
    frameIdx: u32,
    count: u32,
    useBvh: bool,
    useTlas: bool,
    root: u32,
    nodeCount: u32,
    sceneFlags: u32,
    sunAngular: f32,
    softSun: bool,
) -> f32 {
    let lightCount = min(sceneLights.lightCount, 8u);
    for (var li = 0u; li < lightCount; li++) {
        let rawLight = sceneLights.lights[li];
        if (u32(rawLight.colorAndType.w + 0.1) != 0u) { continue; }
        var L = normalize(-rawLight.dirAndIntensity.xyz);
        if (softSun && sunAngular > 0.0) {
            L = sample_cone_around(L, sunAngular, pixel, frameIdx * 401u + li);
        }
        if (dot(N, L) <= 0.0) { return 0.0; }
        let shadowOrigin = origin + N * surface_bias(length(origin));
        let vis = shadow_transmittance(shadowOrigin, L, count, useBvh, useTlas, root, nodeCount, sceneFlags, 1e10);
        return luma(vis);
    }
    return 1.0;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let resetAccum = pathTracerParams[0];
    let lowRes = resetAccum == 0u && hybridHistory.traceScale < 0.99;
    let step = select(1u, max(u32(round(1.0 / max(hybridHistory.traceScale, 0.25))), 1u), lowRes);
    let ox = select(0u, u32(hybridHistory.offsetX + 0.5), lowRes);
    let oy = select(0u, u32(hybridHistory.offsetY + 0.5), lowRes);
    let full = textureDimensions(hybridGDist);
    let px = gid.x * step + ox + select(0u, 1u, pathTracerEmissive.count == 0xFFFFFFFFu);
    let py = gid.y * step + oy;
    if (px >= full.x || py >= full.y) { return; }
    let p = vec2<i32>(i32(px), i32(py));
    let pixel = vec2<u32>(px, py);

    let shadowsOn = pathTracerParams[1] != 0u;
    let frameIdx = pathTracerParams[2];
    let enableReflection = pathTracerParams[7] != 0u;
    let traceThisFrame = pathTracerParams[8];
    let featureFlags = pathTracerParams[9];
    let bvhNodeCount = pathTracerParams[10];
    let bvhRoot = pathTracerParams[11];
    let envIblIntensityRaw = bitcast<f32>(pathTracerParams[13]);
    let envIblIntensity = max(select(envIblIntensityRaw, 1.0, pathTracerParams[13] == 0u), 0.0);
    let sceneFlags = pathTracerParams[18];
    let sunAngular = max(bitcast<f32>(pathTracerParams[19]), 0.0);
    let aoRadiusBits = pathTracerParams[20];
    let aoRadiusRaw = bitcast<f32>(aoRadiusBits);
    let aoRadius = select(1.0, max(aoRadiusRaw, 0.0), aoRadiusBits != 0u);
    let lightRadius = max(bitcast<f32>(pathTracerParams[21]), 0.0);
    let roughBits = pathTracerTileInfo[TILE_HYBRID_REFL_ROUGH];
    let roughMaxRaw = bitcast<f32>(roughBits);
    let roughMax = select(HYBRID_REFL_ROUGH_DEFAULT, roughMaxRaw, roughBits != 0u && roughMaxRaw > 0.0);
    let clampBits = pathTracerTileInfo[TILE_HYBRID_CLAMP];
    let clampRaw = bitcast<f32>(clampBits);
    let clampY = select(HYBRID_CLAMP_DEFAULT, clampRaw, clampBits != 0u && clampRaw > 0.0);

    let prevS = textureLoad(hybridShadowPrev, p, 0);
    let prevR = textureLoad(hybridReflPrev, p, 0);
    let prevG = textureLoad(hybridGiPrev, p, 0);
    let prevV = textureLoad(hybridLightVisPrev, p, 0);
    // Keep-last only when paused/idle with no pending reset. A pause-time light/env/resize
    // reset must still trace so the next unpaused frame does not keep pre-reset lighting.
    if (traceThisFrame == 0u && resetAccum == 0u) {
        textureStore(hybridShadowOut, p, prevS);
        textureStore(hybridReflOut, p, prevR);
        textureStore(hybridGiOut, p, prevG);
        textureStore(hybridLightVisOut, p, prevV);
        return;
    }

    let count = get_triangle_count();
    // The AOVs cover the whole view they are sampled in. tileInfo[2..3] holds the Scene canvas
    // size, which differs from the Game panel.
    let fullSize = vec2<f32>(full);
    let useBvh = ((featureFlags & FLAG_USE_BVH) != 0u) && (bvhNodeCount > 0u);
    let useTlas = ((featureFlags & FLAG_USE_TLAS) != 0u) && useBvh && (get_instance_count() > 0u);
    let softSun = (featureFlags & FLAG_SOFT_SUN) != 0u;

    var vis = 1.0;
    var depth = 0.0;
    var refl = vec3<f32>(0.0);
    var reflHitT = 65000.0;
    var gi = vec3<f32>(0.0);
    var takeRefl = false;
    var takeGi = false;
    var primaryRough = 1.0;
    var reflWeight = 0.0;
    var punctualVis = vec3<f32>(1.0);
    var ao = 1.0;

    if (count > 0u) {
        // Pixel center, no jitter: the raster shades the same point, so the accumulated
        // distance stays a single surface on silhouettes.
        let uvPix = (vec2<f32>(pixel) + 0.5) / fullSize;
        let ndc = vec4<f32>(uvPix.x * 2.0 - 1.0, 1.0 - uvPix.y * 2.0, 0.0, 1.0);
        let worldH = frame.inverseViewProjectionMatrix * ndc;
        let rd = normalize(worldH.xyz / worldH.w - frame.cameraPosition);
        var pathEnv = 0u;

        let s = shade_primary(p, rd, count, useBvh, useTlas, bvhRoot, bvhNodeCount);
        if (s.hit) {
            depth = s.dist;
            primaryRough = s.roughness;
            if (shadowsOn) {
                vis = sun_visibility(
                    s.pos, s.N, pixel, frameIdx, count, useBvh, useTlas,
                    bvhRoot, bvhNodeCount, sceneFlags, sunAngular, softSun
                );
                punctualVis = punctual_visibility(
                    s.pos, s.N, pixel, frameIdx, count, useBvh, useTlas,
                    bvhRoot, bvhNodeCount, sceneFlags, sunAngular, softSun, lightRadius
                );
            }
            if (aoRadius > 0.0) {
                let aoDir = cosine_sample_hemisphere(s.N, pixel, 11u, frameIdx);
                let aoOrigin = s.pos + s.N * surface_bias(length(s.pos));
                let aoHit = trace_closest_scene(aoOrigin, aoDir, count, useBvh, useTlas, bvhRoot, bvhNodeCount);
                ao = select(1.0, 0.0, aoHit.x > 0.0 && aoHit.x < aoRadius);
            }
            takeGi = true;
            let giDir = cosine_sample_hemisphere(s.N, pixel, 5u, frameIdx);
            let giOrigin = s.pos + s.N * surface_bias(length(s.pos));
            let pu = rand2(pixel, frameIdx * 41u + 6u);
            let pv = rand2(pixel, frameIdx * 41u + 7u);
            let lamp = sample_emissive(vec3<f32>(pu.x, pu.y, pv.x), s.pos);
            if (lamp.valid == 1u && lamp.pdf_w > 0.0) {
                let toL = lamp.pos - s.pos;
                let lampDist = length(toL);
                let L = toL / lampDist;
                let cosS = dot(s.N, L);
                if (cosS > 0.0 && lampDist > 1e-4) {
                    let pdfB = cosS / PI;
                    let w = mis_balance_power(lamp.pdf_w, pdfB);
                    var lampVis = vec3<f32>(1.0);
                    if (shadowsOn) {
                        lampVis = shadow_transmittance(
                            giOrigin, L, count, useBvh, useTlas, bvhRoot, bvhNodeCount,
                            sceneFlags, lampDist * (1.0 - 1e-3)
                        );
                    }
                    gi += lamp.Le * cosS * lampVis * w / lamp.pdf_w;
                }
            }
            let gh = trace_closest_scene(giOrigin, giDir, count, useBvh, useTlas, bvhRoot, bvhNodeCount);
            if (gh.x <= 0.0 || gh.x >= 1e9) {
                gi += miss_radiance(giDir, pathEnv, featureFlags, envIblIntensity);
            } else {
                let gs = shade_triangle(u32(gh.w), gh.y, gh.z, giDir, gh.x, giOrigin, useTlas);
                let geoN = triangle_geo_normal_world(u32(gh.w), select(0xFFFFFFFFu, hit_instance_index, useTlas));
                let pdfW = emissive_solid_pdf(u32(gh.w), geoN, giOrigin, gs.pos);
                let pdfB = max(dot(s.N, giDir), 0.0) / PI;
                gi += direct_at_hit(
                    gs, pixel, frameIdx * 7u + 2u, count, useBvh, useTlas,
                    bvhRoot, bvhNodeCount, sceneFlags, shadowsOn, sunAngular, softSun,
                    pathEnv, featureFlags, envIblIntensity, clampY, mis_balance_power(pdfB, pdfW)
                ) + ambient_end(gs, featureFlags, envIblIntensity);
            }
            gi = firefly_clamp_contrib(gi, clampY);
            if (enableReflection && s.roughness < roughMax) {
                takeRefl = true;
                var rro = s.pos + s.N * surface_bias(length(s.pos));
                let first = sample_vndf_reflect(s.N, s.V, s.roughness, pixel, frameIdx * 131u + 17u);
                reflWeight = first.w;
                var rrd = first.xyz;
                var tp = vec3<f32>(1.0);
                var reflEnv = pathEnv;
                var prevN = s.N;
                var prevV = s.V;
                var prevRough = s.roughness;
                for (var b = 0u; b < HYBRID_REFL_BOUNCES; b++) {
                    if (reflWeight <= 0.0) { break; }
                    let rh = trace_closest_scene(rro, rrd, count, useBvh, useTlas, bvhRoot, bvhNodeCount);
                    if (rh.x <= 0.0 || rh.x >= 1e9) {
                        refl += tp * miss_radiance(rrd, reflEnv, featureFlags, envIblIntensity);
                        break;
                    }
                    if (b == 0u) { reflHitT = rh.x; }
                    let rtri = u32(rh.w);
                    let rs = shade_triangle(rtri, rh.y, rh.z, rrd, rh.x, rro, useTlas);
                    reflEnv = min(u32(pathTracerMaterials[get_triangle_material_index(rtri)].header.z + 0.5), 1u);
                    var reflEmitW = 1.0;
                    if (prevRough >= 0.04) {
                        let geoN = triangle_geo_normal_world(rtri, select(0xFFFFFFFFu, hit_instance_index, useTlas));
                        let pdfW = emissive_solid_pdf(rtri, geoN, rro, rs.pos);
                        let pdfB = bsdf_mixture_pdf(prevN, prevV, rrd, max(prevRough, 0.04), 0.9);
                        reflEmitW = mis_balance_power(pdfB, pdfW);
                    }
                    refl += tp * direct_at_hit(
                        rs, pixel, frameIdx * 7u + 3u + b, count, useBvh, useTlas,
                        bvhRoot, bvhNodeCount, sceneFlags, shadowsOn, sunAngular, softSun, reflEnv,
                        featureFlags, envIblIntensity, clampY, reflEmitW
                    );
                    prevN = rs.N;
                    prevV = rs.V;
                    prevRough = rs.roughness;
                    if (b + 1u >= HYBRID_REFL_BOUNCES) {
                        refl += tp * ambient_end(rs, featureFlags, envIblIntensity);
                        break;
                    }
                    let specContinue = rs.metallic > 0.5 && rs.roughness < roughMax;
                    if (specContinue) {
                        let next = sample_vndf_reflect(rs.N, rs.V, rs.roughness, pixel, frameIdx * 19u + b);
                        if (next.w <= 0.0) { break; }
                        tp *= fresnel_schlick(max(dot(rs.N, rs.V), 0.0), rs.F0) * next.w;
                        rrd = next.xyz;
                    } else {
                        tp *= rs.baseColor * (1.0 - rs.metallic);
                        rrd = cosine_sample_hemisphere(rs.N, pixel, b + 3u, frameIdx);
                    }
                    rro = rs.pos + rs.N * surface_bias(length(rs.pos));
                }
                refl = firefly_clamp_contrib(refl, clampY);
            }
        }
    }

    // One raw sample at every trace scale. HybridTemporal owns the history: an in-place
    // mean here is never reprojected and ghosts as soon as the camera moves.
    textureStore(hybridShadowOut, p, vec4<f32>(vis, depth, reflWeight, 1.0));
    textureStore(hybridReflOut, p, vec4<f32>(refl, select(0.0, reflHitT, takeRefl)));
    textureStore(hybridGiOut, p, vec4<f32>(gi, select(0.0, 1.0, takeGi)));
    textureStore(hybridLightVisOut, p, vec4<f32>(punctualVis, ao));
}
