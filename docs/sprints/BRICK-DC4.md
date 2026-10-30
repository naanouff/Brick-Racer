# Sprint BRICK-DC4 — Assembly multi-modules + checklist

Suite de [BRICK-DC3](BRICK-DC3.md) · plan [brick-decor-pipeline.md](../plans/brick-decor-pipeline.md) § DC4.  
Checklist : [brick-decor-checklist.md](../design/brick-decor-checklist.md).

Objectif : composer plusieurs `.layers.json` via `*.assembly.json` (offsets stud/plate) et figer la checklist de prod. Preuve = **`landmark.tower`**.

Ordre : **DC4a → DC4b**. `pnpm test` + `pnpm check`. Aucun commit sans demande.

Branche : `feature/brick-decor-layers`.

---

## BRICK-DC4a — Schema + brickifyAssembly ✅

Fichiers : [`assemblySchema.ts`](../../src/racer/hub/brick/manual/assemblySchema.ts), [`brickifyAssembly.ts`](../../src/racer/hub/brick/manual/brickifyAssembly.ts), [`tests/brickAssembly.test.ts`](../../tests/brickAssembly.test.ts).

Fait quand :

- `modules[{ file, offset?, id? }]` validés.
- `brickifyAssembly(raw, loadLayers)` → un `BrickManual` (steps préfixés, partsList fusionnée, envelope recalculée).
- Tests merge + erreur fichier manquant.

## BRICK-DC4b — CLI + tower + checklist ✅

Fichiers : [`layers-to-manual.mjs`](../../scripts/brick/layers-to-manual.mjs) (accepte `.assembly.json`), [`tower.assembly.json`](../../src/racer/hub/brick/layers/tower.assembly.json) + `tower-base` / `tower-shaft`, [`brick-decor-checklist.md`](../design/brick-decor-checklist.md).

Fait quand :

- `pnpm brick:layers …/tower.assembly.json` → `manuals/tower.manual.json`.
- brick-lab : manuel `tower` hot-swap.
- Checklist prod documentée (ortho → couches → brickify → lab → city).

---

## Hors sprint

- Façades garage / vinyle / mairie (contenu ; même outil).
- Spawn `city-test` pour tower / gate / pad.
- API Gemini.

## Suite

Production landmarks city (checklist) ; P2 hub. Pipeline authoring DC clos.
