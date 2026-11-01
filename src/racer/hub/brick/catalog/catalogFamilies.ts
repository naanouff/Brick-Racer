/**
 * @file catalogFamilies.ts
 * @description Rebrickable category → family labels for catalog-lab filters (ED1).
 */

export type CatalogFamilyId =
  | 'bricks'
  | 'plates'
  | 'tiles'
  | 'rounds'
  | 'slopes'
  | 'arches'
  | 'brackets'
  | 'technic'
  | 'plant'
  | 'light'
  | 'minifig'
  | 'other';

export type CatalogCategoryDef = {
  id: string;
  name: string;
  family: CatalogFamilyId;
};

export type CatalogFamilyDef = {
  id: CatalogFamilyId;
  name: string;
};

export type CatalogCategoriesFile = {
  version: number;
  families: CatalogFamilyDef[];
  categories: CatalogCategoryDef[];
  familyByCategoryId: Record<string, CatalogFamilyId>;
};

const CATEGORIES_URL = '/catalog/categories.json';

let cached: CatalogCategoriesFile | null = null;

export async function loadCatalogCategories(
  url = CATEGORIES_URL,
  force = false
): Promise<CatalogCategoriesFile> {
  if (cached && !force) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`categories HTTP ${res.status}`);
  const data = (await res.json()) as CatalogCategoriesFile;
  if (!Array.isArray(data.categories) || !Array.isArray(data.families)) {
    throw new Error('categories: missing categories[] / families[]');
  }
  cached = data;
  return data;
}

export function clearCatalogCategoriesCache(): void {
  cached = null;
}

export function familyForCategoryId(
  file: CatalogCategoriesFile,
  categoryId: string
): CatalogFamilyId {
  return file.familyByCategoryId[categoryId] ?? 'other';
}

export function categoryName(
  file: CatalogCategoriesFile,
  categoryId: string
): string {
  const hit = file.categories.find((c) => c.id === categoryId);
  return hit?.name ?? `cat ${categoryId}`;
}

/** Exhaustive list of Rebrickable ids covered by the static family map (tests). */
export const FAMILY_MAP_CATEGORY_IDS: readonly string[] = [
  '3',
  '5',
  '6',
  '8',
  '9',
  '11',
  '12',
  '13',
  '14',
  '15',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '25',
  '26',
  '27',
  '28',
  '33',
  '34',
  '37',
  '38',
  '40',
  '45',
  '46',
  '49',
  '51',
  '52',
  '53',
  '54',
  '55',
  '59',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '67',
  '69',
  '70',
  '71',
  '72',
  '73',
  '74',
  '75',
  '76',
];
