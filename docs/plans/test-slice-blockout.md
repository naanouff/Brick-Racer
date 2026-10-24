# Plan : blockout city-test + race-test

Authoring **blockout jouable** des scènes de validation Brick Proving Grounds. Sprint : [BRICK-BO1](../sprints/BRICK-BO1.md). Design coté : [test-slice-plans.md](../design/test-slice-plans.md). Intention : [test-slice.md](../design/test-slice.md). Contrat levels : [architecture.md](architecture.md).

## Objectif

Livrer deux modules TypeScript `raceTest` et `cityTest` (primitives + colliders, matériaux unis) aux cotes plans, branchés via SceneDirector / SessionFlow minimal. Pas d’art final, pas de scoring course.

## Pipeline figé

**Levels TS** — pas SceneDD / `public/scenes/`. Pattern : [`src/racer/levels/sandboxKart/`](../../src/racer/levels/sandboxKart/) (`*Spec.ts` + `spawn*.ts`).

Branche : `feature/test-slice-blockout` depuis `develop`. PR cible : `develop`.

```mermaid
flowchart LR
  boot[bootEngine]
  sd[SceneDirector]
  race[spawnRaceTest]
  city[spawnCityTest]
  kart[kart chassis reuse]
  boot --> sd
  sd -->|"race-test"| race
  sd -->|"city-test"| city
  race --> kart
  city --> kart
```

## 1. Factoriser le spawn shared

Extraire de [`spawnSandboxKart.ts`](../../src/racer/levels/sandboxKart/spawnSandboxKart.ts) vers `src/racer/levels/shared/` :

- `fetchJson`, `applyTransform`, `createPrimitiveMesh`, material/graph bootstrap
- Types communs → `shared/levelTypes.ts`
- Helper `spawnStaticBox({ name, center, size, materialId, collider })`

`sandboxKart` reste fonctionnel (refactor no-behavior-change).

## 2. `race-test` blockout (priorité — driveable)

Module `src/racer/levels/raceTest/` : `raceTestSpec.ts`, `spawnRaceTest.ts`, `index.ts`.

| Élément | Spec |
| ------- | ---- |
| Sol piste | Largeur **12** wu ; médiane **~420** wu ; ovale asymétrique antihoraire ; origine grille `(0,0,0)` +X |
| Bordures | Murs h **0,66**, ép. 0,4, collider |
| Chicane | Largeur **8** wu |
| Whoops ×3 | h **0,45**, espacement 4 |
| Boost sol ×2 | Plaques 4×2×0,05 (visuel ; pas de logic) |
| Anneaux air ×2 | Stub Ø 3,5 @ Y **4** (visuel) |
| Items | Cubes 0,8 @ Y 0,6 (visuel) |
| CP ×5 | Volumes Y 0→8 ; IDs `cp.*` |
| Grille | 4 slots ; kart joueur **slot 0** `(0,0,-4.5)` face +X |
| Arche PROVING | 14×6×2 |
| Dune shortcut | Rampe 10×4 @ ~18° |

Kart + `kart_drive` + chase : réemploi sandbox (pas re-author gproc).

## 3. `city-test` blockout

Module `src/racer/levels/cityTest/` — AABB [test-slice-plans.md](../design/test-slice-plans.md) :

- Sol **40×40**, origine SW `(0,0,0)`
- Plaza + fontaine ; boxes landmarks (tour, garage, Vinyle, billboard, mairie)
- Pad tutoriel 8×6×0,22 ; gate Riviera **non traversable**
- Capsules PNJ stub Hex / Bolt
- Spawn kart `(20, y, 14)` yaw 0 — sud de la fontaine (plaza centre `(20,20)` occupé)
- Triggers `poi.garage` / `pad.race_test` **visuels** (pas de load race encore)

## 4. Brancher le host

| Fichier | Changement |
| ------- | ---------- |
| `SceneDirector.ts` | `load` / `unload` : `sandbox-kart` \| `race-test` \| `city-test` |
| `SessionFlow.ts` | `SandboxKart` \| `CityTest` \| `RaceActive` ; stubs transition |
| Boot / `LegoKartBootProject` | Default **`race-test`** ; `?level=city-test\|sandbox-kart` |
| `startBrickRacerHost.ts` | Exposer `scene.load` |

## 5. Validation

- `pnpm check` / `pnpm test`
- `pnpm dev` : ovale driveable ; `?level=city-test` : hub 40×40, gate impassable
- IDs stables en tête de chaque `*Spec.ts`

## 6. Physique & collisions (suite)

Voir [blockout-physics.md](blockout-physics.md) (sprint ticket BO1f) : groupes WORLD/WALL/RAMP, alias mono physics, kart ×2,5 sur race/city, switch par reload.

## 7. Kart arcade + texture debug (suite)

Voir [blockout-arcade-kart.md](blockout-arcade-kart.md) (ticket **BO1g**) : kart blockout 2 m, couche arcade (cc / drift / boost), grille debug.

**Densité de texels (convention blockout)** : 1 wu = 1 m ; environnement **256 px/m** (texture 1024 → tuile 4 m) ; kart **512 px/m**. Projection triplanar monde (décor) / objet (kart). Défaut = couleurs unies ; `?debugTex=1` pour la grille (coûteux).

## Hors scope

Art final, items / IA / laps, multi, scooter hub, SceneDD. Boosts sol / anneaux arcade → BO1g. Suite course → [BRICK-B3](../sprints/BRICK-B3.md) (B3c+).
