/**
 * @file minifigLabSpec.ts
 * @description Sandbox preview for minifig editor (BRICK-MF1e).
 */

import {
  assembleMinifigEntities,
  type AssembleLdrawContext,
} from '../../minifig/assembleMinifig';
import {
  CATALOG_PLASTIC_SHADER_ID,
  CATALOG_PLASTIC_SHADER_URL,
} from '../../hub/brick/catalog/catalogPlasticMaterials';
import { minifigLdrawFocusY } from '../../minifig/ldrawAssembly';
import { MINIFIG_GPROC_GRAPHS } from '../../minifig/gprocGraphs';
import { loadStoredRecipe } from '../../minifig/recipeStorage';
import type { MinifigRecipe } from '../../minifig/types';
import {
  applyAmbientPlasticMaps,
  resolveMinifigPlasticMap,
} from '../../minifig/plasticMapSets';
import {
  applyMinifigUvGridDebugMaterials,
  MINIFIG_UV_GRID_SHADER_ID,
  MINIFIG_UV_GRID_SHADER_URL,
  resolveMinifigUvGridEnabled,
} from '../../minifig/minifigUvGridDebug';
import {
  MINIFIG_PLASTIC_SHADER_ID,
  MINIFIG_PLASTIC_SHADER_URL,
} from '../../minifig/plasticMaterial';
import {
  BLOCKOUT_PRIMITIVES,
  BLOCKOUT_SHADER_GRAPHS,
  blockoutMaterials,
  makeSunEntity,
} from '../shared/blockoutKit';
import type { LevelEntity, LevelSpec } from '../shared/levelTypes';
import { spawnStaticBox } from '../shared/staticBox';

const PEDESTAL_HEIGHT = 0.1;

/** Minifig root sits on top of the pedestal. */
export const MINIFIG_LAB_ORIGIN = [0, PEDESTAL_HEIGHT, 0] as const;
export const MINIFIG_LAB_CAMERA_ID = 'MinifigLabCamera';
/** Orbit pivot: mid-torso of the native LDraw figure. */
export const MINIFIG_LAB_ORBIT_TARGET: readonly [number, number, number] = [
  0,
  PEDESTAL_HEIGHT + minifigLdrawFocusY(),
  0,
];

export type MinifigLabSpecOpts = {
  /** Sample mesh UV0 with the 0–1 debug grid instead of plastic/prints. */
  uvGrid?: boolean;
  /** Preloaded LDraw meshes (MF2). When set, body parts prefer LDraw over GPROC. */
  ldraw?: AssembleLdrawContext | null;
  /** Override recipe (defaults to session storage / Bolt). */
  recipe?: MinifigRecipe;
};

/** Fresh spec each load so editor swaps (sessionStorage) apply. */
export function buildMinifigLabSpec(opts?: MinifigLabSpecOpts): LevelSpec {
  const uvGrid =
    opts?.uvGrid ??
    (typeof window !== 'undefined' && resolveMinifigUvGridEnabled(window.location.search));

  const recipe = opts?.recipe ?? loadStoredRecipe();
  const useLdraw = opts?.ldraw && opts.ldraw.readyIds.size > 0 ? opts.ldraw : null;
  const assembled = assembleMinifigEntities(recipe, {
    origin: [...MINIFIG_LAB_ORIGIN],
    ldraw: useLdraw,
  });

  const materials = {
    ...blockoutMaterials(),
    ...assembled.materials,
  };
  if (uvGrid) {
    applyMinifigUvGridDebugMaterials(materials);
  } else {
    const plastic = resolveMinifigPlasticMap(
      typeof window !== 'undefined' ? window.location.search : ''
    );
    if (plastic) applyAmbientPlasticMaps(materials, plastic);
  }

  const focusY = MINIFIG_LAB_ORBIT_TARGET[1];
  const camera: LevelEntity = {
    id: MINIFIG_LAB_CAMERA_ID,
    name: MINIFIG_LAB_CAMERA_ID,
    parentId: null,
    transform: {
      position: [2.6, focusY + 0.55, 3.8],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    components: [
      {
        type: 'camera',
        fov: 0.85,
        near: 0.05,
        far: 200,
        isPrimary: true,
        isMain: true,
      },
      {
        type: 'cameraController',
        mode: 'orbital',
        applyOn: 'always',
        orbitalMinDistance: 1.2,
        orbitalMaxDistance: 14,
        orbitalZoomSensitivity: 1,
        orbitalRotateSpeed: 1,
        orbitalDamping: 0.85,
        orbitalLeftMouseMode: 'rotate',
      },
    ],
  };

  const sun = makeSunEntity('MF_Sun');
  // Harder contact shadows help ABS read as molded plastic in the lab.
  for (const c of sun.components) {
    if (c.type === 'directionalLight') {
      c.castShadow = true;
      c.intensity = 3.6;
    }
  }

  const entities: LevelEntity[] = [
    sun,
    spawnStaticBox({
      id: 'MF_Ground',
      center: [0, -0.5, 0],
      size: [12, 1, 12],
      materialId: 'BO_Asphalt',
      friction: 1.1,
      kind: 'ground',
    }),
    spawnStaticBox({
      id: 'MF_Pedestal',
      center: [0, PEDESTAL_HEIGHT * 0.5, 0],
      size: [1.4, PEDESTAL_HEIGHT, 1.4],
      materialId: 'BO_Pad',
      kind: 'none',
      collider: false,
    }),
    camera,
    ...assembled.entities,
  ];

  return {
    id: 'minifig-lab',
    shaderGraphs: [
      ...BLOCKOUT_SHADER_GRAPHS,
      { id: MINIFIG_PLASTIC_SHADER_ID, url: MINIFIG_PLASTIC_SHADER_URL },
      { id: CATALOG_PLASTIC_SHADER_ID, url: CATALOG_PLASTIC_SHADER_URL },
      ...(uvGrid
        ? [{ id: MINIFIG_UV_GRID_SHADER_ID, url: MINIFIG_UV_GRID_SHADER_URL }]
        : []),
    ],
    // Keep GPROC graphs registered so missing LDraw falls back cleanly.
    geometryGraphs: [...MINIFIG_GPROC_GRAPHS],
    scriptGraphs: [],
    materials,
    primitives: { ...BLOCKOUT_PRIMITIVES },
    entities,
  };
}
