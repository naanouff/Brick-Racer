/**
 * @file main.tsx
 * @project brick-racer
 * @author Cyril TARRIET
 * @description React shell: canvas, WebGPU gate; splash hides once the host is ready.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
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

  // No StrictMode remount: GPUManager singleton + canvas configure must run once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    void (async () => {
      try {
        if (!navigator.gpu) {
          throw new Error('WebGPU is not available in this window.');
        }
        canvas.tabIndex = 0;
        await startBrickRacerHost(canvas);
        if (!cancelled) {
          setReady(true);
          canvas.focus({ preventScroll: true });
        }
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
      <canvas
        ref={canvasRef}
        className={`br-canvas${ready && !error ? ' br-canvas--live' : ''}`}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).focus({ preventScroll: true });
        }}
      />
      {error ? (
        <div className="br-error" role="alert">
          <div>
            <img className="br-logo" src="/brand/logo.svg" alt="" />
            <h1>{error.includes('WebGPU') ? 'WebGPU requis' : 'Démarrage interrompu'}</h1>
            <p>{error}</p>
          </div>
        </div>
      ) : ready ? (
        <p className="br-hud-hint" aria-live="polite">
          WASD conduire · X reset
        </p>
      ) : (
        <div className="br-shell" aria-busy="true">
          <img className="br-logo" src="/brand/logo.svg" alt="" />
          <h1 className="br-title">Brick Racer</h1>
          <p className="br-tagline">Chargement du sandbox kart…</p>
        </div>
      )}
      {version ? <p className="br-meta">v{version}</p> : null}
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<App />);
