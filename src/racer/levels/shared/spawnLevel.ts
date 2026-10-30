/**
 * @file spawnLevel.ts
 * @description Imperative ECS spawn for TypeScript levels (no SceneDD).
 */

import { quat, vec3 } from 'gl-matrix';
import {
  CameraComponent,
  DirectionalLightComponent,
  GameCameraControllerComponent,
  HierarchyComponent,
  Material,
  NameComponent,
  PrimitiveFactory,
  RenderableComponent,
  TransformComponent,
  type Engine,
  type Entity,
  type IEngineContext,
  type Material as MaterialType,
  type Mesh,
  type ResourceManager,
  type ShaderGraph,
  type World,
} from '@naanouff/w3dts-core';
import { GProcComponent, bootstrapGProcRuntime, type GProcGraph } from '@naanouff/w3dts-gproc';
import {
  CATALOG_AGING_TEXTURE_ID,
  ensureCatalogAgingTexture,
} from '../../hub/brick/catalog/catalogAgingTexture';
import { ensureMinifigPrintTextures } from '../../minifig/loadMinifigPrintTextures';
import {
  ensureMinifigUvGridTexture,
  MINIFIG_UV_GRID_TEXTURE_ID,
} from '../../minifig/minifigUvGridDebug';
import { registerMinifigGprocNodes } from '../../minifig/registerMinifigGprocNodes';
import {
  ColliderComponent,
  RigidBodyComponent,
  VehicleComponent,
} from '@naanouff/w3dts-physics';
import { ScriptComponent } from '@naanouff/w3dts-scripts';
import {
  BO_DEBUG_GRID_TEXTURE_ID,
  ensureBlockoutDebugTexture,
  resolveDebugTexEnabled,
} from '../../host/blockoutDebugTexture';
import type {
  LevelComponent,
  LevelEntity,
  LevelSpec,
  PrimitiveSpec,
} from './levelTypes';

export async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export function applyTransform(tf: TransformComponent, entity: LevelEntity): void {
  const { position, rotation, scale } = entity.transform;
  vec3.set(tf.position, position[0], position[1], position[2]);
  quat.set(tf.rotation, rotation[0], rotation[1], rotation[2], rotation[3]);
  vec3.set(tf.scale, scale[0], scale[1], scale[2]);
  tf.updateLocalTransform();
}

export function createPrimitiveMesh(id: string, entry: PrimitiveSpec): Mesh {
  const p = entry.params ?? {};
  let mesh: Mesh;
  switch (entry.type) {
    case 'cube': {
      const wx = p.worldUvScaleX;
      const wy = p.worldUvScaleY;
      const wz = p.worldUvScaleZ;
      const hasWs = wx != null && wy != null && wz != null;
      mesh = PrimitiveFactory.createCube(
        p.size ?? 1,
        hasWs ? { worldUvScale: [Number(wx), Number(wy), Number(wz)] } : undefined
      );
      break;
    }
    case 'cylinder':
      mesh = PrimitiveFactory.createCylinder(
        p.radiusTop ?? p.radius ?? 1,
        p.radiusBottom ?? p.radius ?? 1,
        p.height ?? 1,
        p.radialSegments ?? 8,
        p.heightSegments ?? 1
      );
      break;
    case 'plane':
      mesh = PrimitiveFactory.createPlane(p.size ?? 10, p.uvRepeat ?? 1);
      break;
    case 'sphere':
      mesh = PrimitiveFactory.createSphere(
        p.radius ?? 0.5,
        p.latitudeBands ?? 30,
        p.longitudeBands ?? 30
      );
      break;
    case 'capsule':
      mesh = PrimitiveFactory.createCapsule(
        p.radius ?? 0.5,
        p.height ?? 1,
        p.radialSegments ?? 16,
        p.ringsCylinder ?? 1,
        p.ringsCap ?? 4
      );
      break;
    case 'quad':
    default:
      mesh = PrimitiveFactory.createQuad();
      break;
  }
  mesh.name = id;
  return mesh;
}

