/**
 * @file arm.ts
 * @description Right arm: shoulder dome + upper tube, elbow ball, forearm bent toward +Z
 * ending in the wrist socket. Elliptical section (X squashed). Left = mirror.
 * Origin = shoulder pivot.
 */

import { ARM, armElbowLocal } from '../../../src/racer/minifig/dimensions.ts';
import { GraphBuilder, arc, mirrorX, type GProcGraph } from '../graphBuilder.ts';

const SEGMENTS = 28;

function buildArmRightBody(b: GraphBuilder) {
  const r = ARM.tubeRadius;
  const squash: [number, number, number] = [ARM.tubeWidthRadius / r, 1, 1];
  const elbow = armElbowLocal();

  // Open at the bottom: the elbow ball closes it.
  const upper = b.transform(
    b.revolve([[[r, elbow[1], 0], ...arc([0, 0], [r, ARM.domeHeight], 0, 90, 10)]], {
      segments: SEGMENTS,
    }),
    { scale: squash }
  );

  const elbowBall = b.transform(
    b.revolve([arc([0, 0], [r, r], -90, 90, 14)], { segments: SEGMENTS }),
    { translation: elbow, scale: squash }
  );

  // Built along −Y from the elbow, then tilted so its far end swings to +Z.
  const len = ARM.forearmLength;
  const hr = ARM.wristHoleRadius;
  const holeTop = -len + ARM.wristHoleDepth;
  const forearm = b.transform(
    b.revolve(
      [
        [
          [r, -len, 0],
          [r, 0, 0],
        ],
        [
          [hr, -len, 0],
          [r, -len, 0],
        ],
        [
          [hr, holeTop, 0],
          [hr, -len, 0],
        ],
        [
          [0, holeTop, 0],
          [hr, holeTop, 0],
        ],
      ],
      { segments: SEGMENTS }
    ),
    {
      translation: elbow,
      rotation: [(-ARM.elbowBend * 180) / Math.PI, 0, 0],
      scale: squash,
    }
  );

  return b.joinAll([upper, elbowBall, forearm]);
}

export function buildArmRGraph(): GProcGraph {
  const b = new GraphBuilder('minifig-arm-r-generator', 'Minifig Arm R', 'minifig-arm-r');
  return b.build(buildArmRightBody(b));
}

export function buildArmLGraph(): GProcGraph {
  const b = new GraphBuilder('minifig-arm-l-generator', 'Minifig Arm L', 'minifig-arm-l');
  return b.build(mirrorX(b, buildArmRightBody(b)));
}
