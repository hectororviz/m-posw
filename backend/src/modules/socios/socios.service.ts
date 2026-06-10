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
import * as QRCode from 'qrcode';
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
          select: { montoOriginal: true, montoPagado: true, mes: true, anio: true, estado: true },
        },
      },
      orderBy: { nroSocio: 'asc' },
    });

    const ahora = new Date();
    const anioActual = ahora.getUTCFullYear();
    const mesActual = ahora.getUTCMonth() + 1;

    const result = socios.map((s) => {
      let deudaTotal = s.cuotas.reduce(
        (sum, c) => sum + (Number(c.montoOriginal) - Number(c.montoPagado)),
        0,
      );

      if (
        s.estado === 'ACTIVO' &&
        s.socioTipo.activo &&
        Number(s.socioTipo.montoMensual) > 0
      ) {
        const cuotasExistentes = new Set(
          s.cuotas.map((c) => `${c.anio}-${c.mes}`),
        );
        const fechaAlta = new Date(s.fechaAlta);

        for (let mes = 1; mes <= 12; mes++) {
          const key = `${anioActual}-${mes}`;
          if (cuotasExistentes.has(key)) continue;

          const dia10 = new Date(Date.UTC(anioActual, mes - 1, 10, 12, 0, 0));

          // Solo proyectar deuda de meses ya vencidos, no del mes en curso
          if (
            mes < mesActual &&
            fechaAlta.getTime() <= dia10.getTime() &&
            ahora.getTime() >= dia10.getTime()
          ) {
            deudaTotal += Number(s.socioTipo.montoMensual);
          }
        }
      }

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

    if (dto.nroSocio != null) {
      const existing = await this.prisma.socio.findUnique({
        where: { nroSocio: dto.nroSocio },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Ya existe un socio con ese numero');
      }
    }

    if (dto.socioTipoId != null) {
      await this.getTipo(dto.socioTipoId);
    }

    const data: any = { ...dto };
    delete data.socioTipoId;

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
      data: {
        ...data,
        ...(dto.socioTipoId != null ? { socioTipo: { connect: { id: dto.socioTipoId } } } : {}),
      },
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
          const dia10delMes = new Date(Date.UTC(anio, mes - 1, 10, 12, 0, 0));
          const ahora = new Date();

          // Solo mostrar pendiente si el vencimiento (dia 10) ya paso
          if (fechaAlta.getTime() > dia10delMes.getTime() || ahora.getTime() < dia10delMes.getTime()) {
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

  // CR80: 85.6mm x 54mm = 242.65pt x 153.07pt
  private static readonly CARD_W = 242.65;
  private static readonly CARD_H = 153.07;

  private drawCard(
    doc: PDFKit.PDFDocument,
    cardX: number,
    cardY: number,
    socio: { apellido: string; nombre: string; nroSocio: number; fechaAlta: Date; dni: string; uuid: string; socioTipo: { nombre: string } },
    displayName: string,
    accentColor: string,
    logoUrl: string | null | undefined,
    qrBuffer: Buffer,
  ) {
    const { CARD_W: cardW, CARD_H: cardH } = SociosService;

    // Fondo blanco del recuadro
    doc.roundedRect(cardX, cardY, cardW, cardH, 6).fill('#ffffff');

    // Franja vertical de acento recortada al borde redondeado
    const stripeW = 8;
    doc.save();
    doc.roundedRect(cardX, cardY, cardW, cardH, 6).clip();
    doc.rect(cardX, cardY, stripeW, cardH).fill(accentColor);
    doc.restore();

    // Borde del recuadro (encima de la franja)
    doc.roundedRect(cardX, cardY, cardW, cardH, 6).stroke('#cccccc');

    // Margen interno del recuadro
    const marginX = cardX + stripeW + 12;
    const marginY = cardY + 10;
    const contentW = cardW - stripeW - 24;

    const logoSize = 42;

    // Línea separadora bajo el header (se dibuja antes que el logo)
    const headerBottom = marginY + 20;
    doc.strokeColor(accentColor)
      .lineWidth(0.5)
      .moveTo(marginX, headerBottom)
      .lineTo(cardX + cardW - 12, headerBottom)
      .stroke();

    // ─── HEADER: logo (encima de la linea) + nombre ───
    const logoX = cardX + cardW - 12 - logoSize;
    const logoY = marginY;

    if (logoUrl) {
      const logoPath = logoUrl.startsWith('/')
        ? path.join('/data/uploads', logoUrl.replace('/uploads/', ''))
        : logoUrl;

      if (logoPath.startsWith('/data/uploads') && fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, logoX, logoY, { fit: [logoSize, logoSize] });
        } catch (_) {
          // Ignore logo errors
        }
      }
    }

    doc.fill(accentColor)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(displayName.toUpperCase(), marginX, marginY, {
        width: cardW - stripeW - 24 - logoSize - 8,
        align: 'left',
        lineBreak: false,
      });

    // ─── BODY ────────────────────────────────────────
    const bodyY = headerBottom + 10;

    const nombreCompleto = `${socio.apellido}, ${socio.nombre}`;

    doc.fill('#111111')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(nombreCompleto, marginX, bodyY, {
        width: contentW,
        align: 'left',
      });

    doc.fill('#333333')
      .fontSize(10)
      .font('Helvetica')
      .text(`Socio Nº ${String(socio.nroSocio).padStart(6, '0')}`, marginX, bodyY + 18, {
        width: contentW,
        align: 'left',
      });

    const fechaAlta = new Date(socio.fechaAlta);
    const fechaAltaStr = `${String(fechaAlta.getUTCDate()).padStart(2, '0')}/${String(fechaAlta.getUTCMonth() + 1).padStart(2, '0')}/${fechaAlta.getUTCFullYear()}`;
    const dniFormateado = socio.dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    const infoY = bodyY + 38;
    const lineH = 14;

    doc.fill('#555555').fontSize(7).font('Helvetica');
    doc.text(`Tipo: ${socio.socioTipo.nombre}`, marginX, infoY);
    doc.text(`DNI: ${dniFormateado}`, marginX, infoY + lineH);
    doc.text(`Socio desde: ${fechaAltaStr}`, marginX, infoY + lineH * 2);

    // ─── FOOTER ──────────────────────────────────────
    const footerY = cardY + cardH - 14;
    doc.strokeColor('#dddddd')
      .lineWidth(0.3)
      .moveTo(marginX, footerY - 4)
      .lineTo(cardX + cardW - 12, footerY - 4)
      .stroke();

    doc.fill('#aaaaaa')
      .fontSize(5.5)
      .font('Helvetica')
      .text(displayName, marginX, footerY, {
        width: contentW,
        align: 'center',
      });

    // QR code en la esquina inferior derecha
    const qrSize = 60;
    const qrX = cardX + cardW - qrSize - 8;
    const qrY = cardY + cardH - qrSize - 8;
    doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });
  }

  async generateCarnetPdf(socioId: number): Promise<{ buffer: Buffer; filename: string }> {
    const socio = await this.prisma.socio.findUnique({
      where: { id: socioId },
      include: { socioTipo: true },
    });

    if (!socio) throw new NotFoundException('Socio no encontrado');

    const setting = await this.prisma.setting.findUnique({
      where: { id: '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca' },
      select: { logoUrl: true, storeName: true, clubName: true, accentColor: true },
    });

    const displayName = setting?.clubName?.trim() || setting?.storeName || 'Club';
    const accentColor = setting?.accentColor || '#1e3a5f';
    const filename = `credencial-socio-${socio.nroSocio}.pdf`;

    const qrBuffer = await QRCode.toBuffer(socio.uuid, {
      type: 'png',
      width: 120,
      margin: 1,
    });

    const { CARD_W: cardW, CARD_H: cardH } = SociosService;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margin: 0,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), filename }));
      doc.on('error', reject);

      // Posicion del recuadro CR80 centrado en A4 portrait (595.28 x 841.89 pt)
      const pageW = 595.28;
      const cardX = (pageW - cardW) / 2;
      const cardY = 40;

      this.drawCard(doc, cardX, cardY, socio, displayName, accentColor, setting?.logoUrl, qrBuffer);

      doc.end();
    });
  }

  async generateCarnetsPdf(ids: number[]): Promise<{ buffer: Buffer; filename: string }> {
    if (!ids || ids.length === 0) throw new BadRequestException('Se requiere al menos un ID de socio');

    const socios = await this.prisma.socio.findMany({
      where: { id: { in: ids } },
      include: { socioTipo: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });

    if (socios.length === 0) throw new NotFoundException('No se encontraron socios con los IDs proporcionados');

    const setting = await this.prisma.setting.findUnique({
      where: { id: '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca' },
      select: { logoUrl: true, storeName: true, clubName: true, accentColor: true },
    });

    const displayName = setting?.clubName?.trim() || setting?.storeName || 'Club';
    const accentColor = setting?.accentColor || '#1e3a5f';
    const logoUrl = setting?.logoUrl || null;

    // Pre-generar todos los QR buffers
    const qrMap = new Map<number, Buffer>();
    for (const socio of socios) {
      const qrBuffer = await QRCode.toBuffer(socio.uuid, {
        type: 'png',
        width: 120,
        margin: 1,
      });
      qrMap.set(socio.id, qrBuffer);
    }

    const { CARD_W: cardW, CARD_H: cardH } = SociosService;

    // Grid: 2 columnas x 4 filas en A4 portrait (595.28 x 841.89 pt)
    const COLS = 2;
    const ROWS = 4;
    const CARDS_PER_PAGE = COLS * ROWS; // 8
    const pageW = 595.28;
    const colGap = 38;
    const rowGap = 46;
    const leftMargin = (pageW - COLS * cardW - colGap) / 2; // ~36
    const topMargin = 42;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margin: 0,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        filename: `credenciales-${socios.length}-socios.pdf`,
      }));
      doc.on('error', reject);

      for (let i = 0; i < socios.length; i++) {
        const pageIndex = Math.floor(i / CARDS_PER_PAGE);
        const slotInPage = i % CARDS_PER_PAGE;
        const col = slotInPage % COLS;
        const row = Math.floor(slotInPage / COLS);

        const cardX = leftMargin + col * (cardW + colGap);
        const cardY = topMargin + row * (cardH + rowGap);

        if (slotInPage === 0 && i > 0) {
          doc.addPage();
        }

        const socio = socios[i];
        const qrBuffer = qrMap.get(socio.id)!;
        this.drawCard(doc, cardX, cardY, socio, displayName, accentColor, logoUrl, qrBuffer);
      }

      doc.end();
    });
  }
}