function buildMaterial(
  id: string,
  spec: LevelSpec['materials'][string],
  shaderGraphs: ReadonlyMap<string, unknown>,
  resourceManager: ResourceManager,
  device?: GPUDevice | null
): MaterialType {
  const p = spec.properties;
  const shaderGraph = shaderGraphs.get(spec.shaderGraphId) as ShaderGraph | undefined;
  const baseOrDiffuseArr =
    Array.isArray(p.baseColor) && (p.baseColor as number[]).length >= 3
      ? (p.baseColor as number[])
      : Array.isArray(p.diffuseColor) && (p.diffuseColor as number[]).length >= 3
        ? (p.diffuseColor as number[])
        : undefined;
  const alphaModeRaw = p.alphaMode;
  const alphaMode =
    alphaModeRaw === 'BLEND' ||
    alphaModeRaw === 'MASK' ||
    alphaModeRaw === 'MULTIPLY' ||
    alphaModeRaw === 'OPAQUE'
      ? alphaModeRaw
      : undefined;
  const material = new Material({
    name: spec.name || id,
    shaderGraph,
    diffuseColor: baseOrDiffuseArr
      ? vec3.fromValues(baseOrDiffuseArr[0], baseOrDiffuseArr[1], baseOrDiffuseArr[2])
      : undefined,
    metallic: typeof p.metallic === 'number' ? p.metallic : undefined,
    roughness: typeof p.roughness === 'number' ? p.roughness : undefined,
    alphaMode,
    alphaCutoff: typeof p.alphaCutoff === 'number' ? p.alphaCutoff : undefined,
    doubleSided: p.doubleSided === true,
    properties: p,
  });
  let needsTextureSampler = false;
  for (const [k, v] of Object.entries(p)) {
    let val: unknown = v;
    if (typeof v === 'string' && (k.endsWith('Texture') || k === 'baseColorTexture')) {
      const tex = resourceManager.getTexture(v);
      if (tex) {
        val = tex;
        needsTextureSampler = true;
      }
    } else if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number') {
      // Keep vec4 (printFrame, baseColor). A 4-float array must not collapse to vec3.
      if (v.length >= 4) {
        val = [Number(v[0]), Number(v[1]), Number(v[2]), Number(v[3])];
      } else if (v.length === 2) {
        val = [Number(v[0]), Number(v[1])];
      } else {
        val = vec3.fromValues(Number(v[0]), Number(v[1]), Number(v[2]));
      }
    }
    material.properties.set(k, val);
  }
  if (baseOrDiffuseArr && !material.properties.has('baseColor')) {
    material.properties.set(
      'baseColor',
      baseOrDiffuseArr.length >= 4
        ? baseOrDiffuseArr
        : [...baseOrDiffuseArr.slice(0, 3), 1]
    );
  }
  if (needsTextureSampler && !material.sampler) {
    material.sampler =
      device?.createSampler?.({
        addressModeU: 'repeat',
        addressModeV: 'repeat',
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        maxAnisotropy: 16,
      }) ?? material.sampler;
  }
  return material;
}

