# Sprint BRICK-B2 — Host Lego Kart (P0)

Découpage de [docs/plans/lego-kart-host.md](../plans/lego-kart-host.md).  
Contrats : [docs/plans/architecture.md](../plans/architecture.md) (SandboxKart, SceneDirector minimal, **levels TS sans SceneDD**).  
Références : [docs/references/w3dts-demos.md](../references/w3dts-demos.md). Ladder VP0 : [vehicle-prototypes.md](../plans/vehicle-prototypes.md).

Objectif : coque Electron qui **spawne** le sandbox kart (module TS), applique le runtime kart, et permet de conduire (WASD) / reset (X). Poser les **hooks architecture** (boot + SceneDirector minimal + état `SandboxKart`) sans RaceSystem ni hub.

Pas de Motocross. Pas de boucle tours / items (→ [BRICK-B3](BRICK-B3.md)). **Pas de SceneDD.**

Ordre : B2a → B2b → B2c → B2d → B2e → B2f → B2g. Chaque ticket de code se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande.

Branche prévue : `feature/lego-kart-host` depuis `develop`. PR cible : `develop`.

Prérequis : BRICK-B1 ✅. Soft : UI1 parallèle OK (canvas sous overlays).

---

## BRICK-B2a — Boot moteur + stack vehicle ✅

Fichiers : `src/racer/host/bootEngine.ts`, `startBrickRacerHost.ts`.

Fait :

- `GPUManager` + `EngineBuilder` + stack vehicle / physics `KART_PHYSICS_PRESET` / wheelVisual / chase.
- Systèmes gproc + scripts (input + vehicle nodes).
- Projet lit + level kart (enchaîné B2d).

## BRICK-B2b — Dépendances scripts / mono ✅

Paquet `w3dts-scripts` **non publié** sur npm public → alias Vite [`w3dtsMonoAliases.ts`](../../w3dtsMonoAliases.ts) → sibling `../w3dts_repos/w3dts` (voir [build.md](../build.md)). **Pas d’alias scenedd.** Typings ambient : `src/racer/types/w3dts-mono.d.ts`.

## BRICK-B2c — Assets publics kart ✅

Sous `public/` : `script-graphs/kart-drive.json`, graphs lit + Kart, `shader-graphs/` (PBR, LegoTile, Rock…), gproc kart ×4. **Pas** de `scenes/lego-kart.json`.

## BRICK-B2d — Level TS spawn + runtime ✅ (code)

Fichiers : `src/racer/levels/sandboxKart/*`, `LegoKartBootProject.ts`, `legoKartSceneRuntime.ts`, looks.  
`spawnSandboxKart(spec)` + `applyLegoKartSceneRuntime`. Pas de dep `@naanouff/w3dts-viewer` ni `@naanouff/w3dts-scenedd`.

**Playtest runtime** encore à valider sous `pnpm dev` (B2g).

## BRICK-B2e — Chase, input, reset ⏳

Prévu via spawn + `kart-drive.json` + `__W3DTS_SCRIPT_PLAY_STATE__=playing` + rebind `KartChaseCamera`.  
À confirmer en playtest (WASD / X).

## BRICK-B2f — Hooks architecture (minimal) ✅

- `src/racer/scene/SceneDirector.ts` — `load` / `unload`
- `src/racer/session/SessionFlow.ts` — `getState(): 'SandboxKart'`
- Host : `{ ready, engine, scene, flow }`

## BRICK-B2g — Smoke et docs ⏳

- `tsc` + `vitest` verts en local.
- `pnpm build` / `pnpm dev` playtest + coche finale encore ouverts.

---

## Hors de ce sprint

- Motocross / terrain / moto 2 roues / avion.
- Boucle course (tours, CP scoring, items, IA) → [BRICK-B3](BRICK-B3.md).
- Hub `city-test`, pads, multi, garage.
- Pack JSON maison courses/hub.
- Release `0.2.0` (branche `release/0.2.0` après merge si on livre le host).
- Extraction `VehicleMode` registry (attendre scooter VP1).

## Critères playtest P0

| Critère | Succès |
| ------- | ------ |
| Boot | Canvas WebGPU + sandbox kart sans erreur console bloquante |
| Conduite | 5 min WASD sans softlock |
| Caméra | Ne perd jamais `KartChassis` |
| Reset | X respawn + clear vélocité fiable |
