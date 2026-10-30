# Prompt Gemini — mode d’emploi brick (Brick-Racer)

**Usage** : joindre une **image de référence** (photo / concept de la construction) + le prompt manuel ci-dessous → Gemini rend **uniquement** le JSON d’assemblage.

Pipeline runtime : image → JSON → `validateManual` → `assembleManual` → `bakeShell` → **LDraw InstancedMesh** (Brick Lab) ; proxy box si l’IPC LDraw est absent.  
Gemini **ne code pas** ; il ne rend que le JSON.

Les champs `part` sont des **design numbers LDraw** (`parts/<id>.dat`), chargés par `spawnLandmarkLdraw`.

---

## Catalogue (autorisé uniquement)

Source de vérité : [`parts.json`](../../src/racer/hub/brick/catalog/data/parts.json) + [`colors.json`](../../src/racer/hub/brick/catalog/data/colors.json) (plan [brick-part-catalog.md](../plans/brick-part-catalog.md)).

### Règle d’ID (LDraw)

- **Obligatoire** : **design number LDraw** (`3005`, `6141`, `3960`, `85080`, …) — id du `.dat` et clé Brick Lab.
- Alias legacy (`1x1`, `plate_1x1`, …) acceptés par le validateur, **interdits** dans les manuels générés.
- Pièce absente de `parts.json` = **refus** — l’ajouter au catalogue avant usage.
- Brick Lab charge les `.dat` ; fallback box si l’IPC manque.

### Pièces (extrait — seed BC1)

| Id LDraw | Alias legacy | Emprise |
| -------- | ------------ | ------- |
| `3005` | `1x1` | 1×3×1 |
| `3004` | `1x2` | 1×3×2 |
| `3003` | `2x2` | 2×3×2 |
| `3001` | `2x4` | 2×3×4 |
| `3020` | `plate` | 2×1×4 |
| `3068` | `tile` | 2×1×2 |
| `6141` | `plate_1x1` | 1×1×1 |
| `41539` | `3128` | 8×1×8 |
| `85080` | — | 2×3×2 | macaroni 2×2 |
| `48092` | — | 4×3×4 | macaroni 4×4 |
| `3941` | — | 2×3×2 |
| `3960` / `4740` | — | dish |
| `4589` | `4589b` | 1×3×1 |

Liste complète = `parts.json` (70+ pièces, extensible).

`rot` ∈ `{0, 90, 180, 270}` (yaw Y). À 90°/270°, X et Z de l’emprise s’échangent.  
Dishes `3960` / `4740` : retournées automatiquement au spawn (bol vers le haut) — pas d’autre pitch dans le JSON.

### Couleurs (`color`)

`white` · `black` · `yellow` · `lime` · `sand` · `gray` · `dark_gray` · `terracotta` · `cyan` · `clear`  
(+ aliases `lbg`, `trans_light_blue`, …)  
Choisir les couleurs **d’après l’image jointe**.

### Unités

- **1 stud (S)** = 0,33 m — X / Z  
- **1 plate (P)** = 0,11 m — Y  
- **1 brick (B)** = 3 plates = 0,33 m  
- Coordonnées = **entiers** (studs / plates), relatives à `origin`  
- `at: [sx, py, sz]` = coin **min** de la pièce  
- `ring` / `disc` : pas de `center` — centre = `origin` ; `radius` + `y` suffisent

### Enveloppe / placement

- `id` : `landmark.<nom>` (ex. dérivé du sujet de l’image)  
- `origin` : `[20, 0, 20]` mètres monde (Brick Lab recentre à `[0,0,0]`)  
- `envelope.size` : AABB mètres qui contient toute la construction vue sur l’image (élargir si besoin)

---

## Format JSON (sortie obligatoire)

