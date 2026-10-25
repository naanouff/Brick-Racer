/**
 * @file hand.ts
 * @description C-clip hand: clip axis along Z (perpendicular to the wrist peg on +Y),
 * slit on −Y, away from the wrist. Origin = clip center.
 */

import { HAND, handPegCenterY } from '../../../src/racer/minifig/dimensions.ts';
import {
  GraphBuilder,
  arc,
  smoothCylinder,
  type GProcGraph,
  type Vec3,
} from '../graphBuilder.ts';

const SEGMENTS = 30;

/** Closed wall section in (radius, y), counter-clockwise, outer rims rounded. */
function clipProfile(): Vec3[] {
  const ro = HAND.outerRadius;
  const ri = HAND.innerRadius;
  const h = HAND.length * 0.5;
  const e = HAND.edgeRadius;
  const ei = e * 0.4;
  return [
    ...arc([ro - e, -h + e], [e, e], 270, 360, 5),
    ...arc([ro - e, h - e], [e, e], 0, 90, 5),
    ...arc([ri + ei, h - ei], [ei, ei], 90, 180, 3),
    ...arc([ri + ei, -h + ei], [ei, ei], 180, 270, 3),
  ];
}

/** Profile placed at lathe angle `deg`: (r cos θ, y, −r sin θ). */
function profileAt(profile: Vec3[], deg: number): Vec3[] {
  const t = (deg * Math.PI) / 180;
  return profile.map(([r, y]) => [r * Math.cos(t), y, -r * Math.sin(t)]);
}

export function buildHandGraph(): GProcGraph {
  const b = new GraphBuilder('minifig-hand-generator', 'Minifig Hand', 'minifig-hand');
  const profile = clipProfile();

  // Built with the clip axis on Y; lathe angle 270° is +Z, which the final +90° X turn
  // sends to −Y (slit side). The slit is parallel-ish: its half-angle is taken at mid wall.
  const midR = (HAND.outerRadius + HAND.innerRadius) * 0.5;
  const halfSlit = (Math.asin(HAND.slitWidth * 0.5 / midR) * 180) / Math.PI;
  const start = 270 + halfSlit;
  const end = 270 + 360 - halfSlit;

  const ring = b.revolve([[...profile, profile[0]!]], {
    segments: SEGMENTS,
    startAngle: (start * Math.PI) / 180,
    endAngle: (end * Math.PI) / 180,
  });
  const startCap = b.flatPolygon(profileAt(profile, start));
  const endCap = b.flatPolygon(profileAt([...profile].reverse(), end));
  const clip = b.transform(b.joinAll([ring, startCap, endCap]), { rotation: [90, 0, 0] });

  const peg = b.transform(smoothCylinder(b, HAND.pegRadius, HAND.pegLength, 18), {
    translation: [0, handPegCenterY(), 0],
  });
  return b.build(b.join(clip, peg));
}
