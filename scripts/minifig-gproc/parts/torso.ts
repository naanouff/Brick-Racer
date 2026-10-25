/**
 * @file torso.ts
 * @description Tapered torso from a chamfered-rectangle extrude — same tiny bevel on
 * the four vertical corners as TORSO.bevel — + neck peg + shoulder stubs.
 */

import {
  NECK,
  TORSO,
  shoulderLateralX,
  torsoHalfWidthAt,
} from '../../../src/racer/minifig/dimensions.ts';
import { GraphBuilder, smoothCylinder, type GProcGraph, type Vec3 } from '../graphBuilder.ts';

/** Rectangle in XZ with a tiny cut on each corner. CCW winding → +Y. */
function chamferedRectXZ(hx: number, hz: number, bev: number, y: number): Vec3[] {
  const b = Math.min(bev, hx * 0.45, hz * 0.45);
  return [
    [-hx + b, y, -hz],
    [-hx, y, -hz + b],
    [-hx, y, hz - b],
    [-hx + b, y, hz],
    [hx - b, y, hz],
    [hx, y, hz - b],
    [hx, y, -hz + b],
    [hx - b, y, -hz],
  ];
}

export function buildTorsoGraph(): GProcGraph {
  const b = new GraphBuilder('minifig-torso-generator', 'Minifig Torso', 'minifig-torso');
  const halfH = TORSO.height * 0.5;
  const bev = TORSO.bevel;
  const hx = TORSO.widthBottom * 0.5;
  const hz = TORSO.depth * 0.5;
  const taper = TORSO.widthTop / TORSO.widthBottom;

  // One extrude: vertical corners cut by `bev`, top face scaled for the trapezoid.
  // Horizontal rims: ChamferedBox lids of height `bev` meeting the wall without overlap.
  const wall = b.transform(
    b.shadeFlat(
      b.extrude(b.filledPolygon(chamferedRectXZ(hx, hz, bev, 0)), {
        offset: TORSO.height - 2 * bev,
        scale: taper,
      })
    ),
    { translation: [0, -halfH + bev, 0] }
  );
  const bottom = b.shadeFlat(
    b.chamferedBox({
      size: [TORSO.widthBottom, bev, TORSO.depth],
      center: [0, -halfH + bev * 0.5, 0],
      bevel: bev * 0.45,
    })
  );
  const top = b.shadeFlat(
    b.chamferedBox({
      size: [TORSO.widthTop, bev, TORSO.depth * taper],
      center: [0, halfH - bev * 0.5, 0],
      bevel: bev * 0.45,
    })
  );
  const body = b.triangulate(b.joinAll([wall, bottom, top]));

  const neck = b.transform(smoothCylinder(b, NECK.radius, NECK.height), {
    translation: [0, halfH + NECK.height * 0.28, 0],
  });

  const shoulderY = (TORSO.shoulderYFrac - 0.5) * TORSO.height;
  const sideX = torsoHalfWidthAt(TORSO.shoulderYFrac);
  const pivotX = shoulderLateralX();
  const stubLen = pivotX - sideX + 0.02;
  const stubX = sideX - 0.02 + stubLen * 0.5;
  const stub = (sign: number) =>
    b.transform(smoothCylinder(b, TORSO.shoulderRadius, stubLen, 16), {
      translation: [sign * stubX, shoulderY, 0],
      rotation: [0, 0, 90],
    });

  return b.build(b.triangulate(b.joinAll([body, neck, stub(-1), stub(1)])));
}
