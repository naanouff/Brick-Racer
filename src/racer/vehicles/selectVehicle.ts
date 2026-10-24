/**
 * @file selectVehicle.ts
 * @description Player vehicle kind from `?vehicle=` (kart | moto | plane).
 */

export type VehicleKind = 'kart' | 'moto' | 'plane';

export const VEHICLE_KINDS: VehicleKind[] = ['kart', 'moto', 'plane'];

export const VEHICLE_CHASSIS_NAME: Record<VehicleKind, string> = {
  kart: 'KartChassis',
  moto: 'MotoChassis',
  plane: 'PlaneChassis',
};

export function resolveVehicleKind(search = globalThis.location?.search ?? ''): VehicleKind {
  const v = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    .get('vehicle')
    ?.toLowerCase();
  if (v === 'moto' || v === 'bike') return 'moto';
  if (v === 'plane' || v === 'avion' || v === 'air') return 'plane';
  return 'kart';
}

export function vehicleLabel(kind: VehicleKind): string {
  if (kind === 'moto') return 'Moto';
  if (kind === 'plane') return 'Avion';
  return 'Kart';
}
