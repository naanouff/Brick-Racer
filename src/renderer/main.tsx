/**
 * @file main.tsx
 * @project brick-racer
 * @author Cyril TARRIET
 * @description React shell: canvas, WebGPU gate, Atelier HUD + arcade telemetry.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { resolveLevelIdFromSearch, type LevelId } from '../racer/levels/registry';
import { resolveDebugTexEnabled } from '../racer/host/blockoutDebugTexture';
import {
  resolveRenderQuality,
  type RenderQuality,
} from '../racer/host/renderQuality';
import {
  startBrickRacerHost,
  type BrickRacerHost,
} from '../racer/host/startBrickRacerHost';
import type { BrickManualId } from '../racer/hub/brick/manuals/registry';
import {
  readBrickLabManualId,
  readBrickLabShell,
  writeBrickLabManualId,
  writeBrickLabShell,
} from '../racer/hub/brick/manuals/labPrefs';
import { fountainShellReport } from '../racer/hub/brick';
import {
  getKartTelemetry,
  resolveCcTier,
  type CcTier,
  type KartTelemetrySnapshot,
} from '../racer/vehicles/kart/arcade';
import {
  resolveVehicleKind,
  type VehicleKind,
} from '../racer/vehicles/selectVehicle';
import { AtelierShell } from './atelier/AtelierShell';
import { CatalogBrowserPanel } from './catalog/CatalogBrowserPanel';
import './app.css';

function App(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [levelId, setLevelId] = useState<LevelId>(() =>
    resolveLevelIdFromSearch(typeof window !== 'undefined' ? window.location.search : '')
  );
  const [vehicle] = useState<VehicleKind>(() =>
    resolveVehicleKind(typeof window !== 'undefined' ? window.location.search : '')
  );
  const [cc] = useState<CcTier>(() =>
    resolveCcTier(typeof window !== 'undefined' ? window.location.search : '')
  );
  const [debugTex] = useState(() =>
    resolveDebugTexEnabled(typeof window !== 'undefined' ? window.location.search : '')
  );
  const [renderQuality] = useState<RenderQuality>(() =>
    resolveRenderQuality(typeof window !== 'undefined' ? window.location.search : '')
  );
  const [brickManual, setBrickManual] = useState<BrickManualId>(() => readBrickLabManualId());
  const [brickShell, setBrickShell] = useState(() => readBrickLabShell());
  const [brickStats, setBrickStats] = useState<string | null>(() => {
    try {
      const r = fountainShellReport(readBrickLabShell());
      return `fontaine ${r.kept}/${r.total}`;
    } catch {
      return null;
    }
  });
  const [telemetry, setTelemetry] = useState<KartTelemetrySnapshot>(() => getKartTelemetry());
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const [drawCalls, setDrawCalls] = useState(0);
  const [trisVisible, setTrisVisible] = useState(0);
  const [trisTotal, setTrisTotal] = useState(0);
  const [bufferW, setBufferW] = useState(0);
  const [bufferH, setBufferH] = useState(0);
  const hostRef = useRef<BrickRacerHost | null>(null);

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
        canvas.tabIndex = 0;
        const host = await startBrickRacerHost(canvas);
        if (!cancelled) {
          hostRef.current = host;
          setLevelId(host.levelId);
          setReady(true);
          canvas.dataset.levelId = host.levelId;
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
      hostRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || error) return;
    const id = window.setInterval(() => {
      const host = hostRef.current;
      const perf = host?.engine.perfMonitor;
      setFps(perf?.getFPS() ?? 0);
      setFrameMs(perf?.getFrameTime() ?? 0);
      setDrawCalls(perf?.getDrawCalls() ?? 0);
      setTrisVisible(perf?.getVisibleTriangles() ?? 0);
      setTrisTotal(perf?.getTotalTriangles() ?? 0);
      const canvas = canvasRef.current;
      setBufferW(canvas?.width ?? 0);
      setBufferH(canvas?.height ?? 0);
      setTelemetry(getKartTelemetry());
    }, 200);
    return () => window.clearInterval(id);
  }, [ready, error]);

  const reloadWith = (mutate: (url: URL) => void): void => {
    const url = new URL(window.location.href);
    mutate(url);
    window.location.assign(url.href);
  };

  const onSelectLevel = (id: LevelId): void => {
    if (id === levelId) return;
    const host = hostRef.current;
    if (!host) {
      reloadWith((url) => url.searchParams.set('level', id));
      return;
    }
    void host
      .loadLevel(id)
      .then(() => setLevelId(id))
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  };

  const onSelectVehicle = (next: VehicleKind): void => {
    if (next === vehicle) return;
    reloadWith((url) => {
      if (next === 'kart') url.searchParams.delete('vehicle');
      else url.searchParams.set('vehicle', next);
    });
  };

  const onSelectCc = (next: CcTier): void => {
    if (next === cc) return;
    reloadWith((url) => url.searchParams.set('cc', String(next)));
  };

  const onToggleDebugTex = (on: boolean): void => {
    if (on === debugTex) return;
    reloadWith((url) => {
      if (on) url.searchParams.set('debugTex', '1');
      else url.searchParams.delete('debugTex');
    });
  };

  const onSelectRenderQuality = (q: RenderQuality): void => {
    if (q === renderQuality) return;
    reloadWith((url) => {
      if (q === 'fast') url.searchParams.delete('render');
      else url.searchParams.set('render', q);
    });
  };

  const reloadBrickLab = (manual: BrickManualId, shell: boolean): void => {
    writeBrickLabManualId(manual);
    writeBrickLabShell(shell);
    setBrickManual(manual);
    setBrickShell(shell);
    try {
      const r = fountainShellReport(shell);
      setBrickStats(`${manual} ${r.kept}/${r.total}`);
    } catch {
      setBrickStats(null);
    }
    const host = hostRef.current;
    if (!host) return;
    void host
      .loadLevel('brick-lab')
      .then(() => setLevelId('brick-lab'))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  const onSelectBrickManual = (id: BrickManualId): void => {
    if (id === brickManual && levelId === 'brick-lab') return;
    reloadBrickLab(id, brickShell);
  };

  const onToggleBrickShell = (on: boolean): void => {
    if (on === brickShell && levelId === 'brick-lab') return;
    reloadBrickLab(brickManual, on);
  };

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
        <AtelierShell
          active={levelId}
          vehicle={vehicle}
          cc={cc}
          debugTex={debugTex}
          renderQuality={renderQuality}
          brickManual={brickManual}
          brickShell={brickShell}
          brickStats={brickStats}
          telemetry={telemetry}
          fps={fps}
          frameMs={frameMs}
          drawCalls={drawCalls}
          trisVisible={trisVisible}
          trisTotal={trisTotal}
          bufferW={bufferW}
          bufferH={bufferH}
          version={version}
          catalogSlot={
            levelId === 'catalog-lab' ? (
              <CatalogBrowserPanel host={hostRef.current} embedded />
            ) : null
          }
          onSelectLevel={onSelectLevel}
          onSelectVehicle={onSelectVehicle}
          onSelectCc={onSelectCc}
          onToggleDebugTex={onToggleDebugTex}
          onSelectRenderQuality={onSelectRenderQuality}
          onSelectBrickManual={onSelectBrickManual}
          onToggleBrickShell={onToggleBrickShell}
        />
      ) : (
        <div className="br-shell" aria-busy="true">
          <img className="br-logo" src="/brand/logo.svg" alt="" />
          <h1 className="br-title">Brick Racer</h1>
          <p className="br-tagline">Chargement du blockout Proving Grounds…</p>
        </div>
      )}
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<App />);
