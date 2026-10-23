/**
 * @file startBrickRacerHost.ts
 * @project brick-racer
 * @author Cyril TARRIET
 * @description Stub host until the kart scene is ported (feature/lego-kart-host).
 */

export interface BrickRacerHost {
  readonly ready: true;
}

/**
 * Placeholder boot: marks the canvas and resolves without starting the engine.
 * Kart gameplay will replace this stub in a later sprint.
 * @param canvas - Visible game surface.
 */
export async function startBrickRacerHost(canvas: HTMLCanvasElement): Promise<BrickRacerHost> {
  canvas.dataset.testid = 'game-view-canvas';
  canvas.dataset.brickRacerHost = 'stub';
  return { ready: true };
}
