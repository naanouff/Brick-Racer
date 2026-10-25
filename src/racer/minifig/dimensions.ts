/**
 * @file dimensions.ts
 * @description Canonical minifig cotes (BRICK-MF2a), calibrated against
 * `docs/design/art/minifig/reference-hq-metrics.json` (3M / Sketchfab HQ fig).
 *
 * Units: world metres. Feet on y=0. Total height ≈ 2.1 (stud tip).
 * Generators (`scripts/minifig-gproc/parts`) and assemble both read the helpers
 * below so part geometry and pivots cannot drift apart.
 */

export const MINIFIG_TOTAL_HEIGHT = 2.1;

type V3 = [number, number, number];

/** Head (lathe barrel + stud + neck groove). */
export const HEAD = {
  radius: 0.26,
  /** Barrel height excl. stud. */
  height: 0.5,
  studRadius: 0.125,
  studHeight: 0.11,
  neckRingRadius: 0.155,
  neckRingHeight: 0.055,
} as const;

/** Neck peg on torso. */
export const NECK = {
  radius: 0.14,
  height: 0.11,
} as const;

/** Linear trapezoid torso (narrower at top). */
export const TORSO = {
  widthTop: 0.54,
  widthBottom: 0.74,
  depth: 0.4,
  height: 0.56,
  /** Shoulder axis height as a fraction of torso height from its bottom. */
  shoulderYFrac: 0.8,
  /** Shoulder pin radius; must stay hidden inside the arm's shoulder dome. */
  shoulderRadius: 0.06,
  /** Tiny top/bottom edge break only — must not change the silhouette. */
  bevel: 0.01,
} as const;

/**
 * Arm: shoulder dome + upper tube + elbow ball + forearm ending in the wrist socket.
 * Cross-section is elliptical (narrow seen from the front, deep seen from the side).
 * Right arm; left is mirrored.
 */
export const ARM = {
  /** Shoulder pivot → elbow center. */
  upperLength: 0.27,
  /** Elbow center → wrist socket face. */
  forearmLength: 0.28,
  /** Front-back (Z) radius. */
  tubeRadius: 0.105,
  /** Lateral (X) radius. */
  tubeWidthRadius: 0.08,
  /** Shoulder dome height above the pivot. */
  domeHeight: 0.085,
  /** Elbow bend (radians, forearm swings toward +Z). */
  elbowBend: 0.65,
  wristHoleRadius: 0.056,
  wristHoleDepth: 0.06,
  /** Clearance between torso side and the inner face of the arm. */
  torsoGap: 0.01,
} as const;

/** C-clip hand: clip axis along Z, wrist peg on +Y, slit on −Y. */
export const HAND = {
  outerRadius: 0.115,
  innerRadius: 0.07,
  /** Clip length along its axis (Z). */
  length: 0.15,
  /** Rounding of the clip's outer rims. */
  edgeRadius: 0.025,
  /** Slit width measured at mid-wall radius. */
  slitWidth: 0.08,
  pegRadius: 0.042,
  pegLength: 0.08,
  /** Peg base sunk into the clip wall. */
  pegEmbed: 0.02,
} as const;

/** Hips / pelvis. */
export const HIPS = {
  width: 0.72,
  depth: 0.4,
  height: 0.18,
  tenonRadius: 0.09,
  tenonHeight: 0.08,
  axleRadius: 0.07,
  axleLength: 0.62,
  crotchWidth: 0.14,
  crotchHeight: 0.2,
  crotchDepth: 0.28,
  /** Hip joint height below hips center, as a fraction of hips height. */
  jointDropFrac: 0.2,
} as const;

/** Single leg (right). Graph origin = thigh center. */
export const LEG = {
  thighWidth: 0.33,
  thighDepth: 0.38,
  thighHeight: 0.58,
  footWidth: 0.33,
  footDepth: 0.46,
  footHeight: 0.12,
  axleHoleRadius: 0.075,
  /** Foot bottom sits this far below thigh bottom (centered foot = footHeight/2 overlap). */
  footDropFrac: 0.4,
} as const;

/**
 * Mechanic baseball cap (Bolt artwork): low soft dome + short curved bill.
 * Origin of the hat graph ≈ crown center; bill extends toward +Z.
 */
export const HAT = {
  /** Slightly larger than HEAD.radius so it cups the skull. */
  crownRadius: 0.29,
  /** Band + dome height. */
  crownHeight: 0.2,
  /** How far the short bill sticks out past the crown. */
  brimLength: 0.13,
  /** Bill tip drops below the band. */
  brimDrop: 0.055,
  brimThickness: 0.022,
  /** Half-angle of the bill around +Z (degrees). */
  brimHalfAngleDeg: 58,
  /** Placement nudge toward the face (assemble). */
  brimForward: 0.04,
} as const;

/** Wrench accessory. */
export const WRENCH = {
  handleWidth: 0.09,
  handleHeight: 0.42,
  handleDepth: 0.09,
  headWidth: 0.2,
  headHeight: 0.13,
  headDepth: 0.07,
} as const;

/** Torso half-width at `frac` of its height (0 = bottom, 1 = top). */
export function torsoHalfWidthAt(frac: number): number {
  return (TORSO.widthBottom + (TORSO.widthTop - TORSO.widthBottom) * frac) * 0.5;
}

/** Torso half-depth at `frac` (depth scales with width, same taper). */
export function torsoHalfDepthAt(frac: number): number {
  return torsoHalfWidthAt(frac) * (TORSO.depth / TORSO.widthBottom);
}

/** Shoulder pivot |x| — arm tube clears the torso side at shoulder height. */
export function shoulderLateralX(): number {
  return torsoHalfWidthAt(TORSO.shoulderYFrac) + ARM.tubeWidthRadius + ARM.torsoGap;
}

