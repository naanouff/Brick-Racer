# Maquettes HTML — Brick Racer

SPA à ancres (`#title`, `#hub`, …) pour que la navigation marche aussi en **`file://`** (navigateur Cursor).

- **Canon joueur :** [../design/ui-ux.md](../design/ui-ux.md)
- **Sprint joueur :** [../sprints/BRICK-UIM1.md](../sprints/BRICK-UIM1.md)
- **Atelier dev :** [../plans/dev-atelier.md](../plans/dev-atelier.md) · [../sprints/BRICK-UIM2.md](../sprints/BRICK-UIM2.md) — `atelier.html` est le livrable du sprint, hors du routeur `#title` / `#hub`

## Ouvrir

1. Ouvre **[`index.html`](index.html)** (double-clic ou Simple Browser).
2. Clique **Démarrer le parcours** ou un écran de la grille.
3. URLs utiles : `index.html#title`, `index.html#hub?prompt=pad`, `index.html#race-hud`.

**Atelier dev** (coque hors parcours joueur) : ouvre **[`atelier.html`](atelier.html)** — ou la carte *Atelier dev* depuis l’index. Touches `1`–`6` (slices), `` ` `` (replier le rail).

Ou via HTTP (si `serve` dispo) :

```bash
npx --yes serve docs/mocup -l 8765
```

Puis http://localhost:8765/ ou http://localhost:8765/atelier.html

Les fichiers sous `screens/*.html` redirigent vers les ancres de `index.html`.

**Esc** = retour contextuel sur les écrans joueur (voir chrome en haut à gauche).

**Brick Racer n’est pas affilié à The LEGO Group ni à Nintendo.**
