/**
 * @file assembleMinifig.ts
 * @description Recipe → hierarchical LevelEntity tree (BRICK-MF2d).
 *
 * Tree (parentId):
 *   root → pivot.hips → { part.hips, pivot.hipL/R → leg, part.torso →
 *     pivot.neck → head → hat/hair, pivot.shoulder* → arm, pivot.wrist* → hand → accessory }
 * Each pivot sits on its joint; mesh parts are offset children so poses rotate in place.
 *
 * Mesh source: LDraw (`MF_ldraw.*`) when preloaded; else legacy GPROC; else bo_cube proxy.
 */

import type { LevelEntity, MaterialSpec, Quat, Vec3 } from '../levels/shared/levelTypes';
import { minifigLdrawAgingTextureId, minifigLdrawMeshId, requireCatalogEntry } from './catalog';
import { computePivots, handOffsetFromWrist, handTiltDeg, legOffsetFromHip } from './dimensions';
import {
  minifigLdrawGamePosition,
  minifigLdrawRotation,
  type MinifigLdrawRole,
} from './ldrawAssembly';
import { minifigLdrawPlasticMaterial } from './ldrawPlasticMaterial';
import { DEFAULT_POSE, eulerDegToQuat, mergePose, type MinifigPose } from './pose';
import { minifigPlasticMaterial } from './plasticMaterial';
import type { MinifigRecipe, MinifigSlotAssignment } from './types';
import { assertValidRecipe } from './validateRecipe';

export type AssembleMinifigResult = {
  entities: LevelEntity[];
  materials: Record<string, MaterialSpec>;
  rootId: string;
};

/** Preloaded LDraw meshes available for this assemble pass. */
export type AssembleLdrawContext = {
  /** Design ids that uploaded successfully. */
  readyIds: ReadonlySet<string>;
  /** Game-space AABB size per design id (after catalog preview grounding). */
  sizes: ReadonlyMap<string, readonly [number, number, number]>;
  /** Design ids with a registered UV1 aging map. */
  agingIds?: ReadonlySet<string>;
};

export type AssembleMinifigOpts = {
  origin?: Vec3;
  pose?: MinifigPose | null;
  /** When set, prefer LDraw renderables for ready parts. */
  ldraw?: AssembleLdrawContext | null;
};

type V3 = readonly [number, number, number];

const IDENTITY: Quat = [0, 0, 0, 1];
/** Accessories are held through the clip, whose axis is hand-local Z. */
const ACCESSORY_IN_CLIP: Quat = eulerDegToQuat({ x: 90, y: 0, z: 0 });

function hexToRgb01(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return [0.7, 0.7, 0.7];
  }
  const n = Number.parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function tintMaterialId(partId: string, tint: string): string {
  const safe = tint.replace('#', '').toLowerCase();
  return `MF_${partId.replace(/\./g, '_')}_${safe}`;
}

function resolveTint(partId: string, recipeTint: string | null | undefined): string {
  if (recipeTint) return recipeTint;
  return requireCatalogEntry(partId).defaultTint ?? '#888888';
}

function resolvePrintTextureUrl(printId: string | null | undefined): string | null {
  if (!printId) return null;
  const entry = requireCatalogEntry(printId);
  return entry.textureUrl ?? null;
}

