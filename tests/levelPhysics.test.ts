/**
 * @file levelPhysics.test.ts
 * @description Collision groups + kart scale + anti-tunnel (BRICK-BO1f).
 */

import { describe, expect, it } from 'vitest';
import {
  ColliderComponent,
  RigidBodyComponent,
  createPhysicsSystem,
} from '@naanouff/w3dts-physics';
import { TransformComponent, World } from '@naanouff/w3dts-core';
import { cityTestSpec } from '../src/racer/levels/cityTest';
import { raceTestSpec } from '../src/racer/levels/raceTest';
import {
  CHASE_FRAME_BOOST,
  GROUP_RAMP,
  GROUP_WALL,
  GROUP_WORLD,
  KART_SCALE,
  createPlayerKartEntities,
  scaleKartEntities,
} from '../src/racer/levels/shared';
import { isW3dtsMonoAvailable } from '../w3dtsMonoAliases';

function colliderGroup(entityId: string, entities: typeof raceTestSpec.entities): number | null {
  const e = entities.find((x) => x.id === entityId);
  if (!e) return null;
  const col = e.components.find((c) => c.type === 'collider');
  return col && col.type === 'collider' ? (col.collisionGroup ?? null) : null;
}

describe('blockout collision groups', () => {
  it('race-test: ground WORLD, walls WALL, whoops/dune RAMP, arch pillars WALL', () => {
    const ents = raceTestSpec.entities;
    expect(colliderGroup('RT_Ground', ents)).toBe(GROUP_WORLD);
    expect(colliderGroup('RT_WallOuter.0', ents)).toBe(GROUP_WALL);
    expect(colliderGroup('RT_WallInner.0', ents)).toBe(GROUP_WALL);
    expect(colliderGroup('prop.whoop.0.up', ents)).toBe(GROUP_RAMP);
    expect(colliderGroup('prop.dune', ents)).toBe(GROUP_RAMP);
    expect(colliderGroup('prop.arch.proving.left', ents)).toBe(GROUP_WALL);
    expect(colliderGroup('prop.arch.proving.right', ents)).toBe(GROUP_WALL);
    expect(colliderGroup('prop.arch.proving.lintel', ents)).toBeNull();
    expect(colliderGroup('cp.start_finish', ents)).toBeNull();
  });

  it('city-test: landmarks/gate WALL, pad RAMP, ground WORLD', () => {
    const ents = cityTestSpec.entities;
    expect(colliderGroup('CT_Ground', ents)).toBe(GROUP_WORLD);
    expect(colliderGroup('landmark.tower', ents)).toBe(GROUP_WALL);
    expect(colliderGroup('landmark.gate', ents)).toBe(GROUP_WALL);
    expect(colliderGroup('landmark.fountain', ents)).toBe(GROUP_WALL);
    expect(colliderGroup('landmark.pad', ents)).toBe(GROUP_RAMP);
    expect(colliderGroup('poi.garage', ents)).toBeNull();
  });
});

describe('scaleKartEntities', () => {
  it('scales wheels, collider, and derived vehicle params', () => {
    const base = createPlayerKartEntities({ position: [0, 0.22, 0], scale: 1 });
    const scaled = scaleKartEntities(
      createPlayerKartEntities({ position: [0, 0.22, 0], scale: 1 }),
      KART_SCALE
    );
    const chassis = scaled.find((e) => e.id === 'KartChassis')!;
    const baseChassis = base.find((e) => e.id === 'KartChassis')!;
    const vehicle = chassis.components.find((c) => c.type === 'vehicle');
    const baseVehicle = baseChassis.components.find((c) => c.type === 'vehicle');
    expect(vehicle?.type).toBe('vehicle');
    expect(baseVehicle?.type).toBe('vehicle');
    if (vehicle?.type !== 'vehicle' || baseVehicle?.type !== 'vehicle') return;

    const wheel = vehicle.wheels?.[0] as Record<string, unknown>;
    const baseWheel = baseVehicle.wheels?.[0] as Record<string, unknown>;
    expect(wheel.radius).toBeCloseTo((baseWheel.radius as number) * KART_SCALE, 5);
    expect(wheel.stiffness).toBeCloseTo((baseWheel.stiffness as number) / KART_SCALE, 5);
    expect(vehicle.maxSpeed).toBeCloseTo((baseVehicle.maxSpeed as number) * KART_SCALE, 5);

    const col = chassis.components.find((c) => c.type === 'collider');
    const baseCol = baseChassis.components.find((c) => c.type === 'collider');
    if (col?.type === 'collider' && baseCol?.type === 'collider' && col.size && baseCol.size) {
      expect(col.size[0]).toBeCloseTo(baseCol.size[0] * KART_SCALE, 5);
    }
  });

  it('plan-scale chase is farther than linear kart scale alone (sandbox path)', () => {
    const cam = createPlayerKartEntities({
      position: [0, 0.22 * KART_SCALE, 0],
      scale: KART_SCALE,
    }).find((e) => e.id === 'KartChaseCamera')!;
    const ctrl = cam.components.find((c) => c.type === 'cameraController');
    expect(ctrl?.type).toBe('cameraController');
    if (ctrl?.type !== 'cameraController') return;
    expect(ctrl.chaseDistance).toBeCloseTo(1.8 * KART_SCALE * CHASE_FRAME_BOOST, 5);
    expect(ctrl.chaseHeight).toBeCloseTo(0.7 * KART_SCALE * CHASE_FRAME_BOOST, 5);
    expect(cam.transform.scale).toEqual([1, 1, 1]);
  });
});

