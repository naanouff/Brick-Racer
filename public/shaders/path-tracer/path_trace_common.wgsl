/**
 * Shared path-trace traversal, sampling and shading helpers.
 * Included after bindings and constants in path_trace.compute.wgsl.
 * Bindings, overrides and firefly caps stay in the including shader.
 */

fn get_triangle_count() -> u32 { return pathTracerParams[12]; }

fn get_triangle_positions(i: u32) -> mat3x3<f32> {
    let base = i * FLOATS_PER_TRIANGLE;
    return mat3x3<f32>(
        vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]),
        vec3<f32>(triangles[base+3u], triangles[base+4u], triangles[base+5u]),
        vec3<f32>(triangles[base+6u], triangles[base+7u], triangles[base+8u])
    );
}

fn get_triangle_normals(i: u32) -> mat3x3<f32> {
    let base = i * FLOATS_PER_TRIANGLE + 9u;
    return mat3x3<f32>(
        vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]),
        vec3<f32>(triangles[base+3u], triangles[base+4u], triangles[base+5u]),
        vec3<f32>(triangles[base+6u], triangles[base+7u], triangles[base+8u])
    );
}

fn get_triangle_tangents(i: u32) -> mat3x3<f32> {
    let base = i * FLOATS_PER_TRIANGLE + 18u;
    return mat3x3<f32>(
        vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]),
        vec3<f32>(triangles[base+3u], triangles[base+4u], triangles[base+5u]),
        vec3<f32>(triangles[base+6u], triangles[base+7u], triangles[base+8u])
    );
}

fn get_triangle_bitangents(i: u32) -> mat3x3<f32> {
    let base = i * FLOATS_PER_TRIANGLE + 27u;
    return mat3x3<f32>(
        vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]),
        vec3<f32>(triangles[base+3u], triangles[base+4u], triangles[base+5u]),
        vec3<f32>(triangles[base+6u], triangles[base+7u], triangles[base+8u])
    );
}

fn get_triangle_uvs(i: u32) -> mat3x2<f32> {
    let b = i * FLOATS_PER_TRIANGLE + 36u;
    return mat3x2<f32>(
        vec2<f32>(triangles[b], triangles[b+1u]),
        vec2<f32>(triangles[b+2u], triangles[b+3u]),
        vec2<f32>(triangles[b+4u], triangles[b+5u])
    );
}

fn get_triangle_uvs1(i: u32) -> mat3x2<f32> {
    let b = i * FLOATS_PER_TRIANGLE + 42u;
    return mat3x2<f32>(
        vec2<f32>(triangles[b], triangles[b+1u]),
        vec2<f32>(triangles[b+2u], triangles[b+3u]),
        vec2<f32>(triangles[b+4u], triangles[b+5u])
    );
}

fn get_triangle_base_color(i: u32) -> vec3<f32> {
    let base = i * FLOATS_PER_TRIANGLE + 48u;
    return vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]);
}

fn get_triangle_metallic(i: u32) -> f32 {
    return triangles[i * FLOATS_PER_TRIANGLE + 51u];
}

fn get_triangle_roughness(i: u32) -> f32 {
    return triangles[i * FLOATS_PER_TRIANGLE + 52u];
}

fn get_triangle_emissive(i: u32) -> vec3<f32> {
    let base = i * FLOATS_PER_TRIANGLE + 53u;
    return vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]);
}

fn get_triangle_material_index(i: u32) -> u32 {
    let mi = u32(triangles[i * FLOATS_PER_TRIANGLE + 56u]);
    return select(0u, mi, mi < arrayLength(&pathTracerMaterials));
}

fn material_tex_slot(mat: PathTracerMaterial) -> u32 {
    return u32(mat.header.x);
}

/** Single-winding Möller–Trumbore; `abs(a)` rejects parallel rays only (not backfaces). */
fn ray_triangle_hit_bary_once(ro: vec3<f32>, rd: vec3<f32>, p0: vec3<f32>, p1: vec3<f32>, p2: vec3<f32>) -> vec4<f32> {
    let e1 = p1 - p0;
    let e2 = p2 - p0;
    let h = cross(rd, e2);
    let a = dot(e1, h);
    let eps = 1e-7;
    if (abs(a) < eps) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    let f = 1.0 / a;
    let s = ro - p0;
    let u = f * dot(s, h);
    if (u < 0.0 || u > 1.0) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    let q = cross(s, e1);
    let v = f * dot(rd, q);
    if (v < 0.0 || u + v > 1.0) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    let t = f * dot(e2, q);
    if (t <= 1e-7) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    return vec4<f32>(t, u, v, 0.0);
}

/**
 * Double-sided hit. `ray_triangle_hit_bary_once` already accepts both windings:
 * it rejects only parallel rays (`abs(a) < eps`), so a second test with swapped
 * vertices does not recover extra hits and doubles the cost of every miss.
 * Barycentrics stay in the (p0, p1, p2) convention used for normals and UVs.
 */
fn ray_triangle_hit_bary(ro: vec3<f32>, rd: vec3<f32>, p0: vec3<f32>, p1: vec3<f32>, p2: vec3<f32>) -> vec4<f32> {
    return ray_triangle_hit_bary_once(ro, rd, p0, p1, p2);
}