function sub(a: V3, b: V3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function mirrorX(v: V3): Vec3 {
  return [-v[0], v[1], v[2]];
}

function hasPart(slot: MinifigSlotAssignment | undefined): slot is MinifigSlotAssignment & {
  part: string;
} {
  return !!slot?.part && slot.part !== 'hat.none';
}

/**
 * Builds a hierarchical minifig for a validated recipe.
 * Mesh parts are children of joint pivots so `pose` rotates each articulation in place.
 */
export function assembleMinifigEntities(
  recipe: MinifigRecipe,
  opts?: AssembleMinifigOpts
): AssembleMinifigResult {
  assertValidRecipe(recipe);
  const origin = opts?.origin ?? ([0, 0, 0] as Vec3);
  const pose = mergePose(DEFAULT_POSE, opts?.pose);
  const ldraw = opts?.ldraw ?? null;
  const rootId = `minifig.${recipe.id}`;
  const materials: Record<string, MaterialSpec> = {};
  const entities: LevelEntity[] = [];
  const slots = recipe.slots;
  const P = computePivots();

  const pivot = (joint: string) => `${rootId}.pivot.${joint}`;
  const part = (name: string) => `${rootId}.part.${name}`;

  const ensureMat = (
    partId: string,
    tint: string | null | undefined,
    printId?: string | null
  ): string => {
    const tintHex = resolveTint(partId, tint);
    const printTex = resolvePrintTextureUrl(printId);
    const matId = printTex
      ? `${tintMaterialId(partId, tintHex)}_print`
      : tintMaterialId(partId, tintHex);
    if (!materials[matId]) {
      const [r, g, b] = hexToRgb01(tintHex);
      materials[matId] = minifigPlasticMaterial({
        name: matId,
        partId,
        tintRgb: [r, g, b],
        printTextureId: printTex,
        metallic:
          partId.includes('wrench') || partId.includes('chrome') ? 0.55 : 0.05,
      });
    }
    return matId;
  };

  /** One material per LDraw design id: each part has its own UV1 aging map. */
  const ensureLdrawMat = (
    partId: string,
    ldrawId: string,
    role: MinifigLdrawRole,
    tint: string | null | undefined,
    printId?: string | null
  ): string => {
    const tintHex = resolveTint(partId, tint);
    const printTex = resolvePrintTextureUrl(printId);
    const base = `MF_ld_${ldrawId}_${tintHex.replace('#', '').toLowerCase()}`;
    const matId = printTex ? `${base}_print` : base;
    if (!materials[matId]) {
      materials[matId] = minifigLdrawPlasticMaterial({
        name: matId,
        role,
        tintRgb: hexToRgb01(tintHex),
        printTextureId: printTex,
        agingTextureId: ldraw?.agingIds?.has(ldrawId)
          ? minifigLdrawAgingTextureId(ldrawId)
          : null,
        metallic: partId.includes('wrench') || partId.includes('chrome') ? 0.55 : 0.05,
      });
    }
    return matId;
  };

  const pushEmpty = (
    id: string,
    parentId: string | null,
    localPos: Vec3,
    rotation: Quat = IDENTITY
  ): void => {
    entities.push({
      id,
      name: id,
      parentId,
      transform: { position: localPos, rotation, scale: [1, 1, 1] },
      components: [],
    });
  };

  /**
   * LDraw renderable when ready, else GPROC, else bo_cube proxy.
   * `ldrawId` / `graphId` are mutually preferred in that order.
   */
  const pushMesh = (
    id: string,
    parentId: string,
    slot: MinifigSlotAssignment & { part: string },
    meshIds: { ldrawId?: string; ldrawRole?: MinifigLdrawRole; graphId?: string },
    localPos: Vec3,
    rotation: Quat = IDENTITY,
    printId?: string | null
  ): void => {
    const entry = requireCatalogEntry(slot.part);
    const proxy = entry.proxySize ?? [0.3, 0.3, 0.3];

    if (meshIds.ldrawId && meshIds.ldrawRole && ldraw?.readyIds.has(meshIds.ldrawId)) {
      // Native LDraw metres, part origin at the snap. No fit-to-proxy scale.
      const matId = ensureLdrawMat(
        slot.part,
        meshIds.ldrawId,
        meshIds.ldrawRole,
        slot.tint,
        printId ?? slot.print
      );
      entities.push({
        id,
        name: id,
        parentId: rootId,
        transform: {
          position: minifigLdrawGamePosition(meshIds.ldrawRole),
          rotation: minifigLdrawRotation(meshIds.ldrawRole),
          scale: [1, 1, 1],
        },
        components: [
          {
            type: 'renderable',
            meshId: minifigLdrawMeshId(meshIds.ldrawId),
            materialId: matId,
            castShadow: true,
          },
        ],
      });
      return;
    }

    const matId = ensureMat(slot.part, slot.tint, printId ?? slot.print);

    if (meshIds.graphId) {
      entities.push({
        id,
        name: id,
        parentId,
        transform: { position: localPos, rotation, scale: [1, 1, 1] },
        components: [{ type: 'gproc', graphId: meshIds.graphId, materialIds: [matId] }],
      });
      return;
    }

    entities.push({
      id,
      name: id,
      parentId,
      transform: {
        position: localPos,
        rotation,
        scale: [...proxy],
      },
      components: [
        { type: 'renderable', meshId: 'bo_cube', materialId: matId, castShadow: true },
      ],
    });
  };

  // --- Root + hips ---
  pushEmpty(rootId, null, [...origin]);
  pushEmpty(pivot('hips'), rootId, [...P.hips]);

  if (hasPart(slots.hipsLegs)) {
    const entry = requireCatalogEntry(slots.hipsLegs.part);
    pushMesh(part('hips'), pivot('hips'), slots.hipsLegs, {
      ldrawId: entry.ldrawId,
      ldrawRole: 'hips',
      graphId: entry.gprocId,
    }, [0, 0, 0]);

    const legOffset = legOffsetFromHip();
    pushEmpty(pivot('hipL'), pivot('hips'), sub(P.hipL, P.hips), eulerDegToQuat(pose.hipL));
    pushMesh(part('leg.L'), pivot('hipL'), slots.hipsLegs, {
      ldrawId: entry.ldrawPair?.left,
      ldrawRole: 'legL',
      graphId: entry.gprocPair?.left,
    }, legOffset);
    pushEmpty(pivot('hipR'), pivot('hips'), sub(P.hipR, P.hips), eulerDegToQuat(pose.hipR));
    pushMesh(part('leg.R'), pivot('hipR'), slots.hipsLegs, {
      ldrawId: entry.ldrawPair?.right,
      ldrawRole: 'legR',
      graphId: entry.gprocPair?.right,
    }, legOffset);
  }

  // --- Torso (child of hips pivot) ---
  const hasTorso = hasPart(slots.torso);
  if (hasPart(slots.torso)) {
    const entry = requireCatalogEntry(slots.torso.part);
    pushMesh(part('torso'), pivot('hips'), slots.torso, {
      ldrawId: entry.ldrawId,
      ldrawRole: 'torso',
      graphId: entry.gprocId,
    }, sub(P.torso, P.hips));
  }
  const torsoParent = hasTorso ? part('torso') : pivot('hips');
  const torsoBase: V3 = hasTorso ? P.torso : P.hips;

  // --- Neck → head → hat / hair ---
  pushEmpty(pivot('neck'), torsoParent, sub(P.neck, torsoBase), eulerDegToQuat(pose.neck));

  const hasHead = hasPart(slots.head);
  if (hasPart(slots.head)) {
    const entry = requireCatalogEntry(slots.head.part);
    const facePrintId = slots.facePrint?.print ?? null;
    pushMesh(
      part('head'),
      pivot('neck'),
      slots.head,
      { ldrawId: entry.ldrawId, ldrawRole: 'head', graphId: entry.gprocId },
      sub(P.head, P.neck),
      IDENTITY,
      facePrintId
    );
  }
  const headParent = hasHead ? part('head') : pivot('neck');
  const headBase: V3 = hasHead ? P.head : P.neck;

  if (hasPart(slots.hat)) {
    const entry = requireCatalogEntry(slots.hat.part);
    pushMesh(part('hat'), headParent, slots.hat, {
      ldrawId: entry.ldrawId,
      ldrawRole: 'hat',
      graphId: entry.gprocId,
    }, sub(P.hat, headBase));
  }
  if (hasPart(slots.hair)) {
    const entry = requireCatalogEntry(slots.hair.part);
    pushMesh(part('hair'), headParent, slots.hair, {
      ldrawId: entry.ldrawId,
      graphId: entry.gprocId,
    }, sub(P.hat, headBase));
  }

  // --- Shoulders → arms; wrists are children of the shoulder so they follow the arm ---
  pushEmpty(
    pivot('shoulderL'),
    torsoParent,
    sub(P.shoulderL, torsoBase),
    eulerDegToQuat(pose.shoulderL)
  );
  pushEmpty(
    pivot('shoulderR'),
    torsoParent,
    sub(P.shoulderR, torsoBase),
    eulerDegToQuat(pose.shoulderR)
  );
  if (hasPart(slots.arms)) {
    const entry = requireCatalogEntry(slots.arms.part);
    pushMesh(part('arm.L'), pivot('shoulderL'), slots.arms, {
      ldrawId: entry.ldrawPair?.left,
      ldrawRole: 'armL',
      graphId: entry.gprocPair?.left,
    }, [0, 0, 0]);
    pushMesh(part('arm.R'), pivot('shoulderR'), slots.arms, {
      ldrawId: entry.ldrawPair?.right,
      ldrawRole: 'armR',
      graphId: entry.gprocPair?.right,
    }, [0, 0, 0]);
  }
  pushEmpty(
    pivot('wristL'),
    pivot('shoulderL'),
    sub(P.wristL, P.shoulderL),
    eulerDegToQuat(pose.wristL)
  );
  pushEmpty(
    pivot('wristR'),
    pivot('shoulderR'),
    sub(P.wristR, P.shoulderR),
    eulerDegToQuat(pose.wristR)
  );

  // --- Hands → accessories ---
  const handOffset = handOffsetFromWrist();
  const [tx, ty, tz] = handTiltDeg();
  const handTilt = eulerDegToQuat({ x: tx, y: ty, z: tz });
  const hasHands = hasPart(slots.hands);
  if (hasPart(slots.hands)) {
    const entry = requireCatalogEntry(slots.hands.part);
    pushMesh(
      part('hand.L'),
      pivot('wristL'),
      slots.hands,
      { ldrawId: entry.ldrawId, ldrawRole: 'handL', graphId: entry.gprocId },
      mirrorX(handOffset),
      handTilt
    );
    pushMesh(
      part('hand.R'),
      pivot('wristR'),
      slots.hands,
      { ldrawId: entry.ldrawId, ldrawRole: 'handR', graphId: entry.gprocId },
      [...handOffset],
      handTilt
    );
  }

  const accessory = (side: 'L' | 'R', slot: MinifigSlotAssignment | undefined): void => {
    if (!hasPart(slot)) return;
    const entry = requireCatalogEntry(slot.part);
    const ids = { ldrawId: entry.ldrawId, graphId: entry.gprocId };
    const id = part(`accessory${side}`);
    if (hasHands) {
      pushMesh(id, part(`hand.${side}`), slot, ids, [0, 0, 0], ACCESSORY_IN_CLIP);
      return;
    }
    const wrist = pivot(side === 'L' ? 'wristL' : 'wristR');
    const offset: Vec3 = side === 'L' ? mirrorX(handOffset) : [...handOffset];
    pushMesh(id, wrist, slot, ids, offset, handTilt);
  };
  accessory('L', slots.accessoryL);
  accessory('R', slots.accessoryR);

  return { entities, materials, rootId };
}

/** @alias assembleMinifigEntities — LevelSpec path used by SceneDirector. */
export const assembleMinifig = assembleMinifigEntities;
