# Checklist production décor brick

Pipeline : [brick-decor-pipeline.md](../plans/brick-decor-pipeline.md) · prompts [brick-manual-prompt.md](brick-manual-prompt.md).

Pour chaque landmark :

1. **Image ortho** — Prompt 0 ; enregistrer sous `docs/design/art/` et copie runtime `public/brick-refs/<stem>-ortho.*` si overlay.
2. **Fiche de cotes** — Prompt A ; valider footprint / hauteur / couleurs à l’œil.
3. **Couches** — Prompt B → `src/racer/hub/brick/layers/<stem>.layers.json` (ou modules + `*.assembly.json`).
4. **Brickify** — `pnpm brick:layers <fichier>` → `manuals/<stem>.manual.json`.
5. **brick-lab** — hot-swap manuel ; Face / Côté / Dessus ; overlay opacité ; ±1 stud vs réf.
6. **Perf** — noter `dc` / FPS (`BrickRacerFast`) ; batches raisonnables.
7. **city-test** (si POI) — spawn landmark + collider AABB **inchangé** ; IDs stables.
8. **Commit** — layers (+ assembly) + manuel généré + overlay + note sprint.

Assemblages multi-modules : un `.assembly.json` référence plusieurs `.layers.json` avec `offset [sx,py,sz]`.
