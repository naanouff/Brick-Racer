/**
 * One SVGF à-trous step for the four hybrid signals.
 * STEP is the pixel stride (1, 2, 4, 8, 16). PASS is the iteration index (0..4).
 * A signal whose iteration budget is already spent is copied unchanged.
 * History (.a of shadow, reflection and GI) and the shadow distance (.g) are not filtered.
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

override STEP: f32 = 1.0;
override PASS: f32 = 0.0;

@group(0) @binding(0) var<storage, read> hybridHistory: HybridHistoryParams;
@group(0) @binding(1) var shadowIn: texture_2d<f32>;
@group(0) @binding(2) var reflIn: texture_2d<f32>;
@group(0) @binding(3) var giIn: texture_2d<f32>;
@group(0) @binding(4) var lightVisIn: texture_2d<f32>;
@group(0) @binding(5) var hybridGDist: texture_2d<f32>;
@group(0) @binding(6) var hybridGNormal: texture_2d<f32>;
@group(0) @binding(7) var hybridMoments: texture_2d<f32>;
@group(0) @binding(8) var reflRaw: texture_2d<f32>;
@group(0) @binding(9) var<storage, read> pathTracerParams: array<u32>;
@group(0) @binding(20) var shadowOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(21) var reflOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(22) var giOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(23) var lightVisOut: texture_storage_2d<rgba16float, write>;

const EPS = 1e-4;

fn b3(i: i32) -> f32 {
    if (i == 0) { return 0.375; }
    if (abs(i) == 1) { return 0.25; }
    return 0.0625;
}

fn luma(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.25, 0.5, 0.25));
}

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

fn inside(p: vec2<i32>, dims: vec2<u32>) -> bool {
    return p.x >= 0 && p.y >= 0 && u32(p.x) < dims.x && u32(p.y) < dims.y;
}

fn grad_t(p: vec2<i32>, dims: vec2<u32>) -> vec2<f32> {
    let xm = max(p.x - 1, 0);
    let xp = min(p.x + 1, i32(dims.x) - 1);
    let ym = max(p.y - 1, 0);
    let yp = min(p.y + 1, i32(dims.y) - 1);
    let dx = textureLoad(hybridGDist, vec2<i32>(xp, p.y), 0).x - textureLoad(hybridGDist, vec2<i32>(xm, p.y), 0).x;
    let dy = textureLoad(hybridGDist, vec2<i32>(p.x, yp), 0).x - textureLoad(hybridGDist, vec2<i32>(p.x, ym), 0).x;
    return vec2<f32>(dx / max(f32(xp - xm), 1.0), dy / max(f32(yp - ym), 1.0));
}

fn moment_var(mu1: f32, mu2: f32) -> f32 {
    return max(mu2 - mu1 * mu1, 0.0);
}

fn shadow_iters(sun_angle: f32) -> i32 {
    return select(3, 1, sun_angle <= 1e-6);
}

fn refl_iters(rough: f32) -> i32 {
    return i32(round(mix(0.0, 5.0, smoothstep(0.02, 0.5, rough))));
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(hybridGDist);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }
    let p = vec2<i32>(i32(gid.x), i32(gid.y));
    let centerS = textureLoad(shadowIn, p, 0);
    let centerR = textureLoad(reflIn, p, 0);
    let centerG = textureLoad(giIn, p, 0);
    let centerV = textureLoad(lightVisIn, p, 0);
    // Pause with no reset: identity so HistoryCopy does not keep softening the freeze.
    if (pathTracerParams[8] == 0u && pathTracerParams[0] == 0u) {
        textureStore(shadowOut, p, centerS);
        textureStore(reflOut, p, centerR);
        textureStore(giOut, p, centerG);
        textureStore(lightVisOut, p, centerV);
        return;
    }
    let step = max(i32(round(STEP)), 1);
    let iter = i32(round(PASS));
    let t = textureLoad(hybridGDist, p, 0).x;
    if (t <= 1e-4) {
        textureStore(shadowOut, p, centerS);
        textureStore(reflOut, p, centerR);
        textureStore(giOut, p, centerG);
        textureStore(lightVisOut, p, centerV);
        return;
    }
    let packedN = textureLoad(hybridGNormal, p, 0);
    let n = decode_oct(packedN.xy);
    let rough = packedN.z;
    let sun = bitcast<f32>(pathTracerParams[19]);
    let nShadow = shadow_iters(sun);
    let nRefl = refl_iters(rough);
    let filterS = iter < nShadow;
    let filterR = iter < nRefl;
    let filterG = iter < 5;
    let filterV = iter < 5;
    if (!filterS && !filterR && !filterG && !filterV) {
        textureStore(shadowOut, p, centerS);
        textureStore(reflOut, p, centerR);
        textureStore(giOut, p, centerG);
        textureStore(lightVisOut, p, centerV);
        return;
    }
    let grad = grad_t(p, dims);
    let moments = textureLoad(hybridMoments, p, 0);
    let varR = moment_var(moments.r, moments.g);
    let varG = moment_var(moments.b, moments.a);
    let yS = centerS.r;
    let yR = luma(centerR.rgb);
    let yG = luma(centerG.rgb);
    let yV = luma(centerV.rgb);
    let varS = max(yS * 0.05, 1e-4);
    let varV = max(yV * 0.05, 1e-4);
    let sigmaLS = select(4.0, 8.0, centerS.a < 8.0);
    let sigmaLR = select(4.0, 8.0, centerR.a < 8.0);
    let sigmaLG = select(4.0, 8.0, centerG.a < 8.0);
    let sigmaLV = select(4.0, 8.0, centerS.a < 8.0);
    let hitP = textureLoad(reflRaw, p, 0).a;
    var accS = vec2<f32>(0.0);
    var accR = vec3<f32>(0.0);
    var accG = vec3<f32>(0.0);
    var accV = vec4<f32>(0.0);
    var wS = 0.0;
    var wR = 0.0;
    var wG = 0.0;
    var wV = 0.0;
    for (var j = -2; j <= 2; j++) {
        for (var i = -2; i <= 2; i++) {
            let q = p + vec2<i32>(i, j) * step;
            if (!inside(q, dims)) { continue; }
            let tq = textureLoad(hybridGDist, q, 0).x;
            if (tq <= 1e-4) { continue; }
            let nq = decode_oct(textureLoad(hybridGNormal, q, 0).xy);
            let kernel = b3(i) * b3(j);
            let delta = vec2<f32>(f32(i * step), f32(j * step));
            let depthW = exp(-abs(t - tq) / (max(hybridHistory.sigmaZ, 1.0) * abs(dot(grad, delta)) + EPS));
            let normalW = pow(max(dot(n, nq), 0.0), hybridHistory.sigmaN);
            let base = kernel * depthW * normalW;
            if (filterS) {
                let s = textureLoad(shadowIn, q, 0);
                let lumaW = exp(-abs(s.r - yS) / (sigmaLS * sqrt(varS) + EPS));
                let w = base * lumaW;
                accS += vec2<f32>(s.r, s.b) * w;
                wS += w;
            }
            if (filterR) {
                let r = textureLoad(reflIn, q, 0);
                let lumaW = exp(-abs(luma(r.rgb) - yR) / (sigmaLR * sqrt(varR) + EPS));
                var hitW = 1.0;
                if (hitP > 1e-3 && hitP < 60000.0) {
                    let hitQ = textureLoad(reflRaw, q, 0).a;
                    if (hitQ > 1e-3 && hitQ < 60000.0) {
                        hitW = exp(-abs(hitP - hitQ) / (0.1 * hitP));
                    }
                }
                let w = base * lumaW * hitW;
                accR += r.rgb * w;
                wR += w;
            }
            if (filterG) {
                let g = textureLoad(giIn, q, 0);
                let lumaW = exp(-abs(luma(g.rgb) - yG) / (sigmaLG * sqrt(varG) + EPS));
                let w = base * lumaW;
                accG += g.rgb * w;
                wG += w;
            }
            if (filterV) {
                let v = textureLoad(lightVisIn, q, 0);
                let lumaW = exp(-abs(luma(v.rgb) - yV) / (sigmaLV * sqrt(varV) + EPS));
                let w = base * lumaW;
                accV += v * w;
                wV += w;
            }
        }
    }
    var outS = centerS;
    if (filterS && wS > 1e-5) {
        let f = accS / wS;
        outS = vec4<f32>(f.x, centerS.g, f.y, centerS.a);
    }
    var outR = centerR;
    if (filterR && wR > 1e-5) {
        outR = vec4<f32>(accR / wR, centerR.a);
    }
    var outG = centerG;
    if (filterG && wG > 1e-5) {
        outG = vec4<f32>(accG / wG, centerG.a);
    }
    var outV = centerV;
    if (filterV && wV > 1e-5) {
        outV = accV / wV;
    }
    textureStore(shadowOut, p, outS);
    textureStore(reflOut, p, outR);
    textureStore(giOut, p, outG);
    textureStore(lightVisOut, p, outV);
}
