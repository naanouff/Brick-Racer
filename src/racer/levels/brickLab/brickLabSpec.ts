/**
 * @file brickLabSpec.ts
 * @description Orbit lab for brick manuals (BW1c) — no vehicles / hub possession.
 */

import { brickCatalogMaterials } from '../../hub/brick/brickMaterials';
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
    shaderGraphs: [...BLOCKOUT_SHADER_GRAPHS],
    geometryGraphs: [],
    scriptGraphs: [],
    materials: {
      ...blockoutMaterials(),
      ...brickCatalogMaterials(),
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
