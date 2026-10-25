/**
 * @file wrench.ts
 * @description Chrome wrench accessory.
 */

import { WRENCH } from '../../../src/racer/minifig/dimensions.ts';
import { GraphBuilder, type GProcGraph } from '../graphBuilder.ts';

export function buildWrenchGraph(): GProcGraph {
  const b = new GraphBuilder('minifig-wrench-generator', 'Minifig Wrench', 'minifig-wrench');
  const handle = b.chamferedBox({
    size: [WRENCH.handleWidth, WRENCH.handleHeight, WRENCH.handleDepth],
    center: [0, 0, 0],
    bevel: 0.01,
  });
  const head = b.chamferedBox({
    size: [WRENCH.headWidth, WRENCH.headHeight, WRENCH.headDepth],
    center: [0, WRENCH.handleHeight * 0.5 + WRENCH.headHeight * 0.12, 0],
    bevel: 0.01,
  });
  return b.build(b.shadeFlat(b.join(handle, head)));
}
