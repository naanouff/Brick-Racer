/**
 * Keeps last frame's filtered AOVs and G-buffer for the next reprojection.
 * Sampled sources, storage destinations: the pair cannot be the same texture.
 */

@group(0) @binding(0) var shadowSrc: texture_2d<f32>;
@group(0) @binding(1) var reflSrc: texture_2d<f32>;
@group(0) @binding(2) var giSrc: texture_2d<f32>;
@group(0) @binding(3) var lightVisSrc: texture_2d<f32>;
@group(0) @binding(4) var shadowDst: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var reflDst: texture_storage_2d<rgba16float, write>;
@group(0) @binding(6) var giDst: texture_storage_2d<rgba16float, write>;
@group(0) @binding(7) var lightVisDst: texture_storage_2d<rgba16float, write>;
@group(0) @binding(8) var distSrc: texture_2d<f32>;
@group(0) @binding(9) var normalSrc: texture_2d<f32>;
@group(0) @binding(10) var distDst: texture_storage_2d<r32float, write>;
@group(0) @binding(11) var normalDst: texture_storage_2d<rgba16float, write>;
@group(0) @binding(12) var<storage, read> pathTracerParams: array<u32>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(shadowSrc);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }
    let p = vec2<i32>(gid.xy);
    textureStore(shadowDst, p, textureLoad(shadowSrc, p, 0));
    textureStore(reflDst, p, textureLoad(reflSrc, p, 0));
    textureStore(giDst, p, textureLoad(giSrc, p, 0));
    textureStore(lightVisDst, p, textureLoad(lightVisSrc, p, 0));
    // Pause with no reset: keep G-buffer prev frozen with the AOV history.
    if (pathTracerParams[8] == 0u && pathTracerParams[0] == 0u) {
        return;
    }
    textureStore(distDst, p, textureLoad(distSrc, p, 0));
    textureStore(normalDst, p, textureLoad(normalSrc, p, 0));
}
