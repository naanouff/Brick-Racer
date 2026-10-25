/**
 * @file arcadeKartSystem.ts
 * @description Arcade drive layer between vehicle suspension and physics integrate.
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
import { RigidBodyComponent, VehicleComponent } from '@naanouff/w3dts-physics';
import { pointInTrigger } from '../../../levels/shared/levelTriggers';
import {
  boostDurationForCharge,
  clamp,
  stepDrift,
  stepLateral,
  stepLongitudinal,
  stepYaw,
} from './arcadeKartMath';
import { driftChargeLevel } from './arcadeKartState';
import { getArcadeKartRuntime, initArcadeKartRuntime } from './arcadeKartRuntime';
import { publishKartTelemetry } from './kartTelemetry';
import { resolveVehicleKind, VEHICLE_CHASSIS_NAME } from '../../selectVehicle';

const _fwd = vec3.create();
const _right = vec3.create();
const _localFwd = vec3.fromValues(0, 0, 1);
const _localRight = vec3.fromValues(1, 0, 0);
const _v = vec3.create();
const G = 9.81;

export type ArcadeKartSystemOptions = {
  getInput: () => {
    isActionPressed(action: string): boolean;
    isActionJustPressed(action: string): boolean;
  };
  /** Prefer this chassis name (KartChassis / MotoChassis). */
  chassisName?: string;
};

function getTf(world: World, entity: Entity): TransformComponent | undefined {
  return world.getComponent(entity, TransformComponent as unknown as ComponentClass<IComponent>) as
    | TransformComponent
    | undefined;
}

function resolveChassis(world: World, preferredName: string): Entity | null {
  for (const [entity] of world.query([VehicleComponent, NameComponent]).iter()) {
    const named = world.getComponent(entity, NameComponent);
    if (named?.name === preferredName) return entity;
  }
  for (const [entity] of world.query([VehicleComponent]).iter()) {
    return entity;
  }
  return null;
}

