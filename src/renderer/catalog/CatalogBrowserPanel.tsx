/**
 * @file CatalogBrowserPanel.tsx
 * @description Master catalog browser overlay for catalog-lab (CL1d).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  BRICK_CATALOG,
  CATALOG_PLASTIC_SETS,
  guessPartCategory,
  isCatalogPart,
  loadMasterIndex,
  registerPartRuntime,
  removeStaging,
  readStaging,
  upsertStaging,
  type CatalogPlasticSet,
  type MasterIndexEntry,
  type StagingPart,
} from '../../racer/hub/brick/catalog';
import type { BrickFootprint, BrickPartCategory } from '../../racer/hub/brick/catalog/types';
import type { BrickRacerHost } from '../../racer/host/startBrickRacerHost';

const ROW_H = 28;
const VIEW_H = 360;

type PreviewMode = 'mesh' | 'box';
type UvGridChannel = 0 | 1 | false;

const PLASTIC_LABELS: Record<CatalogPlasticSet, string> = {
  '003': '003',
  '017b': '017B',
  off: 'Off',
};

export type CatalogBrowserPanelProps = {
  host: BrickRacerHost | null;
};

function parseFootprint(raw: string): BrickFootprint | null {
  const parts = raw.split(/[,x×\s]+/).map((s) => Number(s.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 1)) return null;
  return [Math.round(parts[0]!), Math.round(parts[1]!), Math.round(parts[2]!)];
}

function toStaging(
  entry: MasterIndexEntry,
  footprint: BrickFootprint,
  category: BrickPartCategory
): StagingPart {
  return {
    id: entry.id,
    name: entry.name,
    category,
    footprint,
    mesh: { status: 'box' },
    notes: entry.ldraw_id ? `ldraw:${entry.ldraw_id}` : undefined,
  };
}

export function CatalogBrowserPanel(props: CatalogBrowserPanelProps): ReactElement {
  const { host } = props;
  const [parts, setParts] = useState<MasterIndexEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selected, setSelected] = useState<MasterIndexEntry | null>(null);
  const [footprintEdit, setFootprintEdit] = useState('1,3,1');
  const [categoryEdit, setCategoryEdit] = useState<BrickPartCategory>('brick');
  const [staging, setStaging] = useState<StagingPart[]>(() => readStaging());
  const [scrollTop, setScrollTop] = useState(0);
  const [writeMsg, setWriteMsg] = useState<string | null>(null);
  const [bc1Tick, setBc1Tick] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('mesh');
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [colorId, setColorId] = useState('gray');
  const [plasticSet, setPlasticSet] = useState<CatalogPlasticSet>('003');
  const [uvGrid, setUvGrid] = useState<UvGridChannel>(false);
  const [uv1Ao, setUv1Ao] = useState<Uv1AoView | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  const [aging, setAging] = useState(true);
  const previewToken = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void loadMasterIndex()
      .then((file) => {
        if (!cancelled) setParts(file.parts);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of parts) if (p.category_id) set.add(p.category_id);
    return [...set].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  }, [parts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      if (categoryId && p.category_id !== categoryId) return false;
      if (!q) return true;
      return p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    });
  }, [parts, query, categoryId]);

  const stagingIds = useMemo(() => new Set(staging.map((s) => s.id)), [staging]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 5);
  const visibleCount = Math.ceil(VIEW_H / ROW_H) + 10;
  const slice = filtered.slice(start, start + visibleCount);

  const preview = useCallback(
    (
      entry: MasterIndexEntry,
      fp: BrickFootprint,
      mode: PreviewMode,
      color: string,
      plastic: CatalogPlasticSet,
      grid: UvGridChannel,
      wear: boolean
    ) => {
      if (!host) return;
      const token = ++previewToken.current;
      const look = { colorId: color, plasticSet: plastic, uvGrid: grid, aging: wear };
      if (grid !== 1) setUv1Ao(null);
      setExportId(null);
      const showBox = (reason: string): void => {
        if (token !== previewToken.current) return;
        host.previewCatalogPart({ footprint: fp, ...look });
        setUv1Ao(null);
        setExportId(null);
        setPreviewStatus(reason);
      };
      const api = window.brickRacer?.ldrawPartTriangles;
      if (mode === 'box') return showBox('boîte');
      if (!entry.ldraw_id) return showBox('boîte · pas d’id LDraw');
      if (!api) return showBox('boîte · IPC LDraw indisponible');

      const ldrawId = entry.ldraw_id;
      setPreviewStatus('mesh LDraw · chargement…');
      void api(ldrawId)
        .then((res) => {
          if (token !== previewToken.current) return;
          if (!res.ok) return showBox(`boîte · ${res.error}`);
          const previewed = host.previewCatalogMesh({
            key: ldrawId,
            triangles: res.triangles,
            edges: res.edges,
            ...look,
          });
          if (previewed.triangleCount > 0) {
            setExportId(ldrawId);
            setPreviewStatus(`mesh LDraw · ${previewed.triangleCount.toLocaleString('fr-FR')} tri`);
            setUv1Ao(
              grid === 1 && previewed.ao && previewed.coverage
                ? { ao: previewed.ao, coverage: previewed.coverage }
                : null
            );
          } else showBox('boîte · mesh vide');
        })
        .catch((err: unknown) => showBox(`boîte · ${err instanceof Error ? err.message : String(err)}`));
    },
    [host]
  );

  const repreview = (
    mode = previewMode,
    color = colorId,
    plastic = plasticSet,
    grid = uvGrid,
    wear = aging
  ): void => {
    if (!selected) return;
    preview(
      selected,
      parseFootprint(footprintEdit) ?? selected.footprint,
      mode,
      color,
      plastic,
      grid,
      wear
    );
  };

  const onSelect = (entry: MasterIndexEntry): void => {
    setSelected(entry);
    const fp = entry.footprint;
    setFootprintEdit(`${fp[0]},${fp[1]},${fp[2]}`);
    setCategoryEdit(guessPartCategory(entry.name));
    preview(entry, fp, previewMode, colorId, plasticSet, uvGrid, aging);
  };

  const onPreviewMode = (mode: PreviewMode): void => {
    setPreviewMode(mode);
    repreview(mode);
  };

  const onColor = (id: string): void => {
    setColorId(id);
    repreview(previewMode, id, plasticSet, uvGrid, aging);
  };

  const onPlastic = (set: CatalogPlasticSet): void => {
    setPlasticSet(set);
    repreview(previewMode, colorId, set, uvGrid, aging);
  };

  const onUvGrid = (channel: 0 | 1): void => {
    const next: UvGridChannel = uvGrid === channel ? false : channel;
    setUvGrid(next);
    repreview(previewMode, colorId, plasticSet, next, aging);
  };

  const onAging = (on: boolean): void => {
    setAging(on);
    repreview(previewMode, colorId, plasticSet, uvGrid, on);
  };

  const onExportGlb = (): void => {
    if (!host || !exportId) return;
    const bytes = host.exportCatalogGlb(exportId);
    if (!bytes) {
      setWriteMsg('GLB indisponible — affiche d’abord le mesh');
      return;
    }
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportId}.glb`;
    a.click();
    URL.revokeObjectURL(url);
    setWriteMsg(`GLB ${exportId}.glb`);
  };

  const onExportObj = (): void => {
    if (!host || !exportId) return;
    const bytes = host.exportCatalogObj(exportId);
    if (!bytes) {
      setWriteMsg('OBJ indisponible — affiche d’abord le mesh');
      return;
    }
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportId}.obj`;
    a.click();
    URL.revokeObjectURL(url);
    setWriteMsg(`OBJ ${exportId}.obj · UV1`);
  };

  const onExportFbx = (): void => {
    if (!host || !exportId) return;
    const bytes = host.exportCatalogFbx(exportId);
    if (!bytes) {
      setWriteMsg('FBX indisponible — affiche d’abord le mesh');
      return;
    }
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportId}.fbx`;
    a.click();
    URL.revokeObjectURL(url);
    setWriteMsg(`FBX ${exportId}.fbx · UV0 + UV1`);
  };

  const onAddStaging = (): void => {
    if (!selected) return;
    const fp = parseFootprint(footprintEdit);
    if (!fp) {
      setWriteMsg('Footprint invalide (ex. 2,3,4)');
      return;
    }
    const def = toStaging(selected, fp, categoryEdit);
    registerPartRuntime(def);
    setStaging(upsertStaging(def));
    setBc1Tick((n) => n + 1);
    setWriteMsg(`Staging +${def.id}`);
  };

  const onRemoveStaging = (): void => {
    if (!selected) return;
    setStaging(removeStaging(selected.id));
    setWriteMsg(`Retiré ${selected.id}`);
  };

  const onWriteParts = (): void => {
    setWriteMsg(null);
    const api = window.brickRacer?.mergeBc1Parts;
    if (!api) {
      setWriteMsg('IPC merge indisponible (hors Electron ?)');
      return;
    }
    void api(staging)
      .then((result) => {
        setWriteMsg(
          result.ok
            ? `parts.json : ${result.added} ajout(s), ${result.total} total`
            : result.error ?? 'Échec écriture'
        );
      })
      .catch((err: unknown) => {
        setWriteMsg(err instanceof Error ? err.message : String(err));
      });
  };

  // Force re-render of BC1 badges after registerPartRuntime.
  void bc1Tick;

  return (
    <>
      {uvGrid === 1 && uv1Ao ? <Uv1AoPanel view={uv1Ao} /> : null}
      <aside className="br-catalog" aria-label="Catalogue master LEGO">
      <header className="br-catalog__head">
        <h2 className="br-catalog__title">Catalogue</h2>
        <p className="br-catalog__meta">
          {filtered.length.toLocaleString('fr-FR')} / {parts.length.toLocaleString('fr-FR')} · staging{' '}
          {staging.length}
        </p>
      </header>

      {error ? (
        <p className="br-catalog__error" role="alert">
          {error}
          <br />
          <span className="br-catalog__hint">Lancer `pnpm catalog:build` puis recharger.</span>
        </p>
      ) : null}

      <div className="br-catalog__filters">
        <input
          className="br-catalog__input"
          type="search"
          placeholder="id ou nom…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setScrollTop(0);
          }}
          aria-label="Recherche pièce"
        />
        <select
          className="br-catalog__select"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setScrollTop(0);
          }}
          aria-label="Catégorie Rebrickable"
        >
          <option value="">Toutes cat.</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              cat {c}
            </option>
          ))}
        </select>
      </div>

      <div
        className="br-catalog__list"
        style={{ height: VIEW_H }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: filtered.length * ROW_H, position: 'relative' }}>
          {slice.map((p, i) => {
            const idx = start + i;
            const inBc1 = isCatalogPart(p.id);
            const inSt = stagingIds.has(p.id);
            const active = selected?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={
                  active
                    ? 'br-catalog__row br-catalog__row--active'
                    : 'br-catalog__row'
                }
                style={{ top: idx * ROW_H, height: ROW_H }}
                onClick={() => onSelect(p)}
              >
                <span className="br-catalog__id">{p.id}</span>
                <span className="br-catalog__name">{p.name}</span>
                {inBc1 || inSt ? (
                  <span className="br-catalog__badge">{inBc1 ? 'BC1' : 'ST'}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {selected ? (
        <div className="br-catalog__detail">
          <p className="br-catalog__detail-title">
            #{selected.id} — {selected.name}
          </p>
          <div className="br-catalog__actions" role="group" aria-label="Mode preview">
            {(['mesh', 'box'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={
                  previewMode === m ? 'br-catalog__btn' : 'br-catalog__btn br-catalog__btn--ghost'
                }
                aria-pressed={previewMode === m}
                onClick={() => onPreviewMode(m)}
              >
                {m === 'mesh' ? 'Mesh' : 'Boîte'}
              </button>
            ))}
            {([0, 1] as const).map((channel) => (
              <button
                key={channel}
                type="button"
                className={
                  uvGrid === channel ? 'br-catalog__btn' : 'br-catalog__btn br-catalog__btn--ghost'
                }
                aria-pressed={uvGrid === channel}
                onClick={() => onUvGrid(channel)}
              >
                Grille UV{channel}
              </button>
            ))}
            <button
              type="button"
              className={aging ? 'br-catalog__btn' : 'br-catalog__btn br-catalog__btn--ghost'}
              aria-pressed={aging}
              onClick={() => onAging(!aging)}
            >
              Vieillissement
            </button>
          </div>
          <div className="br-catalog__actions" role="group" aria-label="Plastique AmbientCG">
            {CATALOG_PLASTIC_SETS.map((s) => (
              <button
                key={s}
                type="button"
                className={
                  plasticSet === s ? 'br-catalog__btn' : 'br-catalog__btn br-catalog__btn--ghost'
                }
                aria-pressed={plasticSet === s}
                onClick={() => onPlastic(s)}
              >
                {PLASTIC_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="br-catalog__swatches" role="listbox" aria-label="Couleur diffuse">
            {BRICK_CATALOG.colors.map((c) => {
              const active = colorId === c.id;
              const [r, g, b] = c.rgb;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  title={c.name}
                  className={
                    active
                      ? 'br-catalog__swatch br-catalog__swatch--active'
                      : 'br-catalog__swatch'
                  }
                  style={{ background: `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})` }}
                  onClick={() => onColor(c.id)}
                />
              );
            })}
          </div>
          {previewStatus ? <p className="br-catalog__hint">{previewStatus}</p> : null}
          <label className="br-catalog__field">
            Footprint sx,py,sz
            <input
              className="br-catalog__input"
              value={footprintEdit}
              onChange={(e) => setFootprintEdit(e.target.value)}
              onBlur={() => {
                const fp = parseFootprint(footprintEdit);
                if (fp && previewMode === 'box') {
                  preview(selected, fp, 'box', colorId, plasticSet, uvGrid, aging);
                }
              }}
            />
          </label>
          <label className="br-catalog__field">
            Catégorie BC1
            <select
              className="br-catalog__select"
              value={categoryEdit}
              onChange={(e) => setCategoryEdit(e.target.value as BrickPartCategory)}
            >
              {(
                [
                  'brick',
                  'plate',
                  'tile',
                  'round',
                  'slope',
                  'dish',
                  'cone',
                  'other',
                ] as const
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <p className="br-catalog__hint">
            LDraw {selected.ldraw_id ?? '—'}
            {selected.dims_mm
              ? ` · ${selected.dims_mm.w}×${selected.dims_mm.h}×${selected.dims_mm.d} mm`
              : ''}
          </p>
          <div className="br-catalog__actions">
            <button
              type="button"
              className="br-catalog__btn"
              onClick={onExportGlb}
              disabled={!exportId}
            >
              Exporter GLB
            </button>
            <button
              type="button"
              className="br-catalog__btn"
              onClick={onExportObj}
              disabled={!exportId}
            >
              Exporter OBJ
            </button>
            <button
              type="button"
              className="br-catalog__btn"
              onClick={onExportFbx}
              disabled={!exportId}
            >
              Exporter FBX
            </button>
            <button type="button" className="br-catalog__btn" onClick={onAddStaging}>
              Ajouter BC1
            </button>
            <button
              type="button"
              className="br-catalog__btn br-catalog__btn--ghost"
              onClick={onRemoveStaging}
              disabled={!stagingIds.has(selected.id)}
            >
              Retirer
            </button>
            <button type="button" className="br-catalog__btn br-catalog__btn--accent" onClick={() => void onWriteParts()}>
              Écrire parts.json
            </button>
          </div>
          {writeMsg ? <p className="br-catalog__msg">{writeMsg}</p> : null}
        </div>
      ) : (
        <p className="br-catalog__hint">Sélectionne une pièce pour la prévisualiser.</p>
      )}
      </aside>
    </>
  );
}

type Uv1AoView = { ao: Uint8Array; coverage: Uint8Array };

/** UV1 atlas, AO channel only. Row 0 is v = 0, same as the GPU sample. */
function Uv1AoPanel({ view }: { view: Uv1AoView }): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const size = Math.round(Math.sqrt(view.ao.length));
    canvas.width = size;
    canvas.height = size;
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const covered = view.coverage[i] === 1;
      const v = covered ? view.ao[i]! : 0;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = covered ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
  }, [view]);
  return (
    <aside className="br-uv1" aria-label="UV1, occlusion ambiante">
      <p className="br-uv1__title">UV1 · AO</p>
      <canvas ref={ref} className="br-uv1__map" width={256} height={256} />
      <p className="br-uv1__axis">U → · V ↓ · clair = ouvert</p>
    </aside>
  );
}