```json
{
  "id": "landmark.example",
  "version": 1,
  "title": "Titre court décrivant la construction",
  "origin": [20, 0, 20],
  "envelope": { "size": [3, 2, 3] },
  "partsList": [
    { "part": "3005", "color": "gray", "qty": 8 },
    { "part": "6141", "color": "cyan", "qty": 16 }
  ],
  "steps": [
    {
      "title": "1 — Base",
      "ops": [
        { "op": "disc", "part": "6141", "color": "cyan", "radius": 3, "y": 0 }
      ]
    },
    {
      "title": "2 — Élément suivant",
      "ops": [
        { "op": "brick", "part": "3005", "color": "gray", "at": [-1, 0, -1] }
      ]
    }
  ]
}
```

### Macros `ops`

| `op` | Champs | Effet |
| ---- | ------ | ----- |
| `brick` | `part`, `color`, `at`, `rot?` | Une pièce |
| `ring` | `part`, `color`, `radius`, `y`, `courses?`, `count?` | Anneau autour de `origin` |
| `disc` | `part`, `color`, `radius`, `y`, `filled?`, `innerRadius?` | Disque / anneau plat |
| `wall` | `part`, `color`, `from`, `to`, `y`, `heightCourses?` | Mur grille |
| `box` | `part`, `color`, `min`, `max` | Remplissage AABB (bake retire l’intérieur) |

`partsList` = nomenclature récap ; les `steps` font foi.

---

## Prompt manuel JSON (copier-coller)

Joindre **l’image de référence** de la construction (obligatoire).

```text
Tu es un designer LEGO pour le jeu Brick-Racer. Tu produis UNIQUEMENT un JSON valide (pas de markdown, pas de commentaire) au format « mode d'emploi brick » ci-dessous.

Objectif principal :
- Reproduire fidèlement l’ASSEMBLAGE de la construction visible sur l’IMAGE DE RÉFÉRENCE jointe
- Même silhouette, mêmes volumes, mêmes couleurs, même empilement / disposition des pièces
- Ne rien inventer qui n’apparaît pas sur l’image ; ne pas substituer un autre sujet

Contraintes dures :
- Champ "part" = design number LDraw UNIQUEMENT (ex. "3005", "6141", "85080", "3960", "4740", "4589", "41539", "3941") — PAS d'alias "1x1" / "plate_1x1" / "2x2"
- La pièce doit exister dans parts.json ; N’INVENTE PAS d’ID hors catalogue
- Couleurs = ids colors.json, choisies d’après l’image (gray, cyan, clear, white, sand, …)
- Coordonnées entières : X/Z en studs, Y en plates ; `at` = coin min de la pièce (relatif à origin, PAS des mètres monde)
- rot ∈ {0, 90, 180, 270} (yaw seulement)
- ring / disc : `radius` + `y` (PAS de `center` — le centre est origin)
- Tout dans envelope.size autour de origin [20, 0, 20] ; dimensionner envelope pour contenir la construction de l’image
- Brick Lab charge les meshes LDraw (.dat) — choisir des IDs qui existent en LDraw
- Macros ring / disc / brick / wall / box ; partsList + steps numérotés type notice LEGO
- Pas de chevauchement ; pas de pièce hors catalogue

Format exact :
{
  "id": "landmark.<nom>",
  "version": 1,
  "title": "...",
  "origin": [20, 0, 20],
  "envelope": { "size": [W, H, D] },
  "partsList": [ { "part": "<ldrawId>", "color": "...", "qty": N } ],
  "steps": [
    { "title": "1 — ...", "ops": [ { "op": "ring"|"disc"|"brick"|"wall"|"box", "part": "<ldrawId>", ... } ] }
  ]
}

L’image jointe est la seule référence de forme et de couleurs.
Génère le mode d'emploi complet qui assemble cette construction.
```

### Boucle d’erreurs

Si `validateManual` / tests échouent, recoller à Gemini :

```text
Ce JSON a été rejeté. Corrige UNIQUEMENT le JSON (même format), sans explication.

Erreurs :
<coller le message d'erreur>
```

---
