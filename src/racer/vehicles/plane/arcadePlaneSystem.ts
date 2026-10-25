/**
 * @file arcadePlaneSystem.ts
 * @description Arcade flight: banked turns, pitch climb, L1/R1 knife-edge.
 */

import { quat, vec3 } from 'gl-matrix';
import {
  NameComponent,
  TransformComponent,
  type ComponentClass,
  type Entity,
  type IComponent,
  type System,
  type World,
} from '@naanouff/w3dts-core';
import { RigidBodyComponent } from '@naanouff/w3dts-physics';
import { getArcadeKartRuntime, initArcadeKartRuntime } from '../kart/arcade/arcadeKartRuntime';
import { publishKartTelemetry } from '../kart/arcade/kartTelemetry';
import { clamp } from '../kart/arcade/arcadeKartMath';
import {
  attitudeToQuat,
  forwardFromAttitude,
  stepPlaneAttitude,
  type PlaneAttitude,
} from './arcadePlaneMath';

const _fwd = vec3.create();
const _q = quat.create();
const G = 9.81;
const MAX_SPEED = 28;
const THRUST = 18;
const Y_MIN = 0.6;
const Y_MAX = 8;

export type PlaneInput = {
  isActionPressed(action: string): boolean;
  isActionJustPressed(action: string): boolean;
  getAxis?(name: string): number;
  enableMap?(mapId: string): void;
};

export type ArcadePlaneSystemOptions = {
  getInput: () => PlaneInput;
  /** When false, the parked plane is left to physics. Default: always simulate. */
  shouldSimulate?: () => boolean;
};

function resolvePlane(world: World): Entity | null {
  for (const [entity] of world.query([RigidBodyComponent, NameComponent]).iter()) {
    const named = world.getComponent(entity, NameComponent);
    if (named?.name === 'PlaneChassis') return entity;
  }
  return null;
}

/** Yaw from nose projected on XZ (spawn / reset). */
function yawFromQuat(q: quat): number {
  const forward = vec3.fromValues(0, 0, 1);
  vec3.transformQuat(forward, forward, q);
  return Math.atan2(forward[0] ?? 0, forward[2] ?? 1);
}

function createAttitudeFromSpawn(rotation: quat): PlaneAttitude {
  return { yaw: yawFromQuat(rotation), pitch: 0, roll: 0 };
}

export function createArcadePlaneSystem(options: ArcadePlaneSystemOptions): System {
  let chassis: Entity | null = null;
  let mapEnabled = false;
  let att: PlaneAttitude | null = null;

  return function arcadePlaneSystem(world: World, dt: number): void {
    const stepDt = clamp(dt, 0, 0.05);
    if (stepDt <= 1e-8) return;
    if (options.shouldSimulate && !options.shouldSimulate()) return;

    const rt = getArcadeKartRuntime() ?? initArcadeKartRuntime();
    const st = rt.state;
    const input = options.getInput();

    if (!mapEnabled) {
      input.enableMap?.('gameplay');
      mapEnabled = true;
    }

    if (chassis == null) chassis = resolvePlane(world);
    if (chassis == null) return;

    const transform = world.getComponent(
      chassis,
      TransformComponent as unknown as ComponentClass<IComponent>
    ) as TransformComponent | undefined;
    const body = world.getComponent(
      chassis,
      RigidBodyComponent as unknown as ComponentClass<IComponent>
    ) as RigidBodyComponent | undefined;
    if (!transform || !body) return;

    if (att == null) {
      att = createAttitudeFromSpawn(transform.rotation);
    }

    if (input.isActionJustPressed('resetKart')) {
      vec3.set(
        transform.position,
        st.spawn.position[0],
        st.spawn.position[1],
        st.spawn.position[2]
      );
      quat.set(
        transform.rotation,
        st.spawn.rotation[0],
        st.spawn.rotation[1],
        st.spawn.rotation[2],
        st.spawn.rotation[3]
      );
      transform.updateLocalTransform();
      vec3.set(body.velocity, 0, 0, 0);
      vec3.set(body.angularVelocity, 0, 0, 0);
      body.clearAccumulators?.();
      body.wakeUp?.();
      att = createAttitudeFromSpawn(transform.rotation);
    }

    const throttle = input.getAxis?.('moveForward') ?? 0;
    const steer = input.getAxis?.('moveRight') ?? 0;
    const climb = input.getAxis?.('climb') ?? 0;
    // L1 = −1 (wings vertical left), R1 = +1 (right) — see arcadeMkDriveInput.
    const rollSnap = input.getAxis?.('rollSnap') ?? 0;

    forwardFromAttitude(_fwd, att, _q);
    const speedAlong = vec3.dot(body.velocity, _fwd);

    stepPlaneAttitude(att, {
      steer,
      climb,
      rollSnap,
      speed: speedAlong,
      dt: stepDt,
    });

    attitudeToQuat(transform.rotation, att);
    transform.updateLocalTransform();
    forwardFromAttitude(_fwd, att, _q);

    let next = speedAlong + throttle * THRUST * stepDt;
    if (Math.abs(throttle) < 1e-3) next *= Math.max(0, 1 - 0.55 * stepDt);
    next = clamp(next, -MAX_SPEED * 0.35, MAX_SPEED);

    // Fly along the nose — bank turns, pitch climbs (not ground-vehicle yaw).
    vec3.scale(body.velocity, _fwd, next);
    body.velocity[1] = (body.velocity[1] ?? 0) - G * 0.2 * stepDt;

    body.angularVelocity[0] = 0;
    body.angularVelocity[1] = 0;
    body.angularVelocity[2] = 0;

    const y = transform.position[1];
    if (y < Y_MIN && (body.velocity[1] ?? 0) < 0) {
      transform.position[1] = Y_MIN;
      body.velocity[1] = 0;
      // Level out on ground contact
      att.pitch = approachSoft(att.pitch, 0, stepDt);
      att.roll = approachSoft(att.roll, 0, stepDt);
      attitudeToQuat(transform.rotation, att);
      transform.updateLocalTransform();
    } else if (y > Y_MAX && (body.velocity[1] ?? 0) > 0) {
      body.velocity[1] = 0;
    }

    st.speed = vec3.len(body.velocity);
    st.grounded = transform.position[1] <= Y_MIN + 0.05;
    publishKartTelemetry({
      speedMs: st.speed,
      speedKmh: st.speed * 3.6,
      cc: st.cc,
      drifting: Math.abs(rollSnap) > 0.5,
      charge: 'none',
      boostTimer: 0,
      grounded: st.grounded,
    });
  };
}

function approachSoft(current: number, target: number, dt: number): number {
  const t = 1 - Math.exp(-8 * dt);
  return current + (target - current) * t;
}
