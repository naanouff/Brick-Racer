/**
 * @file collisionGroups.ts
 * @description Kart collision bitmasks (match w3dts physics legoKart.ts).
 */

/** Chassis body. */
export const GROUP_CHASSIS = 0x0001;
/** Wheel (unused for raycast vehicle visuals). */
export const GROUP_WHEEL = 0x0002;
/** Driveable ground / asphalt. */
export const GROUP_WORLD = 0x0004;
/** Vertical barriers — chassis hits these; suspension rays do not. */
export const GROUP_WALL = 0x0008;
/** Kickers / whoops / pads — suspension rays + soft chassis contact. */
export const GROUP_RAMP = 0x0010;
/** On-foot minifig. Unused on race-test. */
export const GROUP_AVATAR = 0x0020;

/** Avatar collider half-extents (full box 0.45 × 1.7 × 0.35). */
export const AVATAR_HALF_EXTENTS: readonly [number, number, number] = [0.225, 0.85, 0.175];
/** Rigid-body origin so the feet sit on y = 0. */
export const AVATAR_CENTER_Y = 0.85;

export const MASK_ALL = 0xffffffff;
/** Chassis solid response: ground + walls + on-foot avatar (not ramps as walls). */
export const MASK_CHASSIS = GROUP_WORLD | GROUP_WALL | GROUP_AVATAR;
/** On-foot body: ground, walls, pads, and vehicle chassis. */
export const MASK_AVATAR = GROUP_WORLD | GROUP_WALL | GROUP_RAMP | GROUP_CHASSIS;
/** Suspension rays: ground + ramps. */
export const MASK_RAY_TRACK = GROUP_WORLD | GROUP_RAMP;

export type ColliderKind = 'ground' | 'wall' | 'ramp' | 'none';

export function groupForKind(kind: ColliderKind): number | undefined {
  switch (kind) {
    case 'ground':
      return GROUP_WORLD;
    case 'wall':
      return GROUP_WALL;
    case 'ramp':
      return GROUP_RAMP;
    case 'none':
      return undefined;
  }
}
