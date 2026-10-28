# Catalogue Rebrickable × LDraw (POC)

Pipeline pour enrichir le catalogue pièces (métadonnées Rebrickable + AABB LDraw en mm / studs / plates).

**Suite produit** : plan [docs/plans/catalog-lab.md](../../docs/plans/catalog-lab.md) · sprints [CL1](../../docs/sprints/BRICK-CL1.md) (browser + BC1) · [CL2](../../docs/sprints/BRICK-CL2.md) (mesh LDraw) · [CL3](../../docs/sprints/BRICK-CL3.md) (plastique + couleur) · [CL4](../../docs/sprints/BRICK-CL4.md) (UV0 + UV1).

## Prérequis

- Python 3.10+
- ~150 Mo disque (ZIP LDraw + extract)

## Usage

```powershell
# 1. Télécharger parts.csv + complete.zip LDraw
python scripts/catalog/fetch_sources.py

# 2a. Smoke test — pièces BOM fontaine
python scripts/catalog/build_master_catalog.py --fountain-bom

# 2b. Échantillon
python scripts/catalog/build_master_catalog.py --limit 500

# 2c. Catalogue complet (plusieurs minutes)
python scripts/catalog/build_master_catalog.py

# 3. Index UI seul (depuis master déjà généré)
pnpm catalog:build
# ≡ python scripts/catalog/build_master_catalog.py --index-only
```

Sorties :
- `data/out/lego_master_catalog.json` (riche, gitignoré)
- `public/catalog/master-index.json` (léger, has_3d — consommé par `catalog-lab`)

## Notes

- Les sources dans `data/` ne doivent **pas** être commités (licence LDraw CA + volume).
- Matching : `part_mappings.csv` (système `LD`) + `{part_num}.dat` + fallback en retirant les suffixes print (`pr####`, etc.).
- Couverture typique ≈ **50 %** des lignes Rebrickable avec dims 3D (le reste : stickers sans mesh, tissus, IDs sans modèle LDraw…).
- Les dimensions sont des **AABB géométriques** LDraw : la hauteur inclut le stud (~+0,5 plate). Ce n’est pas l’emprise grille « notice » (corps seul).
- IDs BOM doc vs Rebrickable : `#3128` → `74611` (Plate Round 8×8), `#4589b` → `4589`.
