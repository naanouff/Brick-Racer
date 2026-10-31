/**
 * @file catalogFavorites.ts
 * @description Persist catalog part favorites, grouped by Rebrickable category id.
 */

export const CATALOG_FAVORITES_KEY = 'brick-racer.catalog-favorites';

export type CatalogFavorite = {
  /** Master / design id. */
  id: string;
  /** Rebrickable category id (grouping key). */
  categoryId: string;
};

type FavoritesStore = {
  version: 1;
  items: CatalogFavorite[];
};

function isFavoriteEntry(v: unknown): v is CatalogFavorite {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && o.id.length > 0 && typeof o.categoryId === 'string';
}

function normalize(items: CatalogFavorite[]): CatalogFavorite[] {
  const byId = new Map<string, CatalogFavorite>();
  for (const it of items) {
    if (!isFavoriteEntry(it)) continue;
    byId.set(it.id, { id: it.id, categoryId: it.categoryId });
  }
  return [...byId.values()].sort(
    (a, b) =>
      a.categoryId.localeCompare(b.categoryId, 'en') || a.id.localeCompare(b.id, 'en')
  );
}

export function readFavorites(): CatalogFavorite[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CATALOG_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return normalize(parsed.filter(isFavoriteEntry));
    if (parsed && typeof parsed === 'object') {
      const o = parsed as FavoritesStore;
      if (Array.isArray(o.items)) return normalize(o.items.filter(isFavoriteEntry));
    }
  } catch {
    /* private mode / corrupt */
  }
  return [];
}

export function writeFavorites(items: readonly CatalogFavorite[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const store: FavoritesStore = { version: 1, items: normalize([...items]) };
    localStorage.setItem(CATALOG_FAVORITES_KEY, JSON.stringify(store));
  } catch {
    /* private mode */
  }
}

export function isFavorite(id: string, items = readFavorites()): boolean {
  return items.some((f) => f.id === id);
}

/** Add or update favorite for this part under `categoryId`. */
export function addFavorite(id: string, categoryId: string): CatalogFavorite[] {
  const next = readFavorites().filter((f) => f.id !== id);
  next.push({ id, categoryId });
  writeFavorites(next);
  return readFavorites();
}

export function removeFavorite(id: string): CatalogFavorite[] {
  const next = readFavorites().filter((f) => f.id !== id);
  writeFavorites(next);
  return next;
}

/** Toggle favorite; returns the new list. */
export function toggleFavorite(id: string, categoryId: string): CatalogFavorite[] {
  if (isFavorite(id)) return removeFavorite(id);
  return addFavorite(id, categoryId);
}

/** Favorites belonging to one Rebrickable category. */
export function favoritesInCategory(
  categoryId: string,
  items = readFavorites()
): CatalogFavorite[] {
  return items.filter((f) => f.categoryId === categoryId);
}

/** Map categoryId → favorite part ids (sorted). */
export function favoritesByCategory(
  items = readFavorites()
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const f of items) {
    const list = map.get(f.categoryId) ?? [];
    list.push(f.id);
    map.set(f.categoryId, list);
  }
  return map;
}
