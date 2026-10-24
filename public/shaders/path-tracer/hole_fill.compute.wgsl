/**
 * Phase 2: fill pixels that have 0 samples from the nearest Bayer neighbor in the stride cell.
 * Input/output are full-resolution HDR beauty buffers.
 * tileInfo: [2]=fullW [3]=fullH [8]=stride [9]=ox [10]=oy [11]=progressiveMode
 */

@group(0) @binding(0) var<storage, read> pathTracerTileInfo: array<u32>;
@group(0) @binding(1) var srcTex: texture_2d<f32>;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fullW = pathTracerTileInfo[2];
    let fullH = pathTracerTileInfo[3];
    if (gid.x >= fullW || gid.y >= fullH) {
        return;
    }
    let p = vec2<i32>(i32(gid.x), i32(gid.y));
    let progressive = pathTracerTileInfo[11];
    let stride = max(pathTracerTileInfo[8], 1u);

    var c = textureLoad(srcTex, p, 0);
    // a stores spp in progressive mode (non-transparent). spp==0 → hole.
    if (progressive != 0u && stride > 1u && c.a < 0.5) {
        let ox = pathTracerTileInfo[9];
        let oy = pathTracerTileInfo[10];
        // Nearest already-traced pixel in this stride cell: snap toward current Bayer offset.
        let cellX = (gid.x / stride) * stride + ox;
        let cellY = (gid.y / stride) * stride + oy;
        let nx = min(cellX, fullW - 1u);
        let ny = min(cellY, fullH - 1u);
        let n = textureLoad(srcTex, vec2<i32>(i32(nx), i32(ny)), 0);
        if (n.a >= 0.5) {
            c = n;
        } else {
            // Fallback: search the stride cell for any sampled texel.
            var found = false;
            for (var dy = 0u; dy < stride; dy++) {
                for (var dx = 0u; dx < stride; dx++) {
                    let sx = (gid.x / stride) * stride + dx;
                    let sy = (gid.y / stride) * stride + dy;
                    if (sx >= fullW || sy >= fullH) { continue; }
                    let s = textureLoad(srcTex, vec2<i32>(i32(sx), i32(sy)), 0);
                    if (s.a >= 0.5) {
                        c = s;
                        found = true;
                        break;
                    }
                }
                if (found) { break; }
            }
        }
    }
    textureStore(dstTex, p, c);
}
