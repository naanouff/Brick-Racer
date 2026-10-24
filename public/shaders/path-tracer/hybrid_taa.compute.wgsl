/**
 * Full-resolution TAA. History is Catmull-Rom filtered, clipped in YCoCg
 * against the current 3×3 neighborhood, then blended.
 * Alpha is 0.1, 0.2 above 8 px of motion, and 1 on disocclusion.
 */

struct HybridHistoryParams {
    viewProj: mat4x4<f32>,
    invViewProj: mat4x4<f32>,
    prevViewProj: mat4x4<f32>,
    prevInvViewProj: mat4x4<f32>,
    cameraPos: vec4<f32>,
    prevCameraPos: vec4<f32>,
    frameIndex: u32,
    historyReset: u32,
    resX: u32,
    resY: u32,
    traceX: u32,
    traceY: u32,
    traceScale: f32,
    offsetX: f32,
    offsetY: f32,
    sigmaZ: f32,
    sigmaN: f32,
    sigmaL: f32,
    alphaMin: f32,
    jitterX: f32,
    jitterY: f32,
    _pad2: f32,
}

@group(0) @binding(0) var colorTex: texture_2d<f32>;
@group(0) @binding(1) var historyTex: texture_2d<f32>;
@group(0) @binding(2) var motionTex: texture_2d<f32>;
@group(0) @binding(3) var distTex: texture_2d<f32>;
@group(0) @binding(4) var outTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var<storage, read> history: HybridHistoryParams;

fn luma(rgb: vec3<f32>) -> f32 {
    return dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn rgb_to_ycocg(rgb: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(
        dot(rgb, vec3<f32>(0.25, 0.5, 0.25)),
        dot(rgb, vec3<f32>(0.5, 0.0, -0.5)),
        dot(rgb, vec3<f32>(-0.25, 0.5, -0.25))
    );
}

fn ycocg_to_rgb(ycc: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(ycc.x + ycc.y - ycc.z, ycc.x + ycc.z, ycc.x - ycc.y - ycc.z);
}

fn sample_color(coord: vec2<i32>, size: vec2<i32>) -> vec3<f32> {
    let clamped = clamp(coord, vec2<i32>(0), size - vec2<i32>(1));
    return textureLoad(colorTex, clamped, 0).rgb;
}

fn sample_history(coord: vec2<i32>, size: vec2<i32>) -> vec3<f32> {
    let clamped = clamp(coord, vec2<i32>(0), size - vec2<i32>(1));
    return textureLoad(historyTex, clamped, 0).rgb;
}

fn catmull(t: f32, c0: vec3<f32>, c1: vec3<f32>, c2: vec3<f32>, c3: vec3<f32>) -> vec3<f32> {
    let t2 = t * t;
    let t3 = t2 * t;
    return 0.5 * (
        (2.0 * c1) +
        (-c0 + c2) * t +
        (2.0 * c0 - 5.0 * c1 + 4.0 * c2 - c3) * t2 +
        (-c0 + 3.0 * c1 - 3.0 * c2 + c3) * t3
    );
}

fn catmull_history(uv: vec2<f32>, size: vec2<i32>) -> vec3<f32> {
    let p = uv * vec2<f32>(size) - vec2<f32>(0.5);
    let base = vec2<i32>(floor(p));
    let f = fract(p);
    var rows: array<vec3<f32>, 4>;
    for (var y = 0; y < 4; y++) {
        rows[y] = catmull(
            f.x,
            sample_history(base + vec2<i32>(-1, y - 1), size),
            sample_history(base + vec2<i32>(0, y - 1), size),
            sample_history(base + vec2<i32>(1, y - 1), size),
            sample_history(base + vec2<i32>(2, y - 1), size)
        );
    }
    return max(catmull(f.y, rows[0], rows[1], rows[2], rows[3]), vec3<f32>(0.0));
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let size = vec2<i32>(textureDimensions(colorTex));
    if (gid.x >= u32(size.x) || gid.y >= u32(size.y)) {
        return;
    }
    let pixel = vec2<i32>(i32(gid.x), i32(gid.y));
    let current = sample_color(pixel, size);
    let motion = textureLoad(motionTex, pixel, 0).rg;
    let uv = (vec2<f32>(pixel) + vec2<f32>(0.5)) / vec2<f32>(size);
    let histUv = uv - motion;
    let outside = histUv.x < 0.0 || histUv.y < 0.0 || histUv.x > 1.0 || histUv.y > 1.0;
    let speed = length(motion * vec2<f32>(size));
    var alpha = select(0.1, 0.2, speed > 8.0);
    let depth = textureLoad(distTex, pixel, 0).r;
    let histPx = vec2<i32>(histUv * vec2<f32>(size));
    let histDepth = textureLoad(distTex, clamp(histPx, vec2<i32>(0), size - vec2<i32>(1)), 0).r;
    if (outside || history.historyReset != 0u || abs(histDepth - depth) > 0.05 * max(depth, 1e-3)) {
        alpha = 1.0;
    }
    var lo = rgb_to_ycocg(current);
    var hi = lo;
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            let ycc = rgb_to_ycocg(sample_color(pixel + vec2<i32>(dx, dy), size));
            lo = min(lo, ycc);
            hi = max(hi, ycc);
        }
    }
    var historyRgb = current;
    if (alpha < 1.0) {
        let clipped = clamp(rgb_to_ycocg(catmull_history(histUv, size)), lo, hi);
        historyRgb = ycocg_to_rgb(clipped);
    }
    let flicker = 1.0 / (1.0 + luma(current));
    let histW = (1.0 - alpha) * flicker;
    let resolved = (current * alpha + historyRgb * histW) / max(alpha + histW, 1e-4);
    textureStore(outTex, pixel, vec4<f32>(resolved, 1.0));
}
