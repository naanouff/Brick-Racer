/**
 * HDR glare written after FSR, before the display blit.
 * Same gather as `accumulateGlare` in `pathTracerPost.ts`:
 * Rec.709 luminance, strict threshold, `numRays` lines (both directions),
 * 16 taps. Weight is `glare * exp(-3 * t) / 16 * BLOOM_WEIGHT_SCALE`.
 * The scale (0.25) keeps the small stars from reading as bright ticks.
 * Only the luminance above the threshold is added. Length is `size * min(width, height)`.
 * `bloom_mix` < 0.5 stores black (Interactive / Refining).
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

@group(0) @binding(0) var<storage, read> post: PathTracerPostParams;
@group(0) @binding(1) var srcHdr: texture_storage_2d<rgba16float, read>;
@group(0) @binding(2) var dstHdr: texture_storage_2d<rgba16float, write>;

const BLOOM_STEPS: u32 = 16u;
const BLOOM_FALLOFF: f32 = 3.0;
const BLOOM_WEIGHT_SCALE: f32 = 0.25;
const PI: f32 = 3.141592653589793;

fn tap_contrib(coord: vec2<i32>, dim: vec2<u32>, weight: f32) -> vec3<f32> {
    if (coord.x < 0 || coord.y < 0 || u32(coord.x) >= dim.x || u32(coord.y) >= dim.y) {
        return vec3<f32>(0.0);
    }
    let px = textureLoad(srcHdr, coord);
    // Alpha above 1 is the progressive spp, not opacity. Match pt_display: clamp before the divide.
    let a = clamp(px.a, 0.0, 1.0);
    var rgb = vec3<f32>(0.0);
    if (a > 1e-6) {
        rgb = px.rgb / a;
    }
    let lum = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    if (lum > post.threshold) {
        let excess = (lum - post.threshold) / lum;
        return rgb * excess * weight;
    }
    return vec3<f32>(0.0);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dim = textureDimensions(dstHdr);
    if (gid.x >= dim.x || gid.y >= dim.y) {
        return;
    }
    let p = vec2<i32>(i32(gid.x), i32(gid.y));
    let rays = min(u32(max(post.num_rays, 0.0)), 8u);
    if (post.bloom_mode >= 0.5) {
        return;
    }
    if (post.bloom_mix < 0.5 || rays == 0u || post.size <= 0.0 || post.glare == 0.0) {
        textureStore(dstHdr, p, vec4<f32>(0.0));
        return;
    }
    let len_px = post.size * f32(min(dim.x, dim.y));
    var acc = vec3<f32>(0.0);
    for (var ray: u32 = 0u; ray < rays; ray++) {
        let ang = post.rotation + f32(ray) * PI / f32(rays);
        let dir = vec2<f32>(cos(ang), sin(ang));
        for (var step: u32 = 1u; step <= BLOOM_STEPS; step++) {
            let t = f32(step) / f32(BLOOM_STEPS);
            let dist = t * len_px;
            let weight = post.glare * exp(-BLOOM_FALLOFF * t) / f32(BLOOM_STEPS) * BLOOM_WEIGHT_SCALE;
            for (var sign: i32 = -1; sign <= 1; sign += 2) {
                let off = vec2<i32>(dir * dist * f32(sign));
                if (off.x == 0 && off.y == 0) {
                    continue;
                }
                acc += tap_contrib(p + off, dim, weight);
            }
        }
    }
    textureStore(dstHdr, p, vec4<f32>(acc, 0.0));
}
