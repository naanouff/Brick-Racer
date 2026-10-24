/**
 * Copy this frame's AOV writes into the previous-frame textures.
 * rgba16float cannot be read_write, so each AOV is a pair.
 */

@group(0) @binding(0) var shadowSrc: texture_storage_2d<rgba16float, read>;
@group(0) @binding(1) var shadowDst: texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var reflSrc: texture_storage_2d<rgba16float, read>;
@group(0) @binding(3) var reflDst: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var giSrc: texture_storage_2d<rgba16float, read>;
@group(0) @binding(5) var giDst: texture_storage_2d<rgba16float, write>;
@group(0) @binding(6) var lightVisSrc: texture_storage_2d<rgba16float, read>;
@group(0) @binding(7) var lightVisDst: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(shadowSrc);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }
    let p = vec2<i32>(gid.xy);
    textureStore(shadowDst, p, textureLoad(shadowSrc, p));
    textureStore(reflDst, p, textureLoad(reflSrc, p));
    textureStore(giDst, p, textureLoad(giSrc, p));
    textureStore(lightVisDst, p, textureLoad(lightVisSrc, p));
}
