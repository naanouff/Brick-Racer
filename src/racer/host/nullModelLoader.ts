/**
 * @file nullModelLoader.ts
 * @description Minimal IModelLoaderService so EngineBuilder can build without GLB/OBJ deps.
 * Sandbox kart uses PrimitiveFactory + gproc only; mesh URL loads are not used in P0.
 */

import type { IModelLoaderService, SceneNode, World } from '@naanouff/w3dts-core';

export class NullModelLoader implements IModelLoaderService {
  async load(_urlOrData: string | Blob, _world: World): Promise<SceneNode | null> {
    return null;
  }
}
