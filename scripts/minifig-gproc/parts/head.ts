/**
 * @file head.ts
 * @description Classic minifig head: neck ring, barrel with rounded rims, stud (HQ-calibrated).
 */

import { HEAD } from '../../../src/racer/minifig/dimensions.ts';
import { GraphBuilder, arc, type GProcGraph } from '../graphBuilder.ts';

export function buildHeadGraph(): GProcGraph {
  const b = new GraphBuilder('minifig-head-generator', 'Minifig Head', 'minifig-head');
  const r = HEAD.radius;
  const half = HEAD.height * 0.5;
  const nr = HEAD.neckRingRadius;
  const barrelBottom = -half + HEAD.neckRingHeight;
  const sr = HEAD.studRadius;
  const studTop = half + HEAD.studHeight;
  const rim = 0.06;

  const head = b.revolve(
    [
      [
        [0, -half, 0],
        [nr, -half, 0],
      ],
      [
        [nr, -half, 0],
        [nr, barrelBottom, 0],
      ],
      [
        [nr, barrelBottom, 0],
        [r - rim, barrelBottom, 0],
      ],
      [
        ...arc([r - rim, barrelBottom + rim], [rim, rim], 270, 360, 6),
        ...arc([r - rim, half - rim], [rim, rim], 0, 90, 6),
      ],
      [
        [r - rim, half, 0],
        [sr, half, 0],
      ],
      [
        [sr, half, 0],
        [sr, studTop, 0],
      ],
      [
        [sr, studTop, 0],
        [0, studTop, 0],
      ],
    ],
    { segments: 32 }
  );
  return b.build(head);
}
