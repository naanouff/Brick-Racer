# Sprint BRICK-DC1 — Mesure fidélité + brickify couches

Découpage de [docs/plans/brick-decor-pipeline.md](../plans/brick-decor-pipeline.md) (DC0 + DC1).  
Runtime inchangé : [brick-world-rendering.md](../plans/brick-world-rendering.md) · [BRICK-BW1](BRICK-BW1.md).  
Prompt v1 (à ne plus étendre) : [brick-manual-prompt.md](../design/brick-manual-prompt.md).  
Réf. preuve : [ref-fountain-ortho.png](../design/art/ref-fountain-ortho.png).

Objectif : pouvoir **mesurer** la fidélité dans `brick-lab`, puis produire un manuel depuis des **couches ASCII** via un brickify déterministe. Preuve = fontaine refaite en couches, comparable en ortho.

Ordre : **DC1a → DC1b → DC1c → DC1d**. Chaque ticket : `pnpm test` + `pnpm check`. Aucun commit sans demande.

Branche prévue : `feature/brick-decor-layers` depuis `develop`. PR cible : `develop`.

Prérequis : BW1b–c (pipeline manuel + `brick-lab`) ; catalogue BC1 (`parts.json` / `colors.json`).

---

## BRICK-DC1a — Ortho + overlay + registre (DC0)

Fichiers : [`spawnBrickLab.ts`](../../src/racer/levels/brickLab/spawnBrickLab.ts), HUD / tiroir Atelier brick-lab, [`registry.ts`](../../src/racer/hub/brick/manuals/registry.ts), note corpus dans le plan ou `docs/design/art/`.

Fait quand :

- Caméra brick-lab : presets **Face / Côté / Dessus** (ortho), en plus de l’orbit.
- Overlay semi-transparent de l’image de référence (chemin par manuel ou stub fontaine) dans le tiroir / HUD lab — opacité réglable.
- Registre manuels : `import.meta.glob('./*.manual.json')` (plus de `switch` + `BrickManualId` figé) ; hot-swap découvre tout nouveau fichier.
- Corpus documenté : fontaine, pad, gate — critères « fidèle » = silhouette, proportions ±1 stud, couleurs.

## BRICK-DC1b — Schema couches

Fichiers : nouveau [`layersSchema.ts`](../../src/racer/hub/brick/manual/layersSchema.ts), exports [`manual/index.ts`](../../src/racer/hub/brick/manual/index.ts), tests.

Fait quand :

- Types `BrickLayers` : `id`, `footprint [sx,sz]`, `legend`, `layers[{ kind, rows }]`, `ops?` (ops `brick` du schema manuel existant).
- `kind` ∈ `{ plate, brick, tile }` ; `.` = vide ; légende → ids `colors.json`.
- `validateLayers` : rangées même longueur = `footprint[0]` ; count = `footprint[1]` ; lettres inconnues / couleurs hors catalogue = issues path+message (même style que `validateManual`).
- Tests unitaires : OK, longueur mismatch, légende invalide, kind inconnu.

## BRICK-DC1c — brickify déterministe

Fichiers : nouveau [`brickifyLayers.ts`](../../src/racer/hub/brick/manual/brickifyLayers.ts), [`tests/brickLayers.test.ts`](../../tests/brickLayers.test.ts).

Fait quand :

- `brickifyLayers(layers)` → `BrickManual` : origin / envelope dérivés ; une step par couche (ou groupe) ; ops `brick` uniquement pour le remplissage.
- Remplissage glouton par couleur : rectangles du plus grand au plus petit parmi les briques / plates / tiles catalogue utiles (ex. `3001` 2×4, `3003` 2×2, `3004` 1×2, `3005` 1×1, `3020` plate, `3068` tile, `6141` plate 1×1 — ids exacts lus depuis `parts.json`).
- Empilement Y : `plate`/`tile` = +1P, `brick` = +3P ; origine centrée sur footprint.
- Append des `ops` libres après les couches (pièces spéciales hors grille).
- Déterministe : même entrée → même JSON (ordre de placement stable).
- Tests : couches → manuel → `assembleManual` sans overlap ; compte de pièces stable ; envelope contient tout.

## BRICK-DC1d — CLI + fontaine couches

Fichiers : `scripts/brick/layers-to-manual.ts` (ou `.mjs`), `package.json` script `brick:layers`, `src/racer/hub/brick/layers/fountain.layers.json`, régénération [`fountain.manual.json`](../../src/racer/hub/brick/manuals/fountain.manual.json), exports index si besoin.

Fait quand :

- `pnpm brick:layers <path.layers.json>` écrit / écrase `manuals/<id-sans-prefixe>.manual.json` (ex. `landmark.fountain` → `fountain.manual.json`).
- Fontaine exprimée en couches + `ops` pour dish / macaroni / cone / eau ; brickify produit un manuel qui assemble.
- Playtest brick-lab : vues ortho + overlay vs [ref-fountain-ortho.png](../design/art/ref-fountain-ortho.png) — silhouette et paliers lisibles (±1 stud).
- `pnpm test` + `pnpm check`.

---

## Hors de ce sprint

- Prompts Gemini v2 (image / fiche / couches) → **DC2**.
- `landmark.pad` / `gate` en production → DC2 / DC3.
- Appareillage décalé, tiles auto, modificateurs pentes → **DC3**.
- `*.assembly.json` multi-modules, façades → **DC4**.
- API Gemini, Meshy→voxel, IoU auto.

## Critères playtest DC1

| Boucle | Succès |
| ------ | ------ |
| Ortho | Face / Côté / Dessus figent la caméra ; orbit reste dispo |
| Overlay | Image ref visible, opacité réglable, n’empêche pas l’orbit |
| Registre | Ajouter un `.manual.json` → apparaît au hot-swap sans toucher le switch |
| Schema | JSON couches invalide → messages path lisibles |
| Brickify | Pad 8×6 bicolore → manuel assemble sans overlap ; pièces > 1×1 utilisées |
| Fontaine | Couches + ops → rendu comparable à l’ortho ref (±1 stud, couleurs) |
| CLI | `pnpm brick:layers` régénère le manuel de façon idempotente |
| Régression | `city-test` fontaine / H1 / catalog-lab inchangés si le manuel régénéré est équivalent |

## Dépendances

```mermaid
flowchart LR
  BW1[BRICK-BW1 manuel runtime]
  DC1[BRICK-DC1 couches brickify]
  DC2[DC2 prompts pad]
  DC3[DC3 gate qualite]
  DC4[DC4 assembly facades]
  P2[P2 Lego City]
  BW1 --> DC1
  DC1 --> DC2
  DC2 --> DC3
  DC3 --> DC4
  DC4 --> P2
```

## Suite

Après validation DC1d : ouvrir **DC2** (prompts v2 + `landmark.pad`), puis DC3 (gate), DC4 (assembly + façades). Mettre à jour [brick-manual-prompt.md](../design/brick-manual-prompt.md) en DC2 — ne pas le réécrire dans ce sprint.