fn aabb_ray_interval(ro: vec3<f32>, rd: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> vec2<f32> {
    var t0 = -1e30;
    var t1 = 1e30;
    let ox = ro.x;
    let oy = ro.y;
    let oz = ro.z;
    let dx = rd.x;
    let dy = rd.y;
    let dz = rd.z;
    var invD = 1.0 / dx;
    var tNear = (bmin.x - ox) * invD;
    var tFar = (bmax.x - ox) * invD;
    if (tNear > tFar) { let tmp = tNear; tNear = tFar; tFar = tmp; }
    t0 = max(t0, tNear);
    t1 = min(t1, tFar);
    invD = 1.0 / dy;
    tNear = (bmin.y - oy) * invD;
    tFar = (bmax.y - oy) * invD;
    if (tNear > tFar) { let tmp = tNear; tNear = tFar; tFar = tmp; }
    t0 = max(t0, tNear);
    t1 = min(t1, tFar);
    invD = 1.0 / dz;
    tNear = (bmin.z - oz) * invD;
    tFar = (bmax.z - oz) * invD;
    if (tNear > tFar) { let tmp = tNear; tNear = tFar; tFar = tmp; }
    t0 = max(t0, tNear);
    t1 = min(t1, tFar);
    return vec2<f32>(t0, t1);
}

/**
 * Slab interval overlaps [0, tLimit]. A missed box has entry > exit; without that test only boxes
 * beyond the current hit are culled, which degrades traversal to a near-linear scan before the first hit.
 */
fn aabb_interval_hit(iv: vec2<f32>, tLimit: f32) -> bool {
    return iv.x <= iv.y && iv.y >= 0.0 && iv.x <= tLimit;
}

fn sample_albedo_tex(slot: u32, uv: vec2<f32>) -> vec4<f32> {
    return textureSampleLevel(tAlbedo, pathTracerSampler, uv, i32(slot), 0.0);
}

fn sample_albedo(slot: u32, uv: vec2<f32>) -> vec3<f32> {
    return sample_albedo_tex(slot, uv).rgb;
}

/**
 * Self-intersection bias. A fixed 0.002 skips watch hands and dial decals, which sit
 * a fraction of a millimetre under the crystal.
 */
fn surface_bias(refDist: f32) -> f32 {
    return clamp(refDist * 1.0e-4, 1.0e-6, 1.0e-3);
}

/**
 * 0 = skip the hit, 1 = shade it. MASK is binary; BLEND is coverage (texture alpha × opacity).
 * Dielectrics ignore this: transmission already decides reflect vs refract.
 */
fn surface_coverage(mat: PathTracerMaterial, slot: u32, bu: f32, bv: f32, uvs: mat3x2<f32>) -> f32 {
    let mode = mat.header.w;
    if (mode == 0.0 || mat.transmission.x > 0.001) { return 1.0; }
    var a = mat.transmission.y;
    if (slot < MAX_MAT_TEX_SLOTS && slot != MAT_SLOT_NONE) {
        let flags = pathTracerTexSlotFlags[slot];
        if ((flags & 1u) != 0u) {
            let w0 = 1.0 - bu - bv;
            let uv = uvs[0] * w0 + uvs[1] * bu + uvs[2] * bv;
            a = a * sample_albedo_tex(slot, uv).a;
        }
    }
    if (mode > 0.0) {
        return select(0.0, 1.0, a >= mode);
    }
    return clamp(a, 0.0, 1.0);
}

fn sample_normal_map(slot: u32, uv: vec2<f32>) -> vec3<f32> {
    return textureSampleLevel(tNormal, pathTracerSampler, uv, i32(slot), 0.0).rgb;
}

fn sample_emissive_tex(slot: u32, uv: vec2<f32>) -> vec3<f32> {
    return textureSampleLevel(tEmissive, pathTracerSampler, uv, i32(slot), 0.0).rgb;
}

fn sample_orm(slot: u32, uv: vec2<f32>) -> vec2<f32> {
    let c = textureSampleLevel(tOrm, pathTracerSampler, uv, i32(slot), 0.0);
    return vec2<f32>(c.g, c.b);
}

fn mat_normal_scale(slot: u32) -> f32 {
    if (slot >= MAX_MAT_TEX_SLOTS || slot == MAT_SLOT_NONE) { return 1.0; }
    return max(pathTracerMatFactors[slot], 0.0);
}

fn eval_surface_albedo(
    slot: u32,
    bu: f32,
    bv: f32,
    uvs: mat3x2<f32>,
    baseF: vec3<f32>
) -> vec3<f32> {
    let w0 = 1.0 - bu - bv;
    let uv = uvs[0] * w0 + uvs[1] * bu + uvs[2] * bv;
    var base = baseF;
    if (slot < MAX_MAT_TEX_SLOTS && slot != MAT_SLOT_NONE) {
        let flags = pathTracerTexSlotFlags[slot];
        if ((flags & 1u) != 0u) {
            base = base * sample_albedo(slot, uv);
        }
    }
    return base;
}

fn eval_surface_emissive(
    slot: u32,
    bu: f32,
    bv: f32,
    uvs: mat3x2<f32>,
    baseEmit: vec3<f32>
) -> vec3<f32> {
    let w0 = 1.0 - bu - bv;
    let uv = uvs[0] * w0 + uvs[1] * bu + uvs[2] * bv;
    var e = baseEmit;
    if (slot < MAX_MAT_TEX_SLOTS && slot != MAT_SLOT_NONE) {
        let flags = pathTracerTexSlotFlags[slot];
        if ((flags & 8u) != 0u) {
            e = e * sample_emissive_tex(slot, uv);
        }
    }
    return max(e, vec3<f32>(0.0));
}

fn eval_surface_scalar(slot: u32, bu: f32, bv: f32, uvs: mat3x2<f32>, uvs1: mat3x2<f32>, metF: f32, roughF: f32) -> vec2<f32> {
    let w0 = 1.0 - bu - bv;
    let uv0 = uvs[0] * w0 + uvs[1] * bu + uvs[2] * bv;
    let uv1 = uvs1[0] * w0 + uvs1[1] * bu + uvs1[2] * bv;
    var met = metF;
    var rough = roughF;
    if (slot < MAX_MAT_TEX_SLOTS && slot != MAT_SLOT_NONE) {
        let flags = pathTracerTexSlotFlags[slot];
        if ((flags & 2u) != 0u) {
            let uvOrm = select(uv0, uv1, (flags & TEX_FLAG_ORM_UV1) != 0u);
            let orm = sample_orm(slot, uvOrm);
            rough = rough * orm.x;
            met = met * orm.y;
        }
    }
    return vec2<f32>(clamp(met, 0.0, 1.0), clamp(rough, 0.0, 1.0));
}

/** Per-path contribution luminance cap: glossy BRDF × sun spikes become fireflies once denoised. */
fn firefly_clamp_contrib(c: vec3<f32>, cap: f32) -> vec3<f32> {
    let lum = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
    if (lum <= cap) { return c; }
    return c * (cap / max(lum, 1e-5));
}

fn build_shading_normal(
    matSlot: u32,
    bu: f32,
    bv: f32,
    uvs: mat3x2<f32>,
    N_geom: vec3<f32>,
    T_interp: vec3<f32>,
    B_interp: vec3<f32>
) -> vec3<f32> {
    let N_geo = normalize(N_geom);
    var T_i = T_interp;
    if (length(T_i) < 1e-20) {
        if (abs(N_geo.y) < 0.999) {
            T_i = cross(N_geo, vec3<f32>(0.0, 1.0, 0.0));
        } else {
            T_i = cross(N_geo, vec3<f32>(1.0, 0.0, 0.0));
        }
    }
    T_i = normalize(T_i);
    var B_i = B_interp;
    if (length(B_i) < 1e-20) {
        B_i = cross(N_geo, T_i);
    } else {
        B_i = normalize(B_i);
    }
    var T = T_i - dot(T_i, N_geo) * N_geo;
    if (length(T) < 1e-5) {
        if (abs(N_geo.y) < 0.999) {
            T = normalize(cross(N_geo, vec3<f32>(0.0, 1.0, 0.0)));
        } else {
            T = normalize(cross(N_geo, vec3<f32>(1.0, 0.0, 0.0)));
        }
    } else {
        T = normalize(T);
    }
    let handedness = select(-1.0, 1.0, dot(cross(N_geo, T), B_i) >= 0.0);
    let B = normalize(cross(N_geo, T)) * handedness;
    if (matSlot < MAX_MAT_TEX_SLOTS && matSlot != MAT_SLOT_NONE) {
        let flags = pathTracerTexSlotFlags[matSlot];
        if ((flags & 4u) != 0u) {
            let w0 = 1.0 - bu - bv;
            let uv = uvs[0] * w0 + uvs[1] * bu + uvs[2] * bv;
            let nm = sample_normal_map(matSlot, uv);
            var tn = nm * 2.0 - 1.0;
            let ns = mat_normal_scale(matSlot);
            tn = vec3<f32>(tn.x * ns, tn.y * ns, tn.z);
            tn = normalize(tn);
            return normalize(T * tn.x + B * tn.y + N_geo * tn.z);
        }
    }
    return N_geo;
}

fn pcg_hash(input: u32) -> u32 {
    var state = input * 747796405u + 2891336453u;
    let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

/** R2 quasirandom (Roberts 2018) — plastic constant bases. */
const R2_A1: f32 = 0.75487766624669276;
const R2_A2: f32 = 0.5698402909980532;

fn r2_sample(n: u32) -> vec2<f32> {
    return fract(vec2<f32>(f32(n) * R2_A1, f32(n) * R2_A2));
}

/** Per-pixel Cranley–Patterson offset (hash; blue-noise texture optional later). */
fn cranley_patterson_offset(pixel: vec2<u32>) -> vec2<f32> {
    let h0 = pcg_hash(pixel.x ^ (pixel.y * 747796405u));
    let h1 = pcg_hash(h0 ^ 0x9e3779b9u);
    return vec2<f32>(f32(h0), f32(h1)) * (1.0 / 4294967296.0);
}

/** Phase 4: R2 + Cranley–Patterson (replaces white-noise pcg for camera / BSDF / light). */
fn rand2(pixel: vec2<u32>, seed: u32) -> vec2<f32> {
    return fract(r2_sample(seed) + cranley_patterson_offset(pixel));
}

fn cosine_sample_hemisphere(N: vec3<f32>, pixel: vec2<u32>, bounce: u32, seed: u32) -> vec3<f32> {
    let r = rand2(pixel, seed * 17u + bounce * 31u + 7u);
    let phi = 2.0 * PI * r.x;
    let cosTheta = sqrt(r.y);
    let sinTheta = sqrt(1.0 - r.y);
    var tangent: vec3<f32>;
    if (abs(N.y) < 0.999) {
        tangent = normalize(cross(N, vec3<f32>(0.0, 1.0, 0.0)));
    } else {
        tangent = normalize(cross(N, vec3<f32>(1.0, 0.0, 0.0)));
    }
    let bitangent = cross(N, tangent);
    return normalize(tangent * cos(phi) * sinTheta + bitangent * sin(phi) * sinTheta + N * cosTheta);
}

fn sample_cone_around(axis: vec3<f32>, halfAngle: f32, pixel: vec2<u32>, seed: u32) -> vec3<f32> {
    let r = rand2(pixel, seed);
    let phi = 2.0 * PI * r.x;
    let cosTheta = 1.0 - r.y * (1.0 - cos(halfAngle));
    let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    var tangent: vec3<f32>;
    if (abs(axis.y) < 0.999) {
        tangent = normalize(cross(axis, vec3<f32>(0.0, 1.0, 0.0)));
    } else {
        tangent = normalize(cross(axis, vec3<f32>(1.0, 0.0, 0.0)));
    }
    let bitangent = cross(axis, tangent);
    return normalize(tangent * cos(phi) * sinTheta + bitangent * sin(phi) * sinTheta + axis * cosTheta);
}

/** HDR cubemap can carry very high radiance; scale down to reduce fireflies vs. analytic sky. */
fn env_sample(rd: vec3<f32>, iblIntensity: f32) -> vec3<f32> {
    return textureSampleLevel(envCubemap, pathTracerSampler, rd, 0.0).rgb * iblIntensity;
}

// Equirect layers in `pathTracerEnv` (layout: pathTracerEnvMap.ts). Cubemap stays the fallback.
const ENV_W = 512u;
const ENV_H = 256u;
const ENV_RADIANCE = 128u;
const ENV_MARGINAL = 1048704u;
const ENV_CONDITIONAL = 1049216u;

fn env_layer_count() -> u32 {
    return u32(max(pathTracerEnv[0], 0.0));
}

fn rot_x(d: vec3<f32>, a: f32) -> vec3<f32> {
    let c = cos(a);
    let s = sin(a);
    return vec3<f32>(d.x, c * d.y - s * d.z, s * d.y + c * d.z);
}

fn rot_y(d: vec3<f32>, a: f32) -> vec3<f32> {
    let c = cos(a);
    let s = sin(a);
    return vec3<f32>(c * d.x + s * d.z, d.y, -s * d.x + c * d.z);
}

fn rot_z(d: vec3<f32>, a: f32) -> vec3<f32> {
    let c = cos(a);
    let s = sin(a);
    return vec3<f32>(c * d.x - s * d.y, s * d.x + c * d.y, d.z);
}

/** `R = Ry · Rx · Rz`; sampling the map uses `Rᵀ · worldDir`. */
fn env_to_map(dir: vec3<f32>, layer: u32) -> vec3<f32> {
    let b = 16u + layer * 4u;
    return rot_z(rot_x(rot_y(dir, -pathTracerEnv[b + 1u]), -pathTracerEnv[b]), -pathTracerEnv[b + 2u]);
}

fn env_to_world(dir: vec3<f32>, layer: u32) -> vec3<f32> {
    let b = 16u + layer * 4u;
    return rot_y(rot_x(rot_z(dir, pathTracerEnv[b + 2u]), pathTracerEnv[b]), pathTracerEnv[b + 1u]);
}

fn env_wrap_x(x: i32) -> u32 {
    let w = i32(ENV_W);
    return u32((x % w + w) % w);
}

fn env_texel(layer: u32, x: u32, y: u32) -> vec4<f32> {
    let i = ENV_RADIANCE + (((layer * ENV_H + y) * ENV_W + x) * 4u);
    return vec4<f32>(pathTracerEnv[i], pathTracerEnv[i + 1u], pathTracerEnv[i + 2u], pathTracerEnv[i + 3u]);
}

fn env_equirect(layer: u32, worldDir: vec3<f32>) -> vec3<f32> {
    let d = env_to_map(worldDir, layer);
    let u = fract(0.5 + atan2(d.z, d.x) / (2.0 * PI));
    let v = clamp(acos(clamp(d.y, -1.0, 1.0)) / PI, 0.0, 0.9999);
    let fx = u * f32(ENV_W) - 0.5;
    let fy = v * f32(ENV_H) - 0.5;
    let x0 = i32(floor(fx));
    let y0 = i32(floor(fy));
    let tx = fract(fx);
    let ty = fract(fy);
    let yA = u32(clamp(y0, 0, i32(ENV_H) - 1));
    let yB = u32(clamp(y0 + 1, 0, i32(ENV_H) - 1));
    let c00 = env_texel(layer, env_wrap_x(x0), yA);
    let c10 = env_texel(layer, env_wrap_x(x0 + 1), yA);
    let c01 = env_texel(layer, env_wrap_x(x0), yB);
    let c11 = env_texel(layer, env_wrap_x(x0 + 1), yB);
    let row0 = mix(c00, c10, tx);
    let row1 = mix(c01, c11, tx);
    return mix(row0, row1, ty).rgb;
}

fn env_pdf_pixel(layer: u32, x: u32, y: u32) -> f32 {
    let lum = env_texel(layer, x, y).a;
    let sumW = pathTracerEnv[4u + layer];
    if (sumW <= 0.0 || lum <= 0.0) { return 0.0; }
    return lum * f32(ENV_W * ENV_H) / (sumW * 2.0 * PI * PI);
}

fn env_pdf(layer: u32, worldDir: vec3<f32>) -> f32 {
    if (layer >= env_layer_count()) { return 0.0; }
    let d = env_to_map(worldDir, layer);
    let u = fract(0.5 + atan2(d.z, d.x) / (2.0 * PI));
    let v = clamp(acos(clamp(d.y, -1.0, 1.0)) / PI, 0.0, 0.9999);
    let x = min(u32(u * f32(ENV_W)), ENV_W - 1u);
    let y = min(u32(v * f32(ENV_H)), ENV_H - 1u);
    return env_pdf_pixel(layer, x, y);
}

fn env_cdf_find(base: u32, n: u32, u: f32) -> u32 {
    var lo = 0u;
    var hi = n;
    loop {
        if (lo >= hi) { break; }
        let mid = (lo + hi) >> 1u;
        if (pathTracerEnv[base + mid] < u) {
            lo = mid + 1u;
        } else {
            hi = mid;
        }
    }
    return min(lo, n - 1u);
}

struct EnvSample {
    dir: vec3<f32>,
    pdf: f32,
}

fn sample_env(layer: u32, u: f32, v: f32) -> EnvSample {
    let y = env_cdf_find(ENV_MARGINAL + layer * ENV_H, ENV_H, clamp(u, 0.0, 0.9999));
    let x = env_cdf_find(ENV_CONDITIONAL + (layer * ENV_H + y) * ENV_W, ENV_W, clamp(v, 0.0, 0.9999));
    let theta = (f32(y) + 0.5) / f32(ENV_H) * PI;
    let phi = ((f32(x) + 0.5) / f32(ENV_W) - 0.5) * 2.0 * PI;
    let st = sin(theta);
    let mapDir = vec3<f32>(st * cos(phi), cos(theta), st * sin(phi));
    var s: EnvSample;
    s.dir = normalize(env_to_world(mapDir, layer));
    s.pdf = env_pdf_pixel(layer, x, y);
    return s;
}

fn softbox_weight(cosAxis: f32, phi: f32, halfAngle: f32, sides: f32, falloff: f32) -> f32 {
    let dist = acos(clamp(cosAxis, -1.0, 1.0));
    var radius = halfAngle;
    if (sides >= 3.0) {
        let sector = 2.0 * PI / sides;
        let wrapped = fract(phi / sector);
        let a = abs(wrapped - 0.5) * sector;
        radius = halfAngle * cos(PI / sides) / max(cos(a), 1e-3);
    }
    let inner = radius * (1.0 - clamp(falloff, 0.0, 1.0));
    if (dist >= radius) { return 0.0; }
    if (dist <= inner) { return 1.0; }
    let t = (radius - dist) / max(radius - inner, 1e-4);
    return t * t * (3.0 - 2.0 * t);
}

/** Radiance along `worldDir` for the softboxes linked to `layer`. Not the cone integral. */
fn softbox_emission(layer: u32, worldDir: vec3<f32>) -> vec3<f32> {
    var sum = vec3<f32>(0.0);
    let softCount = min(u32(pathTracerEnv[3u]), 4u);
    let D = normalize(worldDir);
    for (var si = 0u; si < softCount; si++) {
        let sb = 32u + si * 12u;
        if (pathTracerEnv[sb + 11u] < 0.5) { continue; }
        if (u32(pathTracerEnv[sb + 10u] + 0.5) != layer) { continue; }
        let axis = normalize(vec3<f32>(pathTracerEnv[sb], pathTracerEnv[sb + 1u], pathTracerEnv[sb + 2u]));
        let halfAngle = pathTracerEnv[sb + 7u];
        if (halfAngle <= 0.0) { continue; }
        let cosAxis = dot(D, axis);
        let basisT = select(
            normalize(cross(axis, vec3<f32>(0.0, 1.0, 0.0))),
            normalize(cross(axis, vec3<f32>(1.0, 0.0, 0.0))),
            abs(axis.y) >= 0.999
        );
        let basisB = cross(axis, basisT);
        let phi = atan2(dot(D, basisB), dot(D, basisT));
        let mask = softbox_weight(cosAxis, phi, halfAngle, pathTracerEnv[sb + 8u], pathTracerEnv[sb + 9u]);
        if (mask <= 0.0) { continue; }
        sum += pathTracerEnv[sb + 3u]
            * vec3<f32>(pathTracerEnv[sb + 4u], pathTracerEnv[sb + 5u], pathTracerEnv[sb + 6u])
            * mask;
    }
    return sum;
}

fn trace_closest_linear(ro: vec3<f32>, rd: vec3<f32>, count: u32) -> vec4<f32> {
    var hitDist = 1e10;
    var hitBu = 0.0;
    var hitBv = 0.0;
    var hitTri = 0u;
    for (var i = 0u; i < count; i++) {
        let pos = get_triangle_positions(i);
        let hb = ray_triangle_hit_bary(ro, rd, pos[0], pos[1], pos[2]);
        if (hb.x > 0.0 && hb.x < hitDist) {
            hitDist = hb.x;
            hitBu = hb.y;
            hitBv = hb.z;
            hitTri = i;
        }
    }
    if (hitDist >= 1e9) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    return vec4<f32>(hitDist, hitBu, hitBv, f32(hitTri));
}

fn bvh_is_tri_leaf(left: u32) -> bool {
    return (left & BVH_TRI_LEAF_BIT) != 0u && left != BVH_INSTANCE_LEAF;
}

/** Push the farther child first so the nearer one is visited next. Skip a child whose entry is past `tLimit`. */
fn bvh_push_ordered(
    stack: ptr<function, array<u32, 64>>,
    sp: ptr<function, u32>,
    left: u32,
    right: u32,
    ro: vec3<f32>,
    rd: vec3<f32>,
    tLimit: f32,
    nodeCount: u32,
) {
    var pushL = false;
    var pushR = false;
    var tL = 0.0;
    var tR = 0.0;
    if (left < nodeCount) {
        let n = pathTracerBvhNodes[left];
        let iv = aabb_ray_interval(ro, rd, n.bmin, n.bmax);
        if (aabb_interval_hit(iv, tLimit)) {
            pushL = true;
            tL = iv.x;
        }
    }
    if (right < nodeCount) {
        let n = pathTracerBvhNodes[right];
        let iv = aabb_ray_interval(ro, rd, n.bmin, n.bmax);
        if (aabb_interval_hit(iv, tLimit)) {
            pushR = true;
            tR = iv.x;
        }
    }
    if (pushL && pushR) {
        let near = select(right, left, tL <= tR);
        let far = select(left, right, tL <= tR);
        if (*sp < 63u) {
            (*stack)[*sp] = far;
            *sp = *sp + 1u;
            (*stack)[*sp] = near;
            *sp = *sp + 1u;
        } else if (*sp < 64u) {
            (*stack)[*sp] = near;
            *sp = *sp + 1u;
        }
    } else if (pushL && *sp < 64u) {
        (*stack)[*sp] = left;
        *sp = *sp + 1u;
    } else if (pushR && *sp < 64u) {
        (*stack)[*sp] = right;
        *sp = *sp + 1u;
    }
}

/** Any hit along [minT, maxT] (shadow / short-range AO). Uses same BVH as closest-hit. */
fn trace_any_hit_bvh(
    ro: vec3<f32>,
    rd: vec3<f32>,
    count: u32,
    root: u32,
    nodeCount: u32,
    minT: f32,
    maxT: f32,
) -> bool {
    var stack: array<u32, 64>;
    var sp = 1u;
    stack[0] = root;
    loop {
        if (sp == 0u) { break; }
        sp -= 1u;
        let ni = stack[sp];
        if (ni >= nodeCount) { continue; }
        let node = pathTracerBvhNodes[ni];
        let iv = aabb_ray_interval(ro, rd, node.bmin, node.bmax);
        let tEnter = max(iv.x, minT);
        let tExit = min(iv.y, maxT);
        if (tEnter > tExit) { continue; }
        if (bvh_is_tri_leaf(node.left)) {
            let ntris = node.left & 0x7fffffffu;
            let base = node.right;
            for (var k = 0u; k < ntris; k++) {
                let ti = base + k;
                if (ti >= count) { break; }
                let pos = get_triangle_positions(ti);
                let hb = ray_triangle_hit_bary(ro, rd, pos[0], pos[1], pos[2]);
                if (hb.x > minT && hb.x < maxT) { return true; }
            }
        } else if (node.left != BVH_INSTANCE_LEAF) {
            bvh_push_ordered(&stack, &sp, node.left, node.right, ro, rd, maxT, nodeCount);
        }
    }
    return false;
}

/** Closest hit closer than `tMax` (parametric t; preserved by the TLAS object-space transform). */
fn trace_closest_bvh(ro: vec3<f32>, rd: vec3<f32>, count: u32, root: u32, nodeCount: u32, tMax: f32) -> vec4<f32> {
    var hitDist = tMax;
    var hitBu = 0.0;
    var hitBv = 0.0;
    var hitTri = 0u;
    var stack: array<u32, 64>;
    var sp = 0u;
    stack[0] = root;
    sp = 1u;
    loop {
        if (sp == 0u) { break; }
        sp -= 1u;
        let ni = stack[sp];
        if (ni >= nodeCount) { continue; }
        let node = pathTracerBvhNodes[ni];
        let iv = aabb_ray_interval(ro, rd, node.bmin, node.bmax);
        if (!aabb_interval_hit(iv, hitDist)) { continue; }
        if (bvh_is_tri_leaf(node.left)) {
            let ntris = node.left & 0x7fffffffu;
            let base = node.right;
            for (var k = 0u; k < ntris; k++) {
                let ti = base + k;
                if (ti >= count) { break; }
                let pos = get_triangle_positions(ti);
                let hb = ray_triangle_hit_bary(ro, rd, pos[0], pos[1], pos[2]);
                if (hb.x > 0.0 && hb.x < hitDist) {
                    hitDist = hb.x;
                    hitBu = hb.y;
                    hitBv = hb.z;
                    hitTri = ti;
                }
            }
        } else if (node.left != BVH_INSTANCE_LEAF) {
            bvh_push_ordered(&stack, &sp, node.left, node.right, ro, rd, hitDist, nodeCount);
        }
    }
    if (hitDist >= tMax) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    return vec4<f32>(hitDist, hitBu, hitBv, f32(hitTri));
}

fn transform_dir_mat4(m: mat4x4<f32>, d: vec3<f32>) -> vec3<f32> {
    return (m * vec4<f32>(d, 0.0)).xyz;
}

fn transform_pos_mat4(m: mat4x4<f32>, p: vec3<f32>) -> vec3<f32> {
    return (m * vec4<f32>(p, 1.0)).xyz;
}

/** Normal: (M^{-1})^T * n with M = worldFromObject → transpose(objectFromWorld_3x3) * n. */
fn transform_normal_object_to_world(objectFromWorld: mat4x4<f32>, n: vec3<f32>) -> vec3<f32> {
    let m = mat3x3<f32>(
        objectFromWorld[0].xyz,
        objectFromWorld[1].xyz,
        objectFromWorld[2].xyz
    );
    return normalize(transpose(m) * n);
}

fn get_instance_count() -> u32 { return pathTracerParams[14]; }

/** Closest hit through TLAS → BLAS (object-space triangles). Sets {@link hit_instance_index}. */
fn trace_closest_tlas(ro: vec3<f32>, rd: vec3<f32>, tlasRoot: u32, nodeCount: u32, instanceCount: u32) -> vec4<f32> {
    var hitDist = 1e10;
    var hitBu = 0.0;
    var hitBv = 0.0;
    var hitTri = 0u;
    var hitInst = 0u;
    var stack: array<u32, 64>;
    var sp = 1u;
    stack[0] = tlasRoot;
    loop {
        if (sp == 0u) { break; }
        sp -= 1u;
        let ni = stack[sp];
        if (ni >= nodeCount) { continue; }
        let node = pathTracerBvhNodes[ni];
        let iv = aabb_ray_interval(ro, rd, node.bmin, node.bmax);
        if (!aabb_interval_hit(iv, hitDist)) { continue; }
        if (node.left == BVH_INSTANCE_LEAF) {
            let ii = node.right;
            if (ii >= instanceCount) { continue; }
            let inst = pathTracerInstances[ii];
            let ro_o = transform_pos_mat4(inst.objectFromWorld, ro);
            let rd_o = transform_dir_mat4(inst.objectFromWorld, rd);
            let local = trace_closest_bvh(ro_o, rd_o, inst.triBase + inst.triCount, inst.blasRoot, nodeCount, hitDist);
            // Restrict leaf triangles to this instance range inside BLAS by rejecting out-of-range in loop below.
            // trace_closest_bvh already uses absolute tri indices (packed with triBase).
            if (local.x > 0.0 && local.x < hitDist) {
                let ti = u32(local.w);
                if (ti >= inst.triBase && ti < inst.triBase + inst.triCount) {
                    hitDist = local.x;
                    hitBu = local.y;
                    hitBv = local.z;
                    hitTri = ti;
                    hitInst = ii;
                }
            }
        } else if ((node.left & BVH_TRI_LEAF_BIT) == 0u) {
            bvh_push_ordered(&stack, &sp, node.left, node.right, ro, rd, hitDist, nodeCount);
        }
    }
    if (hitDist >= 1e9) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    hit_instance_index = hitInst;
    return vec4<f32>(hitDist, hitBu, hitBv, f32(hitTri));
}

fn trace_any_hit_tlas(
    ro: vec3<f32>,
    rd: vec3<f32>,
    tlasRoot: u32,
    nodeCount: u32,
    instanceCount: u32,
    minT: f32,
    maxT: f32,
) -> bool {
    var stack: array<u32, 64>;
    var sp = 1u;
    stack[0] = tlasRoot;
    loop {
        if (sp == 0u) { break; }
        sp -= 1u;
        let ni = stack[sp];
        if (ni >= nodeCount) { continue; }
        let node = pathTracerBvhNodes[ni];
        let iv = aabb_ray_interval(ro, rd, node.bmin, node.bmax);
        let tEnter = max(iv.x, minT);
        let tExit = min(iv.y, maxT);
        if (tEnter > tExit) { continue; }
        if (node.left == BVH_INSTANCE_LEAF) {
            let ii = node.right;
            if (ii >= instanceCount) { continue; }
            let inst = pathTracerInstances[ii];
            let ro_o = transform_pos_mat4(inst.objectFromWorld, ro);
            let rd_o = transform_dir_mat4(inst.objectFromWorld, rd);
            if (trace_any_hit_bvh(ro_o, rd_o, inst.triBase + inst.triCount, inst.blasRoot, nodeCount, minT, maxT)) {
                return true;
            }
        } else if ((node.left & BVH_TRI_LEAF_BIT) == 0u) {
            bvh_push_ordered(&stack, &sp, node.left, node.right, ro, rd, maxT, nodeCount);
        }
    }
    return false;
}

fn trace_shadow_ray_linear(origin: vec3<f32>, L: vec3<f32>, count: u32) -> bool {
    let minT = 0.001;
    let maxT = 1e20;
    for (var i = 0u; i < count; i++) {
        let pos = get_triangle_positions(i);
        let hit = ray_triangle_hit_bary(origin, L, pos[0], pos[1], pos[2]);
        if (hit.x > minT && hit.x < maxT) { return true; }
    }
    return false;
}

fn trace_shadow_ray_smart(
    origin: vec3<f32>,
    L: vec3<f32>,
    count: u32,
    use_bvh: bool,
    root: u32,
    nodeCount: u32,
) -> bool {
    let minT = 0.001;
    let maxT = 1e20;
    let use_tlas = (pathTracerParams[9] & FLAG_USE_TLAS) != 0u;
    let instanceCount = get_instance_count();
    if (use_tlas && use_bvh && nodeCount > 0u && instanceCount > 0u) {
        return trace_any_hit_tlas(origin, L, root, nodeCount, instanceCount, minT, maxT);
    }
    if (use_bvh && nodeCount > 0u) {
        return trace_any_hit_bvh(origin, L, count, root, nodeCount, minT, maxT);
    }
    return trace_shadow_ray_linear(origin, L, count);
}

fn trace_occluded_linear(origin: vec3<f32>, rd: vec3<f32>, count: u32, maxT: f32) -> bool {
    let minT = 0.001;
    for (var i = 0u; i < count; i++) {
        let pos = get_triangle_positions(i);
        let hit = ray_triangle_hit_bary(origin, rd, pos[0], pos[1], pos[2]);
        if (hit.x > minT && hit.x < maxT) { return true; }
    }
    return false;
}

fn trace_occluded_smart(
    origin: vec3<f32>,
    rd: vec3<f32>,
    count: u32,
    maxT: f32,
    use_bvh: bool,
    root: u32,
    nodeCount: u32,
) -> bool {
    let minT = 0.001;
    let use_tlas = (pathTracerParams[9] & FLAG_USE_TLAS) != 0u;
    let instanceCount = get_instance_count();
    if (use_tlas && use_bvh && nodeCount > 0u && instanceCount > 0u) {
        return trace_any_hit_tlas(origin, rd, root, nodeCount, instanceCount, minT, maxT);
    }
    if (use_bvh && nodeCount > 0u) {
        return trace_any_hit_bvh(origin, rd, count, root, nodeCount, minT, maxT);
    }
    return trace_occluded_linear(origin, rd, count, maxT);
}

fn sample_ao(
    hitPos: vec3<f32>,
    N: vec3<f32>,
    count: u32,
    pixel: vec2<u32>,
    frameIdx: u32,
    use_bvh: bool,
    root: u32,
    nodeCount: u32,
) -> f32 {
    var blocked = 0u;
    for (var i = 0u; i < AO_RAYS; i++) {
        let dir = cosine_sample_hemisphere(N, pixel, i + 100u, frameIdx);
        let origin = hitPos + N * surface_bias(length(hitPos));
        if (trace_occluded_smart(origin, dir, count, AO_RADIUS, use_bvh, root, nodeCount)) {
            blocked += 1u;
        }
    }
    return f32(blocked) / f32(AO_RAYS);
}

fn sky_color(rd: vec3<f32>) -> vec3<f32> {
    let t = clamp(0.5 * (rd.y + 1.0), 0.0, 1.0);
    let horizon = vec3<f32>(1.0, 1.0, 1.0);
    let zenith  = vec3<f32>(0.5, 0.7, 1.0);
    return mix(horizon, zenith, t);
}

fn fresnel_schlick(cos_theta: f32, F0: vec3<f32>) -> vec3<f32> {
    let ct = clamp(cos_theta, 0.0, 1.0);
    return F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - ct, 5.0);
}

fn distribution_ggx(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(N, H), 0.0);
    let NdotH2 = NdotH * NdotH;
    let denom = NdotH2 * (a2 - 1.0) + 1.0;
    return a2 / max(PI * denom * denom, 1e-8);
}

