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

Plan / sprint : `docs/plans/brick-lab-agent.md` · `docs/sprints/BRICK-BA.md`.

## Prérequis (checklist)

1. `pnpm dev` tourne (bus `127.0.0.1:3847`).
2. Level **brick-lab** ouvert dans l’app.
3. Serveur MCP Cursor `brick-lab` activé (`.cursor/mcp.json` → `node src/mcp/brickLabServer.mjs`).
4. Appeler `status` → `connected: true`. Sinon : stop + message (pas de fetch bus).

## Protocole

1. **`status`** — connecté ? stem courant ?
2. **Analyser l’entrée**
   - Image : emprise (studs), hauteur (plates), sous-ensembles, palette → 12 couleurs catalogue (`list_colors`).
   - Notice : 1 étape notice = 1 lot `place_bricks` (ou une macro).
3. **`list_parts`** — nomenclature + substitutions (voir `reference/parts.md`). Annoncer les écarts catalogue (ex. pas de feuille).
4. **`new`** si nouvelle structure (`stem` / `title` demandés).
5. **Plan par couches** bas → haut. Coords `[sx, py, sz]` = coin min grille ; 1 brick = 3 plates. Voir `reference/coordinates.md`.
6. **Par sous-ensemble**
   - Prefer macros (`fill_rect`, `wall`, `ring`, `disc`, `column`) quand ça colle.
   - `dryRun: true` d’abord → corriger `rejected[]` (cell / opId).
   - Poser pour de vrai.
   - `analyze` → **0 flottante** bloquante (corriger ou justifier).
   - `capture` ou `capture_set` → lire le PNG avec Read ; comparer à la ref.
   - Max **3** boucles correction / sous-ensemble.
7. **`save`** seulement si l’utilisateur le demande.
8. Résumé : BOM (`analyze`), captures, écarts restants.

## Outils clés

| Outil | Usage |
| ----- | ----- |
| `place_bricks` | Lot + `dryRun` |
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
