/**
 * @file catalogLabSpec.ts
 * @description Orbit lab for master catalog browser (CL1b) — no vehicles / manuals.
 */

import { brickCatalogMaterials } from '../../hub/brick/brickMaterials';
import {
  catalogPlasticMaterials,
  catalogUvGridMaterials,
  CATALOG_PLASTIC_SHADER_ID,
  CATALOG_PLASTIC_SHADER_URL,
} from '../../hub/brick/catalog/catalogPlasticMaterials';
import {
  MINIFIG_UV_GRID_SHADER_ID,
  MINIFIG_UV_GRID_SHADER_URL,
} from '../../minifig/minifigUvGridDebug';
import {
  BLOCKOUT_PRIMITIVES,
  BLOCKOUT_SHADER_GRAPHS,
  blockoutMaterials,
  makeSunEntity,
} from '../shared/blockoutKit';
import type { LevelSpec } from '../shared/levelTypes';
import { spawnStaticBox } from '../shared/staticBox';

export function buildCatalogLabSpec(): LevelSpec {
  return {
    id: 'catalog-lab',
    shaderGraphs: [
      ...BLOCKOUT_SHADER_GRAPHS,
      { id: CATALOG_PLASTIC_SHADER_ID, url: CATALOG_PLASTIC_SHADER_URL },
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
      makeSunEntity('CL_Sun'),
      spawnStaticBox({
        id: 'CL_Ground',
        center: [0, -0.5, 0],
        size: [24, 1, 24],
        materialId: 'BO_Asphalt',
        friction: 1.1,
        kind: 'ground',
      }),
      {
        id: 'CL_OrbitCamera',
        name: 'CL_OrbitCamera',
        parentId: null,
        transform: {
          position: [4.2, 2.4, 5.5],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
        components: [
          {
            type: 'camera',
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
            orbitalMinDistance: 1.2,
            orbitalMaxDistance: 28,
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

export const catalogLabSpec: LevelSpec = buildCatalogLabSpec();
