/**
 * @file hybrid_denoised_select.frag.wgsl
 * @description Picks the raw hybrid beauty or the OIDN result written at rest.
 * `useDenoised` is 0 while the camera moves, so postFX keep the live image.
 */

@group(0) @binding(0) var sceneTex: texture_2d<f32>;
@group(0) @binding(1) var denoisedTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> useDenoised: f32;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let dims = vec2<f32>(textureDimensions(sceneTex));
    let px = vec2<i32>(uv * dims);
    let raw = textureLoad(sceneTex, px, 0);
    let den = textureLoad(denoisedTex, px, 0);
    return select(raw, den, useDenoised > 0.5);
}
