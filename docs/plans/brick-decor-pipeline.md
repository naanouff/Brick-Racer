# Plan : pipeline décors brick (couches → brickify)

Sprints : [BRICK-DC1](../sprints/BRICK-DC1.md) · [BRICK-DC2](../sprints/BRICK-DC2.md) · [BRICK-DC3](../sprints/BRICK-DC3.md) · [BRICK-DC4](../sprints/BRICK-DC4.md).  
**Voie principale (ronds / fidélité pièce-à-pièce)** : [brick-lab-editor.md](brick-lab-editor.md) · [BRICK-ED](../sprints/BRICK-ED.md).  
Checklist prod : [brick-decor-checklist.md](../design/brick-decor-checklist.md).  
Rendu / instancing : [brick-world-rendering.md](brick-world-rendering.md) · [BRICK-BW1](../sprints/BRICK-BW1.md).  
Authoring esquisse / grilles : [brick-manual-prompt.md](../design/brick-manual-prompt.md).  
Catalogue pièces : [brick-part-catalog.md](brick-part-catalog.md) · [parts.json](../../src/racer/hub/brick/catalog/data/parts.json).

Branche prévue : `feature/brick-decor-layers` depuis `develop`. PR cible : `develop`.

## Statut (2026-10-30)

DC0–DC4 livrés (ortho, couches, brickify, assembly). Les formes **rondes multi-étages** (fontaine) restent peu fidèles via Gemini + ops ; la production de ces landmarks bascule sur l’éditeur manuel (**ED**). Ce plan reste la référence pour dalles / façades / grilles ASCII.

## Problème

Le workflow v1 demande à Gemini de produire un `BrickManual` avec des `at: [sx, py, sz]`, des `radius` et des macros `ring` / `disc` / `wall` / `box`. Le JSON **passe** souvent `validateManual`, mais le résultat **n’est pas fidèle** à l’image :

| Cause | Effet |
| ----- | ----- |
| Raisonnement spatial LLM | Mauvais comptage de studs ; empreintes mal gérées avec `rot` |
| Macros arrondies | `ring` / `disc` + `innerRadius` divergent de la silhouette voulue |
| Image en perspective | Pas d’échelle ni de cotes ; Gemini invente les proportions |
| Pas de mesure | brick-lab sans vue ortho ni overlay → « fidèle » reste une impression |

Les couches runtime restent saines et **inchangées** : `validateManual` → `assembleManual` → `bakeShell` → instances LDraw ([`src/racer/hub/brick/manual/`](../../src/racer/hub/brick/manual/)).

## Décision

Gemini décrit **ce qu’il voit**, couche par couche (grilles ASCII, une lettre = un stud). Un convertisseur **déterministe** (`brickifyLayers`) choisit les pièces catalogue et émet le `BrickManual` existant.

| Choix | Décision |
| ----- | -------- |
| Entrée Gemini | `*.layers.json` (pixel-art par plate / brique / tile) |
| Sortie | `*.manual.json` (ops `brick` + ops libres pour pièces spéciales) |
| Placement pièces | Remplissage glouton rectangles (2×4 → 1×1) depuis `parts.json` |
| Coordonnées | Origine centrée sur `footprint` ; enveloppe **calculée**, jamais inventée |
| Images source | Planches **ortho** face / côté / dessus sur grille de studs |
| Boucle qualité | Overlay référence dans brick-lab + caméra ortho |
| Hors scope immédiat | API Gemini auto, Meshy→voxel, IoU silhouette auto |

```mermaid
flowchart LR
  refImg[Image ortho grille] --> geminiA[Gemini A fiche cotes]
  geminiA --> geminiB[Gemini B couches ASCII]
  geminiB --> layers["*.layers.json"]
  layers --> brickify[brickifyLayers]
  brickify --> manual["*.manual.json"]
  manual --> pipeline[validate assemble bakeShell]
  pipeline --> lab[brick-lab ortho + overlay]
  lab -->|ecart| geminiB
```

## Format `*.layers.json` (v1)

```json
{
  "id": "landmark.pad",
  "footprint": [8, 6],
  "legend": { "Y": "yellow", "K": "black", "G": "gray" },
  "layers": [
    {
      "kind": "plate",
      "rows": [
        "KKKKKKKK",
        "KYYYYYYK",
        "KYKKKKYK",
        "KYKKKKYK",
        "KYYYYYYK",
        "KKKKKKKK"
      ]
    }
  ],
  "ops": []
}
```

| Champ | Règle |
| ----- | ----- |
| `rows` | Une chaîne par rangée Z ; un caractère par stud X ; `.` = vide ; longueur = `footprint[0]` ; nombre de rangées = `footprint[1]` |
| `kind` | `plate` (1P) · `brick` (3P) · `tile` (1P, lisse) — empilement bas → haut |
| `legend` | Lettre → id `colors.json` |
| `ops` | Ops `brick` manuelles (dish `3960`, macaroni `85080`, cone `4589`, …) après les couches |
| Enveloppe | Dérivée de footprint × hauteur des couches (+ ops) |

## Incréments

Chaque incrément : `pnpm test` + `pnpm check` + décor visible dans `brick-lab`. Aucun commit sans demande.

