/**
 * @file main.tsx
 * @project brick-racer
 * @author Cyril TARRIET
 * @description React shell: canvas, WebGPU gate, title placeholder.
 */

import { StrictMode, useEffect, useRef, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { startBrickRacerHost } from '../racer/host/startBrickRacerHost';
import './app.css';

function App(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void window.brickRacer?.version().then(setVersion).catch(() => setVersion(null));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    void (async () => {
      try {
        if (!navigator.gpu) {
          throw new Error('WebGPU is not available in this window.');
        }
        await startBrickRacerHost(canvas);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="br-canvas" />
      {error ? (
        <div className="br-error" role="alert">
          <div>
            <img className="br-logo" src="/brand/logo.svg" alt="" />
            <h1>WebGPU requis</h1>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="br-shell" aria-hidden={!ready}>
          <img className="br-logo" src="/brand/logo.svg" alt="" />
          <h1 className="br-title">Brick Racer</h1>
          <p className="br-tagline">Course de karts en briques. Workspace en cours d’amorçage.</p>
          <p className="br-disclaimer">
            Brick Racer n’est pas affilié à The LEGO Group ni à Nintendo. LEGO® et Mario Kart™ sont
            des marques de leurs détenteurs respectifs.
          </p>
        </div>
      )}
      {version ? <p className="br-meta">v{version}</p> : null}
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
