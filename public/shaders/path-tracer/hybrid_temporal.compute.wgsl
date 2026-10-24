/**
 * Full-resolution temporal super-resolution of the hybrid AOVs.
 * A traced pixel injects its raw sample. The other pixels reconstruct it
 * from the traced 3×3 neighborhood, then blend with the reprojected history.
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
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
}

@group(0) @binding(0) var<storage, read> hybridHistory: HybridHistoryParams;
@group(0) @binding(1) var shadowRaw: texture_2d<f32>;
@group(0) @binding(2) var reflRaw: texture_2d<f32>;
@group(0) @binding(3) var giRaw: texture_2d<f32>;
@group(0) @binding(4) var lightVisRaw: texture_2d<f32>;
@group(0) @binding(5) var shadowHist: texture_2d<f32>;
@group(0) @binding(6) var reflHist: texture_2d<f32>;
@group(0) @binding(7) var giHist: texture_2d<f32>;
@group(0) @binding(8) var lightVisHist: texture_2d<f32>;
@group(0) @binding(9) var hybridGDist: texture_2d<f32>;
@group(0) @binding(10) var hybridGNormal: texture_2d<f32>;
@group(0) @binding(11) var hybridGMotion: texture_2d<f32>;
@group(0) @binding(12) var hybridGDistPrev: texture_2d<f32>;
@group(0) @binding(13) var hybridGNormalPrev: texture_2d<f32>;
@group(0) @binding(14) var<storage, read> pathTracerParams: array<u32>;
@group(0) @binding(15) var hybridFastHist: texture_2d<f32>;
@group(0) @binding(16) var hybridMomentsHist: texture_2d<f32>;
@group(0) @binding(20) var shadowFilt: texture_storage_2d<rgba16float, write>;
@group(0) @binding(21) var reflFilt: texture_storage_2d<rgba16float, write>;
@group(0) @binding(22) var giFilt: texture_storage_2d<rgba16float, write>;
@group(0) @binding(23) var lightVisFilt: texture_storage_2d<rgba16float, write>;
@group(0) @binding(24) var hybridFastFilt: texture_storage_2d<rgba16float, write>;
@group(0) @binding(25) var hybridMomentsFilt: texture_storage_2d<rgba16float, write>;

const BETA = 0.25;
// History cap. A still camera keeps refining like the phase 1 accumulation; a moving one
// stays short so disocclusions and lighting catch up. 1024 keeps +1 steps exact in f16.
const H_STATIC = 1024.0;

fn sign_not_zero(v: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(select(-1.0, 1.0, v.x >= 0.0), select(-1.0, 1.0, v.y >= 0.0));
}

fn decode_oct(e: vec2<f32>) -> vec3<f32> {
    var n = vec3<f32>(e.xy, 1.0 - abs(e.x) - abs(e.y));
    if (n.z < 0.0) {
        let xy = (1.0 - abs(n.yx)) * sign_not_zero(n.xy);
        n = vec3<f32>(xy, n.z);
    }
    return normalize(n);
}

fn rgb_to_ycocg(c: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(
        dot(c, vec3<f32>(0.25, 0.5, 0.25)),
        dot(c, vec3<f32>(0.5, 0.0, -0.5)),
        dot(c, vec3<f32>(-0.25, 0.5, -0.25)),
    );
}

fn ycocg_to_rgb(c: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z);
}

fn clip_ycocg(hist: vec3<f32>, mu: vec3<f32>, sigma: vec3<f32>, gamma: f32) -> vec3<f32> {
    let h = rgb_to_ycocg(hist);
    return ycocg_to_rgb(clamp(h, mu - gamma * sigma, mu + gamma * sigma));
}

fn bilateral_weight(dp: vec2<f32>, t: f32, tq: f32, ndot: f32, sigmaS: f32) -> f32 {
    let spatial = exp(-dot(dp, dp) / (2.0 * sigmaS * sigmaS));
    let depth = exp(-abs(t - tq) / (0.05 * max(t, 1e-4)));
    let normal = pow(max(ndot, 0.0), 32.0);
    return spatial * depth * normal;
}

fn history_alpha(hPrev: f32, fresh: bool, hMax: f32, alphaMin: f32) -> vec2<f32> {
    let w = select(BETA, 1.0, fresh);
    let h = min(hPrev + w, hMax);
    let alpha = max(w / max(h, 1e-4), alphaMin);
    return vec2<f32>(h, alpha);
}

fn reflection_h_max(roughness: f32) -> f32 {
    let t = smoothstep(0.05, 0.4, roughness);
    return mix(4.0, 32.0, t);
}

fn camera_moved() -> bool {
    var d = 0.0;
    for (var c = 0; c < 4; c++) {
        let delta = abs(hybridHistory.viewProj[c] - hybridHistory.prevViewProj[c]);
        d = max(d, max(max(delta.x, delta.y), max(delta.z, delta.w)));
    }
    return d > 1e-5;
}

fn trace_step() -> i32 {
    let scale = max(hybridHistory.traceScale, 0.25);
    return max(i32(round(1.0 / scale)), 1);
}

fn inside(p: vec2<i32>, dims: vec2<u32>) -> bool {
    return p.x >= 0 && p.y >= 0 && u32(p.x) < dims.x && u32(p.y) < dims.y;
}

fn clip_gamma(kind: u32, h: f32, moving: bool) -> f32 {
    // 0 shadow, 1 reflection → 1. 2 GI, 3 light visibility → 1.5.
    let gamma_move = select(1.0, 1.5, kind >= 2u);
    if (moving) { return gamma_move; }
    return mix(gamma_move, 3.0, saturate(h / 32.0));
}

fn motion_h_max(speed_px: f32) -> f32 {
    return mix(32.0, 8.0, saturate(speed_px / 16.0));
}

fn luma(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.25, 0.5, 0.25));
}

fn clip_signal(hist: vec3<f32>, current: vec3<f32>, sum_y: vec3<f32>, sum_y2: vec3<f32>, sum_w: f32, gamma: f32) -> vec3<f32> {
    var mu: vec3<f32>;
    var sigma: vec3<f32>;
    if (sum_w > 1e-4) {
        mu = sum_y / sum_w;
        let variance = max(sum_y2 / sum_w - mu * mu, vec3<f32>(0.0));
        sigma = sqrt(variance);
    } else {
        mu = rgb_to_ycocg(current);
        sigma = vec3<f32>(0.0);
    }
    return clip_ycocg(hist, mu, sigma, gamma);
}

fn footprint_history(h: f32, alpha: f32, w_sum: f32, valid: bool, fresh: bool, alpha_min: f32) -> vec2<f32> {
    if (!valid || w_sum <= 1e-5) {
        return vec2<f32>(0.0, 1.0);
    }
    if (w_sum < 0.5) {
        let capped = min(h, 2.0);
        let w = select(BETA, 1.0, fresh);
        return vec2<f32>(capped, max(w / max(capped, 1e-4), alpha_min));
    }
    return vec2<f32>(h, alpha);
}

fn fast_alpha(h: f32) -> f32 {
    return 1.0 / max(min(h, 4.0), 1.0);
}

fn moment_sigma(mu1: f32, mu2: f32) -> f32 {
    return sqrt(max(mu2 - mu1 * mu1, 0.0));
}

fn neighborhood_sigma(sum1: f32, sum2: f32, w: f32) -> f32 {
    if (w <= 1e-5) { return 0.0; }
    let mu = sum1 / w;
    return sqrt(max(sum2 / w - mu * mu, 0.0));
}

struct Reproj {
    colorS: vec4<f32>,
    colorR: vec4<f32>,
    colorG: vec4<f32>,
    colorV: vec4<f32>,
    fast: vec4<f32>,
    moments: vec4<f32>,
    wSum: f32,
    valid: bool,
}

fn reproject(uvPrev: vec2<f32>, t: f32, n: vec3<f32>, pCur: vec3<f32>, strict: bool) -> Reproj {
    var out: Reproj;
    let dims = textureDimensions(shadowHist);
    let fdims = vec2<f32>(dims);
    if (uvPrev.x < 0.0 || uvPrev.y < 0.0 || uvPrev.x > 1.0 || uvPrev.y > 1.0) {
        return out;
    }
    let pos = uvPrev * fdims - 0.5;
    let p0 = vec2<i32>(floor(pos));
    let f = fract(pos);
    let wTap = array<f32, 4>(
        (1.0 - f.x) * (1.0 - f.y),
        f.x * (1.0 - f.y),
        (1.0 - f.x) * f.y,
        f.x * f.y,
    );
    let taps = array<vec2<i32>, 4>(
        p0,
        p0 + vec2<i32>(1, 0),
        p0 + vec2<i32>(0, 1),
        p0 + vec2<i32>(1, 1),
    );
    var sumW = 0.0;
    var accS = vec4<f32>(0.0);
    var accR = vec4<f32>(0.0);
    var accG = vec4<f32>(0.0);
    var accV = vec4<f32>(0.0);
    var accF = vec4<f32>(0.0);
    var accM = vec4<f32>(0.0);
    for (var i = 0; i < 4; i++) {
        let q = taps[i];
        if (!inside(q, dims)) { continue; }
        let tq = textureLoad(hybridGDistPrev, q, 0).x;
        if (tq <= 1e-4) { continue; }
        if (strict) {
            let nq = decode_oct(textureLoad(hybridGNormalPrev, q, 0).xy);
            if (dot(nq, n) < 0.9) { continue; }
            let uvq = (vec2<f32>(q) + 0.5) / fdims;
            let ndc = vec4<f32>(uvq.x * 2.0 - 1.0, 1.0 - uvq.y * 2.0, 0.0, 1.0);
            let worldH = hybridHistory.prevInvViewProj * ndc;
            let rdq = normalize(worldH.xyz / worldH.w - hybridHistory.prevCameraPos.xyz);
            let pq = hybridHistory.prevCameraPos.xyz + rdq * tq;
            if (abs(dot(n, pq - pCur)) > 0.01 * max(t, 1e-3)) { continue; }
        }
        let w = wTap[i];
        sumW += w;
        accS += textureLoad(shadowHist, q, 0) * w;
        accR += textureLoad(reflHist, q, 0) * w;
        accG += textureLoad(giHist, q, 0) * w;
        accV += textureLoad(lightVisHist, q, 0) * w;
        accF += textureLoad(hybridFastHist, q, 0) * w;
        accM += textureLoad(hybridMomentsHist, q, 0) * w;
    }
    if (sumW <= 1e-5) { return out; }
    out.valid = true;
    out.wSum = sumW;
    out.colorS = accS / sumW;
    out.colorR = accR / sumW;
    out.colorG = accG / sumW;
    out.colorV = accV / sumW;
    out.fast = accF / sumW;
    out.moments = accM / sumW;
    return out;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(hybridGDist);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }
    let p = vec2<i32>(i32(gid.x), i32(gid.y));
    // Pause with no reset: freeze filtered history (do not grow h / reproject).
    // pathTracerParams[8]=traceThisFrame, [0]=resetAccum.
    if (pathTracerParams[8] == 0u && pathTracerParams[0] == 0u) {
        textureStore(shadowFilt, p, textureLoad(shadowHist, p, 0));
        textureStore(reflFilt, p, textureLoad(reflHist, p, 0));
        textureStore(giFilt, p, textureLoad(giHist, p, 0));
        textureStore(lightVisFilt, p, textureLoad(lightVisHist, p, 0));
        textureStore(hybridFastFilt, p, textureLoad(hybridFastHist, p, 0));
        textureStore(hybridMomentsFilt, p, textureLoad(hybridMomentsHist, p, 0));
        return;
    }
    let t = textureLoad(hybridGDist, p, 0).x;
    if (t <= 1e-4) {
        textureStore(shadowFilt, p, vec4<f32>(1.0, 0.0, 0.0, 0.0));
        textureStore(reflFilt, p, vec4<f32>(0.0));
        textureStore(giFilt, p, vec4<f32>(0.0));
        textureStore(lightVisFilt, p, vec4<f32>(1.0, 1.0, 1.0, 1.0));
        textureStore(hybridFastFilt, p, vec4<f32>(1.0, 0.0, 0.0, 1.0));
        textureStore(hybridMomentsFilt, p, vec4<f32>(0.0));
        return;
    }
    let packedN = textureLoad(hybridGNormal, p, 0);
    let n = decode_oct(packedN.xy);
    let rough = max(packedN.z, 0.04);
    let step = trace_step();
    let ox = i32(hybridHistory.offsetX + 0.5);
    let oy = i32(hybridHistory.offsetY + 0.5);
    // Scene, light and feature resets retrace the full frame (pathTracerParams[0]).
    let reset = hybridHistory.historyReset != 0u || pathTracerParams[0] != 0u;
    let fresh = reset || step <= 1 || ((p.x - ox) % step == 0 && (p.y - oy) % step == 0 && p.x >= ox && p.y >= oy);
    let sigmaS = max(f32(step), 1.0);

    var sumW = 0.0;
    var sumS = vec3<f32>(0.0);
    var sumR = vec3<f32>(0.0);
    var sumG = vec3<f32>(0.0);
    var sumV = vec4<f32>(0.0);
    var sumY = vec3<f32>(0.0);
    var sumY2 = vec3<f32>(0.0);
    var sumGy = vec3<f32>(0.0);
    var sumGy2 = vec3<f32>(0.0);
    var sumReflW = 0.0;
    var sumReflT = 0.0;
    var sumGiW = 0.0;
    var sumSy = vec3<f32>(0.0);
    var sumSy2 = vec3<f32>(0.0);
    var sumVy = vec3<f32>(0.0);
    var sumVy2 = vec3<f32>(0.0);
    var sumVis = 0.0;
    var sumVis2 = 0.0;
    var sumAo = 0.0;
    var sumAo2 = 0.0;
    let block = vec2<i32>((p.x - ox) / step, (p.y - oy) / step);
    for (var dj = -1; dj <= 1; dj++) {
        for (var di = -1; di <= 1; di++) {
            let q = (block + vec2<i32>(di, dj)) * step + vec2<i32>(ox, oy);
            if (!inside(q, dims)) { continue; }
            let tq = textureLoad(hybridGDist, q, 0).x;
            if (tq <= 1e-4) { continue; }
            let nq = decode_oct(textureLoad(hybridGNormal, q, 0).xy);
            let w = bilateral_weight(vec2<f32>(p - q), t, tq, dot(n, nq), sigmaS);
            if (w <= 0.0) { continue; }
            let s = textureLoad(shadowRaw, q, 0);
            let r = textureLoad(reflRaw, q, 0);
            let g = textureLoad(giRaw, q, 0);
            let v = textureLoad(lightVisRaw, q, 0);
            sumW += w;
            sumS += s.rgb * w;
            sumV += v * w;
            sumVis += s.r * w;
            sumVis2 += s.r * s.r * w;
            sumAo += v.a * w;
            sumAo2 += v.a * v.a * w;
            let sy = rgb_to_ycocg(vec3<f32>(s.r, 0.0, s.b));
            sumSy += sy * w;
            sumSy2 += sy * sy * w;
            let vy = rgb_to_ycocg(v.rgb);
            sumVy += vy * w;
            sumVy2 += vy * vy * w;
            if (r.a > 0.0) {
                sumReflW += w;
                sumReflT += r.a * w;
                sumR += r.rgb * w;
                let y = rgb_to_ycocg(r.rgb);
                sumY += y * w;
                sumY2 += y * y * w;
            }
            if (g.a > 0.5) {
                sumGiW += w;
                sumG += g.rgb * w;
                let y = rgb_to_ycocg(g.rgb);
                sumGy += y * w;
                sumGy2 += y * y * w;
            }
        }
    }

    let rawS = textureLoad(shadowRaw, p, 0);
    let rawR = textureLoad(reflRaw, p, 0);
    let rawG = textureLoad(giRaw, p, 0);
    let rawV = textureLoad(lightVisRaw, p, 0);
    var newS = rawS.rgb;
    var newR = rawR.rgb;
    var newG = rawG.rgb;
    var newV = rawV;
    // No traced neighbor on this surface: hold the history, it gets a sample later.
    let hasSample = fresh || sumW > 1e-5;
    if (!fresh && sumW > 1e-5) {
        newS = sumS / sumW;
        newV = sumV / sumW;
        if (sumReflW > 1e-5) { newR = sumR / sumReflW; }
        if (sumGiW > 1e-5) { newG = sumG / sumGiW; }
    }

    let uv = (vec2<f32>(p) + 0.5) / vec2<f32>(dims);
    let ndc = vec4<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
    let worldH = hybridHistory.invViewProj * ndc;
    let rd = normalize(worldH.xyz / worldH.w - hybridHistory.cameraPos.xyz);
    let pCur = hybridHistory.cameraPos.xyz + rd * t;
    let motion = textureLoad(hybridGMotion, p, 0).xy;
    let surfaceUv = uv - motion;
    var hitT = rawR.a;
    if (!fresh && sumReflW > 1e-5) { hitT = sumReflT / sumReflW; }
    var reflUv = surfaceUv;
    let virtualW = 1.0 - smoothstep(0.1, 0.4, rough);
    if (virtualW > 0.5 && hitT > 1e-3 && hitT < 60000.0) {
        let xv = hybridHistory.cameraPos.xyz + rd * (t + hitT);
        let clip = hybridHistory.prevViewProj * vec4<f32>(xv, 1.0);
        if (clip.w > 1e-4) {
            let prevNdc = clip.xy / clip.w;
            reflUv = vec2<f32>(prevNdc.x * 0.5 + 0.5, 0.5 - prevNdc.y * 0.5);
        }
    }

    let histS = reproject(surfaceUv, t, n, pCur, true);
    var histVirtualR: Reproj;
    if (reflUv.x != surfaceUv.x || reflUv.y != surfaceUv.y) {
        histVirtualR = reproject(reflUv, t, n, pCur, false);
    }
    let yMean = select(luma(newR), luma(sumR / max(sumReflW, 1e-5)), sumReflW > 1e-5);
    let pickVirtual = histVirtualR.valid && (!histS.valid || abs(luma(histVirtualR.colorR.rgb) - yMean) < abs(luma(histS.colorR.rgb) - yMean));
    var histR = histS;
    if (pickVirtual) { histR = histVirtualR; }
    let alphaMin = hybridHistory.alphaMin;
    let camMoving = camera_moved();
    let speedPx = length(motion) * f32(hybridHistory.resX);
    let moving = camMoving || speedPx > 0.5;
    let motionCap = motion_h_max(speedPx);
    let hCap = select(H_STATIC, motionCap, moving);
    let hReflCap = select(H_STATIC, min(reflection_h_max(rough), motionCap), moving);
    var hs = history_alpha(min(select(0.0, histS.colorS.a, histS.valid && !reset), hCap), fresh, hCap, alphaMin);
    hs = footprint_history(hs.x, hs.y, histS.wSum, histS.valid && !reset, fresh, alphaMin);
    let hasRefl = rawR.a > 0.0 || (!fresh && sumReflW > 1e-5);
    var hr = history_alpha(min(select(0.0, histR.colorR.a, histR.valid && !reset && hasRefl), hReflCap), fresh && hasRefl, hReflCap, alphaMin);
    hr = footprint_history(hr.x, hr.y, histR.wSum, histR.valid && !reset && hasRefl, fresh && hasRefl, alphaMin);
    // At rest, a pixel with its own history waits for its next traced frame:
    // the neighbor reconstruction would smear mirror detail.
    let holdR = hasRefl && !fresh && !moving && histR.valid && !reset && histR.colorR.a >= 1.0;
    if (holdR) {
        hr = vec2<f32>(histR.colorR.a, 0.0);
    }
    let hasGi = rawG.a > 0.5 || (!fresh && sumGiW > 1e-5);
    var hg = history_alpha(min(select(0.0, histS.colorG.a, histS.valid && !reset && hasGi), hCap), fresh && hasGi, hCap, alphaMin);
    hg = footprint_history(hg.x, hg.y, histS.wSum, histS.valid && !reset && hasGi, fresh && hasGi, alphaMin);

    let histValid = histS.valid && !reset;
    var baseS = newS;
    var baseV = newV.rgb;
    if (histValid) {
        let clippedS = clip_signal(vec3<f32>(histS.colorS.r, 0.0, histS.colorS.b), vec3<f32>(newS.r, 0.0, newS.b), sumSy, sumSy2, sumW, clip_gamma(0u, hs.x, moving));
        baseS = vec3<f32>(clippedS.r, newS.g, clippedS.b);
        baseV = clip_signal(histS.colorV.rgb, newV.rgb, sumVy, sumVy2, sumW, clip_gamma(3u, hs.x, moving));
    }
    var baseR = newR;
    if (histR.valid && !reset && hasRefl) {
        baseR = clip_signal(histR.colorR.rgb, newR, sumY, sumY2, sumReflW, clip_gamma(1u, hr.x, moving));
    }
    var baseG = newG;
    if (histValid && hasGi) {
        baseG = clip_signal(histS.colorG.rgb, newG, sumGy, sumGy2, sumGiW, clip_gamma(2u, hg.x, moving));
    }
    var outR = mix(baseR, newR, select(0.0, hr.y, hasRefl));
    if (holdR) {
        outR = histR.colorR.rgb;
    }
    var outG = mix(baseG, newG, select(0.0, hg.y, hasGi));
    var hsOut = hs;
    if (!hasSample && histValid) {
        hsOut = vec2<f32>(min(histS.colorS.a, hs.x), 0.0);
    }
    var outS = mix(select(newS, baseS, histValid), newS, hsOut.y);
    var outV = mix(select(newV.rgb, baseV, histValid), newV.rgb, hsOut.y);
    var outAo = mix(select(newV.a, histS.colorV.a, histValid), newV.a, hsOut.y);

    let fastHistS = select(vec4<f32>(0.0), histS.fast, histValid);
    let fastHistR = select(vec4<f32>(0.0), histR.fast, histR.valid && !reset && hasRefl);
    let momS = select(vec4<f32>(0.0), histS.moments, histValid);
    let momR = select(vec4<f32>(0.0), histR.moments, histR.valid && !reset && hasRefl);
    let yNewR = luma(newR);
    let yNewG = luma(newG);
    let yFastS = mix(fastHistS.r, newS.r, fast_alpha(hsOut.x));
    let yFastR = select(mix(fastHistR.g, yNewR, fast_alpha(hr.x)), fastHistR.g, holdR);
    let yFastG = mix(fastHistS.b, yNewG, fast_alpha(hg.x));
    let yFastAo = mix(fastHistS.a, newV.a, fast_alpha(hsOut.x));
    let sigmaVis = neighborhood_sigma(sumVis, sumVis2, sumW);
    let sigmaAo = neighborhood_sigma(sumAo, sumAo2, sumW);
    let sigmaR = select(neighborhood_sigma(sumY.x, sumY2.x, sumReflW), moment_sigma(momR.r, momR.g), hr.x >= 4.0);
    let sigmaG = select(neighborhood_sigma(sumGy.x, sumGy2.x, sumGiW), moment_sigma(momS.b, momS.a), hg.x >= 4.0);

    if (abs(outS.r - yFastS) > 2.0 * sigmaVis) {
        outS.x = outS.r * (yFastS / max(outS.r, 1e-4));
        hsOut.x = min(hsOut.x, 4.0);
    }
    if (hasRefl && !holdR && abs(luma(outR) - yFastR) > 2.0 * sigmaR) {
        outR = outR * (yFastR / max(luma(outR), 1e-4));
        hr.x = min(hr.x, 4.0);
    }
    if (hasGi && abs(luma(outG) - yFastG) > 2.0 * sigmaG) {
        outG = outG * (yFastG / max(luma(outG), 1e-4));
        hg.x = min(hg.x, 4.0);
    }
    if (abs(outAo - yFastAo) > 2.0 * sigmaAo) {
        outAo = outAo * (yFastAo / max(outAo, 1e-4));
    }

    let yKeepR = luma(outR);
    let yKeepG = luma(outG);
    let aR = select(0.0, hr.y, hasRefl);
    let aG = select(0.0, hg.y, hasGi);
    let momentsOut = vec4<f32>(
        mix(momR.r, yKeepR, aR),
        mix(momR.g, yKeepR * yKeepR, aR),
        mix(momS.b, yKeepG, aG),
        mix(momS.a, yKeepG * yKeepG, aG),
    );

    // g is the camera distance the raster depth test compares against: never blend it.
    textureStore(shadowFilt, p, vec4<f32>(outS.r, t, outS.b, hsOut.x));
    textureStore(reflFilt, p, vec4<f32>(select(vec3<f32>(0.0), outR, hasRefl), select(0.0, hr.x, hasRefl)));
    textureStore(giFilt, p, vec4<f32>(select(vec3<f32>(0.0), outG, hasGi), select(0.0, hg.x, hasGi)));
    textureStore(lightVisFilt, p, vec4<f32>(outV, outAo));
    textureStore(hybridFastFilt, p, vec4<f32>(yFastS, yFastR, yFastG, yFastAo));
    textureStore(hybridMomentsFilt, p, momentsOut);
}