fn geometry_schlick_ggx(NdotX: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;
    let nx = max(NdotX, 0.0);
    return nx / max(nx * (1.0 - k) + k, 1e-6);
}

fn geometry_smith(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
    let NdotV = max(dot(N, V), 0.0);
    let NdotL = max(dot(N, L), 0.0);
    return geometry_schlick_ggx(NdotV, roughness) * geometry_schlick_ggx(NdotL, roughness);
}

fn ggx_reflection_pdf(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
    let H = normalize(V + L);
    let NdotH = max(dot(N, H), 0.0);
    let VdotH = max(dot(V, H), 1e-4);
    return distribution_ggx(N, H, roughness) * NdotH / (4.0 * VdotH);
}

fn bsdf_mixture_pdf(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32, specProb: f32) -> f32 {
    let cosine = max(dot(N, L), 0.0) / PI;
    return specProb * ggx_reflection_pdf(N, V, L, roughness) + (1.0 - specProb) * cosine;
}

/** f·cos for the opaque lobe (specular already includes the cosine cancellation). */
fn opaque_f_cos(
    N: vec3<f32>,
    V: vec3<f32>,
    L: vec3<f32>,
    F0: vec3<f32>,
    baseColor: vec3<f32>,
    metallic: f32,
    roughness: f32,
) -> vec3<f32> {
    let NdotL = max(dot(N, L), 0.0);
    let NdotV = max(dot(N, V), 0.001);
    if (NdotL <= 0.0) { return vec3<f32>(0.0); }
    let H = normalize(L + V);
    let F = fresnel_schlick(max(dot(V, H), 0.0), F0);
    let spec = distribution_ggx(N, H, roughness) * geometry_smith(N, V, L, roughness) * F / (4.0 * NdotV);
    let kD = (vec3<f32>(1.0) - F) * (1.0 - metallic);
    return spec + kD * baseColor / PI * NdotL;
}

