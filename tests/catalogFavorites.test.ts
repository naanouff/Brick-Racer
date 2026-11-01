import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CATALOG_FAVORITES_KEY,
  addFavorite,
  favoritesByCategory,
  favoritesInCategory,
  isFavorite,
  readFavorites,
  removeFavorite,
  toggleFavorite,
  writeFavorites,
} from '../src/racer/hub/brick/catalog/catalogFavorites';

/** Vitest runs in node — stub localStorage for catalog favorites. */
beforeAll(() => {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
});

describe('catalogFavorites', () => {
  afterEach(() => {
    localStorage.removeItem(CATALOG_FAVORITES_KEY);
  });

  it('stores favorites grouped by category', () => {
    expect(readFavorites()).toEqual([]);
    addFavorite('3001', '11');
    addFavorite('3005', '11');
    addFavorite('3024', '14');
    expect(isFavorite('3005')).toBe(true);
    expect(favoritesInCategory('11').map((f) => f.id)).toEqual(['3001', '3005']);
    expect(favoritesByCategory().get('14')).toEqual(['3024']);
  });

  it('toggles and dedupes by part id', () => {
    addFavorite('3001', '11');
    writeFavorites(addFavorite('3001', '5')); // move category
    expect(readFavorites()).toEqual([{ id: '3001', categoryId: '5' }]);
    expect(toggleFavorite('3001', '5')).toEqual([]);
    expect(removeFavorite('missing')).toEqual([]);
  });
});
