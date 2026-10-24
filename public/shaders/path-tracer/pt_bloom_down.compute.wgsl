/**
 * One HDR pyramid downsample. PREFILTER applies the soft knee (k = 0.5 τ) and a Karis average.
 * 13 taps, weights normalized to 1. Level ≥ bloom_levels stores black.
 */
struct PathTracerPostParams {
    exposure_mul: f32,
    contrast: f32,
    saturation: f32,
    tonemap_mode: f32,
    bloom_mix: f32,
    threshold: f32,
    glare: f32,
    size: f32,
    num_rays: f32,
    rotation: f32,
    _pad0: f32,
    _pad1: f32,
    bloom_mode: f32,
    bloom_intensity: f32,
    bloom_levels: f32,
    _pad2: f32,
}

override PREFILTER: f32 = 0.0;
override LEVEL: f32 = 0.0;

@group(0) @binding(0) var<storage, read> post: PathTracerPostParams;
@group(0) @binding(1) var srcHdr: texture_storage_2d<rgba16float, read>;
@group(0) @binding(2) var dstHdr: texture_storage_2d<rgba16float, write>;

fn soft_excess(y: f32, tau: f32) -> f32 {
    let k = 0.5 * tau;
    if (k <= 1e-8) { return max(y - tau, 0.0); }
    let rise = max(y - tau + k, 0.0);
    let quad = rise * rise / (4.0 * k);
    if (y >= tau + k) { return y - tau; }
    return min(quad, k);
}

fn load_rgb(coord: vec2<i32>, dim: vec2<u32>) -> vec3<f32> {
    let c = clamp(coord, vec2<i32>(0), vec2<i32>(dim) - vec2<i32>(1));
    let px = textureLoad(srcHdr, c);
    let a = clamp(px.a, 0.0, 1.0);
    if (a > 1e-6) { return px.rgb / a; }
    return vec3<f32>(0.0);
}

fn prepared(coord: vec2<i32>, dim: vec2<u32>) -> vec3<f32> {
    let rgb = load_rgb(coord, dim);
    if (PREFILTER < 0.5) { return rgb; }
    let y = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    if (y <= 1e-6) { return vec3<f32>(0.0); }
    return rgb * (soft_excess(y, post.threshold) / y);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dim = textureDimensions(dstHdr);
    if (gid.x >= dim.x || gid.y >= dim.y) { return; }
    let p = vec2<i32>(i32(gid.x), i32(gid.y));
    if (post.bloom_mode < 0.5 || post.bloom_mix < 0.5 || LEVEL >= post.bloom_levels) {
        return;
    }
    let srcDim = textureDimensions(srcHdr);
    let center = vec2<i32>(i32(gid.x) * 2 + 1, i32(gid.y) * 2 + 1);
    let offs = array<vec2<i32>, 13>(
        vec2<i32>(0, 0),
        vec2<i32>(-1, -1), vec2<i32>(1, -1), vec2<i32>(-1, 1), vec2<i32>(1, 1),
        vec2<i32>(-2, 0), vec2<i32>(2, 0), vec2<i32>(0, -2), vec2<i32>(0, 2),
        vec2<i32>(-2, -2), vec2<i32>(2, -2), vec2<i32>(-2, 2), vec2<i32>(2, 2)
    );
    let w = array<f32, 13>(
        0.125, 0.125, 0.125, 0.125, 0.125, 0.0625, 0.0625, 0.0625, 0.0625, 0.03125, 0.03125, 0.03125, 0.03125
    );
    var acc = vec3<f32>(0.0);
    var wSum = 0.0;
    for (var i = 0u; i < 13u; i++) {
        let c = prepared(center + offs[i], srcDim);
        // Karis average on the prefilter: one hot pixel cannot drive the whole halo.
        var wi = w[i];
        if (PREFILTER > 0.5) {
            wi /= 1.0 + dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
        }
        acc += c * wi;
        wSum += wi;
    }
    textureStore(dstHdr, p, vec4<f32>(acc / max(wSum, 1e-6), 1.0));
}
