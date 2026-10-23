# Contribuer — Brick Racer

## Branches

| Branche | Rôle |
| -------- | ---- |
| `main` | Production / releases uniquement |
| `develop` | Intégration (branche active par défaut) |
| `feature/*` | Nouvelle fonctionnalité → PR vers `develop` |
| `fix/*` | Correctif → PR vers `develop` |
| `release/X.Y.Z` | Gel de version → PR vers `main` |

Hotfix urgent : PR vers `main`, puis merge de suivi dans `develop`.

## Protections

`main` et `develop` sont protégées : pull request obligatoire, pas de force-push, pas de suppression (y compris pour les admins). Pas d’approbation de review obligatoire. Les branches de tête de PR sont supprimées au merge (`delete_branch_on_merge`).

## Releases

1. Partir de `develop` : branche `release/X.Y.Z`.
2. `package.json` vaut exactement `X.Y.Z` ; ajouter `docs/releases/X.Y.Z.md`.
3. PR `release/X.Y.Z` → `main`, tag `vX.Y.Z`, puis remonter dans `develop` et préparer la version suivante.

Détail : [docs/semver.md](docs/semver.md) (créé dans le sprint workspace).

## Documentation

- Racine : `README.md`, `CONTRIBUTING.md`, `LICENSE` uniquement pour le markdown / licence.
- Plans : `docs/plans/`.
- Sprints : `docs/sprints/`.
- Build / semver / notes de release : `docs/`.

## Stack de référence

Même famille que [w3dts-chessmaster](https://github.com/naanouff/w3dts-chessmaster) : Electron, electron-vite, Vite, React, TypeScript, pnpm, Vitest, packages npm `@naanouff/w3dts-*`.
