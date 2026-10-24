# Sprint BRICK-MF1 — Fondation minifig GPROC

Découpage de [docs/plans/minifig-gproc.md](../plans/minifig-gproc.md).  
Design : [docs/design/minifig-gproc.md](../design/minifig-gproc.md).  
Réfs GPROC kart : [docs/references/w3dts-demos.md](../references/w3dts-demos.md). Cast : [characters-candidates.md](../design/characters-candidates.md).

Objectif : **pipeline minifig procédural** (catalogue + GPROC + recipe + assembleur) + **sandbox preview** dans la coque Electron. Une recipe preset (Bolt) chargeable ; swap d’au moins un slot. **Pas** boutique hub P3.

Ordre : MF1a → MF1b → MF1c → MF1d → MF1e → MF1f. Chaque ticket de code se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande.

Branche prévue : `feature/minifig-gproc` depuis `develop`. PR cible : `develop`.

Prérequis soft : **BRICK-B2** (boot moteur + gproc stack) merge ou utilisable. UI boutique React = hors scope (P3 / UI1e).

---

## BRICK-MF1a — Types recipe + catalogue

Fichiers : `src/racer/minifig/` (types, `PartCatalog`, schema slots).

Fait quand :

- Types `MinifigRecipe`, slots (`head`, `facePrint`, `hat`/`hair`, `torso`, `arms`, `hands`, `hipsLegs`, `accessoryL`/`R`) documentés et exportés.
- Catalogue v0 : ≥1 entrée par slot critique (head, torso, hipsLegs) + hat + accessoryR (wrench).
- Test unitaire : recipe Bolt stub valide contre le catalogue (ids inconnus → erreur claire).

## BRICK-MF1b — Generators GPROC minifig

Fichiers : `public/gproc/minifig-*.json` (ou chemins équivalents servi par le renderer).

Fait quand :

- Au moins **3** generators : tête, torso, jambes (brick-like, palette saturée).
- Optionnel MF1 : cap + wrench (sinon stub mesh / cube teinté acceptable temporairement).
- Chargés / référencés comme les gproc kart (pas de GLB Meshy).

## BRICK-MF1c — Assembleur `assembleMinifig`

Fichiers : `src/racer/minifig/assembleMinifig.ts` (+ helpers).

Fait quand :

- `assembleMinifig(engine|scene, recipe)` spawn les pièces aux sockets / offsets documentés.
- Teintes appliquées ; print stub si texture absente (couleur unie OK).
- Idempotent : rappel = replace / clear précédent.

## BRICK-MF1d — Recipe preset Bolt

Fichiers : `public/minifig/recipes/c01-bolt.json` (ou sous `src/…/recipes/` si pack TS préféré — documenter le choix).

Fait quand :

- Recipe Bolt aligne slots fiche C01 (casquette, coverall, gants, wrench) **sans** charger `c01-bolt.glb`.
- Load JSON → `assembleMinifig` OK en sandbox.

## BRICK-MF1e — Sandbox preview + swap

Fichiers : host / écran debug / stub React minimal.

Fait quand :

- Entrée sandbox minifig depuis le host (flag, route debug, ou bouton dev) sans casser le kart sandbox.
- Preview WebGPU : Bolt visible.
- UI minimale : changer **≥1** slot (ex. teinte torso ou hat on/off) → regen debounce.
- `pnpm dev` : validé manuellement.

## BRICK-MF1f — Smoke et docs

Fait quand :

- `pnpm test`, `pnpm check`, `pnpm build` OK.
- [minifig-gproc.md](../plans/minifig-gproc.md) / design à jour si chemins divergents.
- README ou `docs/build.md` : comment lancer le sandbox minifig.
- [BRICK-MF1](BRICK-MF1.md) coché dans [docs/README.md](../README.md).

---

## Hors de ce sprint

- Boutique hub Vinyle / POI P3.
- 40 recettes complètes.
- Atlas face prints final / éditeur bitmap.
- Anim locomotion / course.
- Import runtime des GLB Meshy.
- Soft stats / meta pièces.

## Suite

- **P3** : UI boutique + persistance recipe joueur + spawn hub.  
- Recettes PNJ retenus post-playtest → pack recipes.  
- Soft : spike face atlas (MF2) si MF1 valide le corps.
