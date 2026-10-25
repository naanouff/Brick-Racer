# Compiler

## Prérequis

- Node.js 22 ou plus récent
- **pnpm 10** (pin `packageManager` dans `package.json` — aligné CI). Éviter pnpm 11 pour `install` : il réécrit le lockfile sans `overrides` et casse `frozen-lockfile`.
- Un GPU qui expose **WebGPU** (Direct3D 12 sous Windows). L’application n’active pas `--enable-unsafe-webgpu`.
- Pour le host kart (P0 / BRICK-B2 / BO1) : checkout sibling du monorepo w3dts en `../w3dts_repos/w3dts` (à jour `develop`) pour les paquets non publiés ou périmés sur npm (`scripts`, `gproc`, **`physics`**, bientôt **`input`/`core`** pour gamepad HID) — alias Vite via [`w3dtsMonoAliases.ts`](../w3dtsMonoAliases.ts). **Pas de SceneDD** : levels TypeScript sous [`src/racer/levels/`](../src/racer/levels/). Physique blockout : [blockout-physics.md](plans/blockout-physics.md).

Sous inspection TLS Windows, si le postinstall Electron échoue sur le certificat : `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; pnpm install` (même contrainte que le monorepo w3dts / `.npmrc`).

Postinstall Electron/esbuild : [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) `allowBuilds: true` (+ `package.json` → `pnpm.onlyBuiltDependencies`). Si `pnpm approve-builds` laisse des placeholders (`set this to true or false`), `pnpm dev` échoue — remplacer par `true`.

## Scripts

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
pnpm dist
```

`pnpm dev` lance Electron via electron-vite. Boot par défaut : **`race-test`** (blockout ovale). Revue du slice :

| Moyen | Usage |
| ----- | ----- |
| HUD « Revue slice » | Boutons race-test / city-test / sandbox-kart (**reload** `?level=`) ; cc ; debugTex |
| Query | `?level=city-test` · `?level=sandbox-kart` · `?level=race-test` |
| Véhicule | `?vehicle=kart` (défaut) · `moto` · `plane` |
| Cylindrée | `?cc=50` · `?cc=100` (défaut) · `?cc=150` |
| Texture debug | couleurs unies (défaut) · `?debugTex=1` grille densités (coûteux) |
| Checklist | Sprint [BRICK-BO1](sprints/BRICK-BO1.md) · [blockout-arcade-kart.md](plans/blockout-arcade-kart.md) |

WASD pour conduire, Espace = drift, X = reset au spawn. **Gamepad** style MK/DKR (mono requis) : stick X = braquer, **A** = accélérer, **B** = frein/recul, **L1/R1** = drift, Select = reset — [w3dts-input.md](references/w3dts-input.md). Cliquer le canvas une fois (focus + gesture navigateur).

Perf (marge pour décos / IA / autres karts) :

- Cible **≥ 60 fps** avec marge ; ombres off ; backbuffer **DPR ≤ 1** et **long edge ≤ 1280** (fill-rate — le CSS reste plein écran) ; physique **60 Hz**. HUD : `W×H` = taille GPU réelle.
- Render graph **`BrickRacerFast`** par défaut (`?render=showcase` = HBAO+SSR+bloom+FXAA). HUD : `fast|showcase`.
- Circuit : géométrie complète (**72** segments murs, **36** rubans) ; `debugTex` **off** ; CP opaques.
- Véhicules blockout sur grille race-test : `?vehicle=kart|moto|plane` (HUD). Moto = 2 roues arcade ; avion = A/B poussée, stick X **bank**, stick Y / Espace/Shift **tangage**, **L1/R1** (C/V) knife-edge vertical.
- gproc uniquement sur `sandbox-kart` ; `layeredRefraction=off`.
- Au load : `warmPipelines`. HUD : `fps · ms · W×H · dc · tri · quality`.
Assets runtime sous `public/` (depuis `w3dts` viewer-editor) : graphs lit, **`shaders/`**, **`shader-graphs/`**, gproc, script-graphs. Sans ce dossier : ciel possible mais **pas de sol/kart**. Sans `public/shaders` : `Invalid ShaderModule` / `vs_main`.

Cohérence de versions (sinon **aucun modèle visible**, sans erreur bloquante) :

- **`public/shaders/`** doit correspondre au core npm utilisé (0.0.37), pas au `HEAD` du monorepo : les templates récents référencent `hybridShadowAov` → tous les pipelines matériaux échouent. Source : `viewer-editor/public/shaders` au commit `5ec8722c` (dernier avant la publication 0.0.37). Garde-fou : `tests/levelAssets.test.ts`.
- **gproc** : le npm 0.2.8 n'a pas `LegoWheel` / `LegoAxleBracket` / `MeshLOD` utilisés par `public/gproc/lego-*.json` → alias Vite vers `packages/gproc/src` du monorepo.
- **physics** : le npm 0.0.28 n'a pas `yawAssist` / `applyKartPhysicsCollisionTuning` → alias Vite vers `packages/physics/src` du monorepo.
- **input / gamepad HID** : livré mono `develop` (`INP-G`, poll dans `InputManager` + bindings `gameplay`) — [w3dts-input.md](references/w3dts-input.md). Pin npm `input@0.0.21` / `core@0.0.37` peut précéder la republication → alias `input` (+ `core` si besoin du poll) vers le mono.
- **Une seule copie de `w3dts-core`** dans le bundle (`resolve.dedupe` dans `electron.vite.config.ts`) : le `World` indexe les composants par classe ; une 2ᵉ copie (gproc/physics tirent core 0.0.36, scripts tire celui du monorepo) rend leurs `RenderableComponent` / `TransformComponent` invisibles pour le moteur.
- En dev, les warnings/erreurs du renderer sont relayés dans le terminal `pnpm dev` (`[renderer:error] …`).

`pnpm dist` produit l’installateur NSIS Windows. Les cibles macOS et Linux sont déclarées, sans notarisation ni signature. Le numéro, la note et la release GitHub sont dans [Version](semver.md).

Le code source de ce client et les paquets moteur sont sous licence propriétaire. Voir [LICENSE](../LICENSE).

Moteur : [naanouff/w3dts](https://github.com/naanouff/w3dts).

