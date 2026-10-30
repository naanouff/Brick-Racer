# Sprint BRICK-UIM1 — Maquettes HTML écrans UI/UX

Découpage de [docs/design/ui-ux.md](../design/ui-ux.md). Livrable : pages HTML/CSS (JS minimal) sous **[`docs/mocup/`](../mocup/)**.

Objectif : valider **layout, tokens, microcopy et enchaînements** à l’ouverture navigateur **avant** la coque React ([BRICK-UI1](BRICK-UI1.md)). Pas de React, pas de host W3DTS, pas de `pnpm` obligatoire pour consulter les maquettes.

Ordre : UIM1a → UIM1b → UIM1c → UIM1d → UIM1e → UIM1f. Aucun commit sans demande.

Branche prévue : `feature/ui-mocup` depuis `develop`. PR cible : `develop`.

---

## Structure cible `docs/mocup/`

```
docs/mocup/
  README.md           # index + comment ouvrir
  index.html          # hub navigation entre écrans
  css/
    tokens.css        # --br-* (copie canon ui-ux §2)
    base.css          # reset, typo, plaques, boutons
    screens.css       # layouts par écran
  js/
    nav.js            # navigation légère + Esc (option)
  screens/
    title.html
    loading.html
    hub.html          # monde stub + prompt + dialogue
    garage.html
    shop.html
    countdown.html
    race-hud.html     # HUD + toast (monde stub)
    pause.html
    results.html
    settings.html
  assets/             # placeholders locaux (pas de CDN obligatoire)
```

Fond « monde » : gradient / image moodboard locale (`design/art/`) en CSS `background`, pas de WebGPU.

---

## BRICK-UIM1a — Socle tokens + index ✅

Fait quand :

- `docs/mocup/README.md` explique : ouvrir `index.html` (double-clic ou live server), disclaimer non officiel.
- `css/tokens.css` : toutes les variables `--br-*` de [ui-ux.md](../design/ui-ux.md) §2.
- `css/base.css` : plaques paper, boutons CTA, focus stud-yellow, typo display + body (Google Fonts OK en maquette, ou fichiers locaux).
- `index.html` : grille de liens vers chaque écran + note « maquette non jouable ».

## BRICK-UIM1b — Title, loading, settings ✅

Fait quand :

- `screens/title.html` : logo (lien `/brand/logo.svg` ou copie `assets/`), titre, punchline, JOUER / PARAMÈTRES, disclaimer, version stub.
- `screens/loading.html` : scrim, barre studs, one-liner cynique.
- `screens/settings.html` : sections Audio / Échelle UI / À propos ; bouton retour.
- Liens cliquables title ↔ loading ↔ settings ↔ retour index.

## BRICK-UIM1c — Course : countdown, HUD, pause, results ✅

Fait quand :

- `screens/countdown.html` : 3-2-1-GO (statique ou auto-avance JS &lt; 4 s vers HUD).
- `screens/race-hud.html` : slots §4.7 (P n/N, tour, timer, item, toast Hex) sur fond chase stub ; **pas** de vitesse ni minimap.
- `screens/pause.html` : plaque Reprendre / Recommencer / Options / Quitter hub.
- `screens/results.html` : classement mock + punchline Hex + RETOUR HUB.
- Enchaînement index ou liens : countdown → HUD → pause → results.

## BRICK-UIM1d — Hub overlays ✅

Fait quand :

- `screens/hub.html` : fond plaza stub (A1 si dispo), top bar Studs optionnelle, **pas** de chrome obligatoire.
- Prompt POI centre-bas (Garage / Pad) ; dialogue Hex bas-gauche.
- États visibles (tabs, query `?prompt=garage|pad` ou boutons debug maquette) pour basculer prompt / dialogue.

## BRICK-UIM1e — Garage + Boutique ✅

Fait quand :

- `screens/garage.html` : layout §4.4, accent oil orange, slots mock, Équiper / Sortir, one-liner Bolt.
- `screens/shop.html` : layout §4.5, accent magenta, slots minifig mock, one-liner Vinyle.
- Retour hub / index.

## BRICK-UIM1f — Parcours cliquable + docs ✅

Fait quand :

- Depuis `index.html` ou title : parcours **Title → Loading → Hub → Prompt garage → Garage → Hub → Pad → Countdown → HUD → Pause → Results → Hub** sans lien mort.
- Esc documenté (et implémenté en JS léger où pertinent : fermer pause → HUD, overlays → hub).
- [ui-ux.md](../design/ui-ux.md) pointe vers `docs/mocup/` comme canon visuel HTML.
- [docs/README.md](../README.md) indexe `mocup/` + ce sprint.
- Checklist playtest : lecture HUD &lt; 0,5 s ; ton 16+ OK ; pas de dérive purple-glow.

---

## Hors de ce sprint

- Intégration React / Electron ([BRICK-UI1](BRICK-UI1.md)).
- Coque dev / lanceur de slices — [BRICK-UIM2](BRICK-UIM2.md) · [dev-atelier.md](../plans/dev-atelier.md).
- Binding host course / SceneDD.
- Responsive mobile (cible desktop 1920×1080 ; largeur mini ~1280 OK).
- Lobby multi, inventaire réel, audio.
- Build CI qui sert les HTML (ouverture locale suffit).

---

## Relation avec UI1

| Livrable | Rôle |
| -------- | ---- |
| **UIM1** (`docs/mocup`) | Canon visuel / ton / layout — playtest design |
| **UI1** (`src/renderer`) | Coque produit — réutilise tokens + structure validés ici |

UI1 **ne démarre le port pixel-perfect** qu’après merge (ou review) UIM1f, sauf accord explicite pour paralléliser.
