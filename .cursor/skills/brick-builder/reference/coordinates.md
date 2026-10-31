# Coordonnées brick-lab

## Unités

| Unité | Mètres | Notes |
| ----- | ------ | ----- |
| 1 stud (X/Z) | 0,33 m | Grille horizontale |
| 1 plate (Y) | 0,11 m | Hauteur fine |
| 1 brick | 3 plates | `footprint[1] === 3` typique |

Cible city-test fontaine : Ø ~3,0 m (~9 studs), H ~2,0 m (~18 plates).

## `at: [sx, py, sz]`

Coin **minimum** de l’empreinte AABB (pas le centre).

- `sx`, `sz` : studs entiers (peuvent être négatifs).
- `py` : plates depuis le sol (`0` = posé au sol).

`rotatedFootprint(part, rot)` : à 90°/270°, X et Z de l’empreinte sont échangés.

## `rot`

Yaw `0 | 90 | 180 | 270` (degrés). Sens à valider par `capture` si doute :

- Pentes (`3040`, `54200`, `85984`) : la direction « descente » suit typiquement +Z à rot 0 — vérifier face/côté.
- Macaroni `85080` / `48092` : quatre rotations pour les quatre coins d’un anneau.
- Mur `wall` macro : le long de X utilise rot 90 pour les 1×N.

## Occupancy

Collision = AABB stud×plate pleine (pas le mesh creux). Conséquence : **quatre macaroni 4×4** sur un 8×8 **remplissent** toute la surface en occupancy — impossible d’y mettre de l’eau. Préférer `ring` (1 stud) + `disc` intérieur, ou rebord 1 stud (`85080` coins + `3010` bords).
