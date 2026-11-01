# Plan : outils brick-lab (fantôme, caméra, Lucide, MCP)

Sprint : [BRICK-LT](../sprints/BRICK-LT.md).  
Suite de : [brick-lab-editor.md](brick-lab-editor.md) · [BRICK-ED](../sprints/BRICK-ED.md).  
MCP agent lot 1 : [brick-lab-mcp.md](brick-lab-mcp.md). Lot 2 (agent image/notice) : [brick-lab-agent.md](brick-lab-agent.md) · [BRICK-BA](../sprints/BRICK-BA.md).  
Checklist décors : [../design/brick-decor-checklist.md](../design/brick-decor-checklist.md).

Branche prévue : `feature/brick-lab-tools` depuis `develop`. PR cible : `develop`.

## Problème

L’éditeur brick-lab (ED) pose et enregistre des manuels, mais quatre frictions bloquent la construction sérieuse et l’assistance agent :

| Cause | Effet |
| ----- | ----- |
| Fantôme pinceau sans yaw | Empreinte tournée, boîte / mesh fantôme encore à 0° — impossible de viser une 1×4 à 90° ou une pente à 180° |
| Clic gauche avalé par l’édition | Impossible de tourner la vue en construisant ; le chip Orbit ne fait que recadrer et remet les angles à zéro |
| Barre texte + SVG maison | Pas d’icônes Lucide ; toolbar / menu / catalogue / rail Atelier incohérents |
| Pas de pont agent | Un agent ne peut pas piloter la session ouverte ; écrire un `.manual.json` diverge de l’éditeur |

## Décision

| Choix | Décision |
| ----- | -------- |
| Fantôme | Même packing que les briques posées (`BrickPose` + yaw) ; LDraw si cache, sinon boîte yawée |
| Caméra | Outils **Orbite** / **Pan** ; Pinceau et Sélection **verrouillent** la vue ; chip Orbit → **Cadrer** |
| UI | `lucide-react`, taille 16, tokens Atelier paper/ink inchangés |
| Agent | MCP stdio → bus `127.0.0.1` (dev) → session React ; une seule source de vérité |

```mermaid
flowchart LR
  Ghost[Fantome yaw]
  Cam[Outils Orbite Pan]
  Lucide[Lucide UI]
  Mcp[MCP brick-lab]
  Ghost --> Cam
  Cam --> Lucide
  Lucide --> Mcp
  Mcp --> Editor[Session editorState]
```

## 1. Fantôme pinceau + yaw

La pièce **posée** tourne : [`placeEditorBrick`](../../src/racer/levels/brickLab/editor/editorState.ts) → `rot` → [`placeBrick`](../../src/racer/hub/brick/manual/assembleManual.ts) `yaw: rotToYawRad(rot)` → [`packLdrawInstanceData`](../../src/racer/hub/brick/brickLdrawInstanceData.ts) / [`packBrickInstanceData`](../../src/racer/hub/brick/brickInstanceData.ts).

La pièce **à poser** non. `previewGhost` dans [`BrickLabBuildPanel.tsx`](../../src/renderer/brickLab/BrickLabBuildPanel.tsx) décale le centre (swap X/Z) puis appelle `previewCatalogPart` **sans yaw** ; [`packSizedInstance`](../../src/racer/hub/brick/catalog/spawnCatalogPreview.ts) = quaternion identité. [`previewCatalogMesh`](../../src/racer/scene/SceneDirector.ts) est limité à `catalog-lab` et spawn à l’origine.

Correctif :

- Fantôme = `BrickPose` (centre [`gridMinToWorldCenter`](../../src/racer/hub/brick/manual/partFootprint.ts), `yaw` via `rotToYawRad`).
- Mesh LDraw en cache : `packLdrawInstanceData` (+ flip dishes `3960` / `4740`), matière `BRICK_ghost_*`.
- Sinon boîte via `packBrickInstanceData` ; fetch LDraw **une fois par pièce** (pas à chaque `pointermove`).
- Étendre preview (`position`, `yaw`, `opacity`) et l’autoriser sur `brick-lab` ; restaurer après `syncBrickLabManual`.
- Test : 2×1 à 90° → étendues X/Z échangées ; 180° → yaw π.

