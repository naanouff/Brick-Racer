/**
 * @file main.tsx
 * @project brick-racer
 * @author Cyril TARRIET
 * @description React shell: canvas, WebGPU gate, blockout review HUD + arcade telemetry.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LEVEL_IDS,
  levelLabel,
  resolveLevelIdFromSearch,
  type LevelId,
} from '../racer/levels/registry';
import { resolveDebugTexEnabled } from '../racer/host/blockoutDebugTexture';
import { resolveRenderQuality } from '../racer/host/renderQuality';
import {
  startBrickRacerHost,
  type BrickRacerHost,
} from '../racer/host/startBrickRacerHost';
import {
  BRICK_MANUAL_IDS,
  brickManualLabel,
  type BrickManualId,
} from '../racer/hub/brick/manuals/registry';
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
  vehicleLabel,
  VEHICLE_KINDS,
  type VehicleKind,
} from '../racer/vehicles/selectVehicle';
import './app.css';

const CC_TIERS: CcTier[] = [50, 100, 150];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function LevelReviewBar(props: {
  active: LevelId;
  vehicle: VehicleKind;
  cc: CcTier;
  debugTex: boolean;
  brickManual: BrickManualId;
  brickShell: boolean;
  brickStats: string | null;
  telemetry: KartTelemetrySnapshot;
  fps: number;
  frameMs: number;
  drawCalls: number;
  trisVisible: number;
  trisTotal: number;
  bufferW: number;
  bufferH: number;
  renderQuality: string;
  onSelectLevel: (id: LevelId) => void;
  onSelectVehicle: (v: VehicleKind) => void;
  onSelectCc: (cc: CcTier) => void;
  onToggleDebugTex: (on: boolean) => void;
  onSelectBrickManual: (id: BrickManualId) => void;
  onToggleBrickShell: (on: boolean) => void;
}): ReactElement {
  const t = props.telemetry;
  const chargeColor =
    t.charge === 'orange' ? '#f09020' : t.charge === 'blue' ? '#3aa0ff' : '#8b95a8';
  const isLab = props.active === 'brick-lab';
  const hint = isLab
    ? 'Orbit · souris / stick · HUD manuels'
    : props.vehicle === 'plane'
      ? 'WASD thrust/steer · Espace monter · Shift descendre · X reset'
      : 'WASD · Espace drift · X reset';
  return (
    <nav className="br-review" aria-label="Revue blockout Proving Grounds">
      <p className="br-review__title">Revue slice</p>
      <div className="br-review__levels" role="group">
        {LEVEL_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={
              id === props.active ? 'br-review__btn br-review__btn--active' : 'br-review__btn'
            }
            disabled={id === props.active}
            onClick={() => props.onSelectLevel(id)}
          >
            {levelLabel(id)}
          </button>
        ))}
      </div>
      {isLab ? (
        <>
          <div className="br-review__levels" role="group" aria-label="Manuel brick">
            {BRICK_MANUAL_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={
                  id === props.brickManual
                    ? 'br-review__btn br-review__btn--active'
                    : 'br-review__btn'
                }
                disabled={id === props.brickManual}
                onClick={() => props.onSelectBrickManual(id)}
              >
                {brickManualLabel(id)}
              </button>
            ))}
          </div>
          <div className="br-review__levels" role="group" aria-label="Bake shell">
            <button
              type="button"
              className={props.brickShell ? 'br-review__btn br-review__btn--active' : 'br-review__btn'}
              disabled={props.brickShell}
              onClick={() => props.onToggleBrickShell(true)}
            >
              enveloppe
            </button>
            <button
              type="button"
              className={!props.brickShell ? 'br-review__btn br-review__btn--active' : 'br-review__btn'}
              disabled={!props.brickShell}
              onClick={() => props.onToggleBrickShell(false)}
            >
              plein
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="br-review__levels" role="group" aria-label="Véhicule">
            {VEHICLE_KINDS.map((v) => (
              <button
                key={v}
                type="button"
                className={
                  v === props.vehicle ? 'br-review__btn br-review__btn--active' : 'br-review__btn'
                }
                disabled={v === props.vehicle}
                onClick={() => props.onSelectVehicle(v)}
              >
                {vehicleLabel(v)}
              </button>
            ))}
          </div>
          <div className="br-review__levels" role="group" aria-label="Cylindrée">
            {CC_TIERS.map((cc) => (
              <button
                key={cc}
                type="button"
                className={
                  cc === props.cc ? 'br-review__btn br-review__btn--active' : 'br-review__btn'
                }
                disabled={cc === props.cc}
                onClick={() => props.onSelectCc(cc)}
              >
                {cc} cc
              </button>
            ))}
          </div>
        </>
      )}
      <div className="br-review__levels" role="group" aria-label="Texture debug">
        <button
          type="button"
          className={props.debugTex ? 'br-review__btn br-review__btn--active' : 'br-review__btn'}
          disabled={props.debugTex}
          onClick={() => props.onToggleDebugTex(true)}
        >
          grille
        </button>
        <button
          type="button"
          className={!props.debugTex ? 'br-review__btn br-review__btn--active' : 'br-review__btn'}
          disabled={!props.debugTex}
          onClick={() => props.onToggleDebugTex(false)}
        >
          unis
        </button>
      </div>
      <p className="br-review__telemetry" aria-live="polite">
        {!isLab ? (
          <span className="br-review__speed">{Math.round(t.speedKmh)} km/h</span>
        ) : props.brickStats ? (
          <span className="br-review__speed">{props.brickStats}</span>
        ) : null}
        <span className="br-review__fps">
          {Math.round(props.fps)} fps · {props.frameMs.toFixed(1)} ms ·{' '}
          {props.bufferW}×{props.bufferH} · {props.drawCalls} dc ·{' '}
          {formatCount(props.trisVisible)}/{formatCount(props.trisTotal)} tri ·{' '}
          {props.renderQuality}
        </span>
        {!isLab ? (
          <span style={{ color: chargeColor }}>
            {t.drifting ? `drift ${t.charge}` : t.boostTimer > 0 ? 'BOOST' : '—'}
          </span>
        ) : null}
      </p>
      <p className="br-review__hint">{hint}</p>
    </nav>
  );
}

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
  const [renderQuality] = useState(() =>
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

  // Throttle HUD updates — kart telemetry used to setState every physics tick (~rAF),
  // which re-rendered React every frame and destabilized FPS.
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

  /** Full navigation — needed for vehicle/cc/debugTex (boot-time). Prefer assign for `app://`. */
  const reloadWith = (mutate: (url: URL) => void): void => {
    const url = new URL(window.location.href);
    mutate(url);
    window.location.assign(url.href);
  };

  /** Hot-swap via SceneDirector — works in packaged Electron (no URL bar for `?level=`). */
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
        <LevelReviewBar
          active={levelId}
          vehicle={vehicle}
          cc={cc}
          debugTex={debugTex}
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
          renderQuality={renderQuality}
          onSelectLevel={onSelectLevel}
          onSelectVehicle={onSelectVehicle}
          onSelectCc={onSelectCc}
          onToggleDebugTex={onToggleDebugTex}
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
      {version ? <p className="br-meta">v{version}</p> : null}
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<App />);
