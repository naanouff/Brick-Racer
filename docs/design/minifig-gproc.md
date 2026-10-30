# Minifig — décision & architecture

**Canon in-game (MF2+) :** meshes **LDraw** (design IDs catalogue) + recettes JSON + pivots / poses.  
**Legacy MF1 :** generators GPROC minifig — conservés en repo, plus la source mesh de Bolt.  
**Pas** de meshes Meshy / GLB uniques comme base personnage.  
**Pas** de conversion du catalogue LEGO entier en GPROC.

Aligné [vision.md](vision.md) (boutique, pièces swappables), [gdd.md](gdd.md) §11, [characters-candidates.md](characters-candidates.md).  
Réfs GPROC kart : [w3dts-demos.md](../references/w3dts-demos.md).  
Plans / sprints : [minifig-gproc.md](../plans/minifig-gproc.md) · [BRICK-MF1](../sprints/BRICK-MF1.md) → [minifig-ldraw.md](../plans/minifig-ldraw.md) · [BRICK-MF2](../sprints/BRICK-MF2.md).  
Catalogue / lab : [catalog-lab.md](../plans/catalog-lab.md).

**Brick Racer n’est pas affilié à The LEGO Group.**

---

## Décision

| | |
| - | - |
| **Oui (MF2)** | Corps minifig = **pièces LDraw** du master catalogue ; recipes + slots inchangés. |
| **Oui** | Unités **mètres** (LDU → `S`/`P`). Pas de remise à l’échelle : taille native LDraw. |
| **Non** | Convertir tout le catalogue LEGO en GPROC. |
| **Non** | 20–40 GLB photoréalistes comme pipeline personnage. |
| **Meshy / GLB** | Moodboard optionnel (`docs/design/art/characters/*.glb`) — **jamais** chargé en jeu. |
| **Artwork WebP** | Refs art / marketing ; les PNJ en jeu = **recettes**. |
| **GPROC** | Kart / formes custom ; generators minifig MF1 = legacy. |

Pourquoi LDraw : fidélité catalogue, un seul pipeline mesh avec `catalog-lab`, pas de double maintenance GPROC×65k pièces.

---

## Slots (v1)

| Slot | Rôle | Notes |
| ---- | ---- | ----- |
| `head` | Volume tête (cylindre / brick) | Teinte peau |
| `facePrint` | Atlas texture expression | Pas de sculpt procédural du visage |
| `hair` / `hat` | Coiffe | Mutuellement exclusifs ou stack soft |
| `torso` | Buste + print tenue | Teinte + print id |
| `arms` | Manches / couleur bras | |
| `hands` | Gants / C-hands | |
| `hipsLegs` | Hanches + jambes / short | |
| `accessoryL` / `accessoryR` | Props (clé, micro, …) | Optionnels |

Alignés sur les fiches candidats (tête / coiffe / torse / jambes / accessoire).

---

## Recipe JSON (intention)

```json
{
  "id": "c01-bolt",
  "displayName": "Bolt",
  "slots": {
    "head": { "part": "head.basic", "tint": "#F5D76E" },
    "facePrint": { "print": "face.frown_stubble_orange" },
    "hat": { "part": "hat.cap_mechanic", "tint": "#1a1a1a" },
    "torso": { "part": "torso.coverall", "tint": "#1B4F72", "print": "print.mechanic" },
    "arms": { "part": "arms.coverall", "tint": "#1B4F72" },
    "hands": { "part": "hands.glove", "tint": "#111111" },
    "hipsLegs": { "part": "legs.coverall", "tint": "#1B4F72" },
    "accessoryR": { "part": "prop.wrench_chrome" }
  }
}
```

C01–C40 (retenus post-playtest) = fichiers recipe sous `public/` ou `src/racer/minifig/recipes/` (chemin figé au sprint).

---

## Pipeline

```mermaid
flowchart LR
  catalog[PartCatalog_slots_ldrawId]
  ldraw[LDraw_library]
  recipe[MinifigRecipe_JSON]
  editor[Boutique_UI]
  runtime[Hub_Race_spawn]
  catalog --> editor
  ldraw --> runtime
  editor --> recipe
  recipe --> runtime
  catalog --> runtime
```

1. **Catalogue** — ids slots + `ldrawId` / `ldrawPair` + métadonnées UI (teintes, prints).  
2. **LDraw** — géométrie via IPC `ldrawPartTriangles` + `buildLdrawPreviewGeometry` (même stack que catalog-lab).  
3. **Éditeur** — React (coque Electron) → preview WebGPU, regen debounce à chaque swap.  
4. **Runtime** — spawn hub / grille course depuis recipe (cosmétiques only en course MVP).

---

## Risques & mitigations

| Risque | Mitigation |
| ------ | ---------- |
| Origines LDraw ≠ sockets jeu | Table d’offsets × `MINIFIG_LDRAW_SCALE` (MF2c) |
| `data/ldraw` absent | Proxy / log ; même contrainte que catalog-lab |
| Visages | Atlas `facePrint` ; pas de morph procédural |
| Perf hub (~20 PNJ) | Cache mesh upload ; regen seulement à l’édition ; instance / LOD plus tard |
| Anim | Rig / sockets stables ; pièces attachées ou skinnées après coup |
| Drift Meshy réaliste | Doc + CONTRIBUTING : Meshy = moodboard only |

---

## Non-objectifs (MF1 / MVP boutique)

- Import GLB Meshy en runtime.  
- Meta stats liées aux pièces (cosmétiques only).  
- Éditeur de prints bitmap complet (atlas figé v1).  
- Soft-body / ragdoll minifig.

---

## Séquence produit

Spike technique **[BRICK-MF1](../sprints/BRICK-MF1.md)** (generators + recipe + preview sandbox) **avant / en amont de P3** boutique UI complète ([roadmap](../plans/roadmap.md)). P3 consomme MF1 + UI boutique (Vinyle).
