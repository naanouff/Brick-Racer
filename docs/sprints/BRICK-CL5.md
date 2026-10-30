# Sprint BRICK-CL5 — Cache disque LDraw (UV0/UV1 + maps géométriques)

Suite de [BRICK-CL4](BRICK-CL4.md) · plan [catalog-lab.md](../plans/catalog-lab.md) § CL5.  
Consommateurs : [BRICK-MF2](BRICK-MF2.md) (minifig), landmarks LDraw (`spawnLandmarkLdraw`, fontaine), preview catalog-lab.

Objectif : **cuire une seule fois** par pièce et par ancrage le maillage final (UV0/UV1, normales/tangentes, vertex colors) et l’atlas UV1 256² (cavité, arête, AO, hauteur), le **persister sur disque** côté main process, puis ne plus faire qu’**uploader** dans le renderer. Cuisson hors thread UI (`worker_threads`).

Ordre : **CL5a → CL5b → CL5c → CL5d**. Chaque ticket : `pnpm test` + `pnpm check`. Aucun commit sans demande.

Prérequis : CL2–CL4 (`ldrawPartTriangles`, `buildLdrawPreviewGeometry`, `bakeLdrawAgingTexture`, `ensureLdrawUploadedMesh`) ; bibliothèque locale `data/ldraw` (`python scripts/catalog/fetch_sources.py`).

---

## BRICK-CL5a — Module de cuisson + format binaire

Fichiers : nouveau [`ldrawBakedMesh.ts`](../../src/racer/hub/brick/ldraw/ldrawBakedMesh.ts) ; constante `LDRAW_BAKE_VERSION` (géométrie / bake).

Fait quand :

- Type `LdrawBakedMesh` : `{ vertices, indices, triangleCount, size, aging, coverage }`.
- `bakeLdrawMesh(triangles, edges, anchor)` enchaîne `buildLdrawPreviewGeometry` + `bakeLdrawAgingTexture` (logique sortie de `ensureLdrawUploadedMesh`).
- `encodeLdrawBakedMesh` / `decodeLdrawBakedMesh` : magic `LDRC`, version, `LDRAW_AGING_SIZE`, `LDRAW_CREASE_DEG`, hash SHA-1 des triangles + arêtes LDU, puis blocs alignés 4 octets.
- Decode rejette un en-tête incompatible (version, taille d’atlas, hash).
- Tests unitaires encode ↔ decode octet pour octet ; rejet mauvaise version / hash.

## BRICK-CL5b — Cache disque + worker (main)

Fichiers : [`ldrawBakeCache.ts`](../../src/main/ldrawBakeCache.ts), [`ldrawBakeWorker.ts`](../../src/main/ldrawBakeWorker.ts), branchement electron-vite si besoin ; [`.gitignore`](../../.gitignore) → `data/ldraw-cache/`.

Fait quand :

- `ldrawPartMesh(id, anchor)` : triangles/arêtes via `LdrawGeometryCache` existant → hash → lit `data/ldraw-cache/{anchor}/{id}.bin` si valide, sinon worker → écriture atomique (`.tmp` puis rename).
- Worker exécute `bakeLdrawMesh` et renvoie des buffers transferables (main non bloqué).
- Déduplication des requêtes concurrentes sur la même clé (`Map<string, Promise>`).
- Ancres : `ground-center` | `origin`.

## BRICK-CL5c — IPC + renderer

Fichiers : [`main/index.ts`](../../src/main/index.ts), [`preload/index.ts`](../../src/preload/index.ts), [`brickRacer.d.ts`](../../src/renderer/brickRacer.d.ts), [`ldrawMeshCache.ts`](../../src/racer/hub/brick/catalog/ldrawMeshCache.ts), appelants minifig / landmark / fontaine / catalog preview + [`CatalogBrowserPanel.tsx`](../../src/renderer/catalog/CatalogBrowserPanel.tsx).

Fait quand :

- Canal `ldraw-part-mesh(ldrawId, anchor)` exposé ; `ldrawPartTriangles` conservé (tests / debug).
- `ensureLdrawUploadedMesh` accepte un mesh déjà cuit (upload + cache mémoire) ; repli local triangles si IPC absente.
- Appelants migrés vers `ldrawPartMesh` ; préchargements en `Promise.all` (plus de `for … await` séquentiel).
- Preview catalog-lab, minifig-lab, landmarks : comportement visuel inchangé, chargement accéléré au 2ᵉ hit.

## BRICK-CL5d — Préchauffage, tests cache, docs

Fichiers : script `pnpm ldraw:bake` (tsx), [`tests/ldrawBakeCache.test.ts`](../../tests/ldrawBakeCache.test.ts) (ou extension de `ldrawGeometry.test.ts`), [build.md](../build.md), ce sprint + plan § CL5.

Fait quand :

- Script cuit les ids des recettes minifig + landmarks / fontaine référencés (premier lancement instantané possible).
- Test dossier temporaire : 1ᵉʳ appel écrit ; 2ᵉ lit sans re-cuisson (spy) ; invalidation version / hash.
- `pnpm test` + `pnpm check`.
- Note build : emplacement cache, purge (`data/ldraw-cache/`), règle d’incrément de `LDRAW_BAKE_VERSION`.

---

## Hors sprint

- Pré-bake des ~33k pièces du master / distribution packagée du cache.
- Compression zlib du `.bin`.
- Remplacement de `ldrawPartTriangles` (debug OK).
- Changement d’algo UV / bake (seulement incrémenter `LDRAW_BAKE_VERSION` si besoin).

## Critères playtest CL5

| Boucle | Succès |
| ------ | ------ |
| Miss | Première preview `3001` : mesh + usure OK ; fichier créé sous `data/ldraw-cache/ground-center/3001.bin` |
| Hit | Reload / re-sélection : même rendu, chargement nettement plus court (pas de re-bake AO) |
| Ancres | Minifig (`origin`) et catalog (`ground-center`) : deux bins distincts, poses correctes |
| Parallel | Fontaine / landmark multi-pièces : chargement concurrent sans freeze UI |
| Invalidation | Bump `LDRAW_BAKE_VERSION` → re-cuisson automatique |
| Moteur | W3DTS uniquement ; pas de commit de `data/ldraw-cache/` |

## Suite

MF2 / landmarks restent les consommateurs. Une éventuelle CL6 = compression, prewarm CI, ou export packagé.
