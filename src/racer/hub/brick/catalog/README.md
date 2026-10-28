# Brick part catalog (BC1)

Data-first LEGO catalogue for Brick-Racer manuals.

| File | Role |
| ---- | ---- |
| `data/parts.json` | Design ids, footprints, aliases, `mesh.status` |
| `data/colors.json` | Color slugs, RGB, BrickLink ids |
| `loadCatalog.ts` | Index + resolve aliases |
| `types.ts` | Types |

## Add a part

1. Append an entry to `parts.json` (`id` = LEGO design number when known).
2. Set `footprint` `[studsX, platesY, studsZ]` at yaw 0.
3. Set `mesh.status`: `missing` (authoring only / box proxy), `box` (intentional AABB), or `ready` (+ `asset` later).
4. Optional `aliases` for short manual ids.
5. Run `pnpm test` (see `tests/brickPartCatalog.test.ts`).

Do **not** invent part ids in a manual until they exist here.

## Mesh pipeline (later)

`spawnBrickLandmark` currently always uses the unit box mesh. When a part reaches `ready`, wire its asset in spawn — catalogue entry first, mesh second.