## 2. Outils caméra

- Spec : `orbitalLeftMouseMode: 'rotate'` dans [`brickLabSpec.ts`](../../src/racer/levels/brickLab/brickLabSpec.ts).
- Éditeur : [`BrickLabBuildPanel.tsx`](../../src/renderer/brickLab/BrickLabBuildPanel.tsx) consomme boutons 0 et 2 → le clic gauche ne peut pas orbiter.
- Chip **Orbit** = recadrage 3/4 + `resetViewAngles` ([`applyBrickLabView`](../../src/racer/levels/brickLab/brickLabCamera.ts)), pas un mode libre.

`EditorTool` : `'brush' | 'select' | 'orbit' | 'pan'`.

| Outil | Raccourci | Comportement |
| ----- | --------- | ------------ |
| Orbite | `C` | Clic gauche drag = tourner ; molette = zoom ; pas de pose / effacement ; ne remet pas les angles |
| Pan | `H` | Clic gauche drag = pan ; molette = zoom |
| Pinceau / Sélection | `B` / `V` | Vue **verrouillée** (`leftMouseMode = null`) ; clic droit efface ; molette zoom OK |
| Face / Côté / Dessus | chips | Presets ortho, verrou d’édition |
| Cadrer (ex-Orbit) | chip | Recadrage 3/4 perspective ; distinct de l’outil Orbite |

En Orbite / Pan : ne pas consommer le pointeur côté édition ; `leftMouseMode` = `'rotate'` | `'pan'`. Revenir au pinceau conserve l’angle.

## 3. Lucide

Dépendance `lucide-react` (absente aujourd’hui). Remplacer SVG maison ([`sceneIcons.tsx`](../../src/renderer/atelier/sceneIcons.tsx), `Glyph` dans [`CatalogBrowserPanel.tsx`](../../src/renderer/catalog/CatalogBrowserPanel.tsx)) et enrichir la barre texte ([`BrickLabBuildPanel.tsx`](../../src/renderer/brickLab/BrickLabBuildPanel.tsx), [`BrickLabMenuBar.tsx`](../../src/renderer/brickLab/BrickLabMenuBar.tsx)).

- Taille 16, `strokeWidth` 2, `aria-hidden` ; bouton garde `title` / `aria-label`.
- Barre : `Paintbrush`, `MousePointer2`, `Rotate3d`, `Hand`, `Focus` / `RectangleVertical` / `PanelLeft` / `Square`, `Layers`, `RotateCw`, `Undo2`.
- Menu Fichier : `FilePlus`, `Save`, `FolderOpen`.
- Pas de refonte layout / thème.

## 4. MCP

Voir [brick-lab-mcp.md](brick-lab-mcp.md). Résumé lot 1 : bus local dev → renderer → `editorState` ; outils `place_bricks`, `set_brush`, undo/save/load. Lot 2 (macros, dry-run, capture, skill) : [brick-lab-agent.md](brick-lab-agent.md).

## Hors scope

- Macros / capture viewport / skill agent → [BRICK-BA](../sprints/BRICK-BA.md).
- MCP en build packagé / accès réseau hors localhost.
- Refonte Atelier hors icônes.
- Remplacement pipeline DC.

## Critères de succès

- Fantôme 1×4 à 90° et pente à 180° alignés sur la pose finale.
- Orbite tourne sans poser ; Pinceau / Sélection ne font plus bouger la vue au clic.
- Barre / menu / catalogue / rail : une famille Lucide.
- Agent MCP : `place_bricks` pendant `pnpm dev` visible dans brick-lab.

## Historique

| Date | Note |
| ---- | ---- |
| 2026-10-31 | Consignation après playtest ED : yaw fantôme, outils caméra, Lucide, MCP agent |
| 2026-10-31 | Suite agent lot 2 → [brick-lab-agent.md](brick-lab-agent.md) · [BRICK-BA](../sprints/BRICK-BA.md) |
