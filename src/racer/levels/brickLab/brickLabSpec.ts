/**
 * @file brickLabSpec.ts
 * @description Orbit lab for brick manuals (BW1c) — no vehicles / hub possession.
 */

import { brickCatalogMaterials } from '../../hub/brick/brickMaterials';
import {
  CATALOG_PLASTIC_SHADER_ID,
  CATALOG_PLASTIC_SHADER_URL,
  catalogPlasticMaterials,
  catalogUvGridMaterials,
} from '../../hub/brick/catalog/catalogPlasticMaterials';
import {
  MINIFIG_UV_GRID_SHADER_ID,
  MINIFIG_UV_GRID_SHADER_URL,
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
import type { LevelSpec } from '../shared/levelTypes';
import { spawnStaticBox } from '../shared/staticBox';

export function buildBrickLabSpec(): LevelSpec {
  return {
    id: 'brick-lab',
    shaderGraphs: [
      ...BLOCKOUT_SHADER_GRAPHS,
      { id: MINIFIG_PLASTIC_SHADER_ID, url: MINIFIG_PLASTIC_SHADER_URL },
      { id: CATALOG_PLASTIC_SHADER_ID, url: CATALOG_PLASTIC_SHADER_URL },
      // catalogUvGridMaterials() → CL_uv_grid / CL_uv_grid_uv1
      { id: MINIFIG_UV_GRID_SHADER_ID, url: MINIFIG_UV_GRID_SHADER_URL },
    ],
    geometryGraphs: [],
    scriptGraphs: [],
    materials: {
      ...blockoutMaterials(),
      ...brickCatalogMaterials(),
      ...catalogPlasticMaterials(),
      ...catalogUvGridMaterials(),
    },
    primitives: { ...BLOCKOUT_PRIMITIVES },
    entities: [
      makeSunEntity('BL_Sun'),
      spawnStaticBox({
        id: 'BL_Ground',
        center: [0, -0.5, 0],
        size: [24, 1, 24],
        materialId: 'BO_Asphalt',
        friction: 1.1,
        kind: 'ground',
      }),
      {
        id: 'BL_OrbitCamera',
        name: 'BL_OrbitCamera',
        parentId: null,
        transform: {
          // ~50° FOV framing of origin fountain (~2 m tall).
          position: [5.5, 3.2, 7.5],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
        components: [
          {
            type: 'camera',
            // Engine FOV is radians (kart chase ≈ 1.05).
            fov: 0.9,
            near: 0.05,
            far: 200,
            isPrimary: true,
            isMain: true,
            firstPersonEyeOffsetY: 0,
          },
          {
            type: 'cameraController',
            mode: 'orbital',
            applyOn: 'always',
            orbitalMinDistance: 2,
            orbitalMaxDistance: 24,
            orbitalZoomSensitivity: 1,
            orbitalRotateSpeed: 1,
            orbitalDamping: 0.85,
            orbitalLeftMouseMode: 'rotate',
          },
        ],
      },
    ],
  };
}

export const brickLabSpec: LevelSpec = buildBrickLabSpec();
