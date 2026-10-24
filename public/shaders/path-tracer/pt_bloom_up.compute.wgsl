/**
 * Tent 3×3 upsample of the coarser bloom level, added to the finer downsample.
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

override LEVEL: f32 = 0.0;
override COMPOSITE: f32 = 0.0;

@group(0) @binding(0) var<storage, read> post: PathTracerPostParams;
@group(0) @binding(1) var coarseHdr: texture_storage_2d<rgba16float, read>;
@group(0) @binding(2) var fineHdr: texture_storage_2d<rgba16float, read>;
@group(0) @binding(3) var dstHdr: texture_storage_2d<rgba16float, write>;

fn load_rgb(tex: texture_storage_2d<rgba16float, read>, coord: vec2<i32>, dim: vec2<u32>) -> vec3<f32> {
    if (dim.x == 0u || dim.y == 0u) { return vec3<f32>(0.0); }
    let c = clamp(coord, vec2<i32>(0), vec2<i32>(dim) - vec2<i32>(1));
    return textureLoad(tex, c).rgb;
}

fn tent(tex: texture_storage_2d<rgba16float, read>, gid: vec2<u32>, fineDim: vec2<u32>) -> vec3<f32> {
    let coarseDim = textureDimensions(tex);
    let cx = (f32(gid.x) + 0.5) * f32(coarseDim.x) / max(f32(fineDim.x), 1.0) - 0.5;
    let cy = (f32(gid.y) + 0.5) * f32(coarseDim.y) / max(f32(fineDim.y), 1.0) - 0.5;
    let nx = i32(round(cx));
    let ny = i32(round(cy));
    let axis = array<f32, 3>(1.0, 2.0, 1.0);
    var acc = vec3<f32>(0.0);
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            let wx = axis[u32(dx + 1)];
            let wy = axis[u32(dy + 1)];
            acc += load_rgb(tex, vec2<i32>(nx + dx, ny + dy), coarseDim) * (wx * wy);
        }
    }
    return acc / 16.0;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dim = textureDimensions(dstHdr);
    if (gid.x >= dim.x || gid.y >= dim.y) { return; }
    let p = vec2<i32>(i32(gid.x), i32(gid.y));
    if (post.bloom_mode < 0.5) { return; }
    if (post.bloom_mix < 0.5) {
        if (COMPOSITE > 0.5) { textureStore(dstHdr, p, vec4<f32>(0.0)); }
        return;
    }
    var color = tent(coarseHdr, gid.xy, dim);
    if (COMPOSITE < 0.5) {
        color = load_rgb(fineHdr, p, textureDimensions(fineHdr));
        if (LEVEL + 1.0 < post.bloom_levels) {
            color += tent(coarseHdr, gid.xy, dim);
        }
    } else {
        // Each level adds the full energy once: divide so intensity is the fraction kept.
        color *= max(post.bloom_intensity, 0.0) / max(post.bloom_levels, 1.0);
    }
    textureStore(dstHdr, p, vec4<f32>(color, 1.0));
}