function addComponent(
  world: World,
  entity: Entity,
  comp: LevelComponent,
  ctx: {
    meshes: Map<string, Mesh>;
    materials: Map<string, MaterialType>;
    geometryGraphs: ReadonlyMap<string, unknown>;
    scriptGraphs: ReadonlyMap<string, unknown>;
  }
): void {
  switch (comp.type) {
    case 'directionalLight': {
      const color = Array.isArray(comp.color) && comp.color.length >= 3
        ? vec3.fromValues(Number(comp.color[0]), Number(comp.color[1]), Number(comp.color[2]))
        : undefined;
      world.addComponent(
        entity,
        new DirectionalLightComponent({
          color,
          intensity: comp.intensity,
          shadowsEnabled: comp.castShadow ?? false,
        })
      );
      const d = comp.direction;
      if (d && d.length >= 3) {
        const t = world.getComponent(entity, TransformComponent);
        if (t) {
          const from = vec3.fromValues(0, -1, 0);
          const to = vec3.fromValues(Number(d[0]), Number(d[1]), Number(d[2]));
          const len = vec3.length(to);
          if (len > 1e-6) {
            vec3.scale(to, to, 1 / len);
            quat.rotationTo(t.rotation, from, to);
            t.updateLocalTransform();
          }
        }
      }
      break;
    }
    case 'renderable': {
      const mesh = ctx.meshes.get(comp.meshId);
      const mat = ctx.materials.get(comp.materialId);
      if (mesh && mat) {
        world.addComponent(
          entity,
          new RenderableComponent(mesh, mat, comp.castShadow ?? false, comp.visible ?? true)
        );
      }
      break;
    }
    case 'rigidBody':
      world.addComponent(
        entity,
        new RigidBodyComponent({
          mass: comp.mass,
          useGravity: comp.useGravity,
          isKinematic: comp.isKinematic,
          drag: comp.drag,
          angularDrag: comp.angularDrag,
          restitution: comp.restitution,
          friction: comp.friction,
        })
      );
      break;
    case 'collider': {
      const isSphere = comp.shape === 'sphere';
      world.addComponent(
        entity,
        new ColliderComponent({
          type: isSphere ? 'SPHERE' : 'AABB',
          size: !isSphere && comp.size ? comp.size : undefined,
          radius: isSphere ? (comp.radius ?? 0.5) : undefined,
          offset: comp.offset,
          collisionGroup: comp.collisionGroup,
          collisionMask: comp.collisionMask,
        })
      );
      break;
    }
    case 'vehicle': {
      // yawAssist / upright / antiWheelie / leanMax exist on mono VehicleComponentOptions.
      const vehicle = new VehicleComponent({
        maxSteerAngle: comp.maxSteerAngle,
        steerSpeed: comp.steerSpeed,
        maxSpeed: comp.maxSpeed,
        driveTorque: comp.driveTorque,
        brakeTorque: comp.brakeTorque,
        rayMask: comp.rayMask,
        antiRollStiffness: comp.antiRollStiffness,
        rollDamping: comp.rollDamping,
        pitchDamping: comp.pitchDamping,
        airAngularDamping: comp.airAngularDamping,
        yawAssist: comp.yawAssist,
        uprightStiffness: comp.uprightStiffness,
        antiWheelie: comp.antiWheelie,
        leanMax: comp.leanMax,
        wheels: Array.isArray(comp.wheels)
          ? (comp.wheels as Array<Record<string, unknown>>).map((w) => ({
              id: typeof w.id === 'string' ? w.id : undefined,
              hardpoint: w.hardpoint as [number, number, number] | undefined,
              restLength: typeof w.restLength === 'number' ? w.restLength : undefined,
              travel: typeof w.travel === 'number' ? w.travel : undefined,
              stiffness: typeof w.stiffness === 'number' ? w.stiffness : undefined,
              damping: typeof w.damping === 'number' ? w.damping : undefined,
              radius: typeof w.radius === 'number' ? w.radius : undefined,
              driven: typeof w.driven === 'boolean' ? w.driven : undefined,
              steered: typeof w.steered === 'boolean' ? w.steered : undefined,
              mu: typeof w.mu === 'number' ? w.mu : undefined,
              longitudinalStiffness:
                typeof w.longitudinalStiffness === 'number' ? w.longitudinalStiffness : undefined,
              corneringStiffness:
                typeof w.corneringStiffness === 'number' ? w.corneringStiffness : undefined,
            }))
          : undefined,
      } as ConstructorParameters<typeof VehicleComponent>[0]);
      world.addComponent(entity, vehicle as never);
      break;
    }
    case 'scriptBinding': {
      const graph = ctx.scriptGraphs.get(comp.scriptId);
      if (graph) {
        world.addComponent(entity, new ScriptComponent(graph as never) as never);
      }
      break;
    }
    case 'gproc': {
      const graph = ctx.geometryGraphs.get(comp.graphId) as GProcGraph | undefined;
      if (!graph) break;
      const mats =
        comp.materialIds?.length && comp.materialIds.every((id) => ctx.materials.has(id))
          ? (comp.materialIds.map((id) => ctx.materials.get(id)!) as MaterialType[])
          : null;
      const gproc = new GProcComponent(graph, mats);
      if (comp.parameters) gproc.parameters = { ...comp.parameters };
      world.addComponent(entity, gproc as never);
      break;
    }
    case 'camera': {
      const cam = new CameraComponent();
      cam.fov = comp.fov;
      cam.near = comp.near;
      cam.far = comp.far;
      cam.isActive = comp.isPrimary ?? true;
      cam.isMain = comp.isMain ?? false;
      if (typeof comp.firstPersonEyeOffsetY === 'number') {
        cam.firstPersonEyeOffsetY = comp.firstPersonEyeOffsetY;
      }
      world.addComponent(entity, cam);
      break;
    }
    case 'cameraController': {
      const ctrl = new GameCameraControllerComponent(comp.mode, comp.applyOn ?? 'play');
      if (typeof comp.chaseTargetEntityId === 'string') {
        ctrl.chaseTargetEntityId = comp.chaseTargetEntityId;
      }
      if (typeof comp.chaseDistance === 'number') ctrl.chaseDistance = comp.chaseDistance;
      if (typeof comp.chaseHeight === 'number') ctrl.chaseHeight = comp.chaseHeight;
      if (typeof comp.chaseLookAhead === 'number') ctrl.chaseLookAhead = comp.chaseLookAhead;
      if (typeof comp.chaseLookHeight === 'number') ctrl.chaseLookHeight = comp.chaseLookHeight;
      if (typeof comp.chaseFocusSmoothXZ === 'number') {
        ctrl.chaseFocusSmoothXZ = comp.chaseFocusSmoothXZ;
      }
      if (typeof comp.chaseFocusSmoothY === 'number') {
        ctrl.chaseFocusSmoothY = comp.chaseFocusSmoothY;
      }
      if (typeof comp.chaseYawSmooth === 'number') ctrl.chaseYawSmooth = comp.chaseYawSmooth;
      if (typeof comp.orbitalMinDistance === 'number') {
        ctrl.orbitalMinDistance = comp.orbitalMinDistance;
      }
      if (typeof comp.orbitalMaxDistance === 'number') {
        ctrl.orbitalMaxDistance = comp.orbitalMaxDistance;
      }
      if (typeof comp.orbitalZoomSensitivity === 'number') {
        ctrl.orbitalZoomSensitivity = comp.orbitalZoomSensitivity;
      }
      if (typeof comp.orbitalRotateSpeed === 'number') {
        ctrl.orbitalRotateSpeed = comp.orbitalRotateSpeed;
      }
      if (typeof comp.orbitalDamping === 'number') ctrl.orbitalDamping = comp.orbitalDamping;
      if (comp.orbitalLeftMouseMode) ctrl.orbitalLeftMouseMode = comp.orbitalLeftMouseMode;
      world.addComponent(entity, ctrl);
      break;
    }
  }
}

