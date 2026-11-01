/**
 * @file CatalogBrowserPanel.tsx
 * @description Master catalog browser overlay for catalog-lab (CL1d).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Camera,
  Grid3x3,
  ImagePlus,
  LayoutList,
  LayoutGrid,
  Plus,
  Save,
  Square,
  Star,
  X,
  Zap,
} from 'lucide-react';
import {
  BRICK_CATALOG,
  BRICK_PART_CATEGORIES,
  CATALOG_PLASTIC_SETS,
  DEFAULT_CATALOG_PLASTIC_SET,
  categoryName,
  familyForCategoryId,
  guessPartCategory,
  isCatalogPart,
  loadCatalogCategories,
  loadMasterIndex,
  readFavorites,
  registerPartRuntime,
  removeStaging,
  readStaging,
  toggleFavorite,
  upsertStaging,
  type CatalogCategoriesFile,
  type CatalogFavorite,
  type CatalogFamilyId,
  type CatalogPlasticSet,
  type MasterIndexEntry,
  type StagingPart,
} from '../../racer/hub/brick/catalog';
import { fetchLdrawPart, hasLdrawIpc } from '../../racer/hub/brick/catalog/ldrawMeshCache';
import type { BrickFootprint, BrickPartCategory } from '../../racer/hub/brick/catalog/types';
import type { BrickRacerHost } from '../../racer/host/startBrickRacerHost';
import { LegoColorPicker } from '../atelier/LegoColorPicker';
import { SearchCombobox, type SearchComboboxOption } from '../atelier/SearchCombobox';
import {
  enqueueMissingThumbs,
  ensureThumbIndexLoaded,
  reportMissingThumb,
  subscribeThumbBake,
  type ThumbBakePart,
} from './thumbAutoBake';
import '../atelier/atelier.css';

const LI = { size: 15, strokeWidth: 2, 'aria-hidden': true as const };

type SizeFilter = '' | '1' | '2' | '4' | '6+';
type HeightFilter = '' | 'plate' | 'brick' | 'tall';
type ViewMode = 'list' | 'grid';
type SortMode = 'id' | 'name' | 'size';

const ROW_H = 36;
const VIEW_H = 360;

function chipClass(active: boolean, variant?: 'accent' | 'ghost'): string {
  const parts = ['br-atelier-chip'];
  if (active) parts.push('is-active');
  if (variant === 'accent') parts.push('br-atelier-chip--accent');
  if (variant === 'ghost') parts.push('br-atelier-chip--ghost');
  return parts.join(' ');
}

type PreviewMode = 'mesh' | 'box';
type UvGridChannel = 0 | 1 | false;

const PLASTIC_LABELS: Record<CatalogPlasticSet, string> = {
  '003': '003',
  '017b': '017B',
  off: 'Off',
};

export type CatalogUsePart = {
  id: string;
  name: string;
  footprint: BrickFootprint;
  category: BrickPartCategory;
  ldrawId?: string;
};

export type CatalogBrowserPanelProps = {
  host: BrickRacerHost | null;
  /** Fit inside Atelier drawer (no absolute overlay). */
  embedded?: boolean;
  /** Hide export / texture / quality tools (brick-lab picker). */
  pickerMode?: boolean;
  /** Called when the user picks a part for the brush (brick-lab). */
  onUsePart?: (part: CatalogUsePart) => void;
  /** Bottom toolbar: texture debug + render quality (catalog-lab). */
  debugTex?: boolean;
  renderQuality?: 'fast' | 'showcase';
  onToggleDebugTex?: (on: boolean) => void;
  onSelectRenderQuality?: (q: 'fast' | 'showcase') => void;
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
  const {
    host,
    embedded = false,
    pickerMode = false,
    onUsePart,
    debugTex = false,
    renderQuality = 'fast',
    onToggleDebugTex,
    onSelectRenderQuality,
  } = props;
  const [parts, setParts] = useState<MasterIndexEntry[]>([]);
  const [categoriesFile, setCategoriesFile] = useState<CatalogCategoriesFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<CatalogFamilyId | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [bc1Only, setBc1Only] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('');
  const [heightFilter, setHeightFilter] = useState<HeightFilter>('');
  const [sortMode, setSortMode] = useState<SortMode>('id');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [partSuggestOpen, setPartSuggestOpen] = useState(false);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbMsg, setThumbMsg] = useState<string | null>(null);
  const [thumbTick, setThumbTick] = useState(0);
  const [selected, setSelected] = useState<MasterIndexEntry | null>(null);
  const [footprintEdit, setFootprintEdit] = useState('1,3,1');
  const [categoryEdit, setCategoryEdit] = useState<BrickPartCategory>('brick');
  const [staging, setStaging] = useState<StagingPart[]>(() => readStaging());
  const [favorites, setFavorites] = useState<CatalogFavorite[]>(() => readFavorites());
  const [scrollTop, setScrollTop] = useState(0);
  const [writeMsg, setWriteMsg] = useState<string | null>(null);
  const [bc1Tick, setBc1Tick] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('mesh');
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [colorId, setColorId] = useState('gray');
  const [plasticSet, setPlasticSet] = useState<CatalogPlasticSet>(DEFAULT_CATALOG_PLASTIC_SET);
  const [uvGrid, setUvGrid] = useState<UvGridChannel>(false);
  const [uv1Ao, setUv1Ao] = useState<Uv1AoView | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  const [aging, setAging] = useState(true);
  const [listH, setListH] = useState(VIEW_H);
  const previewToken = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadMasterIndex(), loadCatalogCategories()])
      .then(([file, cats]) => {
        if (cancelled) return;
        setParts(file.parts);
        setCategoriesFile(cats);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const apply = (): void => {
      const h = Math.floor(el.clientHeight);
      if (h > 0) setListH(h);
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedded, selected, error, viewMode]);

  const familyOptions = useMemo<SearchComboboxOption[]>(() => {
    return (categoriesFile?.families ?? []).map((f) => ({
      value: f.id,
      label: f.name,
    }));
  }, [categoriesFile]);

  const categoryOptions = useMemo<SearchComboboxOption[]>(() => {
    if (!categoriesFile) return [];
    const ids = new Set<string>();
    for (const p of parts) {
      if (!p.category_id) continue;
      if (family && familyForCategoryId(categoriesFile, p.category_id) !== family) continue;
      ids.add(p.category_id);
    }
    return [...ids]
      .map((id) => ({
        value: id,
        label: categoryName(categoriesFile, id),
        hint: id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [parts, categoriesFile, family]);

  const partSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [] as MasterIndexEntry[];
    return parts
      .filter(
        (p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [parts, query]);

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const favCountInCategory = useMemo(() => {
    if (!categoryId) return favorites.length;
    return favorites.filter((f) => f.categoryId === categoryId).length;
  }, [favorites, categoryId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = parts.filter((p) => {
      if (favOnly && !favoriteIds.has(p.id)) return false;
      if (bc1Only && !isCatalogPart(p.id)) return false;
      if (family && categoriesFile) {
        const fam =
          (p.family as CatalogFamilyId | undefined) ??
          familyForCategoryId(categoriesFile, p.category_id);
        if (fam !== family) return false;
      }
      if (categoryId && p.category_id !== categoryId) return false;
      const [sx, py, sz] = p.footprint;
      const long = Math.max(sx, sz);
      if (sizeFilter === '1' && long !== 1) return false;
      if (sizeFilter === '2' && long !== 2) return false;
      if (sizeFilter === '4' && long !== 4) return false;
      if (sizeFilter === '6+' && long < 6) return false;
      if (heightFilter === 'plate' && py !== 1) return false;
      if (heightFilter === 'brick' && py !== 3) return false;
      if (heightFilter === 'tall' && py <= 3) return false;
      if (!q) return true;
      return p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      if (favOnly) {
        const ca = a.category_id.localeCompare(b.category_id, 'en');
        if (ca !== 0) return ca;
      }
      if (sortMode === 'name') return a.name.localeCompare(b.name, 'fr');
      if (sortMode === 'size') {
        const da = a.footprint[0] * a.footprint[2];
        const db = b.footprint[0] * b.footprint[2];
        return db - da || a.id.localeCompare(b.id);
      }
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [
    parts,
    query,
    categoryId,
    family,
    categoriesFile,
    bc1Only,
    favOnly,
    favoriteIds,
    sizeFilter,
    heightFilter,
    sortMode,
  ]);

  const stagingIds = useMemo(() => new Set(staging.map((s) => s.id)), [staging]);

  const onToggleFavorite = useCallback((): void => {
    if (!selected) return;
    setFavorites(toggleFavorite(selected.id, selected.category_id));
  }, [selected]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 5);
  const visibleCount = Math.ceil(listH / ROW_H) + 10;
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
      if (mode === 'box') return showBox('boîte');
      if (!entry.ldraw_id) return showBox('boîte · pas d’id LDraw');
      if (!hasLdrawIpc()) return showBox('boîte · IPC LDraw indisponible');

      const ldrawId = entry.ldraw_id;
      setPreviewStatus('mesh LDraw · chargement…');
      void fetchLdrawPart(ldrawId, 'ground-center')
        .then((res) => {
          if (token !== previewToken.current) return;
          if (!res) return showBox('boîte · IPC LDraw indisponible');
          if (!res.ok) return showBox(`boîte · ${res.error}`);
          const previewed = host.previewCatalogMesh({
            key: ldrawId,
            ...res.source,
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

  const onUvGrid = (channel: UvGridChannel): void => {
    setUvGrid(channel);
    repreview(previewMode, colorId, plasticSet, channel, aging);
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

  const toThumbPart = (entry: MasterIndexEntry): ThumbBakePart => ({
    id: entry.id,
    ldrawId: entry.ldraw_id ?? entry.id,
    footprint: entry.footprint,
  });

  useEffect(() => {
    void ensureThumbIndexLoaded();
    return subscribeThumbBake((p) => {
      setThumbBusy(p.busy);
      setThumbMsg(p.lastMsg);
      if (p.ok > 0) setThumbTick((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    if (viewMode !== 'grid' || filtered.length === 0) return;
    enqueueMissingThumbs(filtered.slice(0, 120).map(toThumbPart), { limit: 120 });
  }, [viewMode, filtered]);

  const onBakeThumbs = (force = false): void => {
    const targets = filtered.slice(0, 80).map(toThumbPart);
    if (targets.length === 0) {
      setThumbMsg('Aucune pièce à miniaturiser (filtre vide)');
      return;
    }
    enqueueMissingThumbs(targets, { force, limit: 80 });
  };

  // Force re-render of BC1 badges after registerPartRuntime.
  void bc1Tick;

  return (
    <>
      {uvGrid === 1 && uv1Ao ? <Uv1AoPanel view={uv1Ao} /> : null}
      <aside
        className={embedded ? 'br-catalog br-catalog--embedded' : 'br-catalog'}
        aria-label="Catalogue master LEGO"
      >
        <header className="br-catalog__head">
          {!embedded ? <h2 className="br-catalog__title">Catalogue</h2> : null}
          <div className="br-atelier-meta-row">
            <p className="br-atelier-meta">
              <b>{filtered.length.toLocaleString('fr-FR')}</b>
              <span>/ {parts.length.toLocaleString('fr-FR')}</span>
            </p>
            <p
              className={
                favorites.length > 0
                  ? 'br-atelier-meta br-atelier-meta--accent'
                  : 'br-atelier-meta'
              }
              title={
                categoryId
                  ? `Favoris dans cette catégorie : ${favCountInCategory}`
                  : 'Favoris enregistrés'
              }
            >
              fav <b>{categoryId ? favCountInCategory : favorites.length}</b>
            </p>
            <p
              className={
                staging.length > 0
                  ? 'br-atelier-meta br-atelier-meta--accent'
                  : 'br-atelier-meta'
              }
            >
              staging <b>{staging.length}</b>
            </p>
          </div>
        </header>

        {error ? (
          <p className="br-catalog__error" role="alert">
            {error}
            <br />
            <span className="br-catalog__hint">Lancer `pnpm catalog:build` puis recharger.</span>
          </p>
        ) : null}

        <div className="br-catalog__filters">
          <div className="br-combo br-combo--suggest">
            <label className="br-atelier-field br-atelier-field--row">
              <span className="br-atelier-label">Recherche</span>
              <div className="br-combo__control">
                <input
                  className="br-atelier-input br-combo__input"
                  type="search"
                  placeholder="id ou nom… (auto-complétion)"
                  value={query}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={partSuggestOpen && partSuggestions.length > 0}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPartSuggestOpen(true);
                    setScrollTop(0);
                  }}
                  onFocus={() => setPartSuggestOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setPartSuggestOpen(false), 120);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setPartSuggestOpen(false);
                    if (e.key === 'Enter' && partSuggestions[0]) {
                      e.preventDefault();
                      onSelect(partSuggestions[0]);
                      setQuery(partSuggestions[0].id);
                      setPartSuggestOpen(false);
                    }
                  }}
                  aria-label="Recherche pièce"
                />
                {query ? (
                  <button
                    type="button"
                    className="br-combo__clear"
                    aria-label="Effacer la recherche"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery('');
                      setScrollTop(0);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </label>
            {partSuggestOpen && partSuggestions.length > 0 ? (
              <ul className="br-combo__list" role="listbox" aria-label="Suggestions">
                {partSuggestions.map((p) => (
                  <li key={p.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className={
                        selected?.id === p.id
                          ? 'br-combo__option is-selected'
                          : 'br-combo__option'
                      }
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSelect(p);
                        setQuery(p.id);
                        setPartSuggestOpen(false);
                        setScrollTop(0);
                      }}
                    >
                      <span className="br-combo__option-label">{p.name}</span>
                      <span className="br-combo__option-hint">{p.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="br-catalog__filter-row">
            <SearchCombobox
              label="Famille"
              value={family}
              options={familyOptions}
              emptyLabel="Toutes les familles"
              placeholder="Famille…"
              onChange={(v) => {
                setFamily((v || '') as CatalogFamilyId | '');
                setCategoryId('');
                setScrollTop(0);
              }}
            />
            <SearchCombobox
              label="Catégorie"
              value={categoryId}
              options={categoryOptions}
              emptyLabel="Toutes"
              placeholder="Catégorie…"
              onChange={(v) => {
                setCategoryId(v);
                setScrollTop(0);
              }}
            />
          </div>
          <div className="br-catalog__filter-row br-catalog__tools">
            <label className="br-catalog__mini" title="Taille (grand côté, en studs)">
              <select
                className="br-atelier-select"
                aria-label="Taille"
                value={sizeFilter}
                onChange={(e) => {
                  setSizeFilter(e.target.value as SizeFilter);
                  setScrollTop(0);
                }}
              >
                <option value="">tai</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="4">4</option>
                <option value="6+">6+</option>
              </select>
            </label>
            <label className="br-catalog__mini" title="Hauteur : plaque, brique ou plus haut">
              <select
                className="br-atelier-select"
                aria-label="Hauteur"
                value={heightFilter}
                onChange={(e) => {
                  setHeightFilter(e.target.value as HeightFilter);
                  setScrollTop(0);
                }}
              >
                <option value="">ht</option>
                <option value="plate">pl.</option>
                <option value="brick">bri.</option>
                <option value="tall">haut</option>
              </select>
            </label>
            <label className="br-catalog__mini" title="Tri">
              <select
                className="br-atelier-select"
                aria-label="Tri"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
              >
                <option value="id">id</option>
                <option value="name">nom</option>
                <option value="size">taille</option>
              </select>
            </label>
            <div className="br-catalog__iconbar" role="group" aria-label="Vue">
              <button
                type="button"
                className={chipClass(favOnly, favOnly ? 'accent' : undefined)}
                title={
                  categoryId
                    ? 'Afficher les favoris de cette catégorie'
                    : 'Afficher tous les favoris (groupés par catégorie)'
                }
                aria-pressed={favOnly}
                onClick={() => {
                  setFavOnly((v) => !v);
                  setScrollTop(0);
                }}
              >
                ★ Fav
              </button>
              <button
                type="button"
                className={chipClass(bc1Only)}
                title="Limiter au catalogue BC1"
                aria-pressed={bc1Only}
                onClick={() => {
                  setBc1Only((v) => !v);
                  setScrollTop(0);
                }}
              >
                BC1
              </button>
              <button
                type="button"
                className={`${chipClass(viewMode === 'list')} br-atelier-chip--icon`}
                title="Liste"
                aria-label="Liste"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
              >
                <LayoutList {...LI} />
              </button>
              <button
                type="button"
                className={`${chipClass(viewMode === 'grid')} br-atelier-chip--icon`}
                title="Grille"
                aria-label="Grille"
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid {...LI} />
              </button>
              <button
                type="button"
                className={`${chipClass(false, 'accent')} br-atelier-chip--icon`}
                title="Régénérer les miniatures du filtre"
                aria-label="Régénérer miniatures"
                disabled={thumbBusy}
                onClick={() => onBakeThumbs(true)}
              >
                <ImagePlus {...LI} />
              </button>
            </div>
          </div>
          {thumbMsg ? <p className="br-catalog__hint">{thumbMsg}</p> : null}
        </div>

        {viewMode === 'grid' ? (
          <div
            ref={listRef}
            className="br-catalog__grid"
            style={embedded ? undefined : { height: VIEW_H }}
          >
            {filtered.slice(0, 400).map((p) => {
              const inBc1 = isCatalogPart(p.id);
              const inFav = favoriteIds.has(p.id);
              const active = selected?.id === p.id;
              const lid = p.ldraw_id ?? p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={active ? 'br-catalog__cell is-active' : 'br-catalog__cell'}
                  onClick={() => onSelect(p)}
                  title={`${p.id} — ${p.name}`}
                  aria-label={`${p.id} — ${p.name}`}
                >
                  <img
                    src={`/catalog/thumbs/${lid}.png?t=${thumbTick}`}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.opacity = '0.2';
                      (e.currentTarget as HTMLImageElement).style.filter = 'grayscale(1)';
                      reportMissingThumb(toThumbPart(p));
                    }}
                    onLoad={(e) => {
                      (e.currentTarget as HTMLImageElement).style.opacity = '1';
                      (e.currentTarget as HTMLImageElement).style.filter = '';
                    }}
                  />
                  <span className="br-catalog__cell-id">{p.id}</span>
                  <span className="br-catalog__cell-tip">{p.name}</span>
                  {inFav ? <em className="br-catalog__cell-fav" aria-hidden>★</em> : null}
                  {inBc1 ? <em>BC1</em> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            ref={listRef}
            className="br-catalog__list"
            style={embedded ? undefined : { height: VIEW_H }}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            <div style={{ height: filtered.length * ROW_H, position: 'relative' }}>
              {slice.map((p, i) => {
                const idx = start + i;
                const inBc1 = isCatalogPart(p.id);
                const inFav = favoriteIds.has(p.id);
                const inSt = stagingIds.has(p.id);
                const active = selected?.id === p.id;
                const lid = p.ldraw_id ?? p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      active ? 'br-catalog__row br-catalog__row--active' : 'br-catalog__row'
                    }
                    style={{ top: idx * ROW_H, height: ROW_H - 2 }}
                    onClick={() => onSelect(p)}
                  >
                    <img
                      className="br-catalog__row-thumb"
                      src={`/catalog/thumbs/${lid}.png?t=${thumbTick}`}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = '0.25';
                        (e.currentTarget as HTMLImageElement).style.filter = 'grayscale(1)';
                        reportMissingThumb(toThumbPart(p));
                      }}
                      onLoad={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = '1';
                        (e.currentTarget as HTMLImageElement).style.filter = '';
                      }}
                    />
                    <span className="br-catalog__id">{p.id}</span>
                    <span className="br-catalog__name">{p.name}</span>
                    {inFav ? (
                      <span className="br-catalog__badge br-catalog__badge--fav" title="Favori">
                        ★
                      </span>
                    ) : null}
                    {inBc1 ? <span className="br-catalog__badge">BC1</span> : null}
                    {!inBc1 && inSt ? (
                      <span className="br-catalog__badge br-catalog__badge--staging">ST</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selected ? (
          <div className="br-catalog__detail">
            <div className="br-catalog__detail-scroll">
            <p className="br-catalog__detail-title">
              #{selected.id} — {selected.name}
            </p>
            <div className="br-catalog__look-row">
              <div className="br-atelier-seg" role="radiogroup" aria-label="Preview">
                <span className="br-atelier-label">Preview</span>
                <div className="br-atelier-seg__btns">
                  {(['mesh', 'box'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={previewMode === m}
                      className={
                        previewMode === m
                          ? 'br-atelier-seg__btn is-active'
                          : 'br-atelier-seg__btn'
                      }
                      onClick={() => onPreviewMode(m)}
                    >
                      {m === 'mesh' ? 'Mesh' : 'Boîte'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="br-atelier-seg" role="radiogroup" aria-label="Plastique">
                <span className="br-atelier-label">Plastique</span>
                <div className="br-atelier-seg__btns">
                  {CATALOG_PLASTIC_SETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={plasticSet === s}
                      className={
                        plasticSet === s
                          ? 'br-atelier-seg__btn is-active'
                          : 'br-atelier-seg__btn'
                      }
                      onClick={() => onPlastic(s)}
                    >
                      {PLASTIC_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="br-atelier-toggle">
                <input
                  type="checkbox"
                  checked={aging}
                  onChange={(e) => onAging(e.target.checked)}
                />
                <span>Vieilli</span>
              </label>
            </div>
            <div className="br-atelier-seg" role="radiogroup" aria-label="UV debug">
              <span className="br-atelier-label">UV</span>
              <div className="br-atelier-seg__btns">
                {(
                  [
                    { id: false as const, label: 'Off' },
                    { id: 0 as const, label: 'UV0' },
                    { id: 1 as const, label: 'UV1' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={String(opt.id)}
                    type="button"
                    role="radio"
                    aria-checked={uvGrid === opt.id}
                    className={
                      uvGrid === opt.id
                        ? 'br-atelier-seg__btn is-active'
                        : 'br-atelier-seg__btn'
                    }
                    onClick={() => onUvGrid(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <LegoColorPicker value={colorId} onChange={onColor} />
            {previewStatus ? <p className="br-catalog__hint">{previewStatus}</p> : null}
            <div className="br-catalog__meta">
              <label
                className="br-catalog__meta-item"
                title="Emprise : studs X, plaques Y, studs Z"
              >
                <span>sx,py,sz</span>
                <input
                  className="br-atelier-input"
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
              <label className="br-catalog__meta-item" title="Catégorie écrite dans parts.json">
                <span>BC1</span>
                <select
                  className="br-atelier-select"
                  value={categoryEdit}
                  onChange={(e) => setCategoryEdit(e.target.value as BrickPartCategory)}
                >
                  {BRICK_PART_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <span className="br-catalog__meta-ldraw" title="Identifiant LDraw et cotes mm">
                {selected.ldraw_id ?? '—'}
                {selected.dims_mm
                  ? ` · ${selected.dims_mm.w}×${selected.dims_mm.h}×${selected.dims_mm.d}`
                  : ''}
              </span>
            </div>
            </div>
          </div>
        ) : (
          <p className="br-atelier-empty">Sélectionne une pièce pour la prévisualiser.</p>
        )}

        <div className="br-catalog__toolbar" role="toolbar" aria-label="Actions catalogue">
          <button
            type="button"
            className={`${chipClass(
              !!(selected && favoriteIds.has(selected.id)),
              selected && favoriteIds.has(selected.id) ? 'accent' : undefined
            )} br-atelier-chip--icon`}
            disabled={!selected}
            onClick={onToggleFavorite}
            title={
              selected && favoriteIds.has(selected.id)
                ? 'Retirer des favoris'
                : 'Ajouter aux favoris (par catégorie Rebrickable)'
            }
            aria-label={
              selected && favoriteIds.has(selected.id)
                ? 'Retirer des favoris'
                : 'Ajouter aux favoris'
            }
            aria-pressed={!!(selected && favoriteIds.has(selected.id))}
          >
            <Star
              {...LI}
              fill={selected && favoriteIds.has(selected.id) ? 'currentColor' : 'none'}
            />
          </button>
          {pickerMode ? (
            <button
              type="button"
              className={chipClass(false, 'accent')}
              disabled={!selected || !onUsePart}
              onClick={() => {
                if (!selected || !onUsePart) return;
                const fp = parseFootprint(footprintEdit) ?? selected.footprint;
                onUsePart({
                  id: selected.id,
                  name: selected.name,
                  footprint: fp,
                  category: categoryEdit,
                  ...(selected.ldraw_id ? { ldrawId: selected.ldraw_id } : {}),
                });
              }}
            >
              Utiliser
            </button>
          ) : (
            <>
              <button
                type="button"
                className={chipClass(false)}
                onClick={onExportGlb}
                disabled={!exportId}
                title="Exporter GLB"
              >
                GLB
              </button>
              <button
                type="button"
                className={chipClass(false)}
                onClick={onExportObj}
                disabled={!exportId}
                title="Exporter OBJ"
              >
                OBJ
              </button>
              <button
                type="button"
                className={chipClass(false)}
                onClick={onExportFbx}
                disabled={!exportId}
                title="Exporter FBX"
              >
                FBX
              </button>
              <button
                type="button"
                className={`${chipClass(false)} br-atelier-chip--icon`}
                onClick={onAddStaging}
                disabled={!selected}
                title="Ajouter au staging BC1"
                aria-label="Ajouter au staging BC1"
              >
                <Plus {...LI} />
              </button>
              <button
                type="button"
                className={`${chipClass(false, 'ghost')} br-atelier-chip--icon`}
                onClick={onRemoveStaging}
                disabled={!selected || !stagingIds.has(selected.id)}
                title="Retirer du staging"
                aria-label="Retirer du staging"
              >
                <X {...LI} />
              </button>
              <button
                type="button"
                className={`${chipClass(false, 'accent')} br-atelier-chip--icon`}
                onClick={() => void onWriteParts()}
                title="Écrire parts.json"
                aria-label="Écrire parts.json"
              >
                <Save {...LI} />
              </button>
              <button
                type="button"
                className={`${chipClass(debugTex)} br-atelier-chip--icon`}
                disabled={!onToggleDebugTex || debugTex}
                onClick={() => onToggleDebugTex?.(true)}
                title="Texture debug grille"
                aria-label="Texture debug grille"
              >
                <Grid3x3 {...LI} />
              </button>
              <button
                type="button"
                className={`${chipClass(!debugTex)} br-atelier-chip--icon`}
                disabled={!onToggleDebugTex || !debugTex}
                onClick={() => onToggleDebugTex?.(false)}
                title="Texture unie"
                aria-label="Texture unie"
              >
                <Square {...LI} fill="currentColor" />
              </button>
              <button
                type="button"
                className={`${chipClass(renderQuality === 'fast')} br-atelier-chip--icon`}
                disabled={!onSelectRenderQuality || renderQuality === 'fast'}
                onClick={() => onSelectRenderQuality?.('fast')}
                title="Qualité fast (recharge)"
                aria-label="Qualité fast"
              >
                <Zap {...LI} />
              </button>
              <button
                type="button"
                className={`${chipClass(renderQuality === 'showcase')} br-atelier-chip--icon`}
                disabled={!onSelectRenderQuality || renderQuality === 'showcase'}
                onClick={() => onSelectRenderQuality?.('showcase')}
                title="Qualité showcase (recharge)"
                aria-label="Qualité showcase"
              >
                <Camera {...LI} />
              </button>
            </>
          )}
          {writeMsg ? <p className="br-catalog__toolbar-msg">{writeMsg}</p> : null}
        </div>
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
