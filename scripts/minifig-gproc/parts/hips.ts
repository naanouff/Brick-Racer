/**
 * @file hips.ts
 * @description Wide hips plate + leg tenons + axle on the hip joint + crotch post.
 */

import { HIPS } from '../../../src/racer/minifig/dimensions.ts';
import { GraphBuilder, smoothCylinder, type GProcGraph } from '../graphBuilder.ts';

export function buildHipsGraph(): GProcGraph {
  const b = new GraphBuilder('minifig-hips-generator', 'Minifig Hips', 'minifig-hips');
  const plate = b.chamferedBox({
    size: [HIPS.width, HIPS.height, HIPS.depth],
    center: [0, 0, 0],
    bevel: 0.02,
  });

  const tenonY = -HIPS.height * 0.4 - HIPS.tenonHeight * 0.25;
  const tenon = (sign: number) =>
    b.transform(smoothCylinder(b, HIPS.tenonRadius, HIPS.tenonHeight, 20), {
      translation: [sign * HIPS.width * 0.26, tenonY, 0],
    });

  const axle = b.transform(smoothCylinder(b, HIPS.axleRadius, HIPS.axleLength, 20), {
    translation: [0, -HIPS.height * HIPS.jointDropFrac, 0],
    rotation: [0, 0, 90],
  });
  const crotch = b.chamferedBox({
    size: [HIPS.crotchWidth, HIPS.crotchHeight, HIPS.crotchDepth],
    center: [0, -HIPS.height * 0.55, 0],
    bevel: 0.01,
  });
  return b.build(
    b.joinAll([b.shadeFlat(plate), tenon(-1), tenon(1), axle, b.shadeFlat(crotch)])
  );
}
