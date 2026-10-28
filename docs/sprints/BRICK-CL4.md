# Sprint BRICK-CL4 — UV LDraw homogènes (UV0 plastique + UV1 pièce)

Suite de [BRICK-CL3](BRICK-CL3.md) · plan [catalog-lab.md](../plans/catalog-lab.md) § CL4.

Objectif : remplacer la projection planaire `gx/gy` par **deux canaux UV**. UV0 = plastique répétable à densité constante. UV1 = développé de la pièce dans `[0,1]`, pour les effets géométriques (AO, cavité, usure). Les **coutures suivent les arêtes dures**. Rendu **W3DTS uniquement**.

Ordre : **CL4a → CL4b → CL4c**. Chaque ticket : `pnpm test` + `pnpm check`. Aucun commit sans demande.

Prérequis : CL2/CL3 (`buildLdrawPreviewGeometry`, hard edges type 2 + `LDRAW_CREASE_DEG`, grille UV du panneau). Réutiliser la projection box de [`unwrapPart.ts`](../../src/racer/minifig/unwrapPart.ts) (`dominantAxis`, `projectAxis`, `MINIFIG_UV_METERS_PER_CELL` = 10 cm).

> **Statut** : CL4a–c implémentés dans `buildLdrawPreviewGeometry`. Charts coupés sur arête dure ou changement d’axe. UV0 = projection box (1 unité = 10 cm), tangentes alignées. UV1 = atlas `[0,1]` (marge 2 %). La grille du panneau lit UV0. Couleur de sommet bakée (R cavité, G convexité, B AO, A hauteur) ; le plastique catalogue réactive AO / cavité / usure d’arête, et laisse grain / taches procédurales à 0.

---

## BRICK-CL4a — Charts + UV0

Fichiers : [`ldrawGeometry.ts`](../../src/racer/hub/brick/ldraw/ldrawGeometry.ts).

Fait quand :

- Un chart = triangles connexes par une arête **lisse** et de **même axe** dominant (±X/±Y/±Z, normale de face).
- Une arête dure (ligne type 2 ou pli > `LDRAW_CREASE_DEG`) coupe toujours le chart.
- UV0 = projection ortho de la position jeu, échelle `1 / 0.1`. Pas de couture à l’intérieur du chart.
- Sommets dupliqués seulement sur ces frontières (plus une UV par groupe de lissage qui mélange deux axes).
- Tangente et bitangente alignées sur U/V de la projection.
- Une face horizontale a U **et** V qui varient. Une arête de 10 cm mesure 1 unité UV, quel que soit l’axe.

## BRICK-CL4b — UV1 atlas 0–1

Fichiers : le même `buildLdrawPreviewGeometry` (offsets UV1 = 5–6 du stride 20).

Fait quand :

- Mêmes charts que CL4a.
- UV locale = projection box ramenée au min du chart, puis pack étage (padding ~2 %) et scale dans `[0,1]²`.
- Charts disjoints dans l’atlas (les joints tombent sur les arêtes dures).
- Chaque copie de sommet porte l’UV1 de son chart.

## BRICK-CL4c — Tests

Fichiers : [`tests/ldrawGeometry.test.ts`](../../tests/ldrawGeometry.test.ts).

Fait quand :

- Face normale Y : U et V varient.
- Deux arêtes monde de même longueur, axes différents : même longueur UV0.
- Deux triangles coplanaires séparés par une arête dure : UV0 discontinues. Deux triangles lisses de même axe : UV0 continues.
- Tous les UV1 ∈ `[0,1]` ; AABB des charts disjointes.
- Taille et pose jeu inchangées (ground, centrage XZ, normales).
- `pnpm test` + `pnpm check`.

La grille du panneau prévisualise UV0 (shader `GetUV`). Pas de nouveau bouton.

---

## Hors sprint

- Bake AO, taches, usure d’arêtes (lira UV1, vertex color / MeshMaps).
- Sample shader du second canal si `GetUV` n’a pas de set.
- xatlas ou autre librairie de dépliage.
- UV du `bo_cube`.

## Critères playtest CL4

| Boucle | Succès |
| ------ | ------ |
| Dessus | Casque / plaque : la grille n’est plus en bandes sur les faces horizontales |
| Densité | Une cellule de grille a la même taille sur un côté et sur le dessus |
| Coutures | Sauts de grille dans les plis et les tenons, pas au milieu d’une face plane |
| Plastique | Sets `003` / `017b` : grain homogène, plus de taches dues à l’écrasement UV |
| Moteur | W3DTS uniquement |
