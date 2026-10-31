# Checklist production décor brick

Plans : [brick-lab-editor.md](../plans/brick-lab-editor.md) (voie principale) · [brick-decor-pipeline.md](../plans/brick-decor-pipeline.md) (couches / grilles).  
Sprint éditeur : [BRICK-ED](../sprints/BRICK-ED.md). Prompts esquisse : [brick-manual-prompt.md](brick-manual-prompt.md).

## Voie principale — construction manuelle (ED)

Pour landmarks ronds, multi-étages, ou fidélité pièce-à-pièce :

1. **Image ortho** — enregistrer sous `docs/design/art/` et copie `public/brick-refs/<stem>-ortho.*` pour overlay.
2. **Pièces manquantes** — catalog-lab : chercher → staging → écrire `parts.json` (miniatures si besoin).
3. **brick-lab → Construire** — Nouveau manuel ; palette + pose souris ; overlay ~30–50 %.
4. **Enregistrer** → `manuals/<stem>.manual.json` (IPC).
5. **Playtest** — procédure ci-dessous (vues ortho + orbit).
6. **Perf** — noter `dc` / FPS (`BrickRacerFast`) dans la barre Atelier.
7. **city-test** (si POI) — spawn landmark + collider AABB inchangé ; IDs stables.
8. **Commit** — manuel + overlay + note sprint (sur demande).

## Voie grilles — couches → brickify (DC)

Pour dalles, façades et formes rectangulaires en studs :

1. **Image ortho** — Prompt 0 ; `docs/design/art/` + `public/brick-refs/`.
2. **Fiche de cotes** — Prompt A (optionnel).
3. **Couches** — Prompt B ou édition manuelle → `layers/<stem>.layers.json` (ou `*.assembly.json`).
4. **Brickify** — `pnpm brick:layers <fichier>` → `manuals/<stem>.manual.json`.
5. **Playtest** brick-lab ; corriger layers / assembly si besoin.
6. **Perf / city-test / commit** — comme ci-dessus.

Gemini = esquisse ou remplissage de grille. Les ops rondes fidèles se posent dans l’éditeur (ED).

---

## Playtest brick-lab (fidélité)

Prérequis : `pnpm dev` · Atelier · scène **brick-lab**.

### Boucle par manuel

| # | Action | OK si |
| - | ------ | ----- |
| 1 | Tiroir **Manuel** → choisir le landmark (ou mode Construire) | Stats / pièces visibles ; mesh LDraw (boîte locale seulement si pièce absente) |
| 2 | **Vue → Dessus** | Emprise lisible ; pas de pièce hors silhouette attendue |
| 3 | **Vue → Face** puis **Côté** | Hauteur / paliers / ouvertures corrects (±1 stud) |
| 4 | Overlay : opacité ~30–50 % | Alignement silhouette vs réf ; couleurs dominantes OK |
| 5 | Overlay à 0 % puis **Orbit** | Lecture plastique / joints ; pas de trou évident |
| 6 | Toggle **enveloppe / plein** | Shell cull cohérent ; silhouette inchangée de loin |
| 7 | Noter FPS / `dc` / tri | Ressenti ≥60 `BrickRacerFast` ; `dc` pas explosé vs fontaine |

### Corpus actuel

Planches Prompt 0 (à produire) : [art/README.md](art/README.md) § Planches ortho · prompts [brick-manual-prompt.md](brick-manual-prompt.md) § Sujets city-test.

| Manuel | Overlay | Critères |
| ------ | ------- | -------- |
| `fountain` | `/brick-refs/fountain-ortho.png` | 3 paliers ; gris + cyan ; ±1 stud — **cible ED** (reconstruire à la main) |
| `pad` | `/brick-refs/pad-ortho.png` · [ref-pad-ortho.png](art/ref-pad-ortho.png) | 24×18 × 2P ; jaune / noir ; panneau FR — **Prompt 0 livré** |
| `gate` | `/brick-refs/gate-ortho.png` · [ref-gate-ortho.png](art/ref-gate-ortho.png) | Coquillage + chaînes ; 18×4 × 45P ; terracotta / sand — **Prompt 0 livré** |
| `tower` | `/brick-refs/tower-ortho.png` · [ref-tower-ortho.png](art/ref-tower-ortho.png) | Socle + fût penché ; 12×18 × 72P — **Prompt 0 livré** |
| `billboard` | `/brick-refs/billboard-ortho.png` · [ref-billboard-ortho.png](art/ref-billboard-ortho.png) | 24×6 × 50P ; « TU N'ES PERSONNE » — **Prompt 0 livré** |
| `garage` | `/brick-refs/garage-ortho.png` · [ref-garage-ortho.png](art/ref-garage-ortho.png) | 24×24 × 42P ; FC1–FC2 (`garage.manual.json`) — playtest overlay |
| `vinyle` | `/brick-refs/vinyle-ortho.png` · [ref-vinyle-ortho.png](art/ref-vinyle-ortho.png) | 18×18 × 36P ; FC3 (`vinyle.manual.json`) — vitrine cyan / volet |
| `mairie` | `/brick-refs/mairie-ortho.png` · [ref-mairie-ortho.png](art/ref-mairie-ortho.png) | 24×12 × 24P ; FC4 (`mairie.manual.json`) — socle + statue sans tête |

Échec voie manuelle → corriger dans l’éditeur et ré-enregistrer.  
Échec voie couches → corriger `.layers.json` / assembly ([boucle visuelle](brick-manual-prompt.md)), puis `pnpm brick:layers` et rejouer la boucle.
