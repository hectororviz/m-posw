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
    expect(tasaSemanalDesdeMensual(12)).toBeCloseTo(2.8, 3);
    expect(calcularInteresSemanal(10000, 12)).toBe(280);
  });

  test('base solo con vencidas >30 días (FIFO: pagos a lo viejo primero)', () => {
    const corte = D('2026-10-26'); // lunes
    // fiado de hace 45 días: vencido. fiado de hace 10 días: en gracia.
    const fiados = [
      { fecha: D('2026-09-11'), monto: 10000 },
      { fecha: D('2026-10-16'), monto: 5000 },
    ];
    expect(calcularBaseVencida(fiados, [], [], corte).base).toBe(10000);
    // pago de 4000 alivia lo vencido
    const pagos = [{ fecha: D('2026-10-20'), monto: 4000 }];
    expect(calcularBaseVencida(fiados, [], pagos, corte).base).toBe(6000);
    // pago que cubre todo lo vencido -> base 0 (el resto va a lo nuevo)
    expect(
      calcularBaseVencida(fiados, [], [{ fecha: D('2026-10-20'), monto: 12000 }], corte).base,
    ).toBe(0);
  });

  test('amnistía única: deuda anterior queda en 0 días desde el aviso', () => {
    const corte = D('2026-11-09'); // lunes
    const amnistia = D('2026-10-26'); // lunes de ejemplo
    // fiado de hace 45 días queda con fecha efectiva = amnistía (hace 14 días): en gracia.
    const fiados = [{ fecha: D('2026-09-25'), monto: 10000 }];
    expect(calcularBaseVencida(fiados, [], [], corte, amnistia).base).toBe(0);
    // pasado el mes desde la amnistía sí genera: corte 2026-12-07 (42 días después).
    expect(calcularBaseVencida(fiados, [], [], D('2026-12-07'), amnistia).base).toBe(10000);
    // fiado posterior a la amnistía usa su fecha propia.
    const nuevos = [{ fecha: D('2026-11-01'), monto: 7000 }];
    expect(calcularBaseVencida(nuevos, [], [], corte, amnistia).base).toBe(0);
    expect(calcularBaseVencida(nuevos, [], [], D('2026-12-07'), amnistia).base).toBe(7000);
  });

  test('lunes y periodo ISO', () => {
    expect(lunesDeSemana(D('2026-09-18')).toISOString()).toBe(D('2026-09-14').toISOString());
    expect(periodoSemanal(D('2026-10-26'))).toBe('2026-W44');
  });
});
