import * as PDFDocument from 'pdfkit';
import {
  buildHoraBuckets,
  drawJornadaPdf,
  jornadaFilename,
  pctOf,
  round2,
  type JornadaResumen,
} from './entradas-admin.service';

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

  it('buildHoraBuckets agrupa por hora argentina (GMT-3) aunque el server esté en UTC', () => {
    // 21:00Z = 18:00 AR; ventana 21Z → 04Z = 8 buckets (18:00 → 01:00 AR)
    const desde = new Date(Date.UTC(2026, 9, 18, 21, 0, 0));
    const hasta = new Date(Date.UTC(2026, 9, 19, 4, 0, 0));
    const buckets = buildHoraBuckets(
      desde,
      hasta,
      [
        { at: new Date(Date.UTC(2026, 9, 18, 23, 15)), cant: 2 }, // 20:15 AR
        { at: new Date(Date.UTC(2026, 9, 18, 23, 45)), cant: 3 }, // 20:45 AR
      ],
      [{ at: new Date(Date.UTC(2026, 9, 19, 0, 5)), cant: 1 }], // 21:05 AR
    );
    expect(buckets).toHaveLength(8);
    expect(buckets[0].hora).toBe('18:00');
    expect(buckets[2]).toMatchObject({ hora: '20:00', entradas: 5, bufet: 0 });
    expect(buckets[3]).toMatchObject({ hora: '21:00', entradas: 0, bufet: 1 });
    expect(buckets[7].hora).toBe('01:00');
  });

  it('jornadaFilename genera slug ASCII seguro', () => {
    const r = {
      jornada: { tipo: 'PARTIDO', titulo: 'Femenino vs Mundialito', fecha: '2026-10-18T00:00:00.000Z' },
    } as JornadaResumen;
    expect(jornadaFilename(r)).toBe('jornada-2026-10-17-femenino-vs-mundialito.pdf');
  });

  it('drawJornadaPdf genera un PDF válido con datos largos (fuerza 2 páginas)', async () => {
    const r = {
      jornada: {
        tipo: 'PARTIDO',
        titulo: 'Femenino vs Mundialito',
        fecha: '2026-10-18T21:00:00.000Z',
        ventanaDesde: '2026-10-18T21:00:00.000Z',
        ventanaHasta: '2026-10-19T04:00:00.000Z',
      },
      entradas: {
        totalCant: 300,
        totalMonto: 450000,
        porSector: [
          { sector: 'LOCAL', cant: 200, monto: 300000, pct: 66.7 },
          { sector: 'VISITANTE', cant: 100, monto: 150000, pct: 33.3 },
        ],
        porMetodo: [
          { metodo: 'CASH', cant: 180, monto: 270000, pct: 60 },
          { metodo: 'MP_QR', cant: 120, monto: 180000, pct: 40 },
        ],
      },
      bufet: {
        totalCant: 90,
        totalMonto: 320000,
        ticketPromedio: 3555.56,
        porMetodo: [
          { metodo: 'CASH', cant: 50, monto: 180000, pct: 56.3 },
          { metodo: 'MP_QR', cant: 30, monto: 100000, pct: 31.2 },
          { metodo: 'FIADO', cant: 10, monto: 40000, pct: 12.5 },
        ],
        topProductos: Array.from({ length: 10 }, (_, i) => ({
          nombre: `Producto ${i + 1} con nombre largo para probar truncado`,
          cant: 20 - i,
          monto: 50000 - i * 3000,
        })),
      },
      horasPico: Array.from({ length: 12 }, (_, i) => ({
        hora: `${String(18 + i).padStart(2, '0')}:00`,
        entradas: 10 + i,
        bufet: 5 + i,
      })),
      beneficios: { otorgados: 40, canjeados: 12 },
      noAprobadas: [
        { status: 'PENDING', cant: 3 },
        { status: 'CANCELLED', cant: 1 },
      ],
      totalGeneral: 770000,
    } as JornadaResumen;
    let pages = 1;
    const buffer: Buffer = await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margins: { top: 44, bottom: 44, left: 50, right: 50 } });
      doc.on('pageAdded', () => {
        pages += 1;
      });
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      drawJornadaPdf(doc, r, {
        clubName: 'Club Atlético Test',
        accent: '#0e7490',
        logoPath: null,
        escudoPng: null,
        money: (n: number) => `$ ${n}`,
      });
      doc.end();
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(2000);
    expect(pages).toBeGreaterThanOrEqual(2);
  });
});
