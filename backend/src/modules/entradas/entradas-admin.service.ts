import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Express } from 'express';
import { promises as fs, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp = require('sharp');
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../common/prisma.service';
import { validateImageFile } from '../common/image-storage';
import { MercadoPagoOauthService } from '../mercadopago-oauth/mercadopago-oauth.service';
import { CreateEventoDto, UpdateEventoDto } from './dto/create-evento.dto';
import { CreateFixtureDto, UpdateFixtureDto } from './dto/create-fixture.dto';
import { CreateRivalDto } from './dto/create-rival.dto';
import { CreateTorneoDto } from './dto/create-torneo.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { generateDeviceToken, hashDeviceToken } from './device-token.util';
import { TICKET_WIDTH_COLS, defaultLayoutFor, normalizeTemplateId } from './ticket-template.const';

function startOfDayLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function defaultWindowFor(dateInput: string | Date): { ventanaDesde: Date; ventanaHasta: Date; fecha: Date } {
  // Exportada para test; ventana default 06:00 del día → 05:59:59 del siguiente
  const base = new Date(dateInput);
  if (Number.isNaN(base.getTime())) {
    throw new BadRequestException('Fecha inválida');
  }
  const day = startOfDayLocal(base);
  const ventanaDesde = new Date(day);
  ventanaDesde.setHours(6, 0, 0, 0);
  const ventanaHasta = new Date(day);
  ventanaHasta.setDate(ventanaHasta.getDate() + 1);
  ventanaHasta.setHours(5, 59, 59, 999);
  return { ventanaDesde, ventanaHasta, fecha: day };
}

@Injectable()
export class EntradasAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mpOauth: MercadoPagoOauthService,
  ) {}

  // ── POS Mercado Pago dedicado ────────────────────────────
  mpPosStatus() {
    return this.mpOauth.getEntradasPosStatus();
  }

  mpPosDetectStores() {
    return this.mpOauth.listMpStores();
  }

  mpPosSelect(storeId: string, posId: string) {
    if (!storeId || !posId) throw new BadRequestException('storeId y posId requeridos');
    // target='entradas': escribe SOLO mpEntradas*, el principal queda intacto
    return this.mpOauth.selectStore(String(storeId), String(posId), 'entradas');
  }

  mpPosSetup(dto: {
    storeName: string;
    posName: string;
    streetName: string;
    streetNumber: string;
    cityName: string;
    stateName: string;
    zipCode: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.mpOauth.setupPos(
      dto.storeName,
      dto.posName,
      dto.streetName,
      dto.streetNumber,
      dto.cityName,
      dto.stateName,
      dto.zipCode,
      dto.latitude,
      dto.longitude,
      'entradas',
    );
  }

  mpPosDisconnect() {
    return this.mpOauth.deleteEntradasPosSetup();
  }

  // ── Torneos ──────────────────────────────────────────────
  listTorneos() {
    return this.prisma.entradaTorneo.findMany({ orderBy: { nombre: 'asc' } });
  }

  async createTorneo(dto: CreateTorneoDto) {
    try {
      return await this.prisma.entradaTorneo.create({
        data: { nombre: dto.nombre.trim(), precio: new Prisma.Decimal(dto.precio), activo: dto.activo ?? true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya existe un torneo con ese nombre');
      }
      throw error;
    }
  }

  async updateTorneo(id: string, dto: Partial<CreateTorneoDto>) {
    const data: Prisma.EntradaTorneoUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.precio !== undefined) data.precio = new Prisma.Decimal(dto.precio);
    if (dto.activo !== undefined) data.activo = dto.activo;
    try {
      return await this.prisma.entradaTorneo.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Torneo no encontrado');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya existe un torneo con ese nombre');
      }
      throw error;
    }
  }

  // ── Rivales ──────────────────────────────────────────────
  listRivales() {
    return this.prisma.entradaRival.findMany({ orderBy: { nombre: 'asc' } });
  }

  async createRival(dto: CreateRivalDto) {
    try {
      return await this.prisma.entradaRival.create({
        data: { nombre: dto.nombre.trim(), activo: dto.activo ?? true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya existe un rival con ese nombre');
      }
      throw error;
    }
  }

  async updateRival(id: string, dto: Partial<CreateRivalDto>) {
    try {
      return await this.prisma.entradaRival.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Rival no encontrado');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya existe un rival con ese nombre');
      }
      throw error;
    }
  }

  // ── Fixtures (calendario) ────────────────────────────────
  listFixtures(from?: string, to?: string) {
    return this.prisma.entradaFixture.findMany({
      where: {
        ...(from || to
          ? { fecha: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      include: { torneo: true, rival: true },
      orderBy: [{ fecha: 'asc' }, { ventanaDesde: 'asc' }],
      take: 500,
    });
  }

  async createFixture(dto: CreateFixtureDto) {
    const defaults = defaultWindowFor(dto.fecha);
    const ventanaDesde = dto.ventanaDesde ? new Date(dto.ventanaDesde) : defaults.ventanaDesde;
    const ventanaHasta = dto.ventanaHasta ? new Date(dto.ventanaHasta) : defaults.ventanaHasta;
    if (!(ventanaHasta > ventanaDesde)) {
      throw new BadRequestException('La ventana de venta debe terminar después de empezar');
    }
    try {
      return await this.prisma.entradaFixture.create({
        data: {
          fecha: defaults.fecha,
          torneoId: dto.torneoId,
          rivalId: dto.rivalId,
          ventanaDesde,
          ventanaHasta,
          activo: dto.activo ?? true,
        },
        include: { torneo: true, rival: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya existe ese partido en el calendario');
      }
      throw error;
    }
  }

  async updateFixture(id: string, dto: UpdateFixtureDto) {
    const fixture = await this.prisma.entradaFixture.findUnique({ where: { id } });
    if (!fixture) throw new NotFoundException('Partido no encontrado');
    const ventanaDesde = dto.ventanaDesde ? new Date(dto.ventanaDesde) : fixture.ventanaDesde;
    const ventanaHasta = dto.ventanaHasta ? new Date(dto.ventanaHasta) : fixture.ventanaHasta;
    if (!(ventanaHasta > ventanaDesde)) {
      throw new BadRequestException('La ventana de venta debe terminar después de empezar');
    }
    try {
      return await this.prisma.entradaFixture.update({
        where: { id },
        data: {
          ventanaDesde,
          ventanaHasta,
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
          ...(dto.torneoId ? { torneoId: dto.torneoId } : {}),
          ...(dto.rivalId ? { rivalId: dto.rivalId } : {}),
        },
        include: { torneo: true, rival: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya existe ese partido en el calendario');
      }
      throw error;
    }
  }

  async deleteFixture(id: string) {
    const fixture = await this.prisma.entradaFixture.findUnique({ where: { id } });
    if (!fixture) throw new NotFoundException('Partido no encontrado');
    const [sales, units] = await Promise.all([
      this.prisma.ticketSale.count({ where: { fixtureId: id } }),
      this.prisma.ticketUnit.count({ where: { fixtureId: id } }),
    ]);
    if (sales > 0 || units > 0) {
      throw new ConflictException({
        code: 'FIXTURE_CON_VENTAS',
        message: 'No se puede eliminar: el partido ya tiene ventas registradas',
      });
    }
    await this.prisma.$transaction([
      this.prisma.entradaContador.deleteMany({ where: { fixtureId: id } }),
      this.prisma.entradaFixture.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  // ── Eventos especiales (sin torneo ni rival) ────────────
  listEventos(from?: string, to?: string) {
    return this.prisma.entradaEvento.findMany({
      where: {
        ...(from || to
          ? { fecha: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      orderBy: [{ fecha: 'asc' }, { ventanaDesde: 'asc' }],
      take: 500,
    });
  }

  async createEvento(dto: CreateEventoDto) {
    const titulo = dto.titulo.trim().slice(0, 32);
    if (!titulo) throw new BadRequestException('Título requerido');
    const defaults = defaultWindowFor(dto.fecha);
    const ventanaDesde = dto.ventanaDesde ? new Date(dto.ventanaDesde) : defaults.ventanaDesde;
    const ventanaHasta = dto.ventanaHasta ? new Date(dto.ventanaHasta) : defaults.ventanaHasta;
    if (!(ventanaHasta > ventanaDesde)) {
      throw new BadRequestException('La ventana de venta debe terminar después de empezar');
    }
    return this.prisma.entradaEvento.create({
      data: {
        titulo,
        fecha: defaults.fecha,
        precio: new Prisma.Decimal(dto.precio),
        ventanaDesde,
        ventanaHasta,
        activo: dto.activo ?? true,
      },
    });
  }

  async updateEvento(id: string, dto: UpdateEventoDto) {
    const evento = await this.prisma.entradaEvento.findUnique({ where: { id } });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    const ventanaDesde = dto.ventanaDesde ? new Date(dto.ventanaDesde) : evento.ventanaDesde;
    const ventanaHasta = dto.ventanaHasta ? new Date(dto.ventanaHasta) : evento.ventanaHasta;
    if (!(ventanaHasta > ventanaDesde)) {
      throw new BadRequestException('La ventana de venta debe terminar después de empezar');
    }
    return this.prisma.entradaEvento.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim().slice(0, 32) } : {}),
        ...(dto.precio !== undefined ? { precio: new Prisma.Decimal(dto.precio) } : {}),
        ventanaDesde,
        ventanaHasta,
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  async deleteEvento(id: string) {
    const evento = await this.prisma.entradaEvento.findUnique({ where: { id } });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    const [sales, units] = await Promise.all([
      this.prisma.ticketSale.count({ where: { eventoId: id } }),
      this.prisma.ticketUnit.count({ where: { eventoId: id } }),
    ]);
    if (sales > 0 || units > 0) {
      throw new ConflictException({
        code: 'EVENTO_CON_VENTAS',
        message: 'No se puede eliminar: el evento ya tiene ventas registradas',
      });
    }
    await this.prisma.$transaction([
      this.prisma.entradaEventoContador.deleteMany({ where: { eventoId: id } }),
      this.prisma.entradaEvento.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  // ── Dispositivos ─────────────────────────────────────────
  listDevices() {
    // Los revocados no se listan (baja lógica: TicketSale.deviceId impide borrar físicamente)
    return this.prisma.posDevice.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        activo: true,
        revokedAt: true,
        lastSeenAt: true,
        createdAt: true,
        mpStoreId: true,
        mpPosId: true,
        mpStoreName: true,
        mpPosName: true,
      },
    });
  }

  async createDevice(nombre: string, tipo?: string) {
    const clean = (nombre ?? '').trim();
    if (!clean) throw new BadRequestException('Nombre requerido');
    const kind = this.parseDeviceTipo(tipo);
    const token = generateDeviceToken();
    const device = await this.prisma.posDevice.create({
      data: { nombre: clean, tipo: kind, tokenHash: hashDeviceToken(token) },
      select: { id: true, nombre: true, tipo: true, activo: true, createdAt: true },
    });
    return { ...device, token };
  }

  private parseDeviceTipo(tipo: string | undefined, field = 'tipo'): 'ENTRADAS' | 'POS' {
    if (!tipo) return 'ENTRADAS';
    const upper = tipo.trim().toUpperCase();
    if (upper !== 'ENTRADAS' && upper !== 'POS') {
      throw new BadRequestException(`Tipo de dispositivo inválido en ${field}: use ENTRADAS o POS`);
    }
    return upper;
  }

  /**
   * Cambio de modo sin re-pairing (el token no cambia).
   * Se bloquea si la terminal tiene ventas PENDING sin sincronizar,
   * salvo force explícito del admin.
   */
  async updateDeviceTipo(id: string, tipo: string, force = false) {
    const kind = this.parseDeviceTipo(tipo);
    const device = await this.prisma.posDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    if (device.tipo === kind) {
      return { id: device.id, nombre: device.nombre, tipo: device.tipo };
    }
    if (!force) {
      const pending = await this.prisma.ticketSale.count({
        where: { deviceId: id, status: 'PENDING' },
      });
      if (pending > 0) {
        throw new ConflictException({
          code: 'DEVICE_HAS_PENDING_SALES',
          message: `La terminal tiene ${pending} venta(s) pendiente(s) sin sincronizar`,
          pending,
        });
      }
    }
    return this.prisma.posDevice.update({
      where: { id },
      data: { tipo: kind },
      select: { id: true, nombre: true, tipo: true },
    });
  }

  async revokeDevice(id: string) {
    const device = await this.prisma.posDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    return this.prisma.posDevice.update({
      where: { id },
      data: { activo: false, revokedAt: new Date() },
      select: { id: true, nombre: true, activo: true, revokedAt: true },
    });
  }

  async rotateDevice(id: string) {
    const device = await this.prisma.posDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    const token = generateDeviceToken();
    await this.prisma.posDevice.update({
      where: { id },
      data: { tokenHash: hashDeviceToken(token), activo: true, revokedAt: null },
    });
    return { id, token };
  }

  static pairingPayload(baseUrl: string, token: string) {
    return { baseUrl, token };
  }

  pairingPayload(baseUrl: string, token: string) {
    return EntradasAdminService.pairingPayload(baseUrl, token);
  }

  // ── Ventas (lectura + conteos) ───────────────────────────
  async listSales(fixtureId?: string, eventoId?: string, status?: string) {
    const sales = await this.prisma.ticketSale.findMany({
      where: {
        ...(fixtureId ? { fixtureId } : {}),
        ...(eventoId ? { eventoId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        fixture: { include: { torneo: true, rival: true } },
        evento: true,
        device: { select: { id: true, nombre: true } },
        units: {
          orderBy: { nro: 'asc' },
          include: { beneficio: { select: { id: true, nombre: true, usoUnico: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return sales;
  }

  async salesSummary(fixtureId?: string, eventoId?: string) {
    if (eventoId) {
      const [total, units] = await Promise.all([
        this.prisma.ticketSale.aggregate({
          where: { eventoId, status: 'APPROVED' },
          _sum: { total: true, cantidad: true },
        }),
        this.prisma.ticketUnit.count({ where: { eventoId } }),
      ]);
      return {
        totalEntradas: total._sum.cantidad ?? 0,
        recaudado: total._sum.total?.toString() ?? '0',
        unidades: units,
      };
    }
    const [local, visitante, total] = await Promise.all([
      this.prisma.ticketUnit.count({ where: { fixtureId, sector: 'LOCAL' } }),
      this.prisma.ticketUnit.count({ where: { fixtureId, sector: 'VISITANTE' } }),
      this.prisma.ticketSale.aggregate({
        where: { fixtureId, status: 'APPROVED' },
        _sum: { total: true, cantidad: true },
      }),
    ]);
    return { local, visitante, totalEntradas: total._sum.cantidad ?? 0, recaudado: total._sum.total?.toString() ?? '0' };
  }

  // ── Resumen de jornada (entradas + bufet en ventana) ─────
  // Una jornada = un fixture (partido) o un evento especial.
  // Bufet = Sale APPROVED con paidAt dentro de la ventana.
  async jornadaResumen(fixtureId?: string, eventoId?: string): Promise<JornadaResumen> {
    if ((!fixtureId && !eventoId) || (fixtureId && eventoId)) {
      throw new BadRequestException('Indicá fixtureId o eventoId (solo uno)');
    }
    const fixture = fixtureId
      ? await this.prisma.entradaFixture.findUnique({
          where: { id: fixtureId },
          include: { torneo: true, rival: true },
        })
      : null;
    if (fixtureId && !fixture) throw new NotFoundException('Partido no encontrado');
    const evento = eventoId
      ? await this.prisma.entradaEvento.findUnique({ where: { id: eventoId } })
      : null;
    if (eventoId && !evento) throw new NotFoundException('Evento no encontrado');

    const ventanaDesde = new Date(fixture ? fixture.ventanaDesde : evento!.ventanaDesde);
    const ventanaHasta = new Date(fixture ? fixture.ventanaHasta : evento!.ventanaHasta);
    const titulo = fixture
      ? `${fixture.torneo.nombre} vs ${fixture.rival.nombre}`
      : `★ ${evento!.titulo}`;

    const saleWhere = fixtureId ? { fixtureId } : { eventoId };

    const [ticketSales, noAprobadas, beneficiosOtorgados, beneficiosCanjeados] = await Promise.all([
      this.prisma.ticketSale.findMany({
        where: { ...saleWhere, status: 'APPROVED' },
        select: { sector: true, cantidad: true, total: true, paymentMethod: true, paidAt: true, createdAt: true },
        take: 10000,
      }),
      this.prisma.ticketSale.groupBy({
        by: ['status'],
        where: saleWhere,
        _count: { status: true },
      }),
      this.prisma.ticketUnit.count({ where: { ...saleWhere, beneficioId: { not: null } } }),
      this.prisma.entradaBeneficioConsumo.count({
        where: { ticketUnit: fixtureId ? { fixtureId } : { eventoId } },
      }),
    ]);

    // Entradas por sector
    const porSector: Record<string, { cant: number; monto: number }> = {};
    const porMetodoEntradas: Record<string, { cant: number; monto: number }> = {};
    let totalEntradas = 0;
    let montoEntradas = 0;
    for (const s of ticketSales) {
      const sector = s.sector ?? 'GENERAL';
      const cant = s.cantidad;
      const monto = Number(s.total);
      totalEntradas += cant;
      montoEntradas += monto;
      const sec = porSector[sector] ?? { cant: 0, monto: 0 };
      sec.cant += cant;
      sec.monto += monto;
      porSector[sector] = sec;
      const met = porMetodoEntradas[s.paymentMethod] ?? { cant: 0, monto: 0 };
      met.cant += cant;
      met.monto += monto;
      porMetodoEntradas[s.paymentMethod] = met;
    }

    // Bufet: ventas aprobadas con paidAt en ventana
    const bufetSales = await this.prisma.sale.findMany({
      where: { status: 'APPROVED', paidAt: { gte: ventanaDesde, lte: ventanaHasta } },
      select: {
        id: true,
        total: true,
        paymentMethod: true,
        paidAt: true,
        createdAt: true,
        items: { select: { quantity: true, subtotal: true, product: { select: { name: true } } } },
      },
      take: 10000,
    });
    const porMetodoBufet: Record<string, { cant: number; monto: number }> = {};
    const porProducto: Record<string, { cant: number; monto: number }> = {};
    let montoBufet = 0;
    for (const s of bufetSales) {
      const monto = Number(s.total);
      montoBufet += monto;
      const met = porMetodoBufet[s.paymentMethod] ?? { cant: 0, monto: 0 };
      met.cant += 1;
      met.monto += monto;
      porMetodoBufet[s.paymentMethod] = met;
      for (const it of s.items) {
        const nombre = it.product?.name ?? 'Sin nombre';
        const p = porProducto[nombre] ?? { cant: 0, monto: 0 };
        p.cant += it.quantity;
        p.monto += Number(it.subtotal);
        porProducto[nombre] = p;
      }
    }
    const topProductos = Object.entries(porProducto)
      .map(([nombre, v]) => ({ nombre, cant: v.cant, monto: round2(v.monto) }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 10);

    // Horas pico: buckets por hora local entre ventanaDesde y ventanaHasta
    const horasPico = buildHoraBuckets(
      ventanaDesde,
      ventanaHasta,
      ticketSales.map((s) => ({ at: s.paidAt ?? s.createdAt, cant: s.cantidad })),
      bufetSales.map((s) => ({ at: s.paidAt ?? s.createdAt, cant: 1 })),
    );

    const metodoArr = (r: Record<string, { cant: number; monto: number }>, base: number) =>
      Object.entries(r).map(([metodo, v]) => ({
        metodo,
        cant: v.cant,
        monto: round2(v.monto),
        pct: pctOf(v.monto, base),
      }));
    const sectorArr = Object.entries(porSector).map(([sector, v]) => ({
      sector,
      cant: v.cant,
      monto: round2(v.monto),
      pct: pctOf(v.cant, totalEntradas),
    }));

    return {
      jornada: {
        tipo: fixture ? 'PARTIDO' : 'EVENTO',
        titulo,
        fecha: (fixture ? fixture.fecha : evento!.fecha).toISOString(),
        ventanaDesde: ventanaDesde.toISOString(),
        ventanaHasta: ventanaHasta.toISOString(),
      },
      entradas: {
        totalCant: totalEntradas,
        totalMonto: round2(montoEntradas),
        porSector: sectorArr,
        porMetodo: metodoArr(porMetodoEntradas, montoEntradas),
      },
      bufet: {
        totalCant: bufetSales.length,
        totalMonto: round2(montoBufet),
        ticketPromedio: bufetSales.length > 0 ? round2(montoBufet / bufetSales.length) : 0,
        porMetodo: metodoArr(porMetodoBufet, montoBufet),
        topProductos,
      },
      horasPico,
      beneficios: { otorgados: beneficiosOtorgados, canjeados: beneficiosCanjeados },
      noAprobadas: noAprobadas
        .filter((g) => g.status !== 'APPROVED')
        .map((g) => ({ status: g.status, cant: g._count.status })),
      totalGeneral: round2(montoEntradas + montoBufet),
    };
  }

  // ── PDF gráfico del resumen de jornada (para la comisión) ──
  async jornadaPdf(fixtureId?: string, eventoId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const r = await this.jornadaResumen(fixtureId, eventoId);
    const [branding, escudo] = await Promise.all([
      this.prisma.setting.findFirst({
        select: { clubName: true, storeName: true, accentColor: true, logoUrl: true },
      }),
      this.prisma.entradaTicketAsset.findUnique({ where: { id: 'escudo' } }),
    ]);
    const clubName = branding?.clubName?.trim() || branding?.storeName || 'Club';
    const accent = normalizeHexColor(branding?.accentColor) ?? '#0e7490';
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margins: { top: 44, bottom: 44, left: 50, right: 50 } });
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), filename: jornadaFilename(r) }));
      doc.on('error', reject);
      try {
        drawJornadaPdf(doc, r, {
          clubName,
          accent,
          logoPath: resolveUploadFile(branding?.logoUrl),
          escudoPng: escudo?.pngBase64 ?? null,
          money: (n: number) =>
            n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }),
        });
      } catch (e) {
        reject(e);
        return;
      }
      doc.end();
    });
  }

  // ── Template ticket (uno por tipo: partido | evento) ──────
  async getTemplate(rawId?: string) {
    const id = normalizeTemplateId(rawId);
    const row = await this.prisma.entradaTicketTemplate.findUnique({ where: { id } });
    if (row) return row;
    return this.prisma.entradaTicketTemplate.create({
      data: { id, version: 1, widthCols: TICKET_WIDTH_COLS, layout: defaultLayoutFor(id) as Prisma.InputJsonValue },
    });
  }

  async updateTemplate(dto: UpdateTemplateDto) {
    if (!Array.isArray(dto.elements) || dto.elements.length === 0 || dto.elements.length > 40) {
      throw new BadRequestException('El diseño debe tener entre 1 y 40 bloques');
    }
    const id = normalizeTemplateId(dto.id);
    const widthCols = dto.widthCols ?? TICKET_WIDTH_COLS;
    const layout = { version: Date.now(), widthCols, elements: dto.elements } as Prisma.InputJsonValue;
    const current = await this.prisma.entradaTicketTemplate.findUnique({ where: { id } });
    if (!current) {
      return this.prisma.entradaTicketTemplate.create({ data: { id, version: 1, widthCols, layout } });
    }
    return this.prisma.entradaTicketTemplate.update({
      where: { id },
      data: { version: { increment: 1 }, widthCols, layout },
    });
  }

  // ── Escudo monocromático + branding del club ───────────────
  // El POS cachea por version; accentColor/clubName viajan acá para
  // que la app aplique el color de personalización junto al escudo.
  async getEscudo() {
    const [row, branding] = await Promise.all([
      this.prisma.entradaTicketAsset.findUnique({ where: { id: 'escudo' } }),
      this.prisma.setting.findFirst({ select: { accentColor: true, clubName: true, logoUrl: true } }),
    ]);
    const asset = row
      ?? await this.prisma.entradaTicketAsset.create({ data: { id: 'escudo', version: 1, widthPx: 256 } });
    return {
      ...asset,
      accentColor: branding?.accentColor ?? '#0ea5e9',
      clubName: branding?.clubName ?? '',
      logoUrl: branding?.logoUrl ?? null,
    };
  }

  async uploadEscudo(file: Express.Multer.File, widthPx = 256) {
    validateImageFile(file);
    const width = Math.min(Math.max(Number(widthPx) || 256, 128), 576);
    const tmpPath = join(tmpdir(), `escudo-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    await sharp(file.buffer)
      .resize({ width, fit: 'inside', withoutEnlargement: false })
      .grayscale()
      .threshold(128)
      .png({ compressionLevel: 9 })
      .toFile(tmpPath);
    const png = await fs.readFile(tmpPath);
    await fs.unlink(tmpPath).catch(() => undefined);
    const pngBase64 = png.toString('base64');
    if (pngBase64.length > 120_000) {
      throw new BadRequestException('La imagen procesada es demasiado pesada, usá un PNG más simple');
    }
    const current = await this.prisma.entradaTicketAsset.findUnique({ where: { id: 'escudo' } });
    if (!current) {
      return this.prisma.entradaTicketAsset.create({ data: { id: 'escudo', version: 1, pngBase64, widthPx: width } });
    }
    return this.prisma.entradaTicketAsset.update({
      where: { id: 'escudo' },
      data: { pngBase64, widthPx: width, version: { increment: 1 } },
    });
  }

}

// ─── Resumen de jornada: tipos + helpers puros ────────────

export interface JornadaMetodo {
  metodo: string;
  cant: number;
  monto: number;
  pct: number;
}

export interface JornadaSector {
  sector: string;
  cant: number;
  monto: number;
  pct: number;
}

export interface JornadaProducto {
  nombre: string;
  cant: number;
  monto: number;
}

export interface JornadaHora {
  hora: string;
  entradas: number;
  bufet: number;
}

export interface JornadaResumen {
  jornada: {
    tipo: 'PARTIDO' | 'EVENTO';
    titulo: string;
    fecha: string;
    ventanaDesde: string;
    ventanaHasta: string;
  };
  entradas: {
    totalCant: number;
    totalMonto: number;
    porSector: JornadaSector[];
    porMetodo: JornadaMetodo[];
  };
  bufet: {
    totalCant: number;
    totalMonto: number;
    ticketPromedio: number;
    porMetodo: JornadaMetodo[];
    topProductos: JornadaProducto[];
  };
  horasPico: JornadaHora[];
  beneficios: { otorgados: number; canjeados: number };
  noAprobadas: Array<{ status: string; cant: number }>;
  totalGeneral: number;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pctOf(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export const TZ_ARG = 'America/Argentina/Buenos_Aires';

const horaFmtAR = new Intl.DateTimeFormat('es-AR', { timeZone: TZ_ARG, hour: '2-digit', hourCycle: 'h23' });

export function buildHoraBuckets(
  desde: Date,
  hasta: Date,
  entradas: Array<{ at: Date; cant: number }>,
  bufet: Array<{ at: Date; cant: number }>,
): JornadaHora[] {
  const buckets: JornadaHora[] = [];
  const start = new Date(desde);
  start.setMinutes(0, 0, 0);
  const end = new Date(hasta);
  let guard = 0;
  for (let t = start.getTime(); t <= end.getTime() && guard < 48; t += 3_600_000, guard += 1) {
    const d = new Date(t);
    buckets.push({ hora: `${horaFmtAR.format(d)}:00`, entradas: 0, bufet: 0, _t: d.getTime() } as JornadaHora & { _t: number });
  }
  const place = (at: Date, cant: number, key: 'entradas' | 'bufet') => {
    const h = new Date(at);
    h.setMinutes(0, 0, 0);
    const b = buckets.find((x) => (x as unknown as { _t: number })._t === h.getTime());
    if (b) b[key] += cant;
  };
  for (const e of entradas) place(new Date(e.at), e.cant, 'entradas');
  for (const b of bufet) place(new Date(b.at), b.cant, 'bufet');
  return buckets.map(({ hora, entradas: e, bufet: b }) => ({ hora, entradas: e, bufet: b }));
}

export function normalizeHexColor(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) ? t : null;
}

export function resolveUploadFile(url: string | null | undefined): string | null {
  if (!url) return null;
  const p = url.startsWith('/') ? join('/data/uploads', url.replace('/uploads/', '')) : url;
  if (!p.startsWith('/data/uploads') || !existsSync(p)) return null;
  return p;
}

export function fmtEs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-AR', { timeZone: TZ_ARG, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtHoraEs(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { timeZone: TZ_ARG, hour: '2-digit', minute: '2-digit' });
}

export function jornadaFilename(r: JornadaResumen): string {
  const fecha = new Date(r.jornada.fecha).toLocaleDateString('en-CA', { timeZone: TZ_ARG });
  const slug = r.jornada.titulo
    .normalize('NFD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase();
  return `jornada-${fecha}-${slug || 'resumen'}.pdf`;
}

// ─── Dibujo del PDF de jornada (cursor explícito, sin depender de doc.y) ───
// Cada bloque reserva su alto con ensure() y avanza un cursor propio `y`,
// así nada se superpone y el contenido fluye a hoja 2 cuando no entra.

export interface JornadaPdfOpts {
  clubName: string;
  accent: string;
  logoPath: string | null;
  escudoPng: string | null;
  money: (n: number) => string;
}

const JORNADA_LEFT = 50;
const JORNADA_WIDTH = 495.28;
const JORNADA_BOTTOM = 841.89 - 44;
const JORNADA_TRACK = '#e5e7eb';

function fitText(doc: PDFKit.PDFDocument, text: string, maxW: number, font: string, size: number): string {
  doc.font(font).fontSize(size);
  if (doc.widthOfString(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

export function drawJornadaPdf(doc: PDFKit.PDFDocument, r: JornadaResumen, opts: JornadaPdfOpts): void {
  const { accent, clubName, money } = opts;
  const left = JORNADA_LEFT;
  const W = JORNADA_WIDTH;
  const palette = [accent, '#16a34a', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6'];
  let y = doc.y;

  const ensure = (h: number) => {
    if (y + h > JORNADA_BOTTOM) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.y = y;
  };
  const advance = (h: number) => {
    y += h;
    doc.y = y;
  };
  const sectionTitle = (t: string) => {
    ensure(28);
    doc.font('Helvetica-Bold').fontSize(12).fill('#111827').text(t, left, y, { width: W });
    advance(20);
  };
  const legendRow = (color: string, text: string) => {
    ensure(17);
    doc.fill(color).rect(left, y + 2, 10, 10).fill();
    doc.font('Helvetica').fontSize(10).fill('#111827').text(fitText(doc, text, W - 18, 'Helvetica', 10), left + 16, y, { width: W - 16 });
    advance(15);
  };
  const dualBar = (segs: Array<{ pct: number; color: string }>) => {
    ensure(28);
    doc.save().roundedRect(left, y, W, 18, 4).fill(JORNADA_TRACK).restore();
    let acc = 0;
    for (const s of segs) {
      const wSeg = (W * s.pct) / 100;
      if (wSeg > 0.5) doc.save().rect(left + acc, y, wSeg, 18).fill(s.color).restore();
      acc += wSeg;
    }
    advance(26);
  };

  // Encabezado: escudo/logo + club + jornada
  ensure(80);
  const yHead = y;
  let hx = left;
  const drawImg = (src: string | Buffer) => {
    try {
      doc.image(src, left, yHead, { fit: [64, 64] });
      hx = left + 76;
    } catch {
      /* sin imagen */
    }
  };
  if (opts.logoPath) drawImg(opts.logoPath);
  else if (opts.escudoPng) drawImg(Buffer.from(opts.escudoPng, 'base64'));
  doc.font('Helvetica-Bold').fontSize(16).fill('#111827').text(clubName, hx, yHead, { width: W - (hx - left) });
  doc.font('Helvetica-Bold').fontSize(13).fill(accent).text(r.jornada.titulo);
  doc.font('Helvetica').fontSize(9).fill('#6b7280')
    .text(`Resumen de jornada · ${fmtEs(r.jornada.fecha)} · Ventana ${fmtHoraEs(r.jornada.ventanaDesde)} → ${fmtHoraEs(r.jornada.ventanaHasta)}`);
  y = Math.max(yHead + 70, doc.y + 4);
  doc.y = y;
  doc.moveTo(left, y).lineTo(left + W, y).stroke(accent);
  advance(10);

  // KPIs
  const kpis = [
    { label: 'Entradas', value: `${r.entradas.totalCant}`, sub: money(r.entradas.totalMonto) },
    { label: 'Bufet', value: `${r.bufet.totalCant} tickets`, sub: money(r.bufet.totalMonto) },
    { label: 'Ticket prom. bufet', value: money(r.bufet.ticketPromedio), sub: `${r.bufet.topProductos.length} en top` },
    { label: 'TOTAL GENERAL', value: money(r.totalGeneral), sub: 'Entradas + bufet', hot: true },
  ];
  ensure(64);
  const ky = y;
  const kw = W / 4;
  kpis.forEach((k, i) => {
    const x = left + i * kw;
    if (k.hot) doc.save().roundedRect(x, ky, kw - 8, 56, 6).fill(accent).restore();
    else doc.save().roundedRect(x, ky, kw - 8, 56, 6).fill('#f3f4f6').restore();
    const fg = k.hot ? '#ffffff' : '#111827';
    doc.font('Helvetica').fontSize(8).fill(k.hot ? '#f0fdfa' : '#6b7280').text(k.label.toUpperCase(), x + 8, ky + 7, { width: kw - 24 });
    doc.font('Helvetica-Bold').fontSize(13).fill(fg).text(fitText(doc, k.value, kw - 24, 'Helvetica-Bold', 13), x + 8, ky + 20, { width: kw - 24 });
    doc.font('Helvetica').fontSize(8).fill(k.hot ? '#f0fdfa' : '#374151').text(fitText(doc, k.sub, kw - 24, 'Helvetica', 8), x + 8, ky + 38, { width: kw - 24 });
  });
  y = ky + 64;
  doc.y = y;

  // Entradas por sector
  sectionTitle('Entradas por sector');
  if (r.entradas.porSector.length === 0) {
    ensure(18);
    doc.font('Helvetica').fontSize(10).fill('#6b7280').text('Sin entradas aprobadas en esta jornada.', left, y, { width: W });
    advance(16);
  } else {
    const tot = r.entradas.totalCant || 1;
    dualBar(r.entradas.porSector.map((s, i) => ({ pct: (s.cant / tot) * 100, color: palette[i % palette.length] })));
    r.entradas.porSector.forEach((s, i) => {
      legendRow(palette[i % palette.length], `${s.sector}: ${s.cant} (${s.pct}%) · ${money(s.monto)}`);
    });
  }
  advance(8);

  // Entradas por medio de pago
  sectionTitle(`Entradas por medio de pago · ${money(r.entradas.totalMonto)}`);
  if (r.entradas.porMetodo.length === 0) {
    ensure(18);
    doc.font('Helvetica').fontSize(10).fill('#6b7280').text('Sin ventas aprobadas.', left, y, { width: W });
    advance(16);
  } else {
    dualBar(r.entradas.porMetodo.map((m, i) => ({ pct: m.pct, color: palette[i % palette.length] })));
    r.entradas.porMetodo.forEach((m, i) => {
      legendRow(palette[i % palette.length], `${m.metodo}: ${m.cant} · ${money(m.monto)} (${m.pct}%)`);
    });
  }
  advance(8);

  // Bufet por medio de pago
  sectionTitle(`Bufet por medio de pago · ${money(r.bufet.totalMonto)}`);
  if (r.bufet.porMetodo.length === 0) {
    ensure(18);
    doc.font('Helvetica').fontSize(10).fill('#6b7280').text('Sin ventas de bufet en la ventana de esta jornada.', left, y, { width: W });
    advance(16);
  } else {
    dualBar(r.bufet.porMetodo.map((m, i) => ({ pct: m.pct, color: palette[(i + 1) % palette.length] })));
    r.bufet.porMetodo.forEach((m, i) => {
      legendRow(palette[(i + 1) % palette.length], `${m.metodo}: ${m.cant} · ${money(m.monto)} (${m.pct}%)`);
    });
  }
  advance(8);

  // Top productos
  sectionTitle('Productos más vendidos (bufet)');
  if (r.bufet.topProductos.length === 0) {
    ensure(18);
    doc.font('Helvetica').fontSize(10).fill('#6b7280').text('Sin productos vendidos.', left, y, { width: W });
    advance(16);
  } else {
    const max = Math.max(...r.bufet.topProductos.map((p) => p.monto), 1);
    r.bufet.topProductos.slice(0, 8).forEach((p) => {
      ensure(32);
      doc.font('Helvetica').fontSize(9).fill('#111827')
        .text(fitText(doc, `${p.nombre} · ${p.cant} u · ${money(p.monto)}`, W, 'Helvetica', 9), left, y, { width: W });
      advance(13);
      const bw = (W * p.monto) / max;
      doc.save().roundedRect(left, y, W, 10, 3).fill(JORNADA_TRACK).restore();
      if (bw > 0) doc.save().roundedRect(left, y, Math.max(bw, 3), 10, 3).fill(accent).restore();
      advance(17);
    });
  }
  advance(4);

  // Horas pico
  sectionTitle('Horas pico de ventas');
  const buckets = r.horasPico.filter((h) => h.entradas > 0 || h.bufet > 0);
  if (buckets.length === 0) {
    ensure(18);
    doc.font('Helvetica').fontSize(10).fill('#6b7280').text('Sin ventas registradas por hora.', left, y, { width: W });
    advance(16);
  } else {
    const peak = buckets.reduce((a, b) => (b.entradas + b.bufet >= a.entradas + a.bufet ? b : a), buckets[0]);
    ensure(20);
    doc.font('Helvetica').fontSize(10).fill('#374151')
      .text(`Pico ${peak.hora} — ${peak.entradas + peak.bufet} ventas (entradas ${peak.entradas} + bufet ${peak.bufet})`, left, y, { width: W });
    advance(18);
    const ch = 110;
    const n = buckets.length;
    const slot = Math.min(W / n, 64);
    const maxV = Math.max(...buckets.map((b) => Math.max(b.entradas, b.bufet)), 1);
    ensure(ch + 44);
    const baseY = y + ch;
    buckets.forEach((b, i) => {
      const x = left + i * slot;
      const hE = (ch * b.entradas) / maxV;
      const hB = (ch * b.bufet) / maxV;
      const bwBar = Math.max(Math.min(slot * 0.22, 18), 4);
      if (hE > 0) doc.save().rect(x + slot * 0.18, baseY - hE, bwBar, Math.max(hE, 1)).fill(accent).restore();
      if (hB > 0) doc.save().rect(x + slot * 0.46, baseY - hB, bwBar, Math.max(hB, 1)).fill('#16a34a').restore();
      doc.font('Helvetica').fontSize(7).fill('#374151').text(b.hora, x, baseY + 4, { width: slot });
    });
    advance(ch + 20);
    ensure(18);
    doc.fill(accent).rect(left, y + 2, 10, 10).fill();
    doc.font('Helvetica').fontSize(9).fill('#111827').text('Entradas', left + 16, y);
    const wEntr = doc.widthOfString('Entradas') + 28;
    doc.fill('#16a34a').rect(left + wEntr, y + 2, 10, 10).fill();
    doc.font('Helvetica').fontSize(9).fill('#111827').text('Bufet', left + wEntr + 16, y);
    advance(18);
  }

  // Pie: beneficios + no aprobadas + total
  ensure(96);
  doc.moveTo(left, y).lineTo(left + W, y).stroke('#d1d5db');
  advance(8);
  doc.font('Helvetica').fontSize(9).fill('#374151')
    .text(`Beneficios de bufet: ${r.beneficios.otorgados} otorgados · ${r.beneficios.canjeados} canjeados`, left, y, { width: W });
  advance(14);
  if (r.noAprobadas.length > 0) {
    doc.font('Helvetica').fontSize(9).fill('#6b7280')
      .text(`No suman al total: ${r.noAprobadas.map((x) => `${x.status} ${x.cant}`).join(' · ')}`, left, y, { width: W });
    advance(14);
  }
  doc.save().roundedRect(left, y, W, 34, 6).fill('#111827').restore();
  doc.font('Helvetica-Bold').fontSize(13).fill('#ffffff')
    .text(`TOTAL GENERAL  ${money(r.totalGeneral)}`, left, y + 10, { width: W, align: 'center' });
  advance(42);
  doc.font('Helvetica').fontSize(8).fill('#9ca3af')
    .text(`Emitido el ${fmtEs(new Date().toISOString())} · ${clubName}`, left, y, { width: W, align: 'center' });
  advance(14);
}