export function createArcadeKartSystem(options: ArcadeKartSystemOptions): System {
  let chassis: Entity | null = null;

  return function arcadeKartSystem(world: World, dt: number): void {
    const stepDt = clamp(dt, 0, 0.05);
    if (stepDt <= 1e-8) return;

    const rt = getArcadeKartRuntime() ?? initArcadeKartRuntime();
    const st = rt.state;

    const wantName =
      options.chassisName ??
      VEHICLE_CHASSIS_NAME[resolveVehicleKind(typeof window !== 'undefined' ? window.location.search : '')];
    // Plane uses arcadePlaneSystem — skip ground arcade when no wheeled chassis selected.
    if (wantName === 'PlaneChassis') return;

    if (chassis == null) chassis = resolveChassis(world, wantName);
    if (chassis == null) return;

    const transform = getTf(world, chassis);
    const body = world.getComponent(
      chassis,
      RigidBodyComponent as unknown as ComponentClass<IComponent>
    ) as RigidBodyComponent | undefined;
    const vehicle = world.getComponent(
      chassis,
      VehicleComponent as unknown as ComponentClass<IComponent>
    ) as VehicleComponent | undefined;
    if (!transform || !body || !vehicle) return;

    const input = options.getInput();

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
      vehicle.throttle = 0;
      vehicle.steerInput = 0;
      st.drifting = false;
      st.driftTime = 0;
      st.hopAirTimer = 0;
      st.boostTimer = 0;
      st.insideTriggers.clear();
    }

    st.grounded = vehicle.wheels.some((w) => w.inContact);
    vec3.transformQuat(_fwd, _localFwd, transform.rotation);
    vec3.transformQuat(_right, _localRight, transform.rotation);
    _fwd[1] = 0;
    _right[1] = 0;
    if (vec3.sqrLen(_fwd) > 1e-8) vec3.normalize(_fwd, _fwd);
    if (vec3.sqrLen(_right) > 1e-8) vec3.normalize(_right, _right);

    vec3.copy(_v, body.velocity);
    let vLong = vec3.dot(_v, _fwd);
    let vLat = vec3.dot(_v, _right);
    const vUp = _v[1] ?? 0;

    const throttle = vehicle.throttle;
    const steer = vehicle.steerInput;
    const wantDrift = input.isActionPressed('jump');

    const { hopVy, releasedCharge } = stepDrift({
      wantDrift,
      steer,
      speed: Math.abs(vLong),
      grounded: st.grounded,
      state: st,
      dt: stepDt,
    });
    if (releasedCharge !== 'none') {
      st.boostTimer = Math.max(
        st.boostTimer,
        boostDurationForCharge(releasedCharge, st.profile)
      );
    }

    const pos: [number, number, number] = [
      transform.position[0],
      transform.position[1],
      transform.position[2],
    ];
    for (const t of st.triggers) {
      const inside = pointInTrigger(pos, t);
      if (inside && !st.insideTriggers.has(t.id)) {
        st.insideTriggers.add(t.id);
        st.boostTimer = Math.max(st.boostTimer, st.profile.padBoostDuration);
      } else if (!inside) {
        st.insideTriggers.delete(t.id);
      }
    }

    if (st.boostTimer > 0) st.boostTimer = Math.max(0, st.boostTimer - stepDt);
    const boosting = st.boostTimer > 0;

    // During hop grace, keep arcade planar drive so the hop is a pop not a wall-clear flight.
    const arcadeDrive = st.grounded || (st.drifting && st.hopAirTimer > 0);

    if (arcadeDrive) {
      vLong = stepLongitudinal(vLong, throttle, st.profile, boosting, stepDt);
      const grip = st.drifting ? st.profile.driftGrip : st.profile.grip;
      vLat = stepLateral(vLat, grip, stepDt);
      const dyaw = stepYaw(steer, vLong, st.profile, st.drifting, st.driftDir, stepDt);
      quat.rotateY(transform.rotation, transform.rotation, dyaw);
      quat.normalize(transform.rotation, transform.rotation);
      transform.updateLocalTransform();

      vec3.transformQuat(_fwd, _localFwd, transform.rotation);
      vec3.transformQuat(_right, _localRight, transform.rotation);
      _fwd[1] = 0;
      _right[1] = 0;
      if (vec3.sqrLen(_fwd) > 1e-8) vec3.normalize(_fwd, _fwd);
      if (vec3.sqrLen(_right) > 1e-8) vec3.normalize(_right, _right);

      vec3.scale(_v, _fwd, vLong);
      vec3.scaleAndAdd(_v, _v, _right, vLat);
      // Hop: lift pose (beat suspension) + upward impulse once.
      if (hopVy > 0) {
        transform.position[1] += st.profile.driftHopLift;
        transform.updateLocalTransform();
        _v[1] = Math.max(vUp, 0) + hopVy;
        body.wakeUp?.();
      } else if (st.grounded) {
        _v[1] = vUp;
      } else {
        _v[1] = vUp - G * st.profile.airGravityMul * stepDt;
      }
      vec3.copy(body.velocity, _v);
      body.angularVelocity[1] = 0;
    } else {
      body.velocity[1] = (body.velocity[1] ?? 0) - G * st.profile.airGravityMul * stepDt;
      const dyaw = stepYaw(steer * 0.35, vLong, st.profile, false, 0, stepDt);
      quat.rotateY(transform.rotation, transform.rotation, dyaw);
      quat.normalize(transform.rotation, transform.rotation);
      transform.updateLocalTransform();
    }

    st.speed = vec3.len(body.velocity);
    publishKartTelemetry({
      speedMs: st.speed,
      speedKmh: st.speed * 3.6,
      cc: st.cc,
      drifting: st.drifting,
      charge: driftChargeLevel(st),
      boostTimer: st.boostTimer,
      grounded: st.grounded,
    });
  };
}
