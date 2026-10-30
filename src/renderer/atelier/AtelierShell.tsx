/**
 * @file AtelierShell.tsx
 * @description Dev shell: scene rail + context drawer + perf bar (UIM2 → React).
 */

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  BRICK_MANUAL_IDS,
  brickManualLabel,
  type BrickManualId,
} from '../../racer/hub/brick/manuals/registry';
import {
  LEVEL_IDS,
  levelAccent,
  levelGroup,
  levelLabel,
  levelRole,
  levelShortTitle,
  type LevelId,
} from '../../racer/levels/registry';
import type { RenderQuality } from '../../racer/host/renderQuality';
import type { CcTier, KartTelemetrySnapshot } from '../../racer/vehicles/kart/arcade';
import {
  vehicleLabel,
  VEHICLE_KINDS,
  type VehicleKind,
} from '../../racer/vehicles/selectVehicle';
import { SceneIcon } from './sceneIcons';
import './atelier.css';

const CC_TIERS: CcTier[] = [50, 100, 150];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function sceneHint(active: LevelId, vehicle: VehicleKind): string {
  if (active === 'catalog-lab') return 'Orbit · panneau catalogue à droite';
  if (active === 'brick-lab') return 'Orbit · souris / stick · HUD manuels';
  if (active === 'minifig-lab') return 'Orbit · souris / stick';
  if (active === 'city-test') return 'WASD · F / pad Y possession · X reset';
  if (vehicle === 'plane') {
    return 'WASD thrust/steer · Espace monter · Shift descendre · X reset';
  }
  return 'WASD · Espace drift · X reset';
}

function drawerTitle(active: LevelId): string {
  switch (active) {
    case 'city-test':
      return 'Hub';
    case 'sandbox-kart':
      return 'Sandbox';
    case 'brick-lab':
      return 'Brick lab';
    case 'catalog-lab':
      return 'Catalogue';
    case 'minifig-lab':
      return 'Minifig';
    default:
      return 'Piste';
  }
}

export type AtelierShellProps = {
  active: LevelId;
  vehicle: VehicleKind;
  cc: CcTier;
  debugTex: boolean;
  renderQuality: RenderQuality;
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
  version: string | null;
  catalogSlot?: ReactNode;
  onSelectLevel: (id: LevelId) => void;
  onSelectVehicle: (v: VehicleKind) => void;
  onSelectCc: (cc: CcTier) => void;
  onToggleDebugTex: (on: boolean) => void;
  onSelectRenderQuality: (q: RenderQuality) => void;
  onSelectBrickManual: (id: BrickManualId) => void;
  onToggleBrickShell: (on: boolean) => void;
};

