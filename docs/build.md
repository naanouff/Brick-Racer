# Compiler

## Prérequis

- Node.js 22 ou plus récent
- pnpm
- Un GPU qui expose **WebGPU** (Direct3D 12 sous Windows). L’application n’active pas `--enable-unsafe-webgpu`.

Sous inspection TLS Windows, si le postinstall Electron échoue sur le certificat : `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; pnpm install` (même contrainte que le monorepo w3dts / `.npmrc`).

## Scripts

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
pnpm dist
```

`pnpm dev` lance Electron via electron-vite.

`pnpm dist` produit l’installateur NSIS Windows. Les cibles macOS et Linux sont déclarées, sans notarisation ni signature. Le numéro, la note et la release GitHub sont dans [Version](semver.md).

Le code source de ce client et les paquets moteur sont sous licence propriétaire. Voir [LICENSE](../LICENSE).

Moteur : [naanouff/w3dts](https://github.com/naanouff/w3dts).
