---
name: brick-builder
description: >-
  Build LEGO assemblies in the open brick-lab session from a photo or assembly
  instructions via the brick-lab MCP (dry-run, macros, analyze, capture).
  Use when the user asks to construct/build bricks from an image or notice,
  or to drive brick-lab as an agent.
---

# Brick builder

Pilote **uniquement** le MCP `brick-lab` (session Electron ouverte). Ne pas écrire les `.manual.json` à la main pendant une édition, et **ne pas** contourner via HTTP si le MCP est down — s’arrêter et le signaler.

Plan / sprint : `docs/plans/brick-lab-agent.md` · `docs/sprints/BRICK-BA.md` · `docs/sprints/BRICK-CF.md`.

## Prérequis (checklist)

1. `pnpm dev` tourne (bus `127.0.0.1:3847`).
2. Level **brick-lab** ouvert dans l’app.
3. Serveur MCP Cursor `brick-lab` activé (`.cursor/mcp.json` → `node src/mcp/brickLabServer.mjs`).
4. Appeler `status` → `connected: true`. Sinon : stop + message (pas de fetch bus).

## Protocole

1. **`status`** — connecté ? stem courant ?
2. **Promo catalogue (set / BOM)** — avant de poser des pièces hors BC1 seed :
   - CLI une fois : `pnpm catalog:promote-set -- <setNum>` → `public/catalog/bom/<setNum>.json`.
   - Session : `promote_bom { setNum }` (ou `promote_parts { ids }`) → runtime + staging.
   - `promote_status` / `list_parts` (`source: seed|staging`) pour vérifier.
   - Couleurs set → slugs éditeur (`tan`→`sand`, `dark_orange`→`terracotta`, …).
3. **Analyser l’entrée**
   - Image : emprise (studs), hauteur (plates), sous-ensembles, palette → 12 couleurs catalogue (`list_colors`).
   - Notice : 1 étape notice = 1 lot `place_bricks` (ou une macro).
4. **`list_parts`** — nomenclature + substitutions (voir `reference/parts.md`). Annoncer les écarts catalogue (ex. pas de feuille / unresolved).
5. **`new`** si nouvelle structure (`stem` / `title` demandés).
6. **Plan par couches** bas → haut. Coords `[sx, py, sz]` = coin min grille ; 1 brick = 3 plates. Voir `reference/coordinates.md`.
7. **Par sous-ensemble**
   - Prefer macros (`fill_rect`, `wall`, `ring`, `disc`, `column`) quand ça colle.
   - `dryRun: true` d’abord → corriger `rejected[]` (cell / opId).
   - Poser pour de vrai.
   - `analyze` → **0 flottante** bloquante (corriger ou justifier).
   - `capture` ou `capture_set` → lire le PNG avec Read ; comparer à la ref.
   - Max **3** boucles correction / sous-ensemble.
8. **`save`** seulement si l’utilisateur le demande.
9. Résumé : BOM (`analyze`), captures, écarts restants.

## Outils clés

| Outil | Usage |
| ----- | ----- |
| `promote_bom` / `promote_parts` / `promote_status` | BOM → runtime (CF) |
| `place_bricks` | Lot + `dryRun` |
| `place_assembly` | Merge `manuals/<stem>` at `at` (sous-module → scène) |
| `fill_rect` / `wall` / `ring` / `disc` / `column` | Macros |
| `query_region` | Trouver de la place |
| `analyze` | BBox, BOM, flottantes |
| `set_view` + `capture` / `capture_set` | Voir le résultat |
| `remove_bricks` | Nettoyer une zone (1 undo) |
| `undo` | Annuler le dernier lot |

## Références

- [reference/coordinates.md](reference/coordinates.md)
- [reference/parts.md](reference/parts.md)
- [reference/recipes.md](reference/recipes.md)
