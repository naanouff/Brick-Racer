# Authoring décors brick — prompts Gemini v2

Pipeline : [brick-decor-pipeline.md](../plans/brick-decor-pipeline.md) · sprint [BRICK-DC1](../sprints/BRICK-DC1.md) (runtime) · [BRICK-DC2](../sprints/BRICK-DC2.md) (ces prompts).

```mermaid
flowchart LR
  p0[Prompt0 image ortho] --> img[Planche face cote dessus]
  img --> pA[PromptA fiche cotes]
  pA --> fiche[Fiche validee a l oeil]
  fiche --> pB[PromptB couches ASCII]
  pB --> layers["*.layers.json"]
  layers --> cli["pnpm brick:layers"]
  cli --> manual["*.manual.json"]
  manual --> lab[brick-lab ortho + overlay]
```

Gemini **ne code pas**. Il produit du texte / JSON. Le convertisseur déterministe `brickifyLayers` choisit les pièces catalogue.

Catalogue : [`parts.json`](../../src/racer/hub/brick/catalog/data/parts.json) · [`colors.json`](../../src/racer/hub/brick/catalog/data/colors.json).  
Couleurs ids : `white` · `black` · `yellow` · `lime` · `sand` · `gray` · `dark_gray` · `terracotta` · `cyan` · `clear`.  
Unités : 1 stud = 0,33 m (X/Z) · 1 plate = 0,11 m (Y) · 1 brick = 3 plates.

---

## Prompt 0 — Image de référence exploitable

Usage : générateur d’image (Gemini / autre). **Pas** de perspective. Modèle de composition : [elev-scale-sheet.png](art/elev-scale-sheet.png).

```text
Planche technique LEGO / brick, fond gris neutre uni, sans perspective.
Trois vues orthographiques alignées de LA MÊME construction :
1) dessus (plan)  2) face  3) côté
Grille de studs visible (lignes fines) sur chaque vue, échelle lisible.
Palette plastique limitée (jaune, noir, gris, cyan, blanc, terracotta…).
Pas de texte hors cotes optionnelles en studs / plates.
Pas de décor de fond, pas d’ombre portée complexe, pas de minifig.
Sujet : <décrire le landmark, ex. dalle de départ 8×6 studs jaune et noir>
```

Livrable : une image (ou trois) à coller ensuite dans brick-lab en overlay (`public/brick-refs/`).

---

## Prompt A — Fiche de cotes

Joindre l’image ortho. Gemini rend **uniquement** le JSON fiche (pas de markdown).

```text
Tu es un designer LEGO pour Brick-Racer. À partir de l’IMAGE ORTHO jointe, produis UNIQUEMENT un JSON fiche de cotes (pas de markdown).

{
  "id": "landmark.<nom>",
  "title": "titre court",
  "footprintStuds": [W, D],
  "heightPlates": H,
  "colors": ["yellow", "black"],
  "volumes": [
    { "name": "base", "kind": "plate|brick|tile", "notes": "une phrase" }
  ],
  "specials": [
    { "name": "optionnel dish/macaroni", "partHint": "3960", "notes": "…" }
  ]
}

Règles :
- footprintStuds = emprise au sol en studs entiers, lue sur la vue dessus
- heightPlates = hauteur totale en plates (1 brick = 3)
- colors = ids colors.json présents sur l’image
- Ne pas inventer de pièces hors silhouette ; specials seulement si formes rondes / pentes évidentes
- Pas de coordonnées at[] ici
```

Valider à l’œil (W×D, hauteur, couleurs) avant le Prompt B.

---

## Prompt B — Couches ASCII

Joindre l’image ortho **et** la fiche validée. Gemini rend **uniquement** le `.layers.json`.

```text
Tu es un designer LEGO pour Brick-Racer. Produis UNIQUEMENT un JSON au format couches (pas de markdown).

Format exact :
{
  "id": "landmark.<nom>",
  "version": 1,
  "title": "...",
  "footprint": [W, D],
  "legend": { "Y": "yellow", "K": "black" },
  "layers": [
    { "kind": "plate", "rows": ["KKKK…", "KYYY…"] }
  ],
  "ops": []
}

Règles dures :
- footprint = footprintStuds de la fiche ; rows.length = D ; chaque row.length = W
- Caractère = 1 stud ; "." = vide ; lettres de legend uniquement
- kind ∈ { plate, brick, tile } ; empilement bas → haut ; plate/tile = 1P, brick = 3P
- legend → ids colors.json d’après l’image
- ops[] : uniquement des ops "brick" pour pièces spéciales (dish, macaroni, cone…) avec at [sx,py,sz] entiers relatifs au centre footprint — PAS de ring/disc/wall/box
- Ne pas inventer d’IDs part hors catalogue ; pour le remplissage grille, brickify choisira les pièces — tu ne mets QUE des lettres couleurs dans rows
- Fidélité silhouette / couleurs à l’image ; pas de sujet substitué
```

Enregistrer sous `src/racer/hub/brick/layers/<stem>.layers.json`, puis :

```bash
pnpm brick:layers src/racer/hub/brick/layers/<stem>.layers.json
```

Contrôle : brick-lab · vues Face / Côté / Dessus · overlay.

---

## Boucle d’erreurs

**Validation schema / brickify** — recoller :

```text
Ce JSON couches a été rejeté. Corrige UNIQUEMENT le JSON (même format), sans explication.

Erreurs :
<coller le message validateLayers / BrickifyError>
```

**Fidélité visuelle** (après overlay brick-lab) — recoller :

```text
Le rendu brick-lab ne correspond pas à l’image ortho. Corrige UNIQUEMENT le JSON couches.

Écart observé :
- <ex. couche 0 trop large de 2 studs sur X>
- <ex. jaune manquant au centre>
- <ex. hauteur 1 plate au lieu de 2>

Image et fiche de cotes inchangées sauf si tu dois ajuster footprint/height.
```

---

## Annexe — format manuel runtime (généré, ne pas demander à Gemini)

Sortie de `brickifyLayers` : [`manualSchema`](../../src/racer/hub/brick/manual/manualSchema.ts) → `assembleManual` → `bakeShell` → LDraw.  
Legacy v1 (Gemini → `at[]` / macros) : abandonné pour les nouveaux décors ; fichier historique conservé uniquement comme référence d’échec.
