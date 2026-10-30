# Sprint BRICK-UIM2 — Maquette HTML Atelier dev

Découpage de [docs/plans/dev-atelier.md](../plans/dev-atelier.md). Livrable : **une page HTML** sous [`docs/mocup/`](../mocup/), hors de l’app Electron.

Objectif : valider **layout, densité et tiroir par slice** au navigateur **avant** tout remplacement de la barre « Revue slice ». Pas de React, pas de host W3DTS, pas de fichier sous `src/`.

Les écrans joueur restent [BRICK-UIM1](BRICK-UIM1.md) → [BRICK-UI1](BRICK-UI1.md). Ce sprint ne les modifie pas et ne les bloque pas.

Ordre : UIM2a → UIM2b. Aucun commit sans demande.

Branche prévue : `feature/ui-atelier-mocup` depuis `develop`. PR cible : `develop`.

Prérequis : tokens [`docs/mocup/css/tokens.css`](../mocup/css/tokens.css) (UIM1a). La page peut les lier en relatif ; le JS reste dans `atelier.html` pour que `file://` suffise.

---

## BRICK-UIM2a — Page `atelier.html` ✅

Fichier : [`docs/mocup/atelier.html`](../mocup/atelier.html).

Fait quand :

- Double-clic ou Simple Browser : la page s’ouvre sans `pnpm` et sans le routeur `#title` / `#hub`.
- Rail **Pistes** (`race-test`, `city-test`, `sandbox-kart`) et **Labs** (`brick-lab`, `catalog-lab`, `minifig-lab`) : titre, une ligne de rôle, raccourci `1`–`6`, filet stud yellow sur la carte active.
- Rail repliable (~56 px) par bouton et par `` ` ``.
- Viewport : dégradé asphalte / plaza / studio selon la famille ; nom de slice en display ; centre libre.
- Tiroir droit selon la slice (véhicule + cc + télémétrie fictive ; brick : manuel Fontaine, enveloppe / plein, stats fictives ; catalogue : cadre « panneau réel » ; minifig : orbit, pas de contrôles dédiés).
- Rangée commune : grille / unis, `fast` / `showcase`, mention que ces réglages rechargent la page dans l’app.
- Barre basse en chips (fps, ms, résolution, draw calls, tris, qualité), chiffres fictifs tabulaires.
- Tokens [ui-ux.md](../design/ui-ux.md) §2. Pas de glass violet. Disclaimer non officiel en pied de page.
- État entièrement local (pas de query string, pas de `localStorage`).

## BRICK-UIM2b — Entrée depuis l’index ✅

Fait quand :

- [`docs/mocup/index.html`](../mocup/index.html) a une carte **Atelier dev** qui pointe vers `atelier.html` (lien classique, pas un `data-screen`).
- [`docs/mocup/README.md`](../mocup/README.md) indique comment ouvrir `atelier.html`.
- Les ancres joueur (`#title`, `#hub`, `#race-hud`, …) et [`nav.js`](../mocup/js/nav.js) sont inchangés.
- Checklist visuelle : les six slices changent fond + titre + tiroir ; le rail replié laisse le viewport lisible ; contraste plaque paper / encre lisible.

---

## Suite (hors tickets UIM2a/b)

Port React livré dans `src/renderer/atelier/` (remplace `LevelReviewBar`) — voir [dev-atelier.md](../plans/dev-atelier.md) § Port React.

## Hors de ce sprint

- Restyle profond de `CatalogBrowserPanel` (seulement mode `embedded`).
- Coque produit [BRICK-UI1](BRICK-UI1.md).
- Responsive mobile (cible desktop ~1920×1080 ; largeur mini ~1280).

---

## Relation

| Livrable | Rôle |
| -------- | ---- |
| **UIM1** | Canon visuel des écrans joueur |
| **UIM2** | Canon visuel de la coque dev — playtest design seulement |
| **UI1** | Coque React produit. Ne porte pas l’atelier |

Le port dans l’Electron ne démarre qu’après review de UIM2b, dans un sprint dédié.
