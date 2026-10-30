# Sprint BRICK-MF2 — Minifig Bolt en pièces LDraw

Découpage de [docs/plans/minifig-ldraw.md](../plans/minifig-ldraw.md).  
Design slots / recipes : [docs/design/minifig-gproc.md](../design/minifig-gproc.md).  
Prérequis : MF1 (recipe + sandbox) · CL2–CL4 (IPC LDraw, géométrie, plastique, UV).

Objectif : **remplacer les meshes GPROC de Bolt** par les **design IDs LDraw** du catalogue, en mètres monde **sans remise à l’échelle** (taille native ~1,4 m). Même assembleur pour `minifig-lab` et l’avatar hub `city-test`. **Pas** de conversion du catalogue LEGO en GPROC.

Ordre : **MF2a → MF2b → MF2c → MF2d → MF2e → MF2f**. Chaque ticket : `pnpm test` + `pnpm check`. Aucun commit sans demande.

Branche prévue : `feature/minifig-ldraw` depuis `develop`. PR cible : `develop`.

---

## BRICK-MF2a — Catalogue `ldrawId` + BOM Bolt

Fichiers : [`types.ts`](../../src/racer/minifig/types.ts), [`catalog.ts`](../../src/racer/minifig/catalog.ts), tests catalogue.

Fait quand :

- `MinifigCatalogEntry` expose `ldrawId?` et `ldrawPair?: { left, right }` (GPROC reste optionnel / legacy).
- Entrées Bolt mappées : `3626c`, `4485`, `973`, `3819`/`3818`, `3820`, `3815`, `3817`/`3816`, `4006`.
- Test : chaque slot mesh Bolt résout un id LDraw ; ids inconnus toujours rejetés par `validateRecipe`.

## BRICK-MF2b — Cache mesh LDraw partagé

Fichiers : extraire depuis [`spawnCatalogPreview.ts`](../../src/racer/hub/brick/catalog/spawnCatalogPreview.ts) (ex. `ensureLdrawUploadedMesh`).

Fait quand :

- `ensureLdrawUploadedMesh(engine, ldrawId, triangles, edges?)` upload / cache Mesh + AABB taille.
- `spawnCatalogMeshPreview` consomme ce helper (comportement preview inchangé).
- API exportable pour le spawn minifig (pas de duplication de cache).

## BRICK-MF2c — Scale + offsets assemblage

Fichiers : nouveau helper dimensions LDraw (ex. `ldrawAssembly.ts` à côté de [`dimensions.ts`](../../src/racer/minifig/dimensions.ts)).

Fait quand :

- Aucun scale en plus du passage LDU → mètres (`S` / `P`). Pieds à y = 0.
- Table d’offsets d’assemblage LDraw (hanches à l’origine, jambes Y=12, torse Y=−32, tête et casquette Y=−56, bras dans les trous du torse, mains dans les bras à (±20.528, Y, −9.9) inclinées de 45° autour de X).
- Axes mesh `origin` : jeu = LDraw (X, −Y, −Z). La face avant regarde +Z, pas de lacet racine.
- Prints tête / torse : cadres `minifigLdrawPrintFrame` dans le repère `origin` (fût de la tête, poitrine du torse).
- Plastique : AmbientCG 017b + réglages du catalogue (`catalog_plastic`). Carte d’usure UV1 par pièce ; tête et torse imprimés lisent AO / cavité / usure dans les couleurs de sommet.
- Pivots pose (cou, épaules, hanches, poignets) conservés sur ce chemin.

## BRICK-MF2d — `spawnMinifigLdraw`

Fichiers : `src/racer/minifig/spawnMinifigLdraw.ts` (+ réemploi poses / matériaux plastique de [`assembleMinifig.ts`](../../src/racer/minifig/assembleMinifig.ts)).

Fait quand :

- Post-boot : charge les `.dat` via `ldrawPartTriangles`, upload meshes, attache hiérarchie root → pivots → parts.
- Teintes recipe appliquées (mats plastique minifig / catalogue).
- LDraw absent ou IPC fail → proxy box ou log clair, **pas de crash**.
- Plus de composant `gproc` requis pour Bolt sur ce chemin.

## BRICK-MF2e — Brancher lab + hub

Fichiers : [`minifigLabSpec.ts`](../../src/racer/levels/minifigLab/minifigLabSpec.ts), spawn hub [`cityTest`](../../src/racer/levels/cityTest/), host / SceneDirector si besoin.

Fait quand :

- `minifig-lab` : Bolt LDraw visible, orbit / pedestal OK, hauteur ~2,1 m.
- `city-test` : avatar pied = même assembleur LDraw.
- LevelSpec Bolt ne dépend plus de `MINIFIG_GPROC_GRAPHS` pour le mesh corps.
- `pnpm dev` : validé manuellement sur les deux niveaux.

## BRICK-MF2f — Tests et docs

Fait quand :

- `pnpm test`, `pnpm check` OK.
- [minifig-ldraw.md](../plans/minifig-ldraw.md) et [minifig-gproc.md](../design/minifig-gproc.md) alignés (canon mesh = LDraw).
- [docs/README.md](../README.md) + [roadmap.md](../plans/roadmap.md) listent MF2.
- Note build : prérequis `data/ldraw` (même que catalog-lab).

---

## Hors sprint

- Conversion GPROC de tout le catalogue.  
- Pré-bake GLB / build packagée sans bibliothèque LDraw.  
- Boutique P3 / panneau swap complet.  
- Véhicules ou landmarks `mesh.status: ready`.  
- Rework prints / Substance sur UV LDraw.

## Critères playtest MF2

| Boucle | Succès |
| ------ | ------ |
| Silhouette | Tête / casquette / torse / bras / jambes LDraw reconnaissables |
| Échelle | ~2,1 m, pieds au sol pedestal / hub |
| Teintes | Jaune / bleu combi / noir gants / casquette |
| Hub | Marcher en Bolt LDraw sur `city-test` |
| Lab | Orbit `minifig-lab` sans erreur console fatale |
| Catalogue-lab | Preview pièces inchangé |

## Suite

- Cache disque mesh + maps UV1 : [BRICK-CL5](BRICK-CL5.md) (accélère preload MF2 / landmarks).  
- Mondes : LDraw ready sur manuals / fontaine.  
- Véhicules : BOM / `.ldr`.  
- P3 : boutique sur recettes + swap design IDs.  
