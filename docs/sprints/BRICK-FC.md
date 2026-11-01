# Sprint BRICK-FC — Façades garage / vinyle / mairie

Découpage de [docs/plans/brick-lab-facades.md](../plans/brick-lab-facades.md).  
Refs : [brick-manual-prompt.md](../design/brick-manual-prompt.md) · overlays Prompt 0.  
Suite de [BRICK-LT](BRICK-LT.md).

Objectif : trois landmarks city-test en manuels brick, playtestables sous overlay.

Ordre : **FC1 → FC2 → FC3 → FC4**. Chaque ticket : `pnpm test` + `pnpm check`. Aucun commit sans demande.

Branche : `feature/brick-decor-layers` (courante). PR cible : `develop`.

---

## BRICK-FC1 — Garage shell (couches) ✅

Fichiers : `layers/garage.layers.json` → `manuals/garage.manual.json`, `scripts/brick/gen-garage-layers.mjs`, checklist / plan.

Fait quand :

- Volume **24×24**, H **42P** ; murs terracotta ; toit / parapet `dark_gray`.
- Façade ouverture porte ~**8S × 20P** ; linteau / cadre jaune approximatif.
- Bandeaux gris horizontaux (face + côtés) présents.
- Overlay garage : silhouette ±1 stud en Face / Dessus.
- `pnpm brick:layers src/racer/hub/brick/layers/garage.layers.json`.

## BRICK-FC2 — Garage détails ✅

Fait quand :

- Enseigne zone blanche (« ON JUGERA TON BUILD » = tuiles ; lettres = note / print plus tard).
- Taches huile / plinthes `dark_gray` en bas de mur.
- Playtest FPS / `dc` notés ; manuel enregistré.

Regen : `node scripts/brick/gen-garage-layers.mjs` → `pnpm brick:layers …/garage.layers.json`.

## BRICK-FC3 — Vinyle ✅

Fait quand :

- **18×18 × 36P** ; façade vitrine (transparent/cyan si dispo) + volet noir ; enseigne rouge.
- Overlay vinyle ±1 stud.

Fichiers : `scripts/brick/gen-vinyle-layers.mjs` → `layers/vinyle.layers.json` → `manuals/vinyle.manual.json`.

## BRICK-FC4 — Mairie + docs ✅

Fait quand :

- Socle **24×12 × 24P** sable / blanc ; plaque « MAIRIE ».
- Statue cassée (jaune / noir / rouge) posée éditeur ou MCP.
- Checklist + indexes à jour ; `pnpm test` + `pnpm check`.

Fichiers : `scripts/brick/gen-mairie-layers.mjs` → `layers/mairie.layers.json` → `manuals/mairie.manual.json`.

---

## Hors de ce sprint

- Billboard / tower polish.
- Print textures enseignes.
- Macros MCP wall/box → [BRICK-BA](BRICK-BA.md).
- Retune AABB city-test.

## Critères playtest FC

| Boucle | Succès |
| ------ | ------ |
| Garage shell | Porte et emprise vs overlay |
| Garage détails | Enseigne + plinthes lisibles |
| Vinyle | Vitrine / volet / enseigne |
| Mairie | Socle + statue tête manquante |
| Régression | pad / gate / fountain / brick-lab OK |

## Suite

Spawn mesh landmarks sur `city-test` (remplacer boîtes blockout) — sprint ultérieur.