| Id | Contenu | Preuve |
| -- | ------- | ------ |
| **DC0** | Caméra ortho Face / Côté / Dessus ; overlay image référence ; registre manuels via `import.meta.glob` ; corpus + critères fidélité | Fontaine / pad / gate : checklist silhouette, ±1 stud, couleurs |
| **DC1** | `layersSchema` + `brickifyLayers` + `pnpm brick:layers` + tests ; fontaine refaite en couches | Overlay vs [ref-fountain-ortho.png](../design/art/ref-fountain-ortho.png) |
| **DC2** | Prompts v2 (image ortho, fiche cotes, couches) ; boucle d’erreurs visuelle | `landmark.pad` entièrement via workflow |
| **DC3** | Appareillage décalé, tiles auto, modificateurs pentes (`/` → slope catalogue) | `landmark.gate` dans brick-lab puis `city-test` |
| **DC4** | `*.assembly.json` multi-modules + checklist prod | Tour + façades (garage / vinyle / mairie) |

Ordre landmarks (aligné [brick-world-rendering.md](brick-world-rendering.md)) : fontaine (preuve) → **pad** → **gate** → **tower** → façades.

## Fichiers cibles

| Fichier | Rôle |
| ------- | ---- |
| [`layersSchema.ts`](../../src/racer/hub/brick/manual/layersSchema.ts) | Types + `validateLayers` |
| [`brickifyLayers.ts`](../../src/racer/hub/brick/manual/brickifyLayers.ts) | Couches → `BrickManual` (pur, déterministe) |
| `scripts/brick/layers-to-manual.ts` | CLI `pnpm brick:layers` |
| `src/racer/hub/brick/layers/<id>.layers.json` | Sources authoring |
| `src/racer/hub/brick/manuals/<id>.manual.json` | Sortie versionnée (consommée runtime) |
| [`registry.ts`](../../src/racer/hub/brick/manuals/registry.ts) | Glob de tous les `*.manual.json` |
| [`spawnBrickLab.ts`](../../src/racer/levels/brickLab/spawnBrickLab.ts) | Vues ortho |
| [`brick-manual-prompt.md`](../design/brick-manual-prompt.md) | Prompts v2 (DC2) |

## Hors scope (premier passage)

- CLI / clé API Gemini (copier-coller manuel conservé).
- Image → 3D (Meshy) → voxelisation (réévaluer si DC2 insuffisant pour formes organiques).
- Comparaison automatique de silhouettes (IoU) — overlay manuel suffit en DC0.
- Fusion 1×1 → 2×4 au bake (déjà hors BW1) ; impostors skyline.

## Critères de succès (plan)

- Un décor **grille** = image ortho + `.layers.json` + brickify + overlay OK.
- Un décor **rond / pièce-à-pièce** = éditeur brick-lab (ED) + overlay OK.
- Silhouette et proportions dans ±1 stud vs référence ; couleurs d’après l’image.
- Pipeline runtime BW1 inchangé (même `assembleManual` / `bakeShell` / LDraw).
- Perf `city-test` : `dc` / FPS stables vs landmarks BW1 existants.

## Corpus fidélité (DC1a)

Cibles pour valider le workflow avant / pendant brickify :

| Landmark | Réf. image | Critères « fidèle » |
| -------- | ---------- | ------------------- |
| **fontaine** | [ref-fountain-ortho.png](../design/art/ref-fountain-ortho.png) · overlay `/brick-refs/fountain-ortho.png` | Silhouette 3 paliers ; proportions ±1 stud ; gris + cyan (**canon** — ne pas regénérer) |
| **pad** | [ref-pad-ortho.png](../design/art/ref-pad-ortho.png) · overlay [`pad-ortho.png`](../../public/brick-refs/pad-ortho.png) | 24×18 × 2P ; jaune / noir ; Prompt 0 livré |
| **gate** | [ref-gate-ortho.png](../design/art/ref-gate-ortho.png) · overlay [`gate-ortho.png`](../../public/brick-refs/gate-ortho.png) | Coquillage + chaînes ; terracotta/sand ; Prompt 0 livré |
| **tower** | [ref-tower-ortho.png](../design/art/ref-tower-ortho.png) · overlay [`tower-ortho.png`](../../public/brick-refs/tower-ortho.png) | Socle + fût penché ; gris / terracotta ; Prompt 0 livré |
| **billboard** | [ref-billboard-ortho.png](../design/art/ref-billboard-ortho.png) · overlay [`billboard-ortho.png`](../../public/brick-refs/billboard-ortho.png) | 24×6 × 50P ; magenta imprimé ; Prompt 0 livré |
| **garage** | [ref-garage-ortho.png](../design/art/ref-garage-ortho.png) · overlay [`garage-ortho.png`](../../public/brick-refs/garage-ortho.png) | 24×24 × 42P ; Prompt 0 livré |
| **vinyle** | [ref-vinyle-ortho.png](../design/art/ref-vinyle-ortho.png) · overlay [`vinyle-ortho.png`](../../public/brick-refs/vinyle-ortho.png) | 18×18 × 36P ; Prompt 0 livré |
| **mairie** | [ref-mairie-ortho.png](../design/art/ref-mairie-ortho.png) · overlay [`mairie-ortho.png`](../../public/brick-refs/mairie-ortho.png) | Socle + statue ; Prompt 0 livré |

Playtest détaillé : [brick-decor-checklist.md](../design/brick-decor-checklist.md) § Playtest brick-lab.

## Historique

| Date | Note |
| ---- | ---- |
| 2026-10-30 | Consignation : diagnostic v1, format couches, incréments DC0–DC4, ouverture sprint DC1 |
| 2026-10-30 | DC1a : corpus fidélité + overlay runtime `public/brick-refs/` |
| 2026-10-30 | DC2 : prompts v2 + `landmark.pad` (couches → manuel) |
| 2026-10-30 | DC4 : `*.assembly.json` + tour + checklist prod |
| 2026-10-30 | Pivot : fontaine ronde → éditeur manuel ED ; DC reste pour grilles |