/** Forearm direction (unit) in arm-graph space: down and toward +Z. */
export function forearmDirection(): V3 {
  return [0, -Math.cos(ARM.elbowBend), Math.sin(ARM.elbowBend)];
}

/** Elbow position in arm-graph space (origin = shoulder pivot). */
export function armElbowLocal(): V3 {
  return [0, -ARM.upperLength, 0];
}

/** Point `along` metres down the forearm, in arm-graph space. */
export function armForearmPoint(along: number): V3 {
  const e = armElbowLocal();
  const d = forearmDirection();
  return [e[0] + d[0] * along, e[1] + d[1] * along, e[2] + d[2] * along];
}

/** Wrist pivot in arm-graph space (center of the wrist socket face). */
export function armWristLocal(): V3 {
  return armForearmPoint(ARM.forearmLength);
}

/** Wrist peg center along the hand's +Y (hand graph origin = clip center). */
export function handPegCenterY(): number {
  return HAND.outerRadius + HAND.pegLength * 0.5 - HAND.pegEmbed;
}

/**
 * Hand (clip center) relative to the wrist pivot, along the forearm.
 * The peg center sits on the socket face, so half the peg is inside the forearm.
 */
export function handOffsetFromWrist(): V3 {
  const d = forearmDirection();
  const dist = handPegCenterY();
  return [d[0] * dist, d[1] * dist, d[2] * dist];
}

/** Hand mesh tilt (Euler deg) so its peg axis (+Y) points back up the forearm. */
export function handTiltDeg(): V3 {
  return [(-ARM.elbowBend * 180) / Math.PI, 0, 0];
}

/**
 * Vertical stack from feet (y=0):
 * foot → thigh → hips → torso → neck → head → stud.
 */
export function layoutY(): {
  footTop: number;
  thighCenter: number;
  hipsCenter: number;
  hipJointY: number;
  torsoBottom: number;
  torsoCenter: number;
  neckCenter: number;
  headCenter: number;
  hatCenter: number;
  shoulderY: number;
  totalHeight: number;
} {
  // Foot bottom at y=0: foot center sits footDropFrac*footHeight below thigh bottom.
  const thighBottom = LEG.footHeight * (0.5 + LEG.footDropFrac);
  const thighCenter = thighBottom + LEG.thighHeight * 0.5;
  const thighTop = thighBottom + LEG.thighHeight;
  const hipsBottom = thighTop - 0.05;
  const hipsCenter = hipsBottom + HIPS.height * 0.5;
  const hipJointY = hipsCenter - HIPS.height * HIPS.jointDropFrac;
  const torsoBottom = hipsBottom + HIPS.height * 0.85;
  const torsoCenter = torsoBottom + TORSO.height * 0.5;
  const neckBottom = torsoBottom + TORSO.height;
  const neckCenter = neckBottom + NECK.height * 0.45;
  const headBottom = neckBottom + NECK.height * 0.25;
  const headCenter = headBottom + HEAD.height * 0.5;
  // Cap sits low on the forehead (Bolt artwork), not perched on the stud.
  const hatCenter = headBottom + HEAD.height * 0.78;
  const shoulderY = torsoBottom + TORSO.height * TORSO.shoulderYFrac;
  const totalHeight = headBottom + HEAD.height + HEAD.studHeight;

  return {
    footTop: thighBottom,
    thighCenter,
    hipsCenter,
    hipJointY,
    torsoBottom,
    torsoCenter,
    neckCenter,
    headCenter,
    hatCenter,
    shoulderY,
    totalHeight,
  };
}

/** Leg graph origin (thigh center) relative to the hip pivot. */
export function legOffsetFromHip(): V3 {
  const y = layoutY();
  return [0, y.thighCenter - y.hipJointY, 0];
}

/** Rest-pose (identity joints) pivot / socket positions relative to the root. */
export function computePivots(): {
  root: V3;
  hips: V3;
  hipL: V3;
  hipR: V3;
  torso: V3;
  neck: V3;
  head: V3;
  hat: V3;
  shoulderL: V3;
  shoulderR: V3;
  wristL: V3;
  wristR: V3;
  handL: V3;
  handR: V3;
  accessoryL: V3;
  accessoryR: V3;
  armLateral: number;
  handLateral: number;
} {
  const y = layoutY();
  const sx = shoulderLateralX();
  const hipX = HIPS.width * 0.26;
  const w = armWristLocal();
  const h = handOffsetFromWrist();

  const wristR: V3 = [sx + w[0], y.shoulderY + w[1], w[2]];
  const wristL: V3 = [-sx - w[0], y.shoulderY + w[1], w[2]];
  const handR: V3 = [wristR[0] + h[0], wristR[1] + h[1], wristR[2] + h[2]];
  const handL: V3 = [wristL[0] - h[0], wristL[1] + h[1], wristL[2] + h[2]];

  return {
    root: [0, 0, 0],
    hips: [0, y.hipsCenter, 0],
    hipL: [-hipX, y.hipJointY, 0],
    hipR: [hipX, y.hipJointY, 0],
    torso: [0, y.torsoCenter, 0],
    neck: [0, y.neckCenter, 0],
    head: [0, y.headCenter, 0],
    hat: [0, y.hatCenter, HAT.brimForward * 0.15],
    shoulderL: [-sx, y.shoulderY, 0],
    shoulderR: [sx, y.shoulderY, 0],
    wristL,
    wristR,
    handL,
    handR,
    accessoryL: [...handL],
    accessoryR: [...handR],
    armLateral: sx,
    handLateral: handR[0],
  };
}
