# Sprint BRICK-BO1 — Blockout Proving Grounds

Découpage de [docs/plans/test-slice-blockout.md](../plans/test-slice-blockout.md).  
Design : [test-slice.md](../design/test-slice.md), [test-slice-plans.md](../design/test-slice-plans.md).  
Contrat : [architecture.md](../plans/architecture.md) (levels TS, pas SceneDD).

Objectif : **blockout jouable** `race-test` + `city-test` (primitives + colliders aux cotes plans), SceneDirector multi-level, boot playtest. Pas de boucle tours / items / IA (→ [BRICK-B3](BRICK-B3.md) B3c+).

Ordre : BO1a → BO1b → BO1c → BO1d → BO1e → BO1f → **BO1g**. Chaque ticket de code se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande.

Physique / collisions : [blockout-physics.md](../plans/blockout-physics.md).  
Kart arcade + texture debug : [blockout-arcade-kart.md](../plans/blockout-arcade-kart.md).

Branche prévue : `feature/test-slice-blockout` depuis `develop`. PR cible : `develop`.

Prérequis : **BRICK-B2** merge (sandbox kart jouable).

---

## BRICK-BO1a — Levels shared (factor spawn)

Fichiers : `src/racer/levels/shared/` ; refactor [`sandboxKart/`](../../src/racer/levels/sandboxKart/).

Fait quand :

- Types communs (`LevelEntity`, `PrimitiveSpec`, …) + helpers (`fetchJson`, `applyTransform`, `createPrimitiveMesh`, bootstrap graphs/materials).
- Helper `spawnStaticBox` (ou équivalent) pour blockout.
- `spawnSandboxKart` utilise shared ; **comportement sandbox inchangé** (conduite WASD / X OK).

## BRICK-BO1b — Module `raceTest` blockout

Fichiers : `src/racer/levels/raceTest/` (`raceTestSpec.ts`, `spawnRaceTest.ts`, `index.ts`).

Fait quand :

- Sol + murs h 0,66, largeur 12 (chicane 8), médiane ~420 wu (ovale antihoraire).
- Whoops ×3, dune shortcut, arche PROVING, boosts sol + anneaux air + items **visuels**.
- **≥3** (cible 5) checkpoints volumes Y 0→8, IDs `cp.*` documentés.
- Grille 4 slots ; kart joueur slot 0 + chase + `kart_drive`.
- IDs stables en tête de spec.

## BRICK-BO1c — Module `cityTest` blockout

Fichiers : `src/racer/levels/cityTest/`.

Fait quand :

- Sol 40×40, AABB landmarks ([test-slice-plans.md](../design/test-slice-plans.md) § city-test).
- Pad tutoriel 8×6 ; Riviera Gate **collider bloquant** ; capsules Hex / Bolt stub.
- Spawn kart `(20,y,14)` (sud fontaine) ; volumes `poi.garage` / `pad.race_test` visibles (pas de transition load).

## BRICK-BO1d — SceneDirector + SessionFlow + boot

Fichiers : `SceneDirector.ts`, `SessionFlow.ts`, boot / `LegoKartBootProject.ts`, `startBrickRacerHost.ts`.

Fait quand :

- `scene.load('sandbox-kart' | 'race-test' | 'city-test')` + `unload` (clear entités level).
- États flow : `SandboxKart` | `CityTest` | `RaceActive` (stubs `startRace` / `endRace` / `gotoCity` OK).
- Boot default **`race-test`** ; query `?level=city-test|sandbox-kart` pour bascule.
- `pnpm check` / `pnpm test` OK.

## BRICK-BO1e — Smoke playtest + docs

Fait quand :

- Playtest : conduire ovale blockout ; `?level=city-test` hub 40×40, gate impassable, pad visible.
- Note courte dans [build.md](../build.md) ou README (`?level=`).
- [BRICK-B3](BRICK-B3.md) B3b pointe vers pack TS `raceTest` (plus SceneDD `public/scenes/`).
- Lien sprint dans [docs/README.md](../README.md).

## BRICK-BO1f — Physique & collisions

Plan : [blockout-physics.md](../plans/blockout-physics.md).

Fait quand :

- Alias mono `w3dts-physics` + `applyKartPhysicsCollisionTuning` + pas 1/120 ; sandbox stable (plus de flottement).
- Groupes : sol `4`, murs/gate `8`, rampes/whoops/pad `16` ; arche = 2 piliers (ouverture 14).
- Kart race/city × `KART_SCALE ≈ 2.5` (plans 2 m) ; sandbox reste micro.
- Switch level HUD = reload `?level=` (pas hot-swap).
- Tests groupes + anti-traversée (mono) + `scaleKartEntities`.

## BRICK-BO1g — Kart arcade + texture debug

Plan : [blockout-arcade-kart.md](../plans/blockout-arcade-kart.md).

Fait quand :

- Kart blockout natif ~2 m (primitives `bo_*`, plus de gproc × `KART_SCALE` sur race/city) ; roues rayon visu = physique ; rubans / boosts au ras du sol.
- Couche arcade : 50/100/150 cc (`?cc=`), drift + mini-turbo (Espace), boosts sol + anneaux, reset au spawn, HUD km/h.
- Caméra arcade (yaw lag, FOV vitesse) ; `camera.far` ≥ 400.
- Texture debug grille world / object (256 px/m env) ; défaut unis ; `?debugTex=1` pour grille.
- Tests arcade + materials grille ; playtest critères ci-dessous.

---

## Hors de ce sprint

- Lap / CP scoring, items / IA → BRICK-B3 (B3c–B3e). Boosts sol / anneaux **arcade** livrés en BO1g.
- Transition pad → race réelle, scooter hub → P2.
- Marche + échange kart / moto / avion sur `city-test` → [BRICK-H1](BRICK-H1.md).
- Agrandissement piste (tour ~20 s @ 100 cc).
- Art final, SceneDD, multi.

## Critères playtest BO1

| Boucle | Succès |
| ------ | ------ |
| Race blockout | WASD sur ovale, **murs bloquent** (pas monter dessus), grille / CP visibles, whoops/dune roulables |
| City blockout | Rouler plaza, **gate bloque**, landmarks lisibles, pad franchissable |
| Switch level | `?level=` (reload) change de scène sans crash |
| Sandbox | Jouable via `?level=sandbox-kart` ; assiette stable (physique mono) |
| Échelle | Kart race/city ~2 m blockout ; sandbox micro inchangé |
| Arcade | HUD km/h ; 0→pointe ~2 s ; drift charge bleu/orange ; plaques/anneaux boostent ; X reset au spawn |
| Texture debug | Défaut unis ; `?debugTex=1` = grille 1 m / 25 cm (coûteux) |

## Dépendances

```mermaid
flowchart LR
  B2[BRICK-B2 sandbox]
  BO1[BRICK-BO1 blockout]
  B3[BRICK-B3 race loop]
  P2[P2 hub]
  B2 --> BO1
  BO1 --> B3
  BO1 -.->|city stub| P2
```