/** KHR_materials_ior + KHR_materials_specular dielectric F0. */
fn dielectric_f0_specular_ext(mat: PathTracerMaterial) -> vec3<f32> {
    let ior = max(mat.transmission.z, 1.0);
    let r = (ior - 1.0) / (ior + 1.0);
    let f0 = min(vec3<f32>(r * r) * mat.specular.yzw, vec3<f32>(1.0));
    return f0 * mat.specular.x;
}

fn pbr_f0(baseColor: vec3<f32>, metallic: f32, dielectric_f0: vec3<f32>) -> vec3<f32> {
    return mix(dielectric_f0, baseColor, metallic);
}

fn material_transmission_opacity(mat: PathTracerMaterial) -> vec2<f32> {
    return mat.transmission.xy;
}

// --- Dielectric BSDF helpers (mirrored in src/pathTracerDielectric.ts) ---

const SPECTRAL_MIN_NM = 400.0;
const SPECTRAL_MAX_NM = 700.0;
/** Shadow rays cross at most this many transmissive surfaces before giving up (opaque). */
const SHADOW_MAX_TRANSMISSIVE_HITS = 8u;
const SCENE_FLAG_HAS_TRANSMISSION = 1u;

/** Exact unpolarized Fresnel reflectance; `eta = n_incident / n_transmitted`. 1 on total internal reflection. */
fn fresnel_dielectric(cosI: f32, eta: f32) -> f32 {
    let c = clamp(cosI, 0.0, 1.0);
    let sin2T = eta * eta * (1.0 - c * c);
    if (sin2T >= 1.0) { return 1.0; }
    let cosT = sqrt(1.0 - sin2T);
    let rs = (eta * c - cosT) / (eta * c + cosT);
    let rp = (c - eta * cosT) / (c + eta * cosT);
    return 0.5 * (rs * rs + rp * rp);
}