describe('race-test blockout kart (BO1g)', () => {
  it('spawns native 2 m kart (wheel radius 0.25, no gproc scale)', () => {
    const chassis = raceTestSpec.entities.find((e) => e.id === 'KartChassis')!;
    const vehicle = chassis.components.find((c) => c.type === 'vehicle');
    expect(vehicle?.type).toBe('vehicle');
    if (vehicle?.type !== 'vehicle') return;
    const wheel = vehicle.wheels?.[0] as { radius?: number };
    expect(wheel.radius).toBe(0.25);
    expect(vehicle.driveTorque).toBe(0);
    const cam = raceTestSpec.entities.find((e) => e.id === 'KartChaseCamera')!;
    const camera = cam.components.find((c) => c.type === 'camera');
    expect(camera?.type).toBe('camera');
    if (camera?.type === 'camera') expect(camera.far).toBeGreaterThanOrEqual(400);
  });

  it('ribbons and boost pads are flush (~0.01 thick)', () => {
    const ribbon = raceTestSpec.entities.find((e) => e.id === 'RT_Ribbon.0')!;
    expect(ribbon.transform.scale[1]).toBeCloseTo(0.01, 5);
    expect(ribbon.transform.position[1]).toBeCloseTo(0.005, 5);
    const boost = raceTestSpec.entities.find((e) => e.id === 'prop.boost.ground.0')!;
    expect(boost.transform.scale[1]).toBeCloseTo(0.01, 5);
  });
});

describe('anti-tunnel wall (mono physics)', () => {
  it.skipIf(!isW3dtsMonoAvailable())(
    'scaled chassis launched at wall does not pass through in 2s',
    () => {
      const world = new World();
      const physics = createPhysicsSystem({
        gravity: [0, 0, 0],
        fixedTimeStep: 1 / 120,
        maxStepsPerFrame: 8,
        solverIterations: 40,
        skinWidth: 0.008,
      });

      const wallTf = new TransformComponent();
      wallTf.position[0] = 5;
      wallTf.position[1] = 0.5;
      wallTf.updateLocalTransform();
      const wall = world.createEntity();
      world.addComponent(wall, wallTf);
      world.addComponent(
        wall,
        new RigidBodyComponent({ isKinematic: true, useGravity: false, mass: 0 })
      );
      world.addComponent(
        wall,
        new ColliderComponent({
          type: 'AABB',
          size: [0.5, 1, 4],
          collisionGroup: GROUP_WALL,
        })
      );

      const boxTf = new TransformComponent();
      boxTf.position[0] = 0;
      boxTf.position[1] = 0.5;
      boxTf.updateLocalTransform();
      const box = world.createEntity();
      world.addComponent(box, boxTf);
      const body = new RigidBodyComponent({
        mass: 1.5,
        useGravity: false,
        isKinematic: false,
        restitution: 0,
        friction: 0.2,
      });
      body.velocity[0] = 55; // ~maxSpeed * KART_SCALE
      world.addComponent(box, body);
      world.addComponent(
        box,
        new ColliderComponent({
          type: 'AABB',
          size: [0.28 * KART_SCALE, 0.022 * KART_SCALE, 0.22 * KART_SCALE],
          collisionGroup: 1,
          collisionMask: GROUP_WORLD | GROUP_WALL,
        })
      );

      for (let i = 0; i < 240; i++) {
        physics(world, 1 / 120, i / 120);
      }

      expect(boxTf.position[0]).toBeLessThan(5);
    }
  );
});
