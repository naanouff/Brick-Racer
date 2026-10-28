# Sprint BRICK-CL3 — Plastique AmbientCG + couleur diffuse (catalog-lab)

Suite de [BRICK-CL2](BRICK-CL2.md) · plan [catalog-lab.md](../plans/catalog-lab.md) § CL3.

Objectif : sur le preview catalogue, appliquer les **matériaux plastique AmbientCG** déjà fournis (`003` / `017b` : normal + roughness) **sans** leur texture de diffuse, et permettre de **choisir la couleur diffuse** (catalogue BC1). Rendu **W3DTS uniquement**.

Ordre : **CL3a → CL3b → CL3c → CL3d**. Chaque ticket : `pnpm test` + `pnpm check`. Aucun commit sans demande.

Prérequis : CL2 (mesh LDraw + panneau) ; assets `/minifig/plastic/plastic{003,017b}-{surface,normal}.webp` ; shader `MinifigPlasticPBR`.

> **Statut** : CL3a–d implémentés. Mats `CL_plastic_{set}_{color}` ([`catalogPlasticMaterials.ts`](../../src/racer/hub/brick/catalog/catalogPlasticMaterials.ts)), shader plastic dans `catalog-lab`, preview branchée `colorId` + `plasticSet`, panneau swatches BC1 + toggle 003/017b/Off, UV planaires LDraw (`gx/gy * 10`). Aucune map `*-color.webp`. Bruit procédural ABS / usure MeshMaps coupés sur les mats catalogue (LDraw n’a pas de bake) → seul AmbientCG (surface + normal) + teinte BC1.

---

## BRICK-CL3a — Matériaux `CL_plastic_*` + niveau

Fichiers : `src/racer/hub/brick/catalog/catalogPlasticMaterials.ts` (+ export), [`catalogLabSpec.ts`](../../src/racer/levels/catalogLab/catalogLabSpec.ts), textures / shader comme minifig-lab.

Fait quand :

- Helper : pour chaque `BrickColorId` × set (`off` | `003` | `017b`), un `MaterialSpec` via `minifigPlasticMaterial({ tintRgb })` ; si set ≠ `off`, maps AmbientCG (surface + normal) **sans** `*-color.webp`.
- Id stable : `CL_plastic_{set}_{colorId}` ; API `catalogPlasticMaterialId(set, colorId)`.
- `catalog-lab` charge le shader `minifig_plastic`, les textures white / flat normal / surface+normal des deux sets, et enregistre tous les mats `CL_plastic_*` (garde `brickCatalogMaterials()` en fallback).
- Test : `usePlasticMaps` 0/1 selon le set ; `baseColor` = rgb `colors.json` ; aucune référence aux `plastic*-color.webp`.

## BRICK-CL3b — Preview branchée couleur + set

Fichiers : [`spawnCatalogPreview.ts`](../../src/racer/hub/brick/catalog/spawnCatalogPreview.ts), types host / SceneDirector si besoin.

Fait quand :

- `CatalogPreviewOpts` / `CatalogMeshPreviewOpts` acceptent `plasticSet?: 'off' | '003' | '017b'` (défaut `003`) en plus de `colorId`.
- Spawn résout `catalogPlasticMaterialId` ; si le mat est absent → fallback `BRICK_{color}`.
- Changer couleur ou set remplace la preview (même entité / même flux clear+spawn).

## BRICK-CL3c — Panneau : couleur + set plastique

Fichiers : [`CatalogBrowserPanel.tsx`](../../src/renderer/catalog/CatalogBrowserPanel.tsx), styles `app.css` si besoin.

Fait quand :

- State `colorId` (défaut `gray`) + `plasticSet` (défaut `003`).
- UI : sélecteur de couleurs BC1 + toggle **003 / 017b / Off** (à côté de Mesh / Boîte).
- Les deux passent aux previews box et mesh ; changement → re-preview de la sélection (token stale déjà en place).
- Plus de `colorId: 'gray'` en dur.

## BRICK-CL3d — UV LDraw pour le shader plastic

Fichiers : [`ldrawGeometry.ts`](../../src/racer/hub/brick/ldraw/ldrawGeometry.ts), `tests/ldrawGeometry.test.ts`.

Fait quand :

- `buildLdrawPreviewGeometry` écrit UV0 depuis la position jeu (`u = gx * 10`, `v = gy * 10`, convention minifig « 1 unité = 10 cm »).
- Test : au moins un sommet a des UV non nuls ; axes / taille inchangés.
- Sur playtest : grain / normal lisibles sur mesh LDraw (pas un aplats UV=0).

---

## Hors sprint

- `spawnBrickLandmark` / manuels / `mesh.status: ready`.
- Albedo depuis `plastic*-color.webp`.
- Mutation runtime des propriétés matériau W3DTS (combos pré-enregistrés).
- Contenu LDraw pour minifigs / véhicules / mondes (plan ultérieur).
- UV homogènes (box + atlas, coutures sur arêtes dures) → **[BRICK-CL4](BRICK-CL4.md)**. La projection `gx/gy` de CL3d est provisoire.

## Critères playtest CL3

| Boucle | Succès |
| ------ | ------ |
| Plastique | `3001` + set `003` : surface grainée, pas facetée « plastique plat » |
| Sans diffuse map | Albedo = couleur BC1 choisie ; pas le look de `plastic003-color.webp` |
| Couleur | Passer `gray` → `cyan` / `yellow` recolorie immédiatement |
| Off | Set `Off` : teinte ABS sans maps AmbientCG |
| Boîte | Proxy `bo_cube` reçoit le même matériau (UV cube déjà OK) |
| Moteur | W3DTS uniquement |
