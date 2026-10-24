/**
 * Zeros the path-trace tile buffers when accumulation resets (pathTracerParams[0] != 0).
 * Progressive dispatch only writes the Bayer sublattice, so pixels not traced this frame
 * would otherwise keep the previous view. a=0 marks a hole for HoleFill.
 */

@group(0) @binding(0) var<storage, read> pathTracerParams: array<u32>;
@group(0) @binding(1) var pathTraceOutput: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var pathTraceAccumWrite: texture_storage_2d<rgba32float, write>;
@group(0) @binding(3) var pathTraceGuide: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var pathTraceAlbedo: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var pathTraceObjectId: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    if (pathTracerParams[0] == 0u) {
        return;
    }
    let dims = textureDimensions(pathTraceOutput);
    if (gid.x >= dims.x || gid.y >= dims.y) {
        return;
    }
    let p = vec2<i32>(i32(gid.x), i32(gid.y));
    textureStore(pathTraceOutput, p, vec4<f32>(0.0));
    textureStore(pathTraceAccumWrite, p, vec4<f32>(0.0));
    textureStore(pathTraceGuide, p, vec4<f32>(0.0));
    textureStore(pathTraceAlbedo, p, vec4<f32>(0.0));
    textureStore(pathTraceObjectId, p, vec4<f32>(0.0));
}
