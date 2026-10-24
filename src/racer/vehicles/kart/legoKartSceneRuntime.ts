/**
 * @file legoKartSceneRuntime.ts
 * @description Post-spawn looks for sandbox kart (ported from w3dts viewer; no @naanouff/w3dts-viewer).
 */

import {
  setLitRenderGraphPathsByProjectGlobal,
  type Engine,
  type IEngineContext,
  type LitRenderGraphPathsByProject,
} from '@naanouff/w3dts-core';
import { litRenderGraphPath } from '../../host/renderQuality';
import {
  applyLegoTileFloorToMaterials,
  LEGO_KART_IBL_GAIN,
  LEGO_KART_TILE_FLOOR_OVERRIDES,
} from './legoTileFloorLook';
import { applyKartRubberToMaterials } from './kartWheelLook';

/** Material names used by sandbox kart asphalt / tile floor. */
const LEGO_KART_ASPHALT_NAMES = ['LK_Asphalt', 'KartAsphalt'] as const;

const GLOBAL_KEY = '__W3DTS_LIT_RENDER_GRAPH_PATHS_BY_PROJECT__' as const;

function readLitGraphMap(): LitRenderGraphPathsByProject {
  if (typeof globalThis === 'undefined') return {};
  const raw = (globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY];
  if (!raw || typeof raw !== 'object') return {};
  return { ...(raw as LitRenderGraphPathsByProject) };
}

/** Pin the selected lit graph (fast by default) for the active project. */
export function pinLegoKartLitGraph(projectName: string): void {
  const graph = litRenderGraphPath();
  const next = readLitGraphMap();
  next[projectName] = { scene: graph, game: graph };
  setLitRenderGraphPathsByProjectGlobal(next);
}

/**
 * Plate floor + tire look + IBL after level spawn.
 * Collision tuning comes from `createPhysicsSystem(KART_PHYSICS_PRESET)` at boot (physics 0.0.28
 * has no `applyKartPhysicsCollisionTuning` export).
 */
export async function applyLegoKartSceneRuntime(engine: IEngineContext): Promise<void> {
  const eng = engine as Engine;
  await applyLegoTileFloorToMaterials(
    eng,
    [...LEGO_KART_ASPHALT_NAMES],
    LEGO_KART_TILE_FLOOR_OVERRIDES
  );
  applyKartRubberToMaterials(eng);
  eng.renderer.iblIntensity = LEGO_KART_IBL_GAIN;

  const projectName = eng.director.getActiveProject()?.name ?? 'SandboxProject';
  pinLegoKartLitGraph(projectName);
  await eng.reloadActiveRenderGraph();
  eng.renderer.iblIntensity = LEGO_KART_IBL_GAIN;
}