function attachOrphanRootsToScene(engine: IEngineContext): void {
  const sceneRootId = engine.scene.entityId;
  const sceneHierarchy = engine.ecsWorld.getComponent(sceneRootId, HierarchyComponent);
  if (!sceneHierarchy) return;
  for (const [entity, [h]] of engine.ecsWorld
    .query<[HierarchyComponent]>([HierarchyComponent])
    .iter()) {
    if (entity === sceneRootId) continue;
    if (h.parent === null && !sceneHierarchy.children.includes(entity)) {
      h.parent = sceneRootId;
      sceneHierarchy.children.push(entity);
    }
  }
}

export type SpawnLevelResult = {
  /** Root entity ids (parentId null) — safe to destroyEntity recursively. */
  rootEntityIds: Entity[];
  entityById: Map<string, Entity>;
};

export type SpawnLevelOpts = {
  /** Extra meshes already uploaded (e.g. LDraw minifig parts). */
  extraMeshes?: ReadonlyMap<string, Mesh>;
};

/**
 * Loads graphs/materials/meshes from the level spec and spawns all entities into the ECS.
 */
export async function spawnLevel(
  engine: IEngineContext,
  level: LevelSpec,
  opts?: SpawnLevelOpts
): Promise<SpawnLevelResult> {
  bootstrapGProcRuntime();
  registerMinifigGprocNodes();
  const full = engine as Engine;
  const { resourceManager, ecsWorld: world } = full;

  for (const g of level.shaderGraphs) {
    const payload = await fetchJson(g.url);
    resourceManager.upsertGraphResource('shader-graph', payload, g.id);
  }
  for (const g of level.geometryGraphs) {
    const payload = await fetchJson(g.url);
    resourceManager.upsertGraphResource('geometry-graph', payload, g.id);
  }
  for (const g of level.scriptGraphs) {
    const payload = await fetchJson(g.url);
    resourceManager.upsertGraphResource('script-graph', payload, g.id);
  }

  const shaderGraphs = resourceManager.getCachedGraphs('shader-graph');
  const geometryGraphs = resourceManager.getCachedGraphs('geometry-graph');
  const scriptGraphs = resourceManager.getCachedGraphs('script-graph');

  for (const g of level.shaderGraphs) {
    if (!shaderGraphs.get(g.id)) {
      throw new Error(`Shader graph '${g.id}' missing after load (${g.url}). Check public/shader-graphs.`);
    }
  }
  for (const g of level.geometryGraphs) {
    if (!geometryGraphs.get(g.id)) {
      throw new Error(`Geometry graph '${g.id}' missing after load (${g.url}). Check public/gproc.`);
    }
  }

  const needsDebugGrid = Object.values(level.materials).some(
    (m) => m.properties?.baseColorTexture === BO_DEBUG_GRID_TEXTURE_ID
  );
  if (
    needsDebugGrid &&
    resolveDebugTexEnabled(typeof window !== 'undefined' ? window.location.search : '')
  ) {
    await ensureBlockoutDebugTexture(full);
  }

  await ensureMinifigPrintTextures(full, level.materials);

  const needsAgingMap = Object.values(level.materials).some(
    (m) => m.properties?.baseColorTexture === CATALOG_AGING_TEXTURE_ID
  );
  if (needsAgingMap) ensureCatalogAgingTexture(full);

  const needsUvGrid = Object.values(level.materials).some(
    (m) => m.properties?.baseColorTexture === MINIFIG_UV_GRID_TEXTURE_ID
  );
  if (needsUvGrid) {
    await ensureMinifigUvGridTexture(full);
  }

  const device = full.webGPUContext?.device;
  const materials = new Map<string, MaterialType>();
  for (const [id, spec] of Object.entries(level.materials)) {
    if (!shaderGraphs.get(spec.shaderGraphId)) {
      throw new Error(
        `Material '${id}' references missing shaderGraph '${spec.shaderGraphId}' — add it to LevelSpec.shaderGraphs`
      );
    }
    const mat = buildMaterial(id, spec, shaderGraphs, resourceManager, device);
    if (!mat.shaderGraph) {
      throw new Error(`Material '${id}' has no shaderGraph (id=${spec.shaderGraphId})`);
    }
    resourceManager.uploadMaterial(mat);
    materials.set(id, mat);
  }

  const meshes = new Map<string, Mesh>();
  for (const [id, entry] of Object.entries(level.primitives)) {
    const mesh = createPrimitiveMesh(id, entry);
    resourceManager.uploadMesh(mesh);
    meshes.set(id, mesh);
  }
  if (opts?.extraMeshes) {
    for (const [id, mesh] of opts.extraMeshes) {
      meshes.set(id, mesh);
    }
  }

  const entityById = new Map<string, Entity>();
  const rootEntityIds: Entity[] = [];
  const componentCtx = { meshes, materials, geometryGraphs, scriptGraphs };

  for (const ed of level.entities) {
    const entity = world.createEntity();
    entityById.set(ed.id, entity);
    world.addComponent(entity, new NameComponent(ed.name));
    const tf = new TransformComponent();
    applyTransform(tf, ed);
    world.addComponent(entity, tf);

    const parentEntity = ed.parentId != null ? entityById.get(ed.parentId) ?? null : null;
    world.addComponent(entity, new HierarchyComponent(parentEntity));
    if (parentEntity != null) {
      const parentH = world.getComponent(parentEntity, HierarchyComponent);
      if (parentH) parentH.children.push(entity);
    } else {
      rootEntityIds.push(entity);
    }

    for (const comp of ed.components) {
      addComponent(world, entity, comp, componentCtx);
    }
  }

  attachOrphanRootsToScene(engine);
  return { rootEntityIds, entityById };
}
