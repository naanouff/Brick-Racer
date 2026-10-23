# Sprint BRICK-B2 — Host Lego Kart

Découpage de [docs/plans/lego-kart-host.md](../plans/lego-kart-host.md). Références : [docs/references/w3dts-demos.md](../references/w3dts-demos.md).

Objectif : coque Electron qui charge `lego-kart.json`, applique le runtime kart, et permet de conduire (WASD) / reset (X). Pas de Motocross.

Ordre : B2a → B2b → B2c → B2d → B2e → B2f. Chaque ticket de code se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande.

Branche prévue : `feature/lego-kart-host` depuis `develop`. PR cible : `develop`.

## BRICK-B2a — Boot moteur + stack vehicle

Fichiers : `src/racer/host/startBrickRacerHost.ts`, éventuels helpers engine.

Fait quand :

- `GPUManager` + `EngineBuilder` initialisent un moteur sur le canvas.
- Stack prépendée : `createVehicleSystem`, physics `KART_PHYSICS_PRESET`, `createVehicleWheelVisualSystem`, `createChaseCameraSystem`.
- Sans SceneDD encore : pas d’erreur au boot (scène vide ou clear color acceptable).

## BRICK-B2b — Dépendances npm SceneDD / scripts

Fichiers : `package.json`, `pnpm-lock.yaml`.

Fait quand : `w3dts-scenedd`, loaders / `loader-scenedd`, `w3dts-scripts` (et `character` si besoin) sont pinnés et `pnpm install` réussit.

## BRICK-B2c — Assets publics kart

Fichiers sous `public/` : scène, script-graphs, graphs, shader-graphs, gproc kart.

Fait quand les chemins `/scenes/lego-kart.json`, `/script-graphs/kart-drive.json`, etc. sont servis par le renderer Electron.

## BRICK-B2d — Load SceneDD + runtime

Fichiers : `src/racer/` (port `legoKartSceneRuntime`, looks, load).

Fait quand :

- La scène se charge et se valide.
- `applyLegoKartSceneRuntime` (ou équivalent) s’exécute (sol Lego, pneus, collision tuning).
- Le lit kart est appliqué.

## BRICK-B2e — Chase, input, reset

Fait quand :

- Caméra chase liée à `KartChassis`.
- WASD conduit ; X reset la session kart.
- Scripts en état `playing`.

## BRICK-B2f — Smoke et docs

Fait quand :

- `pnpm check`, `pnpm test`, `pnpm build` OK.
- `pnpm dev` : conduite manuelle validée.
- README / `docs/build.md` mentionnent le lancement kart si besoin.
- [BRICK-B2](BRICK-B2.md) coché dans l’index docs.

## Hors de ce sprint

- Motocross Madness / terrain / moto 2 roues.
- Multiplayer, UI course (tours, items), assets custom Brick Racer.
- Release `0.2.0` (branche `release/0.2.0` après merge si on livre le host).
