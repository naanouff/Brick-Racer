/**
 * @file levelTypes.ts
 * @description Shared TypeScript level contract (no SceneDD).
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export type GraphRef = { id: string; url: string };

export type MaterialSpec = {
  shaderGraphId: string;
  name: string;
  properties: Record<string, unknown>;
};

export type PrimitiveSpec = {
  type: 'cube' | 'cylinder' | 'plane' | 'sphere' | 'quad' | 'capsule';
  params?: Record<string, number>;
};

export type TransformSpec = {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
};

export type LevelComponent =
  | {
      type: 'directionalLight';
      color?: number[];
      intensity?: number;
      castShadow?: boolean;
      direction?: number[];
    }
  | {
      type: 'renderable';
      meshId: string;
      materialId: string;
      castShadow?: boolean;
      visible?: boolean;
    }
  | {
      type: 'rigidBody';
      mass?: number;
      useGravity?: boolean;
      isKinematic?: boolean;
      drag?: number;
      angularDrag?: number;
      restitution?: number;
      friction?: number;
    }
  | {
      type: 'collider';
      shape?: 'box' | 'sphere';
      size?: Vec3;
      radius?: number;
      offset?: Vec3;
      collisionGroup?: number;
      collisionMask?: number;
    }
  | {
      type: 'vehicle';
      maxSteerAngle?: number;
      steerSpeed?: number;
      maxSpeed?: number;
      driveTorque?: number;
      brakeTorque?: number;
      rayMask?: number;
      antiRollStiffness?: number;
      rollDamping?: number;
      pitchDamping?: number;
      airAngularDamping?: number;
      yawAssist?: number;
      uprightStiffness?: number;
      antiWheelie?: number;
      leanMax?: number;
      wheels?: Array<Record<string, unknown>>;
    }
  | { type: 'scriptBinding'; scriptId: string }
  | {
      type: 'gproc';
      graphId: string;
      materialIds?: string[];
      parameters?: Record<string, unknown>;
    }
  | {
      type: 'camera';
      fov: number;
      near: number;
      far: number;
      isPrimary?: boolean;
      isMain?: boolean;
      firstPersonEyeOffsetY?: number;
    }
  | {
      type: 'cameraController';
      mode: 'chase' | 'fps' | 'orbital' | 'none';
      applyOn?: 'play' | 'gameFocus' | 'always';
      chaseTargetEntityId?: string;
      chaseDistance?: number;
      chaseHeight?: number;
      chaseLookAhead?: number;
      chaseLookHeight?: number;
      chaseFocusSmoothXZ?: number;
      chaseFocusSmoothY?: number;
      chaseYawSmooth?: number;
    };

export type LevelEntity = {
  id: string;
  name: string;
  parentId: string | null;
  transform: TransformSpec;
  components: LevelComponent[];
};

export type LevelSpec = {
  id: string;
  shaderGraphs: GraphRef[];
  geometryGraphs: GraphRef[];
  scriptGraphs: GraphRef[];
  materials: Record<string, MaterialSpec>;
  primitives: Record<string, PrimitiveSpec>;
  entities: LevelEntity[];
};

/** @deprecated Prefer LevelSpec — kept for sandbox call sites. */
export type SandboxKartLevel = LevelSpec;
