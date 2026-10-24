/**
 * Shared display grade. The including shader binds `post` at group 0.
 * Exposure is already `2^ev`. Order: tonemap, contrast, saturation.
 * ColorBalanceMode: 0 clamp, 1 Reinhard, 2+ ACES fitted × 0.6.
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
    encode_srgb: f32,
    _pad1: f32,
}

@group(0) @binding(3) var<uniform> post: PathTracerPostParams;

fn aces_fitted(color: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return (color * (a * color + b)) / (color * (c * color + d) + e);
}

fn grade(exposed: vec3<f32>) -> vec3<f32> {
    let mode = post.tonemap_mode;
    var mapped: vec3<f32>;
    if (mode >= 1.5) {
        mapped = aces_fitted(max(exposed, vec3<f32>(0.0)) * 0.6);
    } else if (mode >= 0.5) {
        let v = max(exposed, vec3<f32>(0.0));
        mapped = v / (vec3<f32>(1.0) + v);
    } else {
        mapped = clamp(exposed, vec3<f32>(0.0), vec3<f32>(1.0));
    }
    let scale = max(0.0, 1.0 + post.contrast);
    let contrasted = (mapped - vec3<f32>(0.5)) * scale + vec3<f32>(0.5);
    let luma = dot(contrasted, vec3<f32>(0.2126, 0.7152, 0.0722));
    return mix(vec3<f32>(luma), contrasted, post.saturation);
}

fn linear_to_srgb(c: vec3<f32>) -> vec3<f32> {
    let x = max(c, vec3<f32>(0.0));
    let lo = x * 12.92;
    let hi = 1.055 * pow(x, vec3<f32>(1.0 / 2.4)) - 0.055;
    return select(lo, hi, x > vec3<f32>(0.0031308));
}
