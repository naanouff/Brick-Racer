/**
 * @file registerMinifigGprocNodes.ts
 * @description Brick-Racer GPROC nodes for MF3 unwrap (no w3dts monorepo change).
 */

import {
  GProcNode,
  NodeRegistry,
  type ExecutionContext,
  type GeometrySet,
} from '@naanouff/w3dts-gproc';
import { unwrapMinifigPart } from './unwrapPart';

class NodeUnwrapMinifigPart extends GProcNode {
  public execute(
    inputs: Record<string, unknown>,
    _context: ExecutionContext
  ): Record<string, unknown> {
    const geometry = inputs['geometry'] as GeometrySet | undefined;
    if (!geometry) return {};
    const partKind = String(this.getProperty('partKind', 'minifig-generic'));
    const mirrorU = Boolean(this.getProperty('mirrorU', false));
    return {
      geometry: unwrapMinifigPart(geometry, partKind, { mirrorU }),
    };
  }
}

let registered = false;

/** Idempotent — call after `bootstrapGProcRuntime()`. */
export function registerMinifigGprocNodes(): void {
  if (registered && NodeRegistry.has('UnwrapMinifigPart')) return;
  NodeRegistry.register('UnwrapMinifigPart', NodeUnwrapMinifigPart);
  registered = true;
}