/** KHR volume: transmittance over `dist`; `attDist` 0 = no absorption. */
fn beer_lambert(attColor: vec3<f32>, attDist: f32, dist: f32) -> vec3<f32> {
    if (attDist <= 0.0) { return vec3<f32>(1.0); }
    let sigma = -log(max(attColor, vec3<f32>(1e-4))) / attDist;
    return exp(-sigma * dist);
}

/** Cauchy IOR at `lambdaNm` from n_d (587.6 nm) and KHR dispersion (`20 / Abbe`). */
fn dispersive_ior(nd: f32, dispersion: f32, lambdaNm: f32) -> f32 {
    if (dispersion <= 0.0) { return nd; }
    let dn = (nd - 1.0) * dispersion / 20.0;
    let b = dn / (1.0 / (0.4861 * 0.4861) - 1.0 / (0.6563 * 0.6563));
    let l = lambdaNm * 0.001;
    return nd + b * (1.0 / (l * l) - 1.0 / (0.5876 * 0.5876));
}

/** RGB weight of a hero wavelength sampled uniformly in [SPECTRAL_MIN_NM, SPECTRAL_MAX_NM]; averages to white. */
fn spectral_rgb_weight(lambdaNm: f32) -> vec3<f32> {
    let b = clamp((550.0 - lambdaNm) / 100.0, 0.0, 1.0);
    let r = clamp((lambdaNm - 550.0) / 100.0, 0.0, 1.0);
    return 3.0 * vec3<f32>(r, 1.0 - b - r, b);
}

