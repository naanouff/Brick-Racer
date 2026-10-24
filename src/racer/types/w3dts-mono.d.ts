/**
 * Ambient typings for unpublished @naanouff/w3dts-* resolved via Vite aliases to the sibling mono.
 */

declare module '@naanouff/w3dts-scripts' {
  export type ScriptGraph = { id?: string; [key: string]: unknown };

  export class ScriptComponent {
    graph: ScriptGraph | null;
    graphId: string | null;
    enabled: boolean;
    constructor(graph?: ScriptGraph | null);
  }

  export type ScriptsSystemOptions = {
    resolveGraph?: (
      component: ScriptComponent,
      entity: number,
      world: unknown
    ) => ScriptGraph | null;
    getScriptInputReader?: () => unknown;
    getScriptInputController?: () => unknown;
    registerExtraNodes?: (registry: unknown) => void;
  };

  export function createScriptsSystem(options?: ScriptsSystemOptions): (world: unknown, dt: number, t: number) => void;
  export function registerInputScriptNodes(registry: unknown): void;
  export function registerCameraScriptNodes(registry: unknown): void;
}
