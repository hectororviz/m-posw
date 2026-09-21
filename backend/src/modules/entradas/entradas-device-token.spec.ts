import { extractBearerToken, generateDeviceToken, hashDeviceToken } from './device-token.util';
import { defaultWindowFor } from './entradas-admin.service';

describe('device-token.util', () => {
  it('genera tokens únicos con prefijo ent_ y hashea determinísticamente', () => {
    const a = generateDeviceToken();
    const b = generateDeviceToken();
    expect(a.startsWith('ent_')).toBe(true);
    expect(a).not.toBe(b);
    expect(hashDeviceToken(a)).toBe(hashDeviceToken(a));
    expect(hashDeviceToken(a)).not.toBe(hashDeviceToken(b));
  });

  it('extrae Bearer de forma tolerante', () => {
    expect(extractBearerToken('Bearer ent_abc')).toBe('ent_abc');
    expect(extractBearerToken('bearer ent_abc')).toBe('ent_abc');
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('Token xyz')).toBeNull();
  });
});

describe('defaultWindowFor', () => {
  it('ventana default 06:00 → 05:59 del día siguiente', () => {
    const { ventanaDesde, ventanaHasta, fecha } = defaultWindowFor('2026-09-25');
    expect(ventanaDesde.getHours()).toBe(6);
    expect(ventanaDesde.getMinutes()).toBe(0);
    expect(ventanaHasta.getDate()).toBe(26);
    expect(ventanaHasta.getHours()).toBe(5);
    expect(ventanaHasta.getMinutes()).toBe(59);
    expect(ventanaHasta > ventanaDesde).toBe(true);
    expect(fecha.getDate()).toBe(25);
  });

  it('rechaza fechas inválidas', () => {
    expect(() => defaultWindowFor('no-fecha')).toThrow();
  });
});
