import { buildHoraBuckets, jornadaFilename, pctOf, round2, type JornadaResumen } from './entradas-admin.service';

describe('jornada helpers', () => {
  it('pctOf calcula porcentajes con un decimal', () => {
    expect(pctOf(1, 3)).toBe(33.3);
    expect(pctOf(0, 0)).toBe(0);
    expect(pctOf(5, 0)).toBe(0);
  });

  it('round2 redondea a 2 decimales', () => {
    expect(round2(10.555)).toBe(10.56);
    expect(round2(7)).toBe(7);
  });

  it('buildHoraBuckets agrupa entradas y bufet por hora', () => {
    const desde = new Date(2026, 9, 18, 18, 0, 0);
    const hasta = new Date(2026, 9, 19, 1, 0, 0);
    const buckets = buildHoraBuckets(
      desde,
      hasta,
      [
        { at: new Date(2026, 9, 18, 20, 15), cant: 2 },
        { at: new Date(2026, 9, 18, 20, 45), cant: 3 },
      ],
      [{ at: new Date(2026, 9, 18, 21, 5), cant: 1 }],
    );
    // 18:00 → 01:00 = 8 buckets
    expect(buckets).toHaveLength(8);
    expect(buckets[2]).toMatchObject({ hora: '20:00', entradas: 5, bufet: 0 });
    expect(buckets[3]).toMatchObject({ hora: '21:00', entradas: 0, bufet: 1 });
  });

  it('jornadaFilename genera slug ASCII seguro', () => {
    const r = {
      jornada: { tipo: 'PARTIDO', titulo: 'Femenino vs Mundialito', fecha: '2026-10-18T00:00:00.000Z' },
    } as JornadaResumen;
    expect(jornadaFilename(r)).toBe('jornada-2026-10-18-femenino-vs-mundialito.pdf');
  });
});
