# Sprint BRICK-CL2 — Vraie géométrie LDraw dans catalog-lab

Suite de [BRICK-CL1](BRICK-CL1.md) · plan [catalog-lab.md](../plans/catalog-lab.md) § CL2.

Objectif : remplacer la boîte de preview par la **vraie forme** de la pièce, convertie **à la demande** depuis la bibliothèque LDraw locale (`data/ldraw`), rendue par **W3DTS uniquement** (`new Mesh` + `resourceManager.uploadMesh`).

Ordre : **CL2a → CL2b → CL2c**. Chaque ticket : `pnpm test` + `pnpm check`. Aucun commit sans demande.

Prérequis : CL1 ; `python scripts/catalog/fetch_sources.py` déjà lancé (bibliothèque LDraw présente localement).

> **Statut** : CL2a–c implémentés. Parseur `src/racer/hub/brick/ldraw/ldrawGeometry.ts` (+ `tests/ldrawGeometry.test.ts`), IPC `ldraw-part-triangles` (`src/main/ldrawMain.ts`, plafond 60k tri), preview `spawnCatalogMeshPreview` (mesh mis en cache par pièce) + bascule Mesh/Boîte et ligne de statut dans le panneau. Vérifié sur la bibliothèque réelle : 3001 → 700 tri, 0,66 × 0,385 × 1,32 m, < 10 ms.
>
> **Normales** : LDraw n'en fournit pas. Sommets soudés (0,01 LDU), normales lissées par groupe de lissage (moyenne pondérée par l'angle, indépendante du sens des faces faute de BFC). Arêtes dures conservées : lignes de type 2 de la pièce, ou pli > `LDRAW_CREASE_DEG` (50°) quand l'auteur n'a pas tracé de ligne.

---

## BRICK-CL2a — Parseur LDraw → triangles (pur)

Fichiers : `src/racer/hub/brick/ldraw/ldrawGeometry.ts`, tests.

Fait quand :

- Lignes type 3 / 4 → triangles ; type 1 → sous-fichier avec matrice (même convention que le pipeline Python) ; types 2 / 5 ignorés.
- Cache par fichier (primitives `stud.dat` réutilisées) ; garde anti-cycle + profondeur max.
- Lecteur de fichiers injecté (testable sans disque).
- Conversion repère jeu : Y LDraw vers le haut, X/Z permutés (convention BC1 grand côté sur Z), échelle grille `S/20` horizontal et `P/8` vertical, pièce posée au sol et centrée.
- Double face (pas de gestion BFC) ; normales plates.

## BRICK-CL2b — IPC Electron (dev)

Fichiers : `src/main/ldrawMain.ts`, `src/main/index.ts`, `src/preload/index.ts`, `brickRacer.d.ts`.

Fait quand :

- Canal `ldraw-part-triangles(ldrawId)` : lit `data/ldraw/ldraw/{parts,p}/…`, renvoie les triangles en LDU.
- Erreurs lisibles : bibliothèque absente, pièce introuvable, pièce trop lourde (plafond triangles).
- Hors Electron / build packagée sans `data/` : fallback boîte, pas de crash.

## BRICK-CL2c — Preview mesh dans catalog-lab

Fichiers : `spawnCatalogPreview.ts`, `SceneDirector.ts`, `startBrickRacerHost.ts`, `CatalogBrowserPanel.tsx`.

Fait quand :

- Sélection → requête mesh ; réponse obsolète ignorée si l’utilisateur a déjà cliqué ailleurs.
- Mesh mis en cache par pièce (W3DTS n’expose pas de libération de mesh).
- Bascule **Mesh / Boîte** dans le panneau (la boîte reste utile pour vérifier le footprint BC1).
- Statut affiché : `mesh LDraw · N tri` ou raison du fallback.

---

## Hors sprint

- Couleurs LDraw par face, transparence, logos de studs.
- BFC / backface culling correct (on rend double face).
- Matériaux plastique AmbientCG + sélecteur de couleur diffuse → **[BRICK-CL3](BRICK-CL3.md)**.
- Utilisation des meshes LDraw dans les manuels / niveaux (`mesh.status: ready`).
- Export préalable des 33k meshes / build packagée.

## Critères playtest CL2

| Boucle | Succès |
| ------ | ------ |
| Brique | `3001` : brique 2×4 avec 8 studs visibles |
| Courbes | `85080` macaroni, `3960` dish : formes rondes reconnaissables |
| Orientation | Grand côté sur Z, pièce posée sur le sol, pas à l’envers |
| Fallback | Sans bibliothèque LDraw : boîte + message, pas d’erreur bloquante |
| Moteur | W3DTS uniquement |
