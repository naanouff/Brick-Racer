# Sprint BRICK-B1 — Workspace bootstrap

Découpage de [docs/plans/workspace.md](../plans/workspace.md).

Objectif : dépôt jouable en coque (Electron + React + WebGPU stub), gitflow opérationnel, CI minimale. Pas de gameplay kart.

Ordre : B1a → B1b → B1c → B1d → B1e. Chaque ticket de code se termine par `pnpm test` et `pnpm check` dès que les scripts existent. Aucun commit sans demande.

Branche : `feature/workspace-bootstrap` depuis `develop`. PR cible : `develop`.

## BRICK-B1a — Scaffold package et configs

Fichiers : `package.json`, `pnpm-lock.yaml`, `electron.vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.npmrc`, `resources/icon.ico`.

Fait quand :

- `package.json` nomme `brick-racer`, version `0.1.0`, `appId` `com.naanouff.brickracer`, `productName` `Brick Racer`.
- Scripts : `dev`, `build`, `dist`, `check`, `test`.
- Dépendances `@naanouff/w3dts-*` alignées sur les pins ChessMaster (sans `chessops`).
- `pnpm install` réussit.

## BRICK-B1b — Electron main / preload / renderer stub

Fichiers : `src/main/`, `src/preload/`, `src/renderer/`, `src/racer/host/`, `public/brand/`, `tests/smoke.test.ts`.

Fait quand :

- Main : fenêtre + protocole `app://`, pas d’IPC métier.
- Preload : `window.brickRacer` expose au minimum la version.
- Renderer : canvas, contrôle `navigator.gpu`, titre placeholder « Brick Racer », disclaimer non officiel visible.
- `startBrickRacerHost` est un stub (pas de scene kart).
- `pnpm check` et `pnpm test` passent ; `pnpm dev` ouvre l’app.

## BRICK-B1c — Docs build / semver / release 0.1.0

Fichiers : `docs/build.md`, `docs/semver.md`, `docs/releases/0.1.0.md`, mise à jour `README.md`.

Fait quand :

- `docs/build.md` décrit prérequis (Node 22+, pnpm) et les scripts.
- `docs/semver.md` reprend la politique ChessMaster adaptée à Brick Racer.
- `docs/releases/0.1.0.md` décrit l’amorçage workspace.
- Le README pointe vers `docs/build.md` pour lancer le projet.

## BRICK-B1d — CI

Fichiers : `.github/workflows/ci.yml`, éventuellement `scripts/semverPolicy.mjs` + test.

Fait quand :

- Job `test` : `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test` (et politique semver si le script est présent).
- Job `package-windows` sur push `main` / `release/*` : `pnpm dist`, artefact `brick-racer-X.Y.Z`.
- Pas de deploy Vercel dans ce sprint.

## BRICK-B1e — Protections GitHub et branche par défaut

Fait quand (via `gh`, hors code) :

- `main` et `develop` protégées : PR obligatoire, pas de force-push, pas de suppression (admins inclus), pas d’approbation review obligatoire.
- `delete_branch_on_merge` activé.
- Branche par défaut GitHub = `develop`.
- Workflow optionnel `restore-develop.yml` si utile (même idée que le monorepo w3dts).

## Hors de ce sprint

- Port de `LegoKartProject` / `legoKartSceneRuntime` (sprint suivant, `feature/lego-kart-host`).
- Build web / Vercel.
- Assets piste, kart, audio course, multiplayer.
- Tag `v0.1.0` et release GitHub (après merge `release/0.1.0` → `main`).
