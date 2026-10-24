/**
 * Hybrid G-buffer for static opaque meshes.
 * Same vertex layout as the shader-graph pass (no skin, wind, or billboard).
 * Geometric normal. Roughness and metal come from the per-material uniform.
 * Albedo is the base-color factor. The instance color already holds diffuseColor (BatchingSystem),
 * which the graph PBR does not apply, so it is not multiplied in. Sky stays at distance 0.
 */

struct FrameUniforms {
    projectionMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
    inverseViewProjectionMatrix: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    @size(64) lightMatrix: mat4x4<f32>,
    lightDirection: vec3<f32>,
    lightColor: vec3<f32>,
    ambientLightIntensity: f32,
    debugViewMode: u32,
    totalTime: f32,
};

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) uv1: vec2<f32>,
    @location(3) normal: vec3<f32>,
    @location(4) tangent: vec3<f32>,
    @location(5) bitangent: vec3<f32>,
    @location(6) color: vec4<f32>,
};

struct InstanceInput {
    @location(7) modelMatrix_r1: vec4<f32>,
    @location(8) modelMatrix_r2: vec4<f32>,
    @location(9) modelMatrix_r3: vec4<f32>,
    @location(10) modelMatrix_r4: vec4<f32>,
    @location(11) inverseModel_r1: vec4<f32>,
    @location(12) inverseModel_r2: vec4<f32>,
    @location(13) inverseModel_r3: vec4<f32>,
    @location(14) inverseModel_r4: vec4<f32>,
    @location(15) color: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) world_position: vec3<f32>,
    @location(1) world_normal: vec3<f32>,
    @location(2) prev_clip: vec4<f32>,
    @location(3) cur_clip: vec4<f32>,
};

struct GBufferMaterial {
    baseColor: vec4<f32>,
    roughness: f32,
    metallic: f32,
    _pad: vec2<f32>,
};

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
};

struct GBufferOutput {
    @location(0) dist: f32,
    @location(1) normalRoughMetal: vec4<f32>,
    @location(2) motion: vec2<f32>,
    @location(3) albedo: vec4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(1) @binding(0) var<storage, read> history: HybridHistoryParams;
@group(2) @binding(0) var<uniform> gbufMat: GBufferMaterial;

@vertex
fn vs_main(vertex: VertexInput, instance: InstanceInput) -> VertexOutput {
    let modelMatrix = mat4x4<f32>(
        instance.modelMatrix_r1,
        instance.modelMatrix_r2,
        instance.modelMatrix_r3,
        instance.modelMatrix_r4
    );
    let normalMatrix = mat4x4<f32>(
        instance.inverseModel_r1,
        instance.inverseModel_r2,
        instance.inverseModel_r3,
        instance.inverseModel_r4
    );
    let world_pos_4d = modelMatrix * vec4<f32>(vertex.position, 1.0);
    var output: VertexOutput;
    output.world_position = world_pos_4d.xyz;
    output.world_normal = normalize((normalMatrix * vec4<f32>(vertex.normal, 0.0)).xyz);
    output.clip_position = frame.projectionMatrix * frame.viewMatrix * world_pos_4d;
    output.cur_clip = history.viewProj * world_pos_4d;
    output.prev_clip = history.prevViewProj * world_pos_4d;
    return output;
}

fn clip_uv(clip: vec4<f32>) -> vec2<f32> {
    let ndc = clip.xy / max(clip.w, 1e-6);
    return ndc * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5);
}

fn sign_not_zero(v: f32) -> f32 {
    return select(-1.0, 1.0, v >= 0.0);
}

fn encode_oct(nIn: vec3<f32>) -> vec2<f32> {
    let n = normalize(nIn);
    let l1 = abs(n.x) + abs(n.y) + abs(n.z);
    let xy = n.xy / l1;
    if (n.z < 0.0) {
        return vec2<f32>(
            (1.0 - abs(xy.y)) * sign_not_zero(xy.x),
            (1.0 - abs(xy.x)) * sign_not_zero(xy.y)
        );
    }
    return xy;
}

@fragment
fn fs_main(input: VertexOutput) -> GBufferOutput {
    var output: GBufferOutput;
    output.dist = length(input.world_position - frame.cameraPosition);
    output.normalRoughMetal = vec4<f32>(encode_oct(input.world_normal), gbufMat.roughness, gbufMat.metallic);
    output.albedo = vec4<f32>(gbufMat.baseColor.rgb, 1.0);
    // The fragment clip_position is in pixels; the interpolated clip copy is not.
    output.motion = clip_uv(input.cur_clip) - clip_uv(input.prev_clip);
    return output;
}
