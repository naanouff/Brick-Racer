/**
 * Hybrid beauty → ldrBuffer. Same grade as the path tracer.
 * `encode_srgb` stays 0: color grading and FXAA still follow, and the last pass encodes.
 */
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var hdrTex: texture_2d<f32>;
@group(0) @binding(2) var bloomTex: texture_2d<f32>;

#include "../path-tracer/display_grade.wgsl"

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let px = textureSample(hdrTex, s, uv);
    let a = clamp(px.a, 0.0, 1.0);
    var straight = vec3<f32>(0.0);
    if (a > 1e-6) {
        straight = px.rgb / a;
    }
    if (post.bloom_mix > 0.5) {
        straight += textureSample(bloomTex, s, uv).rgb;
    }
    var ldr = grade(straight * post.exposure_mul);
    if (post.encode_srgb > 0.5) {
        ldr = linear_to_srgb(ldr);
    }
    return vec4<f32>(ldr, a);
}
