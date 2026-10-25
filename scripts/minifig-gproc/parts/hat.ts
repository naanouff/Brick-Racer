/**
 * @file hat.ts
 * @description Mechanic baseball cap: soft low dome + short curved bill (Bolt artwork).
 */

import { HAT } from '../../../src/racer/minifig/dimensions.ts';
import { GraphBuilder, arc, type GProcGraph, type Vec3 } from '../graphBuilder.ts';

const SEGMENTS = 32;

/** Bill cross-section in (radius, y); closed CCW for a solid flap. */
function brimProfile(r0: number, yAttach: number): Vec3[] {
  const len = HAT.brimLength;
  const drop = HAT.brimDrop;
  const t = HAT.brimThickness;
  // Clockwise in (radius, y) so the partial lathe winds the bill tip outward (+Z).
  return [
    [r0, yAttach - t * 0.55, 0],
    [r0 + len * 0.55, yAttach - drop * 0.35 - t * 0.55, 0],
    [r0 + len, yAttach - drop - t * 0.55, 0],
    [r0 + len, yAttach - drop + t * 0.15, 0],
    [r0 + len * 0.55, yAttach - drop * 0.35 + t * 0.25, 0],
    [r0, yAttach + t * 0.35, 0],
  ];
}

function profileAt(profile: Vec3[], deg: number): Vec3[] {
  const th = (deg * Math.PI) / 180;
  return profile.map(([r, y]) => [r * Math.cos(th), y, -r * Math.sin(th)]);
}

export function buildHatGraph(): GProcGraph {
  const b = new GraphBuilder('minifig-hat-generator', 'Minifig Cap', 'minifig-hat');
  const r = HAT.crownRadius;
  const half = HAT.crownHeight * 0.5;
  const band = HAT.crownHeight * 0.28;
  const rim = 0.045;

  // Soft dome: short forehead band → rounded crown (no flat pillbox top).
  const crown = b.revolve(
    [
      [
        [0, -half, 0],
        [r * 0.92, -half, 0],
      ],
      [
        [r * 0.92, -half, 0],
        [r, -half + band * 0.35, 0],
      ],
      [
        [r, -half + band * 0.35, 0],
        [r, -half + band, 0],
      ],
      [[r, -half + band, 0], ...arc([r - rim, half - rim], [rim, rim * 1.15], 0, 90, 8), [0, half, 0]],
    ],
    { segments: SEGMENTS }
  );

  // Short curved bill toward +Z (lathe angle −90°).
  const yAttach = -half + band * 0.15;
  const profile = brimProfile(r * 0.98, yAttach);
  const halfA = HAT.brimHalfAngleDeg;
  const start = -90 - halfA;
  const end = -90 + halfA;
  const bill = b.revolve([[...profile, profile[0]!]], {
    segments: Math.max(12, Math.round(SEGMENTS * (2 * halfA) / 360)),
    startAngle: (start * Math.PI) / 180,
    endAngle: (end * Math.PI) / 180,
  });
  // End caps: match the reversed profile so cut faces wind outward.
  const startCap = b.flatPolygon(profileAt(profile, start));
  const endCap = b.flatPolygon(profileAt([...profile].reverse(), end));

  return b.build(b.triangulate(b.joinAll([crown, bill, startCap, endCap])));
}
