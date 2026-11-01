/**
 * @file LegoColorPicker.tsx
 * @description MT3 — choose material first, then a colour of that finish.
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  BRICK_CATALOG,
  BRICK_MATERIAL_KINDS,
  catalogColorsByMaterial,
  catalogCommonColors,
  getColor,
  materialOf,
  resolveColorId,
  type BrickMaterialKind,
} from '../../racer/hub/brick/catalog';

export type LegoColorPickerProps = {
  value: string;
  onChange: (colorId: string) => void;
  label?: string;
  disabled?: boolean;
  /** When set, tabs outside this list are disabled (part constraint). */
  allowedMaterials?: readonly BrickMaterialKind[];
};

/** @deprecated Alias — same component. */
export type LegoMaterialColorPickerProps = LegoColorPickerProps;

const MATERIAL_LABEL: Record<BrickMaterialKind, string> = {
  plastic: 'Plastique',
  rubber: 'Caoutchouc',
  transparent: 'Transparent',
  chrome: 'Chrome',
  metallic: 'Métallisé',
  pearl: 'Perle',
  glow: 'Lumineux',
  glitter: 'Pailleté',
  satin: 'Satin',
  speckle: 'Moucheté',
};

function rgbCss(rgb: readonly [number, number, number]): string {
  return `rgb(${Math.round(rgb[0]! * 255)},${Math.round(rgb[1]! * 255)},${Math.round(rgb[2]! * 255)})`;
}

function isTranslucent(colorId: string): boolean {
  const def = getColor(colorId);
  if (!def) return false;
  if (def.translucent) return true;
  const m = def.material;
  return m === 'transparent' || m === 'glitter' || m === 'satin';
}

function firstColourOf(
  kind: BrickMaterialKind,
  preferCommon: boolean
): string | undefined {
  if (preferCommon) {
    const common = catalogCommonColors().find((c) => (c.material ?? 'plastic') === kind);
    if (common) return common.id;
  }
  return catalogColorsByMaterial(kind)[0]?.id;
}

export function LegoColorPicker(props: LegoColorPickerProps): ReactElement {
  const { value, onChange, label = 'Couleur', disabled = false, allowedMaterials } = props;
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const [materialTab, setMaterialTab] = useState<BrickMaterialKind>(() => materialOf(value));

  const selected = useMemo(() => getColor(value) ?? BRICK_CATALOG.colors[0]!, [value]);

  useEffect(() => {
    setMaterialTab(materialOf(value));
  }, [value]);

  const counts = useMemo(() => {
    const out: Partial<Record<BrickMaterialKind, number>> = {};
    for (const c of BRICK_CATALOG.colors) {
      const k = c.material ?? 'plastic';
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }, []);

  const swatches = useMemo(() => {
    const pool = showAll
      ? catalogColorsByMaterial(materialTab)
      : catalogCommonColors().filter((c) => (c.material ?? 'plastic') === materialTab);
    const list = pool.length > 0 ? pool : catalogColorsByMaterial(materialTab);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.id.includes(q) ||
        c.name.toLowerCase().includes(q) ||
        String(c.ldrawCode ?? '').includes(q)
    );
  }, [materialTab, showAll, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const tabAllowed = (kind: BrickMaterialKind): boolean => {
    if (!allowedMaterials || allowedMaterials.length === 0) return true;
    return allowedMaterials.includes(kind);
  };

  const selectMaterial = (kind: BrickMaterialKind): void => {
    if (!tabAllowed(kind)) return;
    setMaterialTab(kind);
    setQuery('');
    if (materialOf(value) !== kind) {
      const next = firstColourOf(kind, !showAll);
      if (next) onChange(next);
    }
  };

  const selectedTrans = isTranslucent(selected.id);
  const kindsWithColors = BRICK_MATERIAL_KINDS.filter((k) => (counts[k] ?? 0) > 0);

  return (
    <div className="br-color-picker" ref={rootRef}>
      <span className="br-atelier-label">{label}</span>
      <button
        type="button"
        className="br-color-picker__trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        title={`${MATERIAL_LABEL[materialOf(selected.id)]} · ${selected.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="br-color-picker__chip"
          style={{ background: rgbCss(selected.rgb) }}
          data-translucent={selectedTrans ? '1' : undefined}
        />
        <span className="br-color-picker__name">
          <span className="br-color-picker__kind">{MATERIAL_LABEL[materialOf(selected.id)]}</span>
          {selected.name}
        </span>
        <span className="br-color-picker__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div
          className="br-color-picker__pop br-color-picker__pop--wide"
          role="listbox"
          id={listId}
          aria-label="Palette LEGO"
        >
          <p className="br-color-picker__pop-title">Matériau → couleur</p>
          <div className="br-color-picker__materials" role="tablist" aria-label="Matériau">
            {kindsWithColors.map((kind) => {
              const allowed = tabAllowed(kind);
              const active = materialTab === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={!allowed}
                  title={
                    allowed
                      ? `${MATERIAL_LABEL[kind]} (${counts[kind] ?? 0})`
                      : `${MATERIAL_LABEL[kind]} — non autorisé pour cette pièce`
                  }
                  className={
                    active
                      ? 'br-color-picker__mat-tab is-active'
                      : 'br-color-picker__mat-tab'
                  }
                  onClick={() => selectMaterial(kind)}
                >
                  {MATERIAL_LABEL[kind]}
                  <span className="br-color-picker__mat-count">{counts[kind] ?? 0}</span>
                </button>
              );
            })}
          </div>
          <div className="br-color-picker__pop-tools">
            <button
              type="button"
              className={showAll ? 'br-color-picker__toggle' : 'br-color-picker__toggle is-active'}
              onClick={() => setShowAll(false)}
            >
              Courantes
            </button>
            <button
              type="button"
              className={showAll ? 'br-color-picker__toggle is-active' : 'br-color-picker__toggle'}
              onClick={() => setShowAll(true)}
            >
              Toutes
            </button>
            <input
              className="br-color-picker__search"
              type="search"
              placeholder="Nom ou code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Rechercher une couleur"
            />
          </div>
          <div className="br-color-picker__grid">
            {swatches.map((c) => {
              const canonical = resolveColorId(value) ?? value;
              const active = c.id === canonical;
              const trans = isTranslucent(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  title={`${c.name} · ${c.ldrawCode ?? c.id}`}
                  className={
                    active ? 'br-color-picker__swatch is-active' : 'br-color-picker__swatch'
                  }
                  style={{ background: rgbCss(c.rgb) }}
                  data-translucent={trans ? '1' : undefined}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>
          {swatches.length === 0 ? (
            <p className="br-color-picker__empty">Aucune couleur</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const LegoMaterialColorPicker = LegoColorPicker;
