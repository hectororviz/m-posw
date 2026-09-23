import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Express } from 'express';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp = require('sharp');
import { PrismaService } from '../common/prisma.service';
import { validateImageFile } from '../common/image-storage';
import { MercadoPagoOauthService } from '../mercadopago-oauth/mercadopago-oauth.service';
import { CreateFixtureDto, UpdateFixtureDto } from './dto/create-fixture.dto';
import { CreateRivalDto } from './dto/create-rival.dto';
import { CreateTorneoDto } from './dto/create-torneo.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { generateDeviceToken, hashDeviceToken } from './device-token.util';
import { DEFAULT_TICKET_LAYOUT, TICKET_WIDTH_COLS } from './ticket-template.const';

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

  // ── Dispositivos ─────────────────────────────────────────
  listDevices() {
    // Los revocados no se listan (baja lógica: TicketSale.deviceId impide borrar físicamente)
    return this.prisma.posDevice.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nombre: true, activo: true, revokedAt: true, lastSeenAt: true, createdAt: true },
    });
  }

  async createDevice(nombre: string) {
    const clean = (nombre ?? '').trim();
    if (!clean) throw new BadRequestException('Nombre requerido');
    const token = generateDeviceToken();
    const device = await this.prisma.posDevice.create({
      data: { nombre: clean, tokenHash: hashDeviceToken(token) },
      select: { id: true, nombre: true, activo: true, createdAt: true },
    });
    return { ...device, token };
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
  async listSales(fixtureId?: string, status?: string) {
    const sales = await this.prisma.ticketSale.findMany({
      where: {
        ...(fixtureId ? { fixtureId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        fixture: { include: { torneo: true, rival: true } },
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

  async salesSummary(fixtureId: string) {
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

  // ── Template ticket ──────────────────────────────────────
  async getTemplate() {
    const row = await this.prisma.entradaTicketTemplate.findUnique({ where: { id: 'default' } });
    if (row) return row;
    return this.prisma.entradaTicketTemplate.create({
      data: { id: 'default', version: 1, widthCols: TICKET_WIDTH_COLS, layout: DEFAULT_TICKET_LAYOUT as Prisma.InputJsonValue },
    });
  }

  async updateTemplate(dto: UpdateTemplateDto) {
    if (!Array.isArray(dto.elements) || dto.elements.length === 0 || dto.elements.length > 40) {
      throw new BadRequestException('El diseño debe tener entre 1 y 40 bloques');
    }
    const widthCols = dto.widthCols ?? TICKET_WIDTH_COLS;
    const layout = { version: Date.now(), widthCols, elements: dto.elements } as Prisma.InputJsonValue;
    const current = await this.prisma.entradaTicketTemplate.findUnique({ where: { id: 'default' } });
    if (!current) {
      return this.prisma.entradaTicketTemplate.create({ data: { id: 'default', version: 1, widthCols, layout } });
    }
    return this.prisma.entradaTicketTemplate.update({
      where: { id: 'default' },
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
