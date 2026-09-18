import {
  calcularBaseVencida,
  calcularInteresSemanal,
  lunesDeSemana,
  periodoSemanal,
  tasaSemanalDesdeMensual,
} from './acreedores-intereses.service';

const D = (s: string) => new Date(`${s}T12:00:00Z`);

describe('intereses acreedores (simple y auditable)', () => {
  test('tasa semanal = mensual * 7/30', () => {
    expect(tasaSemanalDesdeMensual(5)).toBeCloseTo(1.1667, 3);
    expect(calcularInteresSemanal(10000, 5)).toBe(116.67);
  });

  test('base solo con vencidas >7 días (FIFO: pagos a lo viejo primero)', () => {
    const corte = D('2026-09-21'); // lunes
    // fiado de hace 10 días: vencido. fiado de hace 2 días: no vencido.
    const fiados = [
      { fecha: D('2026-09-11'), monto: 10000 },
      { fecha: D('2026-09-19'), monto: 5000 },
    ];
    expect(calcularBaseVencida(fiados, [], [], corte).base).toBe(10000);
    // pago de 4000 alivia lo vencido
    const pagos = [{ fecha: D('2026-09-20'), monto: 4000 }];
    expect(calcularBaseVencida(fiados, [], pagos, corte).base).toBe(6000);
    // pago que cubre todo lo vencido -> base 0 (el resto va a lo nuevo)
    expect(
      calcularBaseVencida(fiados, [], [{ fecha: D('2026-09-20'), monto: 12000 }], corte).base,
    ).toBe(0);
  });

  test('lunes y periodo ISO', () => {
    expect(lunesDeSemana(D('2026-09-18')).toISOString()).toBe(D('2026-09-14').toISOString());
    expect(periodoSemanal(D('2026-09-21'))).toBe('2026-W39');
  });
});
