import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../common/prisma.service';
import { CreateSocioTipoDto } from './dto/create-socio-tipo.dto';
import { UpdateSocioTipoDto } from './dto/update-socio-tipo.dto';
import { CreateSocioDto } from './dto/create-socio.dto';
import { UpdateSocioDto } from './dto/update-socio.dto';
import { CreateSocioPagoDto } from './dto/create-socio-pago.dto';
import { GenerarCuotasDto } from './dto/generar-cuotas.dto';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Injectable()
export class SociosService {
  private readonly logger = new Logger(SociosService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Tipos ───────────────────────────────────────────────

  async getTipos() {
    return this.prisma.socioTipo.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  async getTipo(id: number) {
    const tipo = await this.prisma.socioTipo.findUnique({ where: { id } });
    if (!tipo) throw new NotFoundException('Tipo de socio no encontrado');
    return tipo;
  }

  async createTipo(dto: CreateSocioTipoDto) {
    const tipo = await this.prisma.socioTipo.create({ data: dto });

    await this.prisma.socioTipoHistorial.create({
      data: {
        socioTipoId: tipo.id,
        monto: dto.montoMensual,
        vigenciaDesde: new Date(),
      },
    });

    return tipo;
  }

  async updateTipo(id: number, dto: UpdateSocioTipoDto) {
    await this.getTipo(id);

    const data: any = { ...dto };

    if (dto.montoMensual !== undefined) {
      await this.prisma.socioTipoHistorial.create({
        data: {
          socioTipoId: id,
          monto: dto.montoMensual,
          vigenciaDesde: new Date(),
        },
      });
    }

    return this.prisma.socioTipo.update({ where: { id }, data });
  }

  async deleteTipo(id: number) {
    await this.getTipo(id);
    return this.prisma.socioTipo.update({
      where: { id },
      data: { activo: false },
    });
  }

  // ─── Socios ──────────────────────────────────────────────

  async findAll(filters?: {
    estado?: string;
    socioTipoId?: string;
    deuda?: string;
  }) {
    const where: any = {};

    if (filters?.estado) {
      where.estado = filters.estado;
    }

    if (filters?.socioTipoId) {
      where.socioTipoId = parseInt(filters.socioTipoId);
    }

    const socios = await this.prisma.socio.findMany({
      where,
      include: {
        socioTipo: { select: { id: true, nombre: true, montoMensual: true, activo: true } },
        cuotas: {
          where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
          select: { montoOriginal: true, montoPagado: true },
        },
      },
      orderBy: { nroSocio: 'asc' },
    });

    const result = socios.map((s) => {
      const deudaTotal = s.cuotas.reduce(
        (sum, c) => sum + (Number(c.montoOriginal) - Number(c.montoPagado)),
        0,
      );
      return {
        id: s.id,
        nroSocio: s.nroSocio,
        dni: s.dni,
        apellido: s.apellido,
        nombre: s.nombre,
        fechaNacimiento: s.fechaNacimiento,
        telefono: s.telefono,
        direccion: s.direccion,
        socioTipo: s.socioTipo,
        fechaAlta: s.fechaAlta,
        estado: s.estado,
        deudaTotal,
      };
    });

    if (filters?.deuda === 'con-deuda') {
      return result.filter((s) => s.deudaTotal > 0);
    }
    if (filters?.deuda === 'al-dia') {
      return result.filter((s) => s.deudaTotal === 0);
    }

    return result;
  }

  async findOne(id: number) {
    const socio = await this.prisma.socio.findUnique({
      where: { id },
      include: {
        socioTipo: true,
      },
    });
    if (!socio) throw new NotFoundException('Socio no encontrado');
    return socio;
  }

  async create(dto: CreateSocioDto) {
    const existing = await this.prisma.socio.findUnique({
      where: { nroSocio: dto.nroSocio },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un socio con ese numero');
    }

    await this.getTipo(dto.socioTipoId);

    return this.prisma.socio.create({
      data: {
        nroSocio: dto.nroSocio,
        dni: dto.dni,
        apellido: dto.apellido,
        nombre: dto.nombre,
        fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
        telefono: dto.telefono,
        direccion: dto.direccion,
        socioTipoId: dto.socioTipoId,
        fechaAlta: new Date(dto.fechaAlta),
        estado: dto.estado || 'ACTIVO',
      },
      include: { socioTipo: true },
    });
  }

  async update(id: number, dto: UpdateSocioDto) {
    await this.findOne(id);

    if (dto.nroSocio !== undefined) {
      const existing = await this.prisma.socio.findUnique({
        where: { nroSocio: dto.nroSocio },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Ya existe un socio con ese numero');
      }
    }

    if (dto.socioTipoId !== undefined) {
      await this.getTipo(dto.socioTipoId);
    }

    const data: any = { ...dto };

    if (dto.fechaNacimiento !== undefined) {
      data.fechaNacimiento = dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : null;
    }
    if (dto.fechaAlta !== undefined) {
      data.fechaAlta = dto.fechaAlta ? new Date(dto.fechaAlta) : null;
    }

    // Clean empty strings that would fail Prisma validation
    if (data.telefono === '') data.telefono = null;
    if (data.direccion === '') data.direccion = null;

    return this.prisma.socio.update({
      where: { id },
      data,
      include: { socioTipo: true },
    });
  }

  async deactivate(id: number) {
    await this.findOne(id);
    return this.prisma.socio.update({
      where: { id },
      data: { estado: 'INACTIVO' },
    });
  }

  // ─── Cuotas ──────────────────────────────────────────────

  private async getMontoVigente(socioTipoId: number, fechaInicioMes: Date): Promise<number> {
    const historial = await this.prisma.socioTipoHistorial.findFirst({
      where: {
        socioTipoId,
        vigenciaDesde: { lte: fechaInicioMes },
      },
      orderBy: { vigenciaDesde: 'desc' },
    });

    if (historial) {
      return Number(historial.monto);
    }

    const tipo = await this.prisma.socioTipo.findUnique({
      where: { id: socioTipoId },
      select: { montoMensual: true },
    });
    return tipo ? Number(tipo.montoMensual) : 0;
  }

  async generateCuotasMes(anio: number, mes: number): Promise<{
    mensaje: string;
    generadas: number;
    omitidas: number;
  }> {
    const primerDia = new Date(Date.UTC(anio, mes - 1, 1, 12, 0, 0));
    const dia10 = new Date(Date.UTC(anio, mes - 1, 10, 12, 0, 0));

    const socios = await this.prisma.socio.findMany({
      where: {
        estado: 'ACTIVO',
        socioTipo: { montoMensual: { gt: 0 }, activo: true },
      },
      include: { socioTipo: true },
    });

    let generadas = 0;
    let omitidas = 0;

    for (const socio of socios) {
      const fechaAlta = new Date(socio.fechaAlta);
      if (fechaAlta > dia10) {
        omitidas++;
        continue;
      }

      const existente = await this.prisma.socioCuota.findUnique({
        where: {
          socioId_mes_anio: {
            socioId: socio.id,
            mes,
            anio,
          },
        },
      });

      if (existente) {
        omitidas++;
        continue;
      }

      const montoVigente = await this.getMontoVigente(socio.socioTipoId, primerDia);

      await this.prisma.socioCuota.create({
        data: {
          socioId: socio.id,
          mes,
          anio,
          montoOriginal: montoVigente,
          montoPagado: 0,
          estado: 'PENDIENTE',
        },
      });

      generadas++;
    }

    this.logger.log(
      `Cuotas generadas: ${generadas} (omitidas: ${omitidas}) para ${mes}/${anio}`,
    );

    return {
      mensaje: `Cuotas generadas: ${generadas}. Omitidas: ${omitidas}`,
      generadas,
      omitidas,
    };
  }

  async generarCuotas(dto: GenerarCuotasDto) {
    return this.generateCuotasMes(dto.anio, dto.mes);
  }

  @Cron('0 5 0 1 * *')
  async handleGenerarCuotasMensuales() {
    const ahora = new Date();
    const anio = ahora.getUTCFullYear();
    const mes = ahora.getUTCMonth() + 1;
    this.logger.log(`Cron: generando cuotas del mes ${mes}/${anio}...`);
    await this.generateCuotasMes(anio, mes);
  }

  // ─── Cuotas de un socio ─────────────────────────────────

  async getCuotasSocio(socioId: number) {
    await this.findOne(socioId);

    return this.prisma.socioCuota.findMany({
      where: { socioId },
      include: {
        pagos: { orderBy: { fecha: 'desc' } },
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    });
  }

  async pagarCuota(
    cuotaId: number,
    dto: CreateSocioPagoDto,
  ) {
    if (dto.monto <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    const cuota = await this.prisma.socioCuota.findUnique({
      where: { id: cuotaId },
    });

    if (!cuota) {
      throw new NotFoundException('Cuota no encontrada');
    }

    if (cuota.estado === 'PAGADO') {
      throw new BadRequestException('La cuota ya esta pagada completamente');
    }

    const pendiente = Number(cuota.montoOriginal) - Number(cuota.montoPagado);

    if (dto.monto > pendiente) {
      throw new BadRequestException(
        `El monto ingresado (${dto.monto}) supera el saldo pendiente (${pendiente})`,
      );
    }

    const nuevoMontoPagado = Number(cuota.montoPagado) + dto.monto;

    let nuevoEstado: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' = 'PENDIENTE';

    if (nuevoMontoPagado >= Number(cuota.montoOriginal) - 0.001) {
      nuevoEstado = 'PAGADO';
    } else if (nuevoMontoPagado > 0) {
      nuevoEstado = 'PARCIAL';
    }

    const [year, month, day] = dto.fecha.split('-').map(Number);

    const [cuotaActualizada, pago] = await this.prisma.$transaction([
      this.prisma.socioCuota.update({
        where: { id: cuotaId },
        data: {
          montoPagado: nuevoMontoPagado,
          estado: nuevoEstado,
        },
      }),
      this.prisma.socioPago.create({
        data: {
          socioCuotaId: cuotaId,
          monto: dto.monto,
          fecha: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
          observacion: dto.observacion,
        },
      }),
    ]);

    return { cuota: cuotaActualizada, pago };
  }

  // ─── Reporte Matriz ──────────────────────────────────────

  async getMatriz(anio: number) {
    const socios = await this.prisma.socio.findMany({
      include: {
        socioTipo: { select: { id: true, nombre: true, montoMensual: true, activo: true } },
      },
      orderBy: { nroSocio: 'asc' },
    });

    const cuotas = await this.prisma.socioCuota.findMany({
      where: { anio, socioId: { in: socios.map((s) => s.id) } },
    });

    const cuotasPorSocio: Record<number, Record<number, any>> = {};

    for (const c of cuotas) {
      if (!cuotasPorSocio[c.socioId]) {
        cuotasPorSocio[c.socioId] = {};
      }
      cuotasPorSocio[c.socioId][c.mes] = {
        montoOriginal: Number(c.montoOriginal),
        montoPagado: Number(c.montoPagado),
        estado: c.estado,
        id: c.id,
      };
    }

    const filas = socios.map((s) => {
      const meses: Record<number, any> = {};

      let deudaAnual = 0;

      for (let mes = 1; mes <= 12; mes++) {
        const cuota = cuotasPorSocio[s.id]?.[mes];

        if (cuota) {
          const pendiente = cuota.montoOriginal - cuota.montoPagado;
          deudaAnual += pendiente;
          meses[mes] = {
            estado: cuota.estado,
            pendiente: Math.round(pendiente * 100) / 100,
            cuotaId: cuota.id,
          };
        } else if (s.estado === 'ACTIVO' && s.socioTipo.activo && Number(s.socioTipo.montoMensual) > 0) {
          const fechaAlta = new Date(s.fechaAlta);
          const mesDate = new Date(Date.UTC(anio, mes - 1, 1, 12, 0, 0));

          if (fechaAlta.getTime() > new Date(Date.UTC(anio, mes - 1, 10, 12, 0, 0)).getTime()) {
            meses[mes] = { estado: 'NO_APLICA' };
          } else {
            meses[mes] = { estado: 'PENDIENTE_SIN_CUOTA', pendiente: Number(s.socioTipo.montoMensual) };
            deudaAnual += Number(s.socioTipo.montoMensual);
          }
        } else {
          meses[mes] = { estado: 'NO_APLICA' };
        }
      }

      return {
        socioId: s.id,
        nroSocio: s.nroSocio,
        apellido: s.apellido,
        nombre: s.nombre,
        tipo: s.socioTipo.nombre,
        estadoSocio: s.estado,
        meses,
        deudaAnual: Math.round(deudaAnual * 100) / 100,
      };
    });

    const totalesPorMes: Record<number, number> = {};

    for (let mes = 1; mes <= 12; mes++) {
      let total = 0;

      for (const f of filas) {
        const m = f.meses[mes];
        if (m && m.pendiente) {
          total += m.pendiente;
        }
      }

      totalesPorMes[mes] = Math.round(total * 100) / 100;
    }

    return { anio, filas, totalesPorMes };
  }

  // ─── Tesorería (resumen de deuda) ────────────────────────

  async getTesoreríaResumen() {
    const cuotasPendientes = await this.prisma.socioCuota.findMany({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      select: { montoOriginal: true, montoPagado: true },
    });

    const deudaTotal = cuotasPendientes.reduce(
      (sum, c) => sum + (Number(c.montoOriginal) - Number(c.montoPagado)),
      0,
    );

    const sociosActivos = await this.prisma.socio.count({
      where: { estado: 'ACTIVO' },
    });

    const sociosConDeuda = await this.prisma.socio.count({
      where: {
        estado: 'ACTIVO',
        cuotas: {
          some: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
        },
      },
    });

    return {
      deudaTotal: Math.round(deudaTotal * 100) / 100,
      sociosActivos,
      sociosConDeuda,
    };
  }

  // ─── Carnet PDF ──────────────────────────────────────────

  async generateCarnetPdf(socioId: number): Promise<Buffer> {
    const socio = await this.prisma.socio.findUnique({
      where: { id: socioId },
      include: { socioTipo: true },
    });

    if (!socio) throw new NotFoundException('Socio no encontrado');

    const setting = await this.prisma.setting.findFirst({
      select: { logoUrl: true, storeName: true, clubName: true },
    });

    const fechaAlta = new Date(socio.fechaAlta);
    const mesAlta = MONTH_NAMES[fechaAlta.getUTCMonth()];
    const anioAlta = fechaAlta.getUTCFullYear();

    const storeName = setting?.storeName || 'Club';
    const clubName = setting?.clubName || '';

    // A4 landscape (for each carnet) within an A4 portrait sheet
    // Page = A4 portrait (595.28 x 841.89 pt)
    // Each carnet = half height = ~420pt tall, full width
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const carnetHeight = pageHeight / 2;
    const margin = 20;
    const cardWidth = pageWidth - margin * 2;
    const cardHeight = carnetHeight - margin * 2;

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margin: 0,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Helper to render one carnet at (x, y)
      const drawCarnet = (offsetY: number) => {
        const cardX = margin;
        const cardY = offsetY + margin;

        // Card border
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 8).stroke('#cccccc');

        const innerX = cardX + 14;
        const innerY = cardY + 14;
        const innerW = cardWidth - 32;
        const innerH = cardHeight - 28;

        // Header background
        doc.roundedRect(cardX + 8, cardY + 8, cardWidth - 16, 70, 4)
          .fill('#1e3a5f');
        // Fill bottom corners square
        doc.rect(cardX + 8, cardY + 70 - 4, cardWidth - 16, 4).fill('#1e3a5f');

        // Store name in header
        doc.fill('#ffffff')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(storeName.toUpperCase(), innerX, cardY + 20, {
            width: innerW - 80,
            align: 'left',
          });

        if (clubName) {
          doc.fill('#c8d6e5')
            .fontSize(8)
            .font('Helvetica')
            .text(clubName, innerX, cardY + 42, {
              width: innerW - 80,
              align: 'left',
            });
        }

        // Logo area on the right side of header
        const logoUrl = setting?.logoUrl || null;
        if (logoUrl) {
          const logoPath = logoUrl.startsWith('/')
            ? path.join('/data/uploads', logoUrl.replace('/uploads/', ''))
            : logoUrl;

          if (logoPath.startsWith('/data/uploads') && fs.existsSync(logoPath)) {
            try {
              doc.image(logoPath, cardX + cardWidth - 80, cardY + 10, {
                fit: [60, 50],
                align: 'center',
                valign: 'center',
              });
            } catch (_) {
              // Ignore logo errors
            }
          }
        }

        // Separator line
        doc.strokeColor('#1e3a5f')
          .lineWidth(1.5)
          .moveTo(innerX, cardY + 80)
          .lineTo(cardX + cardWidth - 16, cardY + 80)
          .stroke();

        // Body
        const bodyStartY = cardY + 90;
        const col1X = innerX;
        const col2X = innerX + 200;
        const lineHeight = 22;

        const drawField = (label: string, value: string, y: number) => {
          doc.fill('#666666').fontSize(8).font('Helvetica')
            .text(label, col1X, y, { width: 190, continued: false });
          doc.fill('#111111').fontSize(12).font('Helvetica-Bold')
            .text(value, col1X, y + 11, { width: 190, continued: false });
        };

        const nombreCompleto = `${socio.apellido}, ${socio.nombre}`;
        drawField('SOCIO', nombreCompleto, bodyStartY);

        let rowY = bodyStartY + 30;
        drawField('Nº SOCIO', `#${socio.nroSocio}`, rowY);

        rowY += 30;
        drawField('TIPO', socio.socioTipo.nombre, rowY);

        rowY += 30;
        drawField('MIEMBRO DESDE', `${mesAlta} ${anioAlta}`, rowY);

        if (socio.dni) {
          rowY += 30;
          drawField('DNI', socio.dni, rowY);
        }

        // Footer line
        const footerY = cardY + cardHeight - 35;
        doc.strokeColor('#cccccc')
          .lineWidth(0.5)
          .moveTo(innerX, footerY)
          .lineTo(cardX + cardWidth - 16, footerY)
          .stroke();

        doc.fill('#999999').fontSize(7).font('Helvetica')
          .text(`Carnet generado por ${storeName}`, innerX, footerY + 8, {
            width: innerW,
            align: 'center',
          });
      };

      // Draw two carnets
      drawCarnet(0);
      drawCarnet(carnetHeight);

      doc.end();
    });
  }
}
