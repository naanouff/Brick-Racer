# Sprint BRICK-DC3 — Qualité brick + landmark.gate

Suite de [BRICK-DC2](BRICK-DC2.md) · plan [brick-decor-pipeline.md](../plans/brick-decor-pipeline.md) § DC3.

Objectif : appareillage / tiles / pentes dans `brickifyLayers`, preuve **`landmark.gate`** (arche coquillage stub) dans brick-lab.

Ordre : **DC3a → DC3b**. `pnpm test` + `pnpm check`. Aucun commit sans demande.

Branche : `feature/brick-decor-layers`.

---

## BRICK-DC3a — Qualité brickify ✅

Fichiers : [`layersSchema.ts`](../../src/racer/hub/brick/manual/layersSchema.ts), [`brickifyLayers.ts`](../../src/racer/hub/brick/manual/brickifyLayers.ts), tests.

Fait quand :

- `options.runningBond` (défaut true) : cours de briques impairs amorcés en 1×1.
- `options.capTiles` : couche tile sur les cellules du sommet.
- Modificateurs `/` et `\` → slope `3040` (`options.slopeColor`, défaut `sand`).
- Tests unitaires bond / cap / slopes.

## BRICK-DC3b — `landmark.gate` ✅

Fichiers : [`layers/gate.layers.json`](../../src/racer/hub/brick/layers/gate.layers.json), `pnpm brick:layers` → [`manuals/gate.manual.json`](../../src/racer/hub/brick/manuals/gate.manual.json).

Fait quand :

- Silhouette piliers + linteau + pentes (10×4 stub terracotta / sand).
- Assemble sans overlap ; visible brick-lab hot-swap.
- (Hors ticket) spawn `city-test` / chaînes / collider.

---

## Hors sprint

- Chaînes / panneau « Sécurité » détaillés.
- DC4 assembly multi-modules.
- Intégration city-test.

## Suite

**DC4** : `*.assembly.json` + façades / tour.
