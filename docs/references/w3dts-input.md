# Référence w3dts — Input & Gamepad HID

Source : monorepo `w3dts_repos/w3dts` (`develop`, merge [PR #285](https://github.com/naanouff/w3dts/pull/285) — `feat(input): add HID gamepad support (INP-G)`).

| Surface | Chemin mono |
| ------- | ----------- |
| Sprint | `documentation/domains/input/GAMEPAD_HID_SPRINT.md` |
| Plan package | `documentation/domains/input/INPUT_PACKAGE_PLAN.md` |
| Index input | `documentation/domains/input/README.md` |
| Asset défaut | `packages/input/src/defaultInputAsset.ts` |
| Snapshot / resolver | `packages/input/src/HardwareSnapshot.ts`, `InputActionRuntime.ts` |
| Poll navigateur | `packages/core/src/input/InputManager.ts` (`navigator.getGamepads()`) |
| Probe manuel | `packages/viewer-editor/public/gamepad-probe.html` → `/gamepad-probe.html` |

## État

**Gamepad HID livré** dans w3dts (`INP-G0` … `INP-G5`) : orthogonal au gamepad WebXR. Haptique hors scope. Tactile avancé = backlog.

Brick Racer pin npm `input@0.0.21` / `core@0.0.37` (sans poll HID). En local avec mono `develop` :

- alias Vite `@naanouff/w3dts-input` → `packages/input/src` ([w3dtsMonoAliases.ts](../../w3dtsMonoAliases.ts))
- bridge [`hidGamepadBridge.ts`](../../src/racer/host/hidGamepadBridge.ts) poll `getGamepads` dans `InputManager` (le core npm n’a pas encore `INP-G4`)

Sans mono (CI) : le bridge no-op ; clavier seul.

## Contrat V1 (HID)

| Choix | Valeur |
| ----- | ------ |
| API | `navigator.getGamepads()` |
| Kinds | `gamepadButton` · `axisGamepad` |
| Slot défaut | `0` |
| Mapping | Indices **standard** W3C |
| Stick + WASD | Même ids `moveForward` / `moveRight` ; agrégation **max-abs** |
| Dead zone | `0.15` sur axes |
| Stick Y | `invert: true` sur `moveForward` |
| Maps | Bindings pad sur `gameplay` seulement |

## Bindings `gameplay` utiles course

Defaults w3dts (stick Y + A = jump). **Brick Racer** les remappe en MK/DKR via [`arcadeMkDriveInput.ts`](../../src/racer/host/arcadeMkDriveInput.ts) + bridge HID :

| Action sémantique | Clavier | Gamepad Brick (standard) |
| ----------------- | ------- | ------------------------ |
| `moveForward` (throttle) | W/Z · S | **A** accel · **B** frein/recul *(pas le stick Y)* |
| `moveRight` | D · A/Q | Stick gauche X |
| `climb` (avion, tangage) | Espace · Shift | Stick gauche **Y** (haut = cabrer) |
| `rollSnap` (avion knife-edge) | C · V | **L1 / R1** (±90° ailes verticales) |
| `jump` (drift kart) | Espace | **L1 / R1** (buttons 4 / 5) |
| `resetKart` | X | **Select** (button 8) |
| `sprint` | Shift | *(clavier seul — LB libéré pour le drift)* |

`kart_drive_arcade` lit `moveForward` / `moveRight` ; `ArcadeKartSystem` lit `jump` pour le drift ; l’avion lit `climb` pour l’altitude.

## Test rapide (mono)

```bash
# viewer-editor
pnpm dev
# http://localhost:5173/gamepad-probe.html
# ou Input Editor → live monitor gamepad
```

## Historique

| Date | Note |
| ---- | ---- |
| 2026-10-25 | Consignation après merge INP-G sur `w3dts` develop |