fn material_is_dielectric(mat: PathTracerMaterial, metallic: f32) -> bool {
    return mat.transmission.x > 0.001 && metallic < 0.5;
}

fn build_orthonormal_basis(N: vec3<f32>) -> mat3x3<f32> {
    var T: vec3<f32>;
    if (abs(N.y) < 0.999) {
        T = normalize(cross(N, vec3<f32>(0.0, 1.0, 0.0)));
    } else {
        T = normalize(cross(N, vec3<f32>(1.0, 0.0, 0.0)));
    }
    let B = cross(N, T);
    return mat3x3<f32>(T, B, N);
}

fn sample_ggx_H_tangent(roughness: f32, r: vec2<f32>) -> vec3<f32> {
    let a = roughness * roughness;
    let phi = 2.0 * PI * r.x;
    let cosTheta = sqrt((1.0 - r.y) / (1.0 + (a * a - 1.0) * r.y));
    let sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
    return vec3<f32>(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
}

fn sample_reflect_ggx(N: vec3<f32>, V: vec3<f32>, roughness: f32, pixel: vec2<u32>, seed: u32) -> vec3<f32> {
    let basis = build_orthonormal_basis(N);
    let r = rand2(pixel, seed);
    let hLocal = sample_ggx_H_tangent(roughness, r);
    let H = normalize(basis * hLocal);
    return normalize(reflect(-V, H));
}

fn trace_closest_scene(
    ro: vec3<f32>,
    rd: vec3<f32>,
    count: u32,
    useBvh: bool,
    useTlas: bool,
    root: u32,
    nodeCount: u32,
) -> vec4<f32> {
    if (useTlas) { return trace_closest_tlas(ro, rd, root, nodeCount, get_instance_count()); }
    if (useBvh) { return trace_closest_bvh(ro, rd, count, root, nodeCount, 1e10); }
    return trace_closest_linear(ro, rd, count);
}

/** Interpolated vertex normal in world space (reads {@link hit_instance_index} after a TLAS hit). */
fn triangle_world_normal(tri: u32, bu: f32, bv: f32, useTlas: bool) -> vec3<f32> {
    let norms = get_triangle_normals(tri);
    let bw = 1.0 - bu - bv;
    let n = normalize(norms[0] * bw + norms[1] * bu + norms[2] * bv);
    if (useTlas) {
        return transform_normal_object_to_world(pathTracerInstances[hit_instance_index].objectFromWorld, n);
    }
    return n;
}

struct EmissiveSample {
    pos: vec3<f32>,
    n: vec3<f32>,
    Le: vec3<f32>,
    pdf_w: f32,
    valid: u32,
}

fn emissive_luminance(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

/** Area pdf of a catalog triangle: π Y(Le) / Φ. Independent of the triangle area. */
fn emissive_area_pdf(factor: vec3<f32>) -> f32 {
    let y = emissive_luminance(factor);
    let phi = pathTracerEmissive.total_power;
    if (y <= 0.0 || phi <= 0.0) { return 0.0; }
    return PI * y / phi;
}

fn mis_balance_power(a: f32, b: f32) -> f32 {
    let a2 = a * a;
    let b2 = b * b;
    return a2 / max(a2 + b2, 1e-12);
}

fn triangle_point_world(tri: u32, b0: f32, b1: f32, b2: f32, inst: u32) -> vec3<f32> {
    let p = get_triangle_positions(tri);
    let local = p[0] * b0 + p[1] * b1 + p[2] * b2;
    if (inst == 0xFFFFFFFFu) { return local; }
    return transform_pos_mat4(pathTracerInstances[inst].worldFromObject, local);
}

fn triangle_geo_normal_world(tri: u32, inst: u32) -> vec3<f32> {
    let p = get_triangle_positions(tri);
    let c = cross(p[1] - p[0], p[2] - p[0]);
    let len = length(c);
    var n = vec3<f32>(0.0, 1.0, 0.0);
    if (len > 1e-8) { n = c / len; }
    if (inst == 0xFFFFFFFFu) { return n; }
    return transform_normal_object_to_world(pathTracerInstances[inst].objectFromWorld, n);
}

fn find_emissive_entry(u: f32) -> u32 {
    let n = pathTracerEmissive.count;
    var lo = 0u;
    var hi = n;
    loop {
        if (lo >= hi) { break; }
        let mid = (lo + hi) >> 1u;
        if (pathTracerEmissive.entries[mid].cdf < u) {
            lo = mid + 1u;
        } else {
            hi = mid;
        }
    }
    return min(lo, n - 1u);
}

/** Solid-angle pdf of triangle `tri` seen from `from`, using the catalog power. */
fn emissive_solid_pdf(tri: u32, n: vec3<f32>, receiver: vec3<f32>, pos: vec3<f32>) -> f32 {
    let pA = emissive_area_pdf(get_triangle_emissive(tri));
    if (pA <= 0.0) { return 0.0; }
    let toP = receiver - pos;
    let d2 = dot(toP, toP);
    let dist = sqrt(d2);
    if (dist < 1e-4) { return 0.0; }
    let cosL = abs(dot(n, toP / dist));
    if (cosL < 1e-4) { return 0.0; }
    return pA * d2 / cosL;
}

/**
 * One catalog sample. `u.x` walks the power CDF, `u.y`/`u.z` pick a point on the triangle.
 * Back-facing lights are invalid.
 */
fn sample_emissive(u: vec3<f32>, P: vec3<f32>) -> EmissiveSample {
    var s: EmissiveSample;
    s.valid = 0u;
    let n = pathTracerEmissive.count;
    if (n == 0u || pathTracerEmissive.total_power <= 0.0) { return s; }
    let entry = pathTracerEmissive.entries[find_emissive_entry(clamp(u.x, 0.0, 0.999999))];
    let su = sqrt(clamp(u.y, 0.0, 1.0));
    let uz = clamp(u.z, 0.0, 1.0);
    let b0 = 1.0 - su;
    let b1 = su * (1.0 - uz);
    let b2 = su * uz;
    let pos = triangle_point_world(entry.tri, b0, b1, b2, entry.inst);
    let nrm = triangle_geo_normal_world(entry.tri, entry.inst);
    let toP = P - pos;
    let d2 = dot(toP, toP);
    let dist = sqrt(d2);
    if (dist < 1e-4) { return s; }
    let cosL = dot(nrm, toP / dist);
    if (cosL <= 1e-4) { return s; }
    let factor = get_triangle_emissive(entry.tri);
    let pA = emissive_area_pdf(factor);
    if (pA <= 0.0) { return s; }
    let hitMat = pathTracerMaterials[get_triangle_material_index(entry.tri)];
    let Le = eval_surface_emissive(material_tex_slot(hitMat), b1, b2, get_triangle_uvs(entry.tri), factor);
    s.pos = pos;
    s.n = nrm;
    s.Le = Le;
    s.pdf_w = pA * d2 / cosL;
    s.valid = 1u;
    return s;
}

/**
 * Light reaching `origin` along `L` through dielectrics: base-color tint, Fresnel on entry and
 * Beer–Lambert inside (tinted shadows, no caustics). Any opaque blocker returns 0.
 */
fn shadow_transmittance(
    origin: vec3<f32>,
    L: vec3<f32>,
    count: u32,
    useBvh: bool,
    useTlas: bool,
    root: u32,
    nodeCount: u32,
    sceneFlags: u32,
    tMax: f32,
) -> vec3<f32> {
    if (tMax <= 1e-4) { return vec3<f32>(0.0); }
    let blocked = trace_shadow_ray_smart(origin, L, count, useBvh, root, nodeCount);
    if (!blocked) { return vec3<f32>(1.0); }
    // Infinite lights with no transmission: the any-hit test is enough.
    if ((sceneFlags & SCENE_FLAG_HAS_TRANSMISSION) == 0u && tMax > 1e8) { return vec3<f32>(0.0); }
    var T = vec3<f32>(1.0);
    var ro = origin;
    var traveled = 0.0;
    for (var k = 0u; k < SHADOW_MAX_TRANSMISSIVE_HITS; k++) {
        let h = trace_closest_scene(ro, L, count, useBvh, useTlas, root, nodeCount);
        if (h.x <= 0.0 || h.x >= 1e9) { return T; }
        if (traveled + h.x >= tMax) { return T; }
        let tri = u32(h.w);
        let mat = pathTracerMaterials[get_triangle_material_index(tri)];
        if (!material_is_dielectric(mat, get_triangle_metallic(tri))) { return vec3<f32>(0.0); }
        let cosL = dot(triangle_world_normal(tri, h.y, h.z, useTlas), L);
        if (cosL > 0.0) {
            T *= beer_lambert(mat.attenuation.xyz, mat.attenuation.w, h.x);
        } else {
            T *= 1.0 - fresnel_dielectric(-cosL, 1.0 / max(mat.transmission.z, 1.0));
        }
        T *= get_triangle_base_color(tri) * mat.transmission.x;
        if (max(T.x, max(T.y, T.z)) < 1e-3) { return vec3<f32>(0.0); }
        let shadowStep = surface_bias(max(h.x, length(ro)));
        traveled += h.x + shadowStep;
        ro = ro + L * (h.x + shadowStep);
    }
    return vec3<f32>(0.0);
}

/** BRDF next-event estimate of one emissive triangle, power-heuristic against the BSDF. */
fn emissive_nee(
    P: vec3<f32>,
    N: vec3<f32>,
    V: vec3<f32>,
    F0: vec3<f32>,
    baseColor: vec3<f32>,
    metallic: f32,
    roughness: f32,
    specProb: f32,
    u: vec3<f32>,
    shadowOrigin: vec3<f32>,
    count: u32,
    useBvh: bool,
    useTlas: bool,
    root: u32,
    nodeCount: u32,
    sceneFlags: u32,
    shadowsOn: bool,
) -> vec3<f32> {
    let samp = sample_emissive(u, P);
    if (samp.valid == 0u || samp.pdf_w <= 0.0) { return vec3<f32>(0.0); }
    let toL = samp.pos - P;
    let dist = length(toL);
    if (dist < 1e-4) { return vec3<f32>(0.0); }
    let L = toL / dist;
    if (dot(N, L) <= 0.0) { return vec3<f32>(0.0); }
    let pdfB = bsdf_mixture_pdf(N, V, L, max(roughness, 0.04), specProb);
    let w = mis_balance_power(samp.pdf_w, pdfB);
    var vis = vec3<f32>(1.0);
    if (shadowsOn) {
        vis = shadow_transmittance(
            shadowOrigin, L, count, useBvh, useTlas, root, nodeCount, sceneFlags, dist * (1.0 - 1e-3)
        );
    }
    return opaque_f_cos(N, V, L, F0, baseColor, metallic, max(roughness, 0.04))
        * samp.Le * vis * w / samp.pdf_w;
}

const BACKPLATE = 80u;
const BSDF_SHADOW_CATCHER = 2u;

fn backplate_enabled() -> bool {
    return pathTracerEnv[BACKPLATE] > 0.5;
}

/** Screen gradient. Stretching 0.5 is linear (exponent 1), matching pathTracerBackplate.ts. */
fn backplate_color(uv: vec2<f32>) -> vec3<f32> {
    let b = BACKPLATE;
    let startC = vec3<f32>(pathTracerEnv[b + 1u], pathTracerEnv[b + 2u], pathTracerEnv[b + 3u]);
    let finalC = vec3<f32>(pathTracerEnv[b + 4u], pathTracerEnv[b + 5u], pathTracerEnv[b + 6u]);
    let startP = vec2<f32>(pathTracerEnv[b + 7u], pathTracerEnv[b + 8u]);
    let finalP = vec2<f32>(pathTracerEnv[b + 9u], pathTracerEnv[b + 10u]);
    let delta = finalP - startP;
    let len2 = dot(delta, delta);
    var t = 0.0;
    if (len2 > 1e-12) {
        t = clamp(dot(uv - startP, delta) / len2, 0.0, 1.0);
        let expn = clamp(pathTracerEnv[b + 11u], 0.025, 4.0) * 2.0;
        t = pow(t, expn);
    }
    return mix(startC, finalC, t);
}

fn shadow_catcher_factor(occ: vec3<f32>, unocc: vec3<f32>, cutoff: f32) -> f32 {
    let lu = dot(unocc, vec3<f32>(0.2126, 0.7152, 0.0722));
    if (lu <= 1e-6) { return 1.0; }
    let lo = dot(occ, vec3<f32>(0.2126, 0.7152, 0.0722));
    let ratio = clamp(lo / lu, 0.0, 1.0);
    let c = clamp(cutoff, 0.0, 1.0);
    return mix(ratio, 1.0, c);
}

struct CatcherIrradiance {
    occ: vec3<f32>,
    unocc: vec3<f32>,
}

/** Occluded and unoccluded irradiance (N·L · Li). The ratio is the shadow. */
fn catcher_irradiance(
    hitPos: vec3<f32>,
    N: vec3<f32>,
    envLayer: u32,
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
) -> CatcherIrradiance {
    var occ = vec3<f32>(0.0);
    var unocc = vec3<f32>(0.0);
    let origin = hitPos + N * surface_bias(length(hitPos));
    let lightCount = min(sceneLights.lightCount, 8u);
    for (var li = 0u; li < lightCount; li++) {
        let rawLight = sceneLights.lights[li];
        let lightType = u32(rawLight.colorAndType.w + 0.1);
        if (lightType == 3u) { continue; }
        var L = vec3<f32>(0.0, 1.0, 0.0);
        var radiance = rawLight.colorAndType.rgb * rawLight.dirAndIntensity.w;
        var lightT = 1e10;
        if (lightType == 0u) {
            L = normalize(-rawLight.dirAndIntensity.xyz);
            if (softSun && sunAngular > 0.0) {
                L = sample_cone_around(L, sunAngular, pixel, frameIdx * 401u + li);
            }
        } else {
            let offset = rawLight.positionAndRange.xyz - hitPos;
            let dist = length(offset);
            if (dist < 1e-4) { continue; }
            L = offset / dist;
            let range = rawLight.positionAndRange.w;
            var att = 1.0 / (dist * dist);
            if (range > 0.0) {
                let ratio = dist / range;
                att *= max(min(1.0 - ratio * ratio * ratio * ratio, 1.0), 0.0);
            }
            if (lightType == 2u) {
                let actualCos = dot(normalize(rawLight.dirAndIntensity.xyz), -L);
                if (actualCos <= rawLight.params.y) { continue; }
                if (actualCos < rawLight.params.x) {
                    let ang = (actualCos - rawLight.params.y) / max(rawLight.params.x - rawLight.params.y, 1e-4);
                    att *= ang * ang;
                }
            }
            radiance *= att;
            lightT = dist - 0.004;
        }
        let ndotl = max(dot(N, L), 0.0);
        if (ndotl <= 0.0) { continue; }
        let geo = radiance * ndotl;
        unocc += geo;
        if (shadowsOn) {
            occ += geo * shadow_transmittance(origin, L, count, useBvh, useTlas, root, nodeCount, sceneFlags, lightT);
        } else {
            occ += geo;
        }
    }
    if (envLayer < env_layer_count()) {
        for (var s = 0u; s < 2u; s++) {
            let r = rand2(pixel, frameIdx * 809u + s * 17u + 3u);
            let samp = sample_env(envLayer, r.x, r.y);
            let ndotl = max(dot(N, samp.dir), 0.0);
            if (samp.pdf > 1e-6 && ndotl > 0.0) {
                let w = env_equirect(envLayer, samp.dir) * ndotl / samp.pdf;
                unocc += w;
                if (shadowsOn) {
                    occ += w * shadow_transmittance(origin, samp.dir, count, useBvh, useTlas, root, nodeCount, sceneFlags, 1e10);
                } else {
                    occ += w;
                }
            }
        }
    }
    var out: CatcherIrradiance;
    out.occ = occ;
    out.unocc = unocc;
    return out;
}
