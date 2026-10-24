/**
 * @file arcadePlaneSystem.ts
 * @description Simple arcade flight for blockout PlaneChassis (WASD + Space/Shift).
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

const _fwd = vec3.create();
const _localFwd = vec3.fromValues(0, 0, 1);
const G = 9.81;
const MAX_SPEED = 28;
const THRUST = 18;
const YAW_RATE = 1.6;
const CLIMB = 10;
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
};

function resolvePlane(world: World): Entity | null {
  for (const [entity] of world.query([RigidBodyComponent, NameComponent]).iter()) {
    const named = world.getComponent(entity, NameComponent);
    if (named?.name === 'PlaneChassis') return entity;
  }
  return null;
}

export function createArcadePlaneSystem(options: ArcadePlaneSystemOptions): System {
  let chassis: Entity | null = null;
  let mapEnabled = false;

  return function arcadePlaneSystem(world: World, dt: number): void {
    const stepDt = clamp(dt, 0, 0.05);
    if (stepDt <= 1e-8) return;

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
    }

    const throttle = input.getAxis?.('moveForward') ?? 0;
    const steer = input.getAxis?.('moveRight') ?? 0;
    const climb =
      (input.isActionPressed('jump') ? 1 : 0) - (input.isActionPressed('sprint') ? 1 : 0);

    if (Math.abs(steer) > 1e-3) {
      // moveRight axis: +D = right; yaw so nose turns right
      quat.rotateY(transform.rotation, transform.rotation, -steer * YAW_RATE * stepDt);
      quat.normalize(transform.rotation, transform.rotation);
      transform.updateLocalTransform();
    }

    vec3.transformQuat(_fwd, _localFwd, transform.rotation);
    if (vec3.sqrLen(_fwd) > 1e-8) vec3.normalize(_fwd, _fwd);

    const speed = vec3.dot(body.velocity, _fwd);
    let next = speed + throttle * THRUST * stepDt;
    if (Math.abs(throttle) < 1e-3) next *= Math.max(0, 1 - 0.6 * stepDt);
    next = clamp(next, -MAX_SPEED * 0.35, MAX_SPEED);

    const lift = Math.max(0, next) * 0.35;
    const vy =
      (body.velocity[1] ?? 0) - G * 0.35 * stepDt + climb * CLIMB * stepDt + lift * stepDt;

    vec3.scale(body.velocity, _fwd, next);
    body.velocity[1] = vy;
    body.angularVelocity[0] = 0;
    body.angularVelocity[1] = 0;
    body.angularVelocity[2] = 0;

    const y = transform.position[1];
    if (y < Y_MIN && (body.velocity[1] ?? 0) < 0) {
      transform.position[1] = Y_MIN;
      body.velocity[1] = 0;
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
      drifting: false,
      charge: 'none',
      boostTimer: 0,
      grounded: st.grounded,
    });
  };
}
