# Compiler

## Prérequis

- Node.js 22 ou plus récent
- pnpm
- Un GPU qui expose **WebGPU** (Direct3D 12 sous Windows). L’application n’active pas `--enable-unsafe-webgpu`.
- Pour le host kart (P0 / BRICK-B2) : checkout sibling du monorepo w3dts en `../w3dts_repos/w3dts` pour les paquets non publiés ou périmés sur npm (`scripts`, `gproc`…) — alias Vite via [`w3dtsMonoAliases.ts`](../w3dtsMonoAliases.ts). **Pas de SceneDD** : le sandbox kart est un level TypeScript ([`src/racer/levels/sandboxKart/`](../src/racer/levels/sandboxKart/)).

Sous inspection TLS Windows, si le postinstall Electron échoue sur le certificat : `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; pnpm install` (même contrainte que le monorepo w3dts / `.npmrc`).

pnpm 10+ : [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) autorise les postinstall `electron` / `esbuild` / `electron-winstaller` (`allowBuilds`).

## Scripts

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
pnpm dist
```

`pnpm dev` lance Electron via electron-vite et spawne le sandbox kart (module TS) — WASD pour conduire, X pour reset (quand B2e est vert).

Assets runtime sous `public/` (depuis `w3dts` viewer-editor) : graphs lit, **`shaders/`**, **`shader-graphs/`**, gproc, script-graphs. Sans ce dossier : ciel possible mais **pas de sol/kart**. Sans `public/shaders` : `Invalid ShaderModule` / `vs_main`.

Cohérence de versions (sinon **aucun modèle visible**, sans erreur bloquante) :

- **`public/shaders/`** doit correspondre au core npm utilisé (0.0.37), pas au `HEAD` du monorepo : les templates récents référencent `hybridShadowAov` → tous les pipelines matériaux échouent. Source : `viewer-editor/public/shaders` au commit `5ec8722c` (dernier avant la publication 0.0.37). Garde-fou : `tests/levelAssets.test.ts`.
- **gproc** : le npm 0.2.8 n'a pas `LegoWheel` / `LegoAxleBracket` / `MeshLOD` utilisés par `public/gproc/lego-*.json` → alias Vite vers `packages/gproc/src` du monorepo.
- **Une seule copie de `w3dts-core`** dans le bundle (`resolve.dedupe` dans `electron.vite.config.ts`) : le `World` indexe les composants par classe ; une 2ᵉ copie (gproc/physics tirent core 0.0.36, scripts tire celui du monorepo) rend leurs `RenderableComponent` / `TransformComponent` invisibles pour le moteur.
- En dev, les warnings/erreurs du renderer sont relayés dans le terminal `pnpm dev` (`[renderer:error] …`).

`pnpm dist` produit l’installateur NSIS Windows. Les cibles macOS et Linux sont déclarées, sans notarisation ni signature. Le numéro, la note et la release GitHub sont dans [Version](semver.md).

Le code source de ce client et les paquets moteur sont sous licence propriétaire. Voir [LICENSE](../LICENSE).

Moteur : [naanouff/w3dts](https://github.com/naanouff/w3dts).

