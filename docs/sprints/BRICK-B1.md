# Sprint BRICK-B1 — Workspace bootstrap

Découpage de [docs/plans/workspace.md](../plans/workspace.md).

Objectif : dépôt jouable en coque (Electron + React + WebGPU stub), gitflow opérationnel, CI minimale. Pas de gameplay kart.

Ordre : B1a → B1b → B1c → B1d → B1e. Chaque ticket de code se termine par `pnpm test` et `pnpm check` dès que les scripts existent.

Branche : `feature/workspace-bootstrap` depuis `develop`. PR cible : `develop`.

## BRICK-B1a — Scaffold package et configs ✅

Fichiers : `package.json`, `pnpm-lock.yaml`, `electron.vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.npmrc`, `resources/icon.ico`.

Fait :

- `brick-racer` `0.1.0`, `appId` `com.naanouff.brickracer`, `productName` `Brick Racer`.
- Scripts `dev` / `build` / `dist` / `check` / `test`.
- Dépendances `@naanouff/w3dts-*` alignées ChessMaster (sans `chessops`).
- `pnpm install` OK.

## BRICK-B1b — Electron main / preload / renderer stub ✅

Fichiers : `src/main/`, `src/preload/`, `src/renderer/`, `src/racer/host/`, `public/brand/`, `tests/smoke.test.ts`.

Fait :

- Main : fenêtre + `app://`, IPC `app-version` seulement.
- Preload : `window.brickRacer.version`.
- Renderer : canvas, gate WebGPU, titre « Brick Racer », disclaimer.
- `startBrickRacerHost` stub.
- `pnpm check` / `pnpm test` / `pnpm build` OK.

## BRICK-B1c — Docs build / semver / release 0.1.0 ✅

Fichiers : `docs/build.md`, `docs/semver.md`, `docs/releases/0.1.0.md`, `README.md`.

## BRICK-B1d — CI ✅

Fichiers : `.github/workflows/ci.yml`, `scripts/semverPolicy.mjs`, `tests/semverPolicy.test.ts`, `.github/workflows/restore-develop.yml`.

Fait : job `test` (check/test/semver) ; `package-windows` sur `main` / `release/*` → artefact `brick-racer-X.Y.Z` ; pas de Vercel.

## BRICK-B1e — Protections GitHub et branche par défaut ✅

Fait : `develop` branche par défaut ; protections `main`/`develop` ; `delete_branch_on_merge` ; `restore-develop.yml`.

## Hors de ce sprint

- Port de `LegoKartProject` / `legoKartSceneRuntime` (`feature/lego-kart-host`).
- Build web / Vercel.
- Assets piste, kart, audio course, multiplayer.
- Tag `v0.1.0` et release GitHub (après merge `release/0.1.0` → `main`).
