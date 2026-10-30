# Plan : minifig Bolt en pièces LDraw

Sprint : [BRICK-MF2](../sprints/BRICK-MF2.md).  
Design (slots / recipes) : [../design/minifig-gproc.md](../design/minifig-gproc.md).  
Prérequis : [catalog-lab.md](catalog-lab.md) · CL2–CL5 (`ldrawPartTriangles` / `ldrawPartMesh`, géométrie, plastique, [cache disque](../sprints/BRICK-CL5.md)).  
Fondation recipe / sandbox : [minifig-gproc.md](minifig-gproc.md) · [BRICK-MF1](../sprints/BRICK-MF1.md).

## Problème

MF1 a livré Bolt via **generators GPROC** (approximations brick-like).  
Le catalogue master Rebrickable×LDraw + preview `catalog-lab` donnent maintenant les **vraies géométries** minifig (`3626c`, `973`, `3815`, …). Rester en GPROC pour le corps = double pipeline et silhouette non canon catalogue.

## Décisions

| Choix | Décision |
| ----- | -------- |
| Source mesh | **LDraw direct** (IPC + cache, comme catalog-lab) |
| Conversion catalogue → GPROC | **Non** — trop cher, fidélité moindre ; GPROC reste kart / formes custom |
| Unités monde | **Mètres** via `S`/`P` uniquement. **Aucun** scale supplémentaire : la minifig reste à la taille LDraw (~1,4 m), pas à `MINIFIG_TOTAL_HEIGHT` (2,1 m) |
| Périmètre | Bolt dans `minifig-lab` **et** avatar hub `city-test` (même assembleur) |
| Prints face/torse | v1 : teintes + WebP existants si UV frame OK ; pas de rework atlas |
| Packaging | `data/ldraw` local / Electron (comme CL) — pas de pré-bake GLB packagé dans MF2 |

```mermaid
flowchart LR
  recipe[MinifigRecipe_Bolt]
  catalog[PART_CATALOG_ldrawId]
  ipc["ldrawPartMesh CL5"]
  cache[ldraw-cache bin]
  upload[ensureLdrawUploadedMesh]
  spawn[spawnMinifigLdraw]
  recipe --> catalog
  catalog --> ipc
  ipc --> cache
  cache --> upload
  upload --> spawn
```

## BOM Bolt (LDraw local)

| Slot | Design ID | Notes |
| ---- | --------- | ----- |
| head | `3626c` | |
| hat | `4485` | casquette |
| torso | `973` | |
| arms L/R | `3819` / `3818` | |
| hands | `3820` | |
| hips | `3815` | |
| legs L/R | `3817` / `3816` | |
| accessoryR | `4006` | clé |

Teintes recipe C01 inchangées.

## Approche

1. Étendre `MinifigCatalogEntry` : `ldrawId?` / `ldrawPair?` (GPROC = fallback legacy).
2. Mapper le BOM dans [`catalog.ts`](../../src/racer/minifig/catalog.ts).
3. Factoriser `ensureLdrawUploadedMesh` depuis [`spawnCatalogPreview.ts`](../../src/racer/hub/brick/catalog/spawnCatalogPreview.ts).
4. `spawnMinifigLdraw` : hiérarchie pivots (poses MF1) + meshes LDraw post-boot, plus `gproc` pour Bolt.
5. `MINIFIG_LDRAW_SCALE` = `MINIFIG_TOTAL_HEIGHT / heightMeters(assembled)` — constante figée + test.
6. Offsets d’assemblage LDraw × scale (remplacent les cotes GPROC sur ce chemin).
7. Brancher `minifig-lab` + hub `city-test`.
8. Tests + note design (canon mesh = LDraw).

## Hors scope

- Conversion GPROC de tout le catalogue LEGO  
- Pré-bake / ship sans `data/ldraw`  
- Boutique P3 / UI swap complète  
- Véhicules ou mondes LDraw (sprints suivants)  
- Prints Substance haute fidélité sur UV LDraw  

## Critères de succès

| Boucle | Succès |
| ------ | ------ |
| Lab | `minifig-lab` : Bolt = pièces LDraw, hauteur ~2,1 m, orbit OK |
| Hub | `city-test` : même silhouette / teintes à pied |
| Catalogue | design IDs BOM résolus ; IPC absent → proxy / message, pas de crash |
| Perf | pas de regen GPROC minifig pour Bolt |
| Moteur | W3DTS uniquement |
| Régression | `catalog-lab`, brick-lab, race-test inchangés |

## Suite

- Mondes : `mesh.status: ready` landmarks (fontaine)  
- Véhicules : manuals / `.ldr` kart  
- P3 : boutique sur recettes + catalogue LDraw swappable  
