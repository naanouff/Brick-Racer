# Sprint BRICK-DC2 — Prompts v2 + landmark.pad

Suite de [BRICK-DC1](BRICK-DC1.md) · plan [brick-decor-pipeline.md](../plans/brick-decor-pipeline.md) § DC2.  
Prompts : [brick-manual-prompt.md](../design/brick-manual-prompt.md) (v2).

Objectif : figer le **workflow Gemini** (image ortho → fiche → couches) et livrer **`landmark.pad`** entièrement via couches → brickify, visible dans brick-lab.

Ordre : **DC2a → DC2b**. Chaque ticket : `pnpm test` + `pnpm check`. Aucun commit sans demande.

Branche : `feature/brick-decor-layers` (suite DC1) → PR `develop`.

Prérequis : DC1a–d (ortho, schema, brickify, CLI).

---

## BRICK-DC2a — Prompts v2 ✅

Fichiers : [`brick-manual-prompt.md`](../design/brick-manual-prompt.md).

Fait quand :

- Prompt 0 (image ortho face / côté / dessus sur grille).
- Prompt A (fiche de cotes JSON).
- Prompt B (`.layers.json` uniquement).
- Boucles d’erreurs schema **et** fidélité visuelle (overlay).
- Bannière v1 retirée / remplacée : v2 = chemin officiel.

## BRICK-DC2b — `landmark.pad` ✅

Fichiers : [`layers/pad.layers.json`](../../src/racer/hub/brick/layers/pad.layers.json), `pnpm brick:layers` → [`manuals/pad.manual.json`](../../src/racer/hub/brick/manuals/pad.manual.json), overlay [`public/brick-refs/pad-ortho.svg`](../../public/brick-refs/pad-ortho.svg).

Fait quand :

- Dalle **8×6** studs, **2 plates** (plate + tile), jaune / noir, bordure noire.
- `validateLayers` + `brickifyLayers` + `assembleManual` OK.
- brick-lab : manuel `pad` hot-swap ; overlay SVG ; vues ortho.
- (Hors ticket) spawn `city-test` / collider pad : reste BW1d / P2.

---

## Hors de ce sprint

- Intégration collider `landmark.pad` dans `city-test` (BW1d legacy / P2).
- `landmark.gate` → **DC3**.
- API Gemini auto.
- Planche ortho photo réelle du pad (le SVG stub suffit pour la boucle outil).

## Critères playtest DC2

| Boucle | Succès |
| ------ | ------ |
| Prompts | Un designer peut suivre 0 → A → B sans lire le schema TS |
| Pad assemble | `pnpm brick:layers …/pad.layers.json` idempotent |
| brick-lab | Switch manuel pad ; silhouette 8×6 bicolore ; overlay lisible |
| Fidélité | ±1 stud vs pattern layers ; jaune intérieur, noir bordure |
| Régression | Fontaine + DC1 tests OK |

## Suite

**DC3** : qualité brick (appareillage, tiles auto, pentes) + `landmark.gate`.
