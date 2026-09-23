import { makeBenefitCode, normalizeBenefitCode } from './entradas-beneficios.service';

describe('entrada-benefit-code', () => {
  it('genera códigos de 10 chars sin ambiguos', () => {
    const codes = new Set(Array.from({ length: 200 }, () => makeBenefitCode()));
    expect(codes.size).toBe(200);
    for (const c of codes) {
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    }
  });

  it('normaliza ENT: y minúsculas', () => {
    expect(normalizeBenefitCode('ent:ab12')).toBe('AB12');
    expect(normalizeBenefitCode('  K7Q2M9X4PA ')).toBe('K7Q2M9X4PA');
  });
});
