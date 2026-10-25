/**
 * @file leg.ts
 * @description Blocky thigh + hip cylinder + brick foot. Origin = thigh center.
 */

import { LEG, legOffsetFromHip } from '../../../src/racer/minifig/dimensions.ts';
import { GraphBuilder, mirrorX, smoothCylinder, type GProcGraph } from '../graphBuilder.ts';

function buildLegRightBody(b: GraphBuilder) {
  const thigh = b.chamferedBox({
    size: [LEG.thighWidth, LEG.thighHeight, LEG.thighDepth],
    center: [0, 0, 0],
    bevel: 0.025,
  });
  // Rounded hip joint, centered on the hip pivot axis.
  const hipRound = b.transform(
    smoothCylinder(
      b,
      Math.min(LEG.thighDepth * 0.42, LEG.thighHeight * 0.22),
      LEG.thighWidth * 0.98,
      28
    ),
    {
      translation: [0, -legOffsetFromHip()[1], 0],
      rotation: [0, 0, 90],
    }
  );
  const foot = b.chamferedBox({
    size: [LEG.footWidth, LEG.footHeight, LEG.footDepth],
    center: [
      0,
      -LEG.thighHeight * 0.5 - LEG.footHeight * LEG.footDropFrac,
      LEG.footDepth * 0.18,
    ],
    bevel: 0.015,
  });
  return b.joinAll([b.shadeFlat(thigh), hipRound, b.shadeFlat(foot)]);
}

export function buildLegRGraph(): GProcGraph {
  const b = new GraphBuilder('minifig-leg-r-generator', 'Minifig Leg R', 'minifig-leg-r');
  return b.build(buildLegRightBody(b));
}

export function buildLegLGraph(): GProcGraph {
  const b = new GraphBuilder('minifig-leg-l-generator', 'Minifig Leg L', 'minifig-leg-l');
  return b.build(mirrorX(b, buildLegRightBody(b)));
}
