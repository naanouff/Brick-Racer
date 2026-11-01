# Sprint BRICK-HV — Volets brick-lab + hiérarchie BOM

Découpage de [docs/plans/brick-lab-hierarchy.md](../plans/brick-lab-hierarchy.md).  
Réfs : [brick-lab-editor.md](../plans/brick-lab-editor.md) · [BRICK-ED](BRICK-ED.md) · [BRICK-LT](BRICK-LT.md) · [dev-atelier.md](../plans/dev-atelier.md) · [BRICK-UIM2](BRICK-UIM2.md).

Objectif : en brick-lab, **catalogue repliable à droite** et **volet hiérarchie à gauche** (Manuel → Étapes → Sous-étapes → briques, BOM agrégée par nœud). L’arbre est en lecture seule + sélection synchronisée avec le 3D. Le schéma de manuel gagne `substeps` ; l’éditeur cesse d’aplatir les étapes.

Ordre : **HV1 → HV2 → HV3 → HV4 → HV5 → HV6**. Chaque ticket de code : `pnpm test` + `pnpm check`. Aucun commit sans demande. TDD (rouge → vert → refactor).

Branche prévue : `feature/brick-lab-hierarchy` depuis `develop`. PR cible : `develop`.

Prérequis : ED4–ED6 (état éditeur, pose, palette Atelier) ; shell Atelier React (port UIM2) ; MCP `get_assembly` / `place_assembly` (LT). Soft : un manuel multi-étapes pour playtest.

---

## BRICK-HV1 — Schéma `substeps` + flatten

Fichiers : [`manualSchema.ts`](../../src/racer/hub/brick/manual/manualSchema.ts), lecteurs de `.steps` ([`assembleManual.ts`](../../src/racer/hub/brick/manual/assembleManual.ts), [`brickifyAssembly.ts`](../../src/racer/hub/brick/manual/brickifyAssembly.ts), [`mcpCommands.ts`](../../src/racer/levels/brickLab/editor/mcpCommands.ts), éventuellement [`layers-to-manual.mjs`](../../scripts/brick/layers-to-manual.mjs)), `tests/manualSubsteps.test.ts`.

Fait quand :

- `ManualStep = { title; ops; substeps?: ManualStep[] }`.
- `validateManual` récursif (chemins `steps[i].substeps[j].ops[k]`) ; profondeur max **2** (étape → sous-étape) ; au-delà = erreur.
- Helper `flattenManualOps(manual)` : ordre de construction = ops de l’étape puis ops des sous-étapes (récursif).
- Tous les lecteurs runtime / MCP / brickify qui itéraient `.steps` passent par `flattenManualOps` (comportement inchangé sur les manuels sans `substeps`).
- Tests : sous-étape valide ; profondeur 3 refusée ; flatten respecte l’ordre ; `place_assembly` avec sous-étapes.

## BRICK-HV2 — Éditeur conserve les étapes

Fichiers : [`editorState.ts`](../../src/racer/levels/brickLab/editor/editorState.ts), [`editorIo.ts`](../../src/racer/levels/brickLab/editor/editorIo.ts), [`mcpCommands.ts`](../../src/racer/levels/brickLab/editor/mcpCommands.ts) (`get_assembly`), tests editor IO.

Fait quand :

- `EditorStepNode = { id; title; children: EditorStepNode[] }` ; `EditorState.steps` ; chaque `EditorBrickOp` a un `stepId`.
- Nouvelles briques → dernière étape de premier niveau (créée `1 — construction` si absente).
- `manualToEditorState` conserve titres + sous-étapes ; `editorStateToManual` reconstruit l’arbre (étapes vides omises) ; `partsList` reste global.
- `get_assembly` reste rétrocompatible (`ops` à plat) et expose `stepId` + arbre `steps`.
- Tests : roundtrip titres / sous-étapes ; brique ajoutée tombe dans la dernière étape.

## BRICK-HV3 — Modèle `buildBomHierarchy`

