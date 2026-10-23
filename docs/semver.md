# Version

Une seule version : le champ `version` de [`package.json`](../package.json). Elle vaut aujourd’hui `0.1.0`. Electron l’affiche avec `app.getVersion()`. L’installateur NSIS porte le même numéro dans son nom de fichier. Pas de second fichier. electron-builder ne publie pas pendant le build (`--publish never`).

## Numéro

Forme stricte `MAJOR.MINOR.PATCH`. Pas de suffixe : `0.1.0`, pas `0.1.0-dev`.

Tant que le majeur est `0`, un correctif augmente le patch, une fonction le mineur, un changement incompatible aussi le mineur. À partir de `1.0.0`, un changement incompatible augmente le majeur.

## Release

`release/X.Y.Z` part de `develop`. Avant la pull request vers `main`, `package.json` vaut exactement `X.Y.Z`.

Le même commit ajoute `docs/releases/X.Y.Z.md`. C’est la note de version, en français, écrite pour cette livraison. Elle n’est pas produite depuis l’historique git. La CI refuse la branche si ce fichier manque ou s’il est vide (`scripts/semverPolicy.mjs`).

Après le merge dans `main`, la CI ouvre la release GitHub `vX.Y.Z` sur ce commit. Le seul fichier ajouté est l’installateur NSIS. Si le tag existe déjà, la CI n’en crée pas un second. Le merge revient dans `develop`, puis un commit y prépare la version suivante. `develop` n’est pas supprimé.

Un push sur `main` ou `release/*` construit l’exe. L’artefact d’Actions s’appelle `brick-racer-X.Y.Z`. La release GitHub ne reçoit cet exe qu’au push sur `main`.

## Branches

Voir [CONTRIBUTING.md](../CONTRIBUTING.md).
