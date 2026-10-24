import { describe, expect, it } from 'vitest';
import { resolveVehicleKind, vehicleLabel } from '../src/racer/vehicles/selectVehicle';

describe('resolveVehicleKind', () => {
  it('defaults to kart', () => {
    expect(resolveVehicleKind('')).toBe('kart');
    expect(resolveVehicleKind('?level=race-test')).toBe('kart');
  });

  it('parses moto / plane aliases', () => {
    expect(resolveVehicleKind('?vehicle=moto')).toBe('moto');
    expect(resolveVehicleKind('?vehicle=bike')).toBe('moto');
    expect(resolveVehicleKind('?vehicle=plane')).toBe('plane');
    expect(resolveVehicleKind('?vehicle=avion')).toBe('plane');
  });

  it('labels', () => {
    expect(vehicleLabel('kart')).toBe('Kart');
    expect(vehicleLabel('moto')).toBe('Moto');
    expect(vehicleLabel('plane')).toBe('Avion');
  });
});