Fichiers : `src/racer/levels/brickLab/editor/bomHierarchy.ts` (nouveau), `tests/bomHierarchy.test.ts`.

Fait quand :

- `BomNode = { id; kind: 'manual'|'step'|'substep'|'brick'; label; bom: {part,color,qty}[]; count; children }`.
- `buildBomHierarchy(state)` : BOM d’un nœud = agrégat des descendants ; libellés type notice (« Étape 2 », « 2.a »).
- Tests : agrégation parent ← enfants ; numérotation ; comptes.

## BRICK-HV4 — Maquette `atelier.html` (brick-lab)

Fichiers : [`docs/mocup/atelier.html`](../mocup/atelier.html), éventuellement [`docs/mocup/README.md`](../mocup/README.md).

Fait quand :

- Vue brick-lab : volet gauche Hiérarchie (Manuel / Étapes / Sous-étapes / BOM / briques, ligne active) + volet droit Catalogue.
- Les deux volets se replient (languette) via JS local (pas de dépendance app).
- Tokens [ui-ux.md](../design/ui-ux.md) §2. Rail scènes reste en mode icônes.
- Checklist visuelle : repli gauche / droite laisse le viewport lisible ; contraste paper / ink OK.

## BRICK-HV5 — Shell React : volets repliables

Fichiers : [`AtelierShell.tsx`](../../src/renderer/atelier/AtelierShell.tsx), [`atelier.css`](../../src/renderer/atelier/atelier.css), [`main.tsx`](../../src/renderer/main.tsx) (host hiérarchie si déjà stub), [`tests/uiUxRegression.test.ts`](../../tests/uiUxRegression.test.ts).

Fait quand :

- Grille brick-lab à **4 colonnes** : rail · tree · viewport · drawer.
- `<aside class="br-atelier-tree">` (en-tête « Hiérarchie », collapse) ; tiroir catalogue avec collapse.
- Classes `is-tree-collapsed` / `is-drawer-collapsed` ; languettes `br-atelier-panel-tab` ; tokens existants (bordure ink 4 px, paper, stud-yellow sélection).
- Raccourcis `[` / `]` ; persistance `localStorage` clé `br.brickLab.panels`.
- Toolbar flottante en colonne viewport.
- Invariants uiUx : `--menubar-h` ; pas de `--rail-w: 56px` forcé sur `.is-brick-lab` ; présence des classes / raccourcis.

## BRICK-HV6 — Widget hiérarchie + branchement

Fichiers : `src/renderer/brickLab/BrickHierarchyPanel.tsx` (nouveau), [`BrickLabBuildPanel.tsx`](../../src/renderer/brickLab/BrickLabBuildPanel.tsx), [`main.tsx`](../../src/renderer/main.tsx), uiUx / tests dédiés.

Fait quand :

- Arbre accessible : `role="tree"` / `treeitem` / `aria-expanded` ; navigation flèches.
- Nœud étape : chevron, titre, badge count, ligne BOM repliable.
- Feuille brique : pièce, couleur, position ; clic → `selectEditorOp` + sync runtime (comme l’outil Sélection).
- Sélection 3D met en surbrillance la ligne de l’arbre.
- Portail `hierarchyHost` (même pattern que `catalogHost` / `toolbarHost`).
- `pnpm test` + `pnpm check` verts sur la zone touchée.

---

## Hors de ce sprint

- DnD / création / renommage d’étapes dans l’UI.
- Sous-assemblages = fichiers manuels séparés (références).
- Masquage / solo 3D par nœud.
- Coque joueur [BRICK-UI1](BRICK-UI1.md).

---

## Relation

| Livrable | Rôle |
| -------- | ---- |
| **ED** | Pose + IO éditeur (base) |
| **LT** | Outils + MCP |
| **UIM2** | Canon Atelier (rail / tiroir) |
| **HV** | Volets brick-lab + structure d’étapes / BOM dans l’UI |
