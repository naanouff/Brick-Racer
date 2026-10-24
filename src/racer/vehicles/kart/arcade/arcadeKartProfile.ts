/**
 * @file arcadeKartProfile.ts
 * @description CC tiers + suspension-only VehicleComponent defaults (BO1g).
 */

export type CcTier = 50 | 100 | 150;

export type ArcadeKartProfile = {
  cc: CcTier;
  /** Top speed m/s (wu/s). */
  maxSpeed: number;
  /** Peak accel m/s² at v≈0. */
  accel: number;
  /** Brake decel m/s². */
  brake: number;
  /** Coast decel m/s². */
  coast: number;
  /** Reverse top speed m/s. */
  reverseMax: number;
  /** Lateral velocity damp /s (grip). */
  grip: number;
  /** Lateral damp while drifting. */
  driftGrip: number;
  /** Yaw rate at mid speed (rad/s). */
  yawRate: number;
  /** Multiplier on yaw at top speed. */
  yawSpeedMul: number;
  /** Extra downward accel while airborne (multiples of g ≈ 9.81). */
  airGravityMul: number;
  /** Boost pad / ring duration (s). */
  padBoostDuration: number;
  /** Mini-turbo durations by charge level. */
  miniTurboBlue: number;
  miniTurboOrange: number;
  /** Drift hop up velocity. */
  driftHop: number;
  /** Min speed to start drift. */
  driftMinSpeed: number;
  /** Charge thresholds (s). */
  chargeBlue: number;
  chargeOrange: number;
  /** Boost top-speed multiplier. */
  boostSpeedMul: number;
  /** Boost accel multiplier. */
  boostAccelMul: number;
};

const BASE: Omit<ArcadeKartProfile, 'cc' | 'maxSpeed' | 'yawSpeedMul'> = {
  accel: 14,
  brake: 30,
  coast: 4,
  reverseMax: 5,
  grip: 12,
  driftGrip: 3,
  yawRate: 2.4,
  airGravityMul: 1.2,
  padBoostDuration: 1.2,
  miniTurboBlue: 0.6,
  miniTurboOrange: 1.0,
  driftHop: 2.5,
  driftMinSpeed: 8,
  chargeBlue: 0.8,
  chargeOrange: 1.6,
  boostSpeedMul: 1.3,
  boostAccelMul: 1.45,
};

export const ARCADE_PROFILES: Record<CcTier, ArcadeKartProfile> = {
  50: { ...BASE, cc: 50, maxSpeed: 16, yawSpeedMul: 1.0, accel: 12 },
  100: { ...BASE, cc: 100, maxSpeed: 20, yawSpeedMul: 0.95 },
  150: { ...BASE, cc: 150, maxSpeed: 24, yawSpeedMul: 0.9, accel: 18 },
};

export function resolveCcTier(search = ''): CcTier {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = Number(q.get('cc') ?? '100');
  if (raw === 50 || raw === 150) return raw;
  return 100;
}

export function profileForCc(cc: CcTier): ArcadeKartProfile {
  return ARCADE_PROFILES[cc];
}

/**
 * VehicleComponent fields for blockout kart — suspension / visuals only;
 * longitudinal / cornering / yaw handed to ArcadeKartSystem.
 */
export const SUSPENSION_ONLY_VEHICLE = {
  rayMask: 20,
  maxSteerAngle: 0.55,
  steerSpeed: 8,
  maxSpeed: 80,
  driveTorque: 0,
  brakeTorque: 0,
  yawAssist: 0,
  antiRollStiffness: 220,
  rollDamping: 40,
  pitchDamping: 22,
  airAngularDamping: 16,
  uprightStiffness: 18,
  antiWheelie: 0.35,
} as const;

export const BLOCKOUT_WHEEL_RADIUS = 0.25;
export const BLOCKOUT_WHEEL_REST = 0.28;
export const BLOCKOUT_WHEEL_TRAVEL = 0.18;

export function makeBlockoutWheels(): Array<Record<string, unknown>> {
  const base = {
    radius: BLOCKOUT_WHEEL_RADIUS,
    restLength: BLOCKOUT_WHEEL_REST,
    travel: BLOCKOUT_WHEEL_TRAVEL,
    stiffness: 400,
    damping: 45,
    mu: 2.0,
    longitudinalStiffness: 0.02,
    corneringStiffness: 2,
  };
  return [
    { id: 'fl', hardpoint: [-0.62, 0, 0.72], steered: true, driven: true, ...base },
    { id: 'fr', hardpoint: [0.62, 0, 0.72], steered: true, driven: true, ...base },
    { id: 'rl', hardpoint: [-0.62, 0, -0.68], steered: false, driven: false, ...base },
    { id: 'rr', hardpoint: [0.62, 0, -0.68], steered: false, driven: false, ...base },
  ];
}