export function AtelierShell(props: AtelierShellProps): ReactElement {
  const [railCollapsed, setRailCollapsed] = useState(false);
  const t = props.telemetry;
  const isBrickLab = props.active === 'brick-lab';
  const isCatalogLab = props.active === 'catalog-lab';
  const isMinifigLab = props.active === 'minifig-lab';
  const isTrack = !isBrickLab && !isCatalogLab && !isMinifigLab;
  const hint = sceneHint(props.active, props.vehicle);
  const chargeColor =
    t.charge === 'orange' ? '#e87a3a' : t.charge === 'blue' ? '#3aa0ff' : undefined;
  const driftLabel = t.drifting
    ? `drift ${t.charge}`
    : t.boostTimer > 0
      ? 'BOOST'
      : '—';

  const pistes = LEVEL_IDS.filter((id) => levelGroup(id) === 'pistes');
  const labs = LEVEL_IDS.filter((id) => levelGroup(id) === 'labs');
  const onSelectLevelRef = useRef(props.onSelectLevel);
  onSelectLevelRef.current = props.onSelectLevel;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '`') {
        e.preventDefault();
        setRailCollapsed((v) => !v);
        return;
      }
      if (e.key >= '1' && e.key <= '6') {
        const idx = Number(e.key) - 1;
        const id = LEVEL_IDS[idx];
        if (id) {
          e.preventDefault();
          onSelectLevelRef.current(id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const renderSceneCard = (id: LevelId, keyIndex: number): ReactElement => {
    const active = id === props.active;
    return (
      <button
        key={id}
        type="button"
        className={active ? 'br-atelier-card is-active' : 'br-atelier-card'}
        style={{ ['--accent' as string]: levelAccent(id) }}
        aria-pressed={active}
        disabled={active}
        title={`${levelLabel(id)} (${keyIndex})`}
        onClick={() => props.onSelectLevel(id)}
      >
        <span className="br-atelier-card__accent" aria-hidden="true">
          <SceneIcon id={id} className="br-atelier-card__icon" />
        </span>
        <span className="br-atelier-card__body">
          <span className="br-atelier-card__title">{levelShortTitle(id)}</span>
          <span className="br-atelier-card__role">{levelRole(id)}</span>
        </span>
        <span className="br-atelier-card__key">{keyIndex}</span>
      </button>
    );
  };

  return (
    <div
      className={[
        'br-atelier',
        railCollapsed ? 'is-rail-collapsed' : '',
        isCatalogLab ? 'is-catalog' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Atelier Proving Grounds"
    >
      <aside className="br-atelier-rail" aria-label="Slices">
        <div className="br-atelier-rail__top">
          <p className="br-atelier-rail__brand">Atelier</p>
          <button
            type="button"
            className="br-atelier-rail__collapse"
            title={railCollapsed ? 'Déplier le rail (`)' : 'Replier le rail (`)'}
            aria-label={railCollapsed ? 'Déplier le rail' : 'Replier le rail'}
            aria-pressed={railCollapsed}
            onClick={() => setRailCollapsed((v) => !v)}
          >
            {railCollapsed ? '»' : '«'}
          </button>
        </div>

        <div className="br-atelier-rail__groups">
          <div>
            <p className="br-atelier-rail__group">Pistes</p>
            {pistes.map((id, i) => renderSceneCard(id, i + 1))}
          </div>
          <div>
            <p className="br-atelier-rail__group">Labs</p>
            {labs.map((id, i) => renderSceneCard(id, pistes.length + i + 1))}
          </div>
        </div>
      </aside>

      <p className="br-atelier-scene-label" aria-live="polite">
        {levelLabel(props.active)}
      </p>
      <p className="br-atelier-scene-hint">{hint}</p>

      <aside
        className={
          isCatalogLab ? 'br-atelier-drawer br-atelier-drawer--catalog' : 'br-atelier-drawer'
        }
        aria-label="Outils de slice"
      >
        <h2 className="br-atelier-drawer__title">{drawerTitle(props.active)}</h2>

        {isTrack ? (
          <div className="br-atelier-section">
            <p className="br-atelier-label">Véhicule</p>
            <div className="br-atelier-chips" role="group" aria-label="Véhicule">
              {VEHICLE_KINDS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={
                    v === props.vehicle ? 'br-atelier-chip is-active' : 'br-atelier-chip'
                  }
                  disabled={v === props.vehicle}
                  onClick={() => props.onSelectVehicle(v)}
                >
                  {vehicleLabel(v)}
                </button>
              ))}
            </div>
            <p className="br-atelier-label">Cylindrée</p>
            <div className="br-atelier-chips" role="group" aria-label="Cylindrée">
              {CC_TIERS.map((cc) => (
                <button
                  key={cc}
                  type="button"
                  className={cc === props.cc ? 'br-atelier-chip is-active' : 'br-atelier-chip'}
                  disabled={cc === props.cc}
                  onClick={() => props.onSelectCc(cc)}
                >
                  {cc} cc
                </button>
              ))}
            </div>
            <p className="br-atelier-label">Télémétrie</p>
            <p className="br-atelier-telemetry" aria-live="polite">
              <span>
                <strong>{Math.round(t.speedKmh)}</strong> km/h
              </span>
              <span className="br-atelier-telemetry__muted" style={{ color: chargeColor }}>
                {driftLabel}
              </span>
            </p>
            <p className="br-atelier-hint-box">{hint}</p>
          </div>
        ) : null}

        {isBrickLab ? (
          <div className="br-atelier-section">
            <p className="br-atelier-label">Manuel</p>
            <div className="br-atelier-chips" role="group" aria-label="Manuel brick">
              {BRICK_MANUAL_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={
                    id === props.brickManual ? 'br-atelier-chip is-active' : 'br-atelier-chip'
                  }
                  disabled={id === props.brickManual}
                  onClick={() => props.onSelectBrickManual(id)}
                >
                  {brickManualLabel(id)}
                </button>
              ))}
            </div>
            <p className="br-atelier-label">Bake shell</p>
            <div className="br-atelier-chips" role="group" aria-label="Bake shell">
              <button
                type="button"
                className={props.brickShell ? 'br-atelier-chip is-active' : 'br-atelier-chip'}
                disabled={props.brickShell}
                onClick={() => props.onToggleBrickShell(true)}
              >
                enveloppe
              </button>
              <button
                type="button"
                className={!props.brickShell ? 'br-atelier-chip is-active' : 'br-atelier-chip'}
                disabled={!props.brickShell}
                onClick={() => props.onToggleBrickShell(false)}
              >
                plein
              </button>
            </div>
            {props.brickStats ? (
              <>
                <p className="br-atelier-label">Stats</p>
                <p className="br-atelier-telemetry">
                  <strong>{props.brickStats}</strong>
                </p>
              </>
            ) : null}
            <p className="br-atelier-hint-box">{hint}</p>
          </div>
        ) : null}

        {isCatalogLab ? (
          <div className="br-atelier-section br-atelier-section--grow">
            {props.catalogSlot ?? (
              <div className="br-atelier-catalog-slot">
                Le panneau catalogue occupe ce tiroir.
              </div>
            )}
          </div>
        ) : null}

        {isMinifigLab ? (
          <div className="br-atelier-section">
            <p className="br-atelier-hint-box">
              Orbit seul pour l’instant — pas de contrôles dédiés.
            </p>
          </div>
        ) : null}

        <div
          className={
            isCatalogLab ? 'br-atelier-common br-atelier-common--compact' : 'br-atelier-common'
          }
        >
          <div className="br-atelier-section">
            <p className="br-atelier-label">Texture debug</p>
            <div className="br-atelier-chips" role="group" aria-label="Texture debug">
              <button
                type="button"
                className={props.debugTex ? 'br-atelier-chip is-active' : 'br-atelier-chip'}
                disabled={props.debugTex}
                onClick={() => props.onToggleDebugTex(true)}
              >
                grille
              </button>
              <button
                type="button"
                className={!props.debugTex ? 'br-atelier-chip is-active' : 'br-atelier-chip'}
                disabled={!props.debugTex}
                onClick={() => props.onToggleDebugTex(false)}
              >
                unis
              </button>
            </div>
          </div>
          <div className="br-atelier-section">
            <p className="br-atelier-label">Qualité rendu</p>
            <div className="br-atelier-chips" role="group" aria-label="Qualité rendu">
              <button
                type="button"
                className={
                  props.renderQuality === 'fast'
                    ? 'br-atelier-chip is-active'
                    : 'br-atelier-chip'
                }
                disabled={props.renderQuality === 'fast'}
                onClick={() => props.onSelectRenderQuality('fast')}
              >
                fast
              </button>
              <button
                type="button"
                className={
                  props.renderQuality === 'showcase'
                    ? 'br-atelier-chip is-active'
                    : 'br-atelier-chip'
                }
                disabled={props.renderQuality === 'showcase'}
                onClick={() => props.onSelectRenderQuality('showcase')}
              >
                showcase
              </button>
            </div>
            <p className="br-atelier-reload-note">
              Texture et qualité rechargent la page (boot-time).
            </p>
          </div>
        </div>
      </aside>

      <footer className="br-atelier-status" aria-label="Perf">
        <div className="br-atelier-status__chip">
          <b>{Math.round(props.fps)}</b> <span>fps</span>
        </div>
        <div className="br-atelier-status__chip">
          <b>{props.frameMs.toFixed(1)}</b> <span>ms</span>
        </div>
        <div className="br-atelier-status__chip">
          <b>
            {props.bufferW}×{props.bufferH}
          </b>{' '}
          <span>buffer</span>
        </div>
        <div className="br-atelier-status__chip">
          <b>{props.drawCalls}</b> <span>dc</span>
        </div>
        <div className="br-atelier-status__chip">
          <b>{formatCount(props.trisVisible)}</b>/<b>{formatCount(props.trisTotal)}</b>{' '}
          <span>tri</span>
        </div>
        <div className="br-atelier-status__chip">
          <b>{props.renderQuality}</b> <span>qualité</span>
        </div>
        {props.version ? (
          <p className="br-atelier-status__ver">v{props.version}</p>
        ) : null}
      </footer>
    </div>
  );
}
