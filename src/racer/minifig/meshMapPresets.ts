/**
 * @file meshMapPresets.ts
 * @description BakeMeshMaps presets per minifig part (BRICK-MF3b).
 */

export type MeshMapBakePreset = {
  curvatureContrast: number;
  aoRadius: number;
  aoSamples: number;
  heightScale: number;
  bakeCurvature: boolean;
  bakeAO: boolean;
  bakeHeight: boolean;
};

const BASE: MeshMapBakePreset = {
  curvatureContrast: 2.6,
  aoRadius: 0.09,
  aoSamples: 12,
  heightScale: 1.1,
  bakeCurvature: true,
  bakeAO: true,
  bakeHeight: true,
};

const BY_KIND: Record<string, Partial<MeshMapBakePreset>> = {
  'minifig-head': { aoRadius: 0.08, curvatureContrast: 2.5 },
  'minifig-torso': { aoRadius: 0.11, curvatureContrast: 2.4 },
  'minifig-arm-r': { aoRadius: 0.07, curvatureContrast: 2.7 },
  'minifig-arm-l': { aoRadius: 0.07, curvatureContrast: 2.7 },
  'minifig-leg-r': { aoRadius: 0.075, curvatureContrast: 2.7 },
  'minifig-leg-l': { aoRadius: 0.075, curvatureContrast: 2.7 },
  'minifig-hand': { aoRadius: 0.05, curvatureContrast: 3.0 },
  'minifig-hips': { aoRadius: 0.09, curvatureContrast: 2.5 },
  'minifig-hat': { aoRadius: 0.07, curvatureContrast: 2.5 },
  'minifig-wrench': { aoRadius: 0.055, curvatureContrast: 3.2 },
};

export function meshMapPresetForKind(kind: string): MeshMapBakePreset {
  const k = kind.trim().toLowerCase();
  return { ...BASE, ...(BY_KIND[k] ?? {}) };
}
