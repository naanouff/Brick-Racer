# Sprint BRICK-UI1 — Coque UI / UX écrans MVP

Découpage de [docs/design/ui-ux.md](../design/ui-ux.md). Réfs : [tone.md](../design/tone.md), [gdd.md](../design/gdd.md) §16–17, [test-slice.md](../design/test-slice.md).

Objectif : remplacer le placeholder titre dans `src/renderer` par une **coque UI** (machine d’états + écrans React) fidèle aux **maquettes HTML** ([docs/mocup/](../mocup/) · [BRICK-UIM1](BRICK-UIM1.md)) — tokens, layouts, microcopy. Les écrans course/hub/garage peuvent tourner en **données mock** tant que P1–P3 host ne publient pas les events.

Ordre : UI1a → UI1b → UI1c → UI1d → UI1e → UI1f. Chaque ticket de code se termine par `pnpm test` et `pnpm check`. Aucun commit sans demande.

Branche prévue : `feature/ui-shell` depuis `develop`. PR cible : `develop`.

Prérequis : maquettes [BRICK-UIM1](BRICK-UIM1.md) reviewées (ou accord de paralléliser). Soft : coque Electron (B1) OK ; host kart (B2) **non bloquant** pour les stubs UI (canvas peut rester sous les overlays).

---

## BRICK-UI1a — Tokens, typo, shell router

Fichiers cibles (indicatif) :

- `src/renderer/ui/tokens.css` (ou section `app.css`)
- `src/renderer/ui/UiShell.tsx` + `uiState.ts` (états §3 ui-ux)
- `src/renderer/main.tsx` — monte le shell au-dessus du canvas

Fait quand :

- Tokens CSS (`--br-*`) alignés [ui-ux.md](../design/ui-ux.md) §2.
- Police display + body chargées (ou link fonts) ; plus de stack « Segoe only » pour les titres.
- Machine d’états UI : au minimum `title` | `loading` | `hub` | `race` | `race_countdown` | `race_pause` | `race_results` | `garage` | `shop` | `settings`.
- Canvas reste visible sous les overlays (pointer-events corrects).

## BRICK-UI1b — Title, loading, settings

Fait quand :

- Écran titre : logo, titre, punchline, `JOUER`, `PARAMÈTRES`, disclaimer, version.
- `JOUER` → `loading` (scrim + one-liner + barre stub) → `hub` (ou `race` si flag debug documenté).
- `settings` : audio stubs, échelle UI 100/125 %, À propos + disclaimer ; Esc retour.
- Microcopy tirée du pool §5 ui-ux (pas de lorem).

## BRICK-UI1c — Course : countdown, HUD, pause, résultats

Fait quand :

- `race_countdown` : 3-2-1-GO (timer mock ou accéléré en test).
- `race` HUD : position, tour, timer, slot item (mock) — layout §4.7 ; **pas** de vitesse ni minimap.
- Toast annonce (Hex) affichable 2 s.
- Pause Esc : Reprendre / Recommencer / Options / Quitter hub.
- `race_results` : classement mock + punchline + `RETOUR HUB`.
- Mode **preview** (ex. query `?ui=race` ou menu debug title) pour playtest UI sans boucle gameplay.

## BRICK-UI1d — Hub overlays (prompt + dialogue)

Fait quand :

- Sur état `hub` : pas de chrome obligatoire ; top bar Studs optionnelle.
- `hub_prompt` : plaque centre-bas (action + sous-titre) ; mock touche `E`.
- `hub_dialogue` : bulle bas-gauche + Suite / Esc.
- Preview `?ui=hub` pour enchaîner prompt → garage / shop / « pad » → loading → countdown.

## BRICK-UI1e — Garage Bolt + Boutique Vinyle

Fait quand :

- Overlays `garage` / `shop` selon §4.4–4.5 (liste slots mock, CTA Équiper / Sortir, one-liner PNJ).
- Accents oil orange / magenta billboard.
- Esc / Sortir → `hub`.
- Pas d’économie réelle ni persist inventaire (stubs OK).

## BRICK-UI1f — Smoke, a11y, docs

Fait quand :

- `pnpm check`, `pnpm test`, `pnpm build` OK.
- Focus visible + navigation clavier basique sur title / pause / results.
- Esc cohérent (pause en course, fermeture overlays).
- [docs/README.md](../README.md) indexe ui-ux + ce sprint ; [roadmap.md](../plans/roadmap.md) pointe UI1.
- README racine : mention courte preview UI si flag documenté.

---

## Hors de ce sprint

- Binding live rang / tours / items depuis le host course (P1 gameplay).
- Triggers SceneDD hub → ouverture garage (P2/P3).
- Inventaire / monnaie persistés ; remap contrôles complet.
- Lobby multi (P5).
- Assets 3D custom dans les viewports garage/shop (silhouettes / placeholders OK).
- Voicelines audio Hex.

---

## Critères playtest UI (fin de sprint)

- Capture HUD : position + tour + item lus en &lt; 0,5 s.
- Title → hub → (prompt) → garage → hub → pad mock → countdown → HUD → pause → results → hub sans softlock.
- Ton 16+ présent sans casser le contraste.
