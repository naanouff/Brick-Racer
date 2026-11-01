# Plan : MCP brick-lab (agent construction)

Sprint tickets : [BRICK-LT4](../sprints/BRICK-LT.md#brick-lt4--bus-local-dev) · [BRICK-LT5](../sprints/BRICK-LT.md#brick-lt5--serveur-mcp--docs).  
Plan parent : [brick-lab-tools.md](brick-lab-tools.md).  
Éditeur : [brick-lab-editor.md](brick-lab-editor.md) · [`editorState.ts`](../../src/racer/levels/brickLab/editor/editorState.ts).

## Objectif

Permettre à un agent (Cursor / autre client MCP) de **construire des assemblages LEGO** dans la session **brick-lab déjà ouverte** — même occupancy, undo et sync scène que l’UI humaine.

## Pourquoi pas écrire le JSON directement

L’état éditeur vit dans React. Écrire `src/racer/hub/brick/manuals/<stem>.manual.json` depuis l’extérieur diverge de la session (ED4 : le hot-reload ignore le stem en cours d’édition). Le MCP **commande** l’éditeur ; il ne remplace pas `editorState`.

```mermaid
flowchart LR
  agent[Agent Cursor]
  mcp[Serveur stdio brick-lab]
  bus[HTTP 127.0.0.1]
  main[Electron main]
  panel[BrickLabBuildPanel]
  agent --> mcp
  mcp --> bus
  bus --> main
  main --> panel
```

## Sécurité / portée

| Règle | Détail |
| ----- | ------ |
| Dev only | Bus actif uniquement sous `pnpm dev` |
| Localhost | Bind `127.0.0.1` uniquement |
| Jeton | Fichier `data/brick-lab-mcp.token` (gitignoré) ; header requis |
| Level | Si le level actif ≠ `brick-lab` → outils répondent « non connecté » |
| Packagé | Pas de bus dans `pnpm dist` / installateur |

## Implémentation

| Couche | Rôle |
| ------ | ---- |
| Electron main | Petit serveur HTTP + IPC vers renderer |
| Preload / renderer | Appliquer commandes sur `editorState` puis `syncBrickLabManual` |
| `src/mcp/` | Serveur stdio `@modelcontextprotocol/sdk` |
| Script | `pnpm mcp:brick-lab` |
| Config | Exemple `mcp.json` (Cursor) dans ce doc / sprint LT5 |

## Outils (premier lot)

| Outil | Rôle |
| ----- | ---- |
| `status` | Connecté ? level, stem, tool, rot, ops count |
| `list_parts` | Catalogue BC1 (id, footprint, famille) |
| `list_colors` | `colors.json` |
| `get_assembly` | Ops courantes (part, color, at, rot) |
| `place_bricks` | Lot de poses ; **un** undo ; collisions renvoyées par index |
| `remove_brick` | Par `opId` ou cellule |
| `set_brush` | Pièce, couleur, rot `0\|90\|180\|270` |
| `undo` / `redo` | Piles éditeur |
| `save` / `load` / `new` | Même IPC que le menu Fichier |

## Outils (lot 2 — agent)

Sprint : [BRICK-BA](../sprints/BRICK-BA.md) · plan : [brick-lab-agent.md](brick-lab-agent.md).

| Outil | Rôle |
| ----- | ---- |
| `place_bricks` + `dryRun` | Validation sans mutation ; collision → `cell` / `opId` |
| `query_region` | Cellules + ops dans un AABB |
| `analyze` | BBox, BOM, pièces flottantes |
| `remove_bricks` | Lot opIds / région ; un undo |
| `fill_rect` / `wall` / `ring` / `disc` / `column` | Macros → `place_bricks` |
| `set_view` | `orbit` \| `face` \| `side` \| `top` |
| `capture` / `capture_set` | PNG sous `data/brick-lab-captures/` (gitignoré) |

Skill Cursor : `.cursor/skills/brick-builder/` · subagent : `.cursor/agents/brick-builder.md`.

Hors scope durable : promotion catalogue maître ; MCP packagé / hors localhost.

## Contrat `place_bricks`

Entrée (indicatif) :

```json
{
  "bricks": [
    { "part": "3001", "color": "gray", "at": [0, 0, 0], "rot": 90 }
  ]
}
```

Sortie : `{ ok, placed: [...], rejected: [{ index, reason }] }` — collision = rejet de cette entrée, le reste du lot peut passer (ou tout-ou-rien : trancher en LT4 ; préférer **partiel + raisons** pour un agent).

## Critères

- `pnpm dev` + `pnpm mcp:brick-lab` + Cursor : `status` → connecté sur brick-lab.
- `place_bricks` visible immédiatement dans la vue ; undo UI annule le lot.
- Hors brick-lab ou sans jeton : erreur claire, pas de mute fail.

## Config Cursor (exemple)

1. `pnpm dev` — ouvrir le level **brick-lab** (le bus écoute `127.0.0.1:3847`, jeton dans `data/brick-lab-mcp.token`).
2. Ajouter le serveur MCP (projet ou user) :

```json
{
  "mcpServers": {
    "brick-lab": {
      "command": "node",
      "args": ["src/mcp/brickLabServer.mjs"],
      "cwd": "C:/Local/Travail/Web/Brick-Racer"
    }
  }
}
```

Sous Windows, préférer `node` directement (évite les soucis de résolution `pnpm` dans Cursor). Équivalent script : `pnpm mcp:brick-lab`.

Exemple projet : [`.cursor/mcp.json`](../../.cursor/mcp.json). Checklist : `pnpm dev` → ouvrir **brick-lab** → recharger le serveur MCP Cursor → `status` connecté. Ne pas committer le jeton ni `data/brick-lab-captures/`.

3. Appeler `status` puis `place_bricks` — les briques apparaissent dans la session ouverte.

Script : [`src/mcp/brickLabServer.mjs`](../../src/mcp/brickLabServer.mjs) · bus : [`src/main/brickLabMcpBus.ts`](../../src/main/brickLabMcpBus.ts).

## Historique

| Date | Note |
| ---- | ---- |
| 2026-10-31 | Consignation architecture bus + outils lot 1 |
| 2026-10-31 | LT4/LT5 : bus + serveur stdio + exemple mcp.json |
| 2026-10-31 | Lot 2 agent (dry-run, macros, capture, skill) → [brick-lab-agent.md](brick-lab-agent.md) · [BRICK-BA](../sprints/BRICK-BA.md) |
