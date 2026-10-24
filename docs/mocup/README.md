# Maquettes HTML — Brick Racer

SPA à ancres (`#title`, `#hub`, …) pour que la navigation marche aussi en **`file://`** (navigateur Cursor).

- **Canon :** [../design/ui-ux.md](../design/ui-ux.md)
- **Sprint :** [../sprints/BRICK-UIM1.md](../sprints/BRICK-UIM1.md)

## Ouvrir

1. Ouvre **[`index.html`](index.html)** (double-clic ou Simple Browser).
2. Clique **Démarrer le parcours** ou un écran de la grille.
3. URLs utiles : `index.html#title`, `index.html#hub?prompt=pad`, `index.html#race-hud`.

Ou via HTTP (si `serve` dispo) :

```bash
npx --yes serve docs/mocup -l 8765
```

Puis http://localhost:8765/

Les fichiers sous `screens/*.html` redirigent vers les ancres de `index.html`.

**Esc** = retour contextuel (voir chrome en haut à gauche).

**Brick Racer n’est pas affilié à The LEGO Group ni à Nintendo.**
