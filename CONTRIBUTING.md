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

## Assets images

Pour limiter la taille du dépôt, **toutes les images** versionnées (refs art, UI, docs) sont en **WebP**.

- N’ajoute pas de `.jpg` / `.jpeg` / `.png` / `.gif` sources dans le repo (sauf exception technique justifiée, ex. favicon `.ico`).
- Avant commit : convertir en `.webp` (qualité ~80–85 pour concept art). Exemple :

```bash
npx --yes sharp-cli -i chemin/source.png -o chemin/cible.webp --format webp --quality 82
```

- Refs personnages : `docs/design/art/characters/` (voir [docs/design/characters-candidates.md](docs/design/characters-candidates.md)).

## Assets 3D

**Canon personnages in-game :** GPROC + recettes JSON ([docs/design/minifig-gproc.md](docs/design/minifig-gproc.md)) — **pas** les GLB Meshy.

### Moodboard Meshy (optionnel)

- Emplacement : `docs/design/art/characters/` (ex. `c01-bolt.glb`), nommés `cNN-slug.glb`.
- Préférer un seul fichier GLB texturé ; viser sous 10 Mo / perso.
- **Jamais** chargés en runtime jeu ; vibe / silhouette seulement.

### Runtime

- Generators : `public/gproc/minifig-*` (voir [BRICK-MF1](docs/sprints/BRICK-MF1.md)).
- Recipes PNJ / joueur : JSON slots (pas de mesh unique par perso).

## Stack de référence

Même famille que [w3dts-chessmaster](https://github.com/naanouff/w3dts-chessmaster) : Electron, electron-vite, Vite, React, TypeScript, pnpm, Vitest, packages npm `@naanouff/w3dts-*`.
