# Recettes

## Fontaine circulaire photo (pilote ~80 pcs)

Réf visuelle : photo multi-paliers gris / sand / cyan / clear + fleurs.

1. **Base** — `41539` dark_gray à `[-4,0,-4]`.
2. **Rebord** — 4× `85080` coins + 4× `3010` arêtes (y=1) ; coping `3070`/`3069` sand en y=4 ; accents `50950` gray cardinaux.
3. **Piédestal** — `60474` dark_gray `[-2,1,-2]` ; eau `6141` cyan sur le reste de l’intérieur (pas sous rebord AABB ni piédestal).
4. **Colonne** — 2× `3941` gray empilés (`column` ou manuel) ; `3960` ; eau mid ; `3062` ; `4740` ; jet `6141`+`4589` clear ; accents green.
5. **Cascades** — `85984`/`54200` clear sur 4 axes, **sous** le dish (y≤6) pour éviter collision AABB.
6. **Jets bassin** — `4589` cyan hors cascades.
7. **Fleurs** — hors dalle : `6141` green + `98138` red/yellow.

Valider : `analyze` (0 flottante), `capture_set` face/côté/dessus.

## Bassin circulaire générique

```
disc { center, radius: r-1, y, color: cyan }   // eau
ring { center, radius: r, y, color: gray }     // rebord 1 stud
```

Éviter 4× `48092` si l’intérieur doit rester libre (AABB).

## Colonne à paliers

```
column { part: 3941, at, count: 2 }
place 3960 dish centered on column
column { part: 3062, at: top of dish, count: 1 }
place 4740 + spout
```

## Mur / dalle

```
fill_rect { min, max, color, part?: 3024 }
wall { from, to, color, part?: 3005 }  // from/to partagent X ou Z
```

## Façade (rappel)

Préférer couches ASCII → `pnpm brick:layers` pour grilles larges ; MCP pour détails / statues / ronds.
