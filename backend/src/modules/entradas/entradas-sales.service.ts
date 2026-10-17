import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntradaBeneficioSector, EntradaPayMethod, EntradaSaleStatus, EntradaSector, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { SociosQrService } from '../socios/socios-qr.service';
import { MercadoPagoInstoreService } from '../sales/services/mercadopago-instore.service';
import { CreateIntentDto } from './dto/create-intent.dto';
import { TICKET_TEMPLATE_DEFAULT_ID, TICKET_TEMPLATE_EVENTO_ID } from './ticket-template.const';
import { makeBenefitCode } from './entradas-beneficios.service';
import { resolveDeviceMpOrThrow } from './device-mp.helper';
import type { EntradasDeviceContext } from './device.guard';

const SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';
const QR_TTL_MINUTES = 10;
const INTENT_RATE_LIMIT_PER_MIN = 10;

const pad3 = (n: number) => String(n).padStart(3, '0');

function prefixFor(sector: EntradaSector | null | undefined): string {
  if (!sector) return 'E';
  return sector === 'LOCAL' ? 'L' : 'V';
}

@Injectable()
export class EntradasSalesService {
  private readonly logger = new Logger(EntradasSalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mpInstore: MercadoPagoInstoreService,
    private readonly sociosQr: SociosQrService,
  ) {}

  private async assertModuleEnabled() {
    const setting = await this.prisma.setting.findUnique({
      where: { id: SETTING_ID },
      select: { enableEntradasModule: true },
    });
    if (!setting?.enableEntradasModule) {
      throw new ForbiddenException({ code: 'ENTRADAS_DISABLED', message: 'Módulo de entradas desactivado' });
    }
  }

  // ── Fixtures y eventos vigentes ──────────────────────────
  async vigentes() {
    await this.assertModuleEnabled();
    const now = new Date();
    const [fixtures, eventos] = await Promise.all([
      this.prisma.entradaFixture.findMany({
        where: { activo: true, ventanaDesde: { lte: now }, ventanaHasta: { gte: now } },
        include: { torneo: true, rival: true },
        orderBy: { ventanaDesde: 'asc' },
      }),
      this.prisma.entradaEvento.findMany({
        where: { activo: true, ventanaDesde: { lte: now }, ventanaHasta: { gte: now } },
        orderBy: { ventanaDesde: 'asc' },
      }),
    ]);
    const withCounts = await Promise.all(
      fixtures
        .filter((f) => f.torneo.activo && f.rival.activo)
        .map(async (f) => {
          const [vendidosL, vendidosV] = await Promise.all([
            this.prisma.ticketUnit.count({ where: { fixtureId: f.id, sector: 'LOCAL' } }),
            this.prisma.ticketUnit.count({ where: { fixtureId: f.id, sector: 'VISITANTE' } }),
          ]);
          return {
            tipo: 'PARTIDO' as const,
            fixtureId: f.id,
            fecha: f.fecha,
            torneo: f.torneo.nombre,
            torneoId: f.torneoId,
            rival: f.rival.nombre,
            rivalId: f.rivalId,
            precio: f.torneo.precio.toString(),
            vendidosL,
            vendidosV,
            ventanaDesde: f.ventanaDesde,
            ventanaHasta: f.ventanaHasta,
          };
        }),
    );
    const eventosConVentas = await Promise.all(
      eventos.map(async (e) => {
        const vendidos = await this.prisma.ticketUnit.count({ where: { eventoId: e.id } });
        return {
          tipo: 'EVENTO' as const,
          eventoId: e.id,
          titulo: e.titulo,
          fecha: e.fecha,
          precio: e.precio.toString(),
          vendidos,
          ventanaDesde: e.ventanaDesde,
          ventanaHasta: e.ventanaHasta,
        };
      }),
    );
    return { now, fixtures: withCounts, eventos: eventosConVentas };
  }

  // ── Intent de venta ──────────────────────────────────────
  async createIntent(device: EntradasDeviceContext, dto: CreateIntentDto, requestId?: string) {
    await this.assertModuleEnabled();

    const minuteAgo = new Date(Date.now() - 60_000);
    const recent = await this.prisma.ticketSale.count({
      where: { deviceId: device.id, createdAt: { gte: minuteAgo } },
    });
    if (recent >= INTENT_RATE_LIMIT_PER_MIN) {
      throw new BadRequestException({ code: 'RATE_LIMIT', message: 'Demasiados intentos, esperá un minuto' });
    }

    if (requestId) {
      const existing = await this.prisma.ticketSale.findUnique({
        where: { requestId },
        include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } }, evento: true },
      });
      if (existing) return this.toStatusPayload(existing);
    }

    if (!!dto.fixtureId === !!dto.eventoId) {
      throw new BadRequestException({ code: 'TIPO_REQUERIDO', message: 'Indicá fixtureId o eventoId (solo uno)' });
    }

    const now = new Date();
    if (dto.eventoId) {
      return this.createEventoIntent(device, dto, requestId, now);
    }

    const fixture = await this.prisma.entradaFixture.findUnique({
      where: { id: dto.fixtureId! },
      include: { torneo: true, rival: true },
    });
    if (!fixture || !fixture.activo || !fixture.torneo.activo || !fixture.rival.activo) {
      throw new NotFoundException({ code: 'FIXTURE_NO_DISPONIBLE', message: 'Partido no disponible' });
    }
    if (!(fixture.ventanaDesde <= now && now <= fixture.ventanaHasta)) {
      throw new BadRequestException({ code: 'FUERA_DE_VENTANA', message: 'Fuera del horario de venta' });
    }

    const precioUnit = Number(fixture.torneo.precio);

    // Descuento por socio (reservado futuro: hoy socioUuid siempre null desde el POS)
    let socioId: number | null = null;
    let beneficioId: string | null = null;
    let descuento = 0;
    if (dto.socioUuid) {
      const resolved = await this.resolveSocioDiscount(dto.socioUuid, fixture.torneoId, precioUnit * dto.cantidad);
      socioId = resolved.socioId;
      beneficioId = resolved.beneficioId;
      descuento = resolved.descuento;
    }

    const subtotal = precioUnit * dto.cantidad;
    const total = Math.round((subtotal - descuento + Number.EPSILON) * 100) / 100;
    if (total <= 0) {
      throw new BadRequestException({ code: 'TOTAL_INVALIDO', message: 'Total inválido' });
    }

    const sale = await this.prisma.ticketSale.create({
      data: {
        fixtureId: fixture.id,
        eventoId: null,
        sector: dto.sector ?? null,
        cantidad: dto.cantidad,
        precioUnit: new Prisma.Decimal(precioUnit),
        descuento: new Prisma.Decimal(descuento),
        total: new Prisma.Decimal(total),
        paymentMethod: dto.paymentMethod,
        status: 'PENDING',
        deviceId: device.id,
        socioId,
        beneficioId,
        requestId: requestId ?? null,
      },
      include: { units: true },
    });

    if (dto.paymentMethod === EntradaPayMethod.CASH) {
      const approved = await this.approveSale(sale.id, new Date());
      return this.toStatusPayload(approved);
    }

    const externalReference = `ticket-${sale.id}`;
    try {
      // POS propio del dispositivo (400 MP_POS_NOT_LINKED si no hay).
      const posOverride = await resolveDeviceMpOrThrow(this.prisma, device.id);
      await this.mpInstore.putTicketOrder(
        {
          externalReference,
          title: `Entradas ${fixture.torneo.nombre} vs ${fixture.rival.nombre}`,
          description: `Entradas ${dto.sector} x${dto.cantidad} ${fixture.torneo.nombre}`,
          totalAmount: total,
        },
        'entradas',
        posOverride,
      );
    } catch (error) {
      await this.prisma.ticketSale.update({
        where: { id: sale.id },
        data: { status: 'REJECTED' },
      });
      throw error;
    }
    await this.prisma.ticketSale.update({
      where: { id: sale.id },
      data: { mpExternalReference: externalReference },
    });
    // El QR es la imagen del POS propio del dispositivo (sin fallback).
    const deviceMp = await this.prisma.posDevice.findUnique({
      where: { id: device.id },
      select: { mpQrData: true },
    });
    const pending = await this.prisma.ticketSale.findUnique({
      where: { id: sale.id },
      include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } }, evento: true },
    });
    const payload = await this.toStatusPayload(pending!);
    return {
      ...payload,
      qrImageUrl: deviceMp?.mpQrData ?? payload.datos.qrImageUrl ?? null,
    };
  }

  // ── Intent de venta para eventos especiales ────────────────
  // Sin torneo/rival/sector: precio propio del evento, sector GENERAL,
  // numeración E-xxx con contador único por evento.
  private async createEventoIntent(
    device: EntradasDeviceContext,
    dto: CreateIntentDto,
    requestId: string | undefined,
    now: Date,
  ) {
    const evento = await this.prisma.entradaEvento.findUnique({ where: { id: dto.eventoId! } });
    if (!evento || !evento.activo) {
      throw new NotFoundException({ code: 'EVENTO_NO_DISPONIBLE', message: 'Evento no disponible' });
    }
    if (!(evento.ventanaDesde <= now && now <= evento.ventanaHasta)) {
      throw new BadRequestException({ code: 'FUERA_DE_VENTANA', message: 'Fuera del horario de venta' });
    }

    const precioUnit = Number(evento.precio);

    let socioId: number | null = null;
    let beneficioId: string | null = null;
    let descuento = 0;
    if (dto.socioUuid) {
      const resolved = await this.resolveSocioDiscount(dto.socioUuid, null, precioUnit * dto.cantidad);
      socioId = resolved.socioId;
      beneficioId = resolved.beneficioId;
      descuento = resolved.descuento;
    }

    const subtotal = precioUnit * dto.cantidad;
    const total = Math.round((subtotal - descuento + Number.EPSILON) * 100) / 100;
    if (total <= 0) {
      throw new BadRequestException({ code: 'TOTAL_INVALIDO', message: 'Total inválido' });
    }

    const sale = await this.prisma.ticketSale.create({
      data: {
        fixtureId: null,
        eventoId: evento.id,
        sector: null,
        cantidad: dto.cantidad,
        precioUnit: new Prisma.Decimal(precioUnit),
        descuento: new Prisma.Decimal(descuento),
        total: new Prisma.Decimal(total),
        paymentMethod: dto.paymentMethod,
        status: 'PENDING',
        deviceId: device.id,
        socioId,
        beneficioId,
        requestId: requestId ?? null,
      },
      include: { units: true },
    });

    if (dto.paymentMethod === EntradaPayMethod.CASH) {
      const approved = await this.approveSale(sale.id, new Date());
      return this.toStatusPayload(approved);
    }

    const externalReference = `ticket-${sale.id}`;
    try {
      const posOverride = await resolveDeviceMpOrThrow(this.prisma, device.id);
      await this.mpInstore.putTicketOrder(
        {
          externalReference,
          title: `Entradas ${evento.titulo}`,
          description: `Entradas GENERAL x${dto.cantidad} ${evento.titulo}`,
          totalAmount: total,
        },
        'entradas',
        posOverride,
      );
    } catch (error) {
      await this.prisma.ticketSale.update({
        where: { id: sale.id },
        data: { status: 'REJECTED' },
      });
      throw error;
    }
    await this.prisma.ticketSale.update({
      where: { id: sale.id },
      data: { mpExternalReference: externalReference },
    });
    const deviceMp = await this.prisma.posDevice.findUnique({
      where: { id: device.id },
      select: { mpQrData: true },
    });
    const pending = await this.prisma.ticketSale.findUnique({
      where: { id: sale.id },
      include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } }, evento: true },
    });
    const payload = await this.toStatusPayload(pending!);
    return {
      ...payload,
      qrImageUrl: deviceMp?.mpQrData ?? payload.datos.qrImageUrl ?? null,
    };
  }

  async status(saleId: string, device: EntradasDeviceContext) {
    const sale = await this.prisma.ticketSale.findFirst({
      where: { id: saleId, deviceId: device.id },
      include: {
        units: { orderBy: { nro: 'asc' } },
        fixture: { include: { torneo: true, rival: true } },
        evento: true,
      },
    });
    if (!sale) throw new NotFoundException({ code: 'VENTA_NO_ENCONTRADA', message: 'Venta no encontrada' });
    return this.toStatusPayload(sale);
  }

  async cancel(saleId: string, device: EntradasDeviceContext) {
    const sale = await this.prisma.ticketSale.findFirst({ where: { id: saleId, deviceId: device.id } });
    if (!sale) throw new NotFoundException({ code: 'VENTA_NO_ENCONTRADA', message: 'Venta no encontrada' });
    if (sale.status !== 'PENDING') {
      throw new BadRequestException({ code: 'NO_CANCELABLE', message: 'Solo se pueden cancelar ventas pendientes' });
    }
    if (sale.paymentMethod === EntradaPayMethod.MP_QR) {
      try {
        // DELETE contra el POS propio de la venta (si se desvinculó, igual se cancela local).
        const posOverride = await resolveDeviceMpOrThrow(this.prisma, sale.deviceId).catch(() => null);
        await this.mpInstore.deleteOrder('entradas', posOverride ?? undefined);
      } catch (error) {
        this.logger.warn(`No se pudo borrar orden MP del ticket ${saleId}: ${error}`);
      }
    }
    const updated = await this.prisma.ticketSale.update({
      where: { id: sale.id },
      data: { status: 'CANCELLED' },
      include: { units: true, fixture: { include: { torneo: true, rival: true } }, evento: true },
    });
    return this.toStatusPayload(updated);
  }

  /** Marca vencidas las PENDING con QR más antiguas que el TTL. Lo invoca el polling. */
  async expireOldPending(): Promise<number> {
    const cutoff = new Date(Date.now() - QR_TTL_MINUTES * 60_000);
    const res = await this.prisma.ticketSale.updateMany({
      where: { status: 'PENDING', paymentMethod: 'MP_QR', createdAt: { lt: cutoff } },
      data: { status: 'EXPIRED' },
    });
    return res.count;
  }

  // ── Aplicación de pagos (webhook MP) ─────────────────────
  async findTicketSale(externalReference: string | null, merchantOrderId: string | null, paymentId: string | null) {
    if (externalReference?.startsWith('ticket-')) {
      const byRef = await this.prisma.ticketSale.findUnique({ where: { mpExternalReference: externalReference } });
      if (byRef) return byRef;
      const saleId = externalReference.slice('ticket-'.length);
      return this.prisma.ticketSale.findUnique({ where: { id: saleId } });
    }
    if (merchantOrderId) {
      const byOrder = await this.prisma.ticketSale.findFirst({ where: { mpOrderId: merchantOrderId } });
      if (byOrder) return byOrder;
    }
    return null;
  }

  async applyTicketPayment(input: {
    saleId: string;
    status: 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'PENDING';
    paymentId?: string | null;
    merchantOrderId?: string | null;
    paidAt?: Date | null;
  }) {
    const sale = await this.prisma.ticketSale.findUnique({ where: { id: input.saleId } });
    if (!sale) {
      this.logger.warn(`WEBHOOK_TICKET_SALE_NOT_FOUND saleId=${input.saleId}`);
      return null;
    }
    if (sale.status === 'APPROVED') return sale;
    if (input.status === 'APPROVED') {
      const approved = await this.approveSale(sale.id, input.paidAt ?? new Date(), {
        paymentId: input.paymentId,
        merchantOrderId: input.merchantOrderId,
      });
      // Registrar canje de beneficio de socio si corresponde
      if (sale.beneficioId && sale.socioId && Number(sale.descuento) > 0) {
        await this.prisma.socioCanje.create({
          data: {
            socioBeneficioId: sale.beneficioId,
            socioId: sale.socioId,
            ventaId: sale.id,
            montoDescontado: sale.descuento,
            usuarioId: null,
            posId: sale.deviceId,
          },
        }).catch((e) => this.logger.warn(`No se pudo registrar canje socio: ${e}`));
      }
      return approved;
    }
    return this.prisma.ticketSale.update({
      where: { id: sale.id },
      data: {
        status: input.status,
        ...(input.paymentId ? { mpOrderId: input.merchantOrderId ?? undefined } : {}),
      },
    });
  }

  /** Aprueba y genera unidades L-xxx/V-xxx (partidos) o E-xxx (eventos, contador único). */
  async approveSale(saleId: string, paidAt: Date, mp?: { paymentId?: string | null; merchantOrderId?: string | null }) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.ticketSale.findUnique({ where: { id: saleId } });
      if (!sale) throw new NotFoundException('Venta no encontrada');
      if (sale.status === EntradaSaleStatus.APPROVED) {
        return tx.ticketSale.findUnique({
          where: { id: saleId },
          include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } }, evento: true },
        });
      }
      // Update condicional: solo una transacción concurrente gana la aprobación
      const claimed = await tx.ticketSale.updateMany({
        where: { id: saleId, status: EntradaSaleStatus.PENDING },
        data: {
          status: 'APPROVED',
          paidAt,
          ...(mp?.merchantOrderId ? { mpOrderId: mp.merchantOrderId } : {}),
        },
      });
      if (claimed.count === 0) {
        const current = await tx.ticketSale.findUnique({ where: { id: saleId } });
        if (current?.status === EntradaSaleStatus.APPROVED) {
          return tx.ticketSale.findUnique({
            where: { id: saleId },
            include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } }, evento: true },
          });
        }
        throw new BadRequestException({ code: 'NO_APROBABLE', message: `Venta en estado ${current?.status}` });
      }
      const esEvento = !!sale.eventoId;
      let startNro: number;
      let entradaBeneficio: { id: string; porcentaje: Prisma.Decimal } | null = null;
      if (esEvento) {
        const counter = await tx.entradaEventoContador.upsert({
          where: { eventoId: sale.eventoId! },
          create: { eventoId: sale.eventoId!, ultimoNro: sale.cantidad },
          update: { ultimoNro: { increment: sale.cantidad } },
        });
        startNro = counter.ultimoNro - sale.cantidad + 1;
        const rows = await tx.entradaBeneficio.findMany({
          where: { activo: true, sector: EntradaBeneficioSector.AMBAS },
          orderBy: { porcentaje: 'desc' },
          take: 1,
        });
        entradaBeneficio = rows[0] ?? null;
      } else {
        const counter = await tx.entradaContador.upsert({
          where: { fixtureId_sector: { fixtureId: sale.fixtureId!, sector: sale.sector! } },
          create: { fixtureId: sale.fixtureId!, sector: sale.sector!, ultimoNro: sale.cantidad },
          update: { ultimoNro: { increment: sale.cantidad } },
        });
        startNro = counter.ultimoNro - sale.cantidad + 1;
        // Beneficio de bufet por sector (global + LOCAL|VISITANTE|AMBAS): el de mayor %.
        // No descuenta la entrada; se imprime como 2º QR para canjear en bufet/cantina.
        const scopes =
          sale.sector === 'LOCAL'
            ? [EntradaBeneficioSector.LOCAL, EntradaBeneficioSector.AMBAS]
            : [EntradaBeneficioSector.VISITANTE, EntradaBeneficioSector.AMBAS];
        const rows = await tx.entradaBeneficio.findMany({
          where: { activo: true, sector: { in: scopes } },
          orderBy: { porcentaje: 'desc' },
          take: 1,
        });
        entradaBeneficio = rows[0] ?? null;
      }
      const prefix = prefixFor(sale.sector);
      const codes = Array.from({ length: sale.cantidad }, () => (entradaBeneficio ? makeBenefitCode() : null));
      const definedCodes = codes.filter((c): c is string => !!c);
      if (definedCodes.length > 0) {
        const existing = await tx.ticketUnit.findMany({
          where: { benefitCode: { in: definedCodes } },
          select: { benefitCode: true },
        });
        const taken = new Set(existing.map((e) => e.benefitCode));
        for (let i = 0; i < codes.length; i++) {
          if (codes[i] && taken.has(codes[i]!)) codes[i] = makeBenefitCode();
        }
      }
      await tx.ticketUnit.createMany({
        data: Array.from({ length: sale.cantidad }, (_, i) => {
          const nro = startNro + i;
          return {
            saleId: sale.id,
            fixtureId: sale.fixtureId,
            eventoId: sale.eventoId,
            sector: sale.sector,
            nro,
            codigo: `${prefix}-${pad3(nro)}`,
            ...(entradaBeneficio
              ? {
                  beneficioId: entradaBeneficio.id,
                  benefitCode: codes[i],
                  beneficioPorcentaje: entradaBeneficio.porcentaje,
                }
              : {}),
          };
        }),
      });
      return tx.ticketSale.update({
        where: { id: sale.id },
        data: {
          status: 'APPROVED',
          paidAt,
          ...(mp?.merchantOrderId ? { mpOrderId: mp.merchantOrderId } : {}),
        },
        include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } }, evento: true },
      });
    });
  }

  // ── Payload al POS ───────────────────────────────────────
  private async toStatusPayload(sale: {
    id: string;
    status: unknown;
    cantidad: number;
    precioUnit: unknown;
    descuento: unknown;
    total: unknown;
    paymentMethod: unknown;
    paidAt: unknown;
    fixtureId?: string | null;
    eventoId?: string | null;
    sector?: string | null;
    fixture?: { torneo?: { nombre?: string } | null; rival?: { nombre?: string } | null; fecha?: Date | null } | null;
    evento?: { id: string; titulo: string; fecha: Date } | null;
    units?: { codigo: string }[];
  }) {
    const esEvento = !!sale.eventoId;
    const templateId = esEvento ? TICKET_TEMPLATE_EVENTO_ID : TICKET_TEMPLATE_DEFAULT_ID;
    const [template, asset, setting, benefitUnits] = await Promise.all([
      this.prisma.entradaTicketTemplate.findUnique({ where: { id: templateId } }),
      this.prisma.entradaTicketAsset.findUnique({ where: { id: 'escudo' } }),
      this.prisma.setting.findUnique({ where: { id: SETTING_ID }, select: { clubName: true } }),
      this.prisma.ticketUnit.findMany({
        where: { saleId: sale.id, beneficioId: { not: null } },
        select: {
          codigo: true,
          benefitCode: true,
          beneficioPorcentaje: true,
          beneficio: { select: { id: true, nombre: true, usoUnico: true } },
        },
        orderBy: { nro: 'asc' },
      }),
    ]);
    const codigos = (sale.units ?? []).map((u) => u.codigo);
    return {
      saleId: sale.id,
      status: sale.status,
      tipo: esEvento ? 'EVENTO' : 'PARTIDO',
      eventoId: sale.eventoId ?? null,
      codigos,
      cantidad: sale.cantidad,
      precioUnit: sale.precioUnit?.toString() ?? '0',
      descuento: sale.descuento?.toString() ?? '0',
      total: sale.total?.toString() ?? '0',
      paymentMethod: sale.paymentMethod,
      paidAt: sale.paidAt,
      datos: {
        club: setting?.clubName ?? '',
        torneo: sale.fixture?.torneo?.nombre ?? '',
        rival: sale.fixture?.rival?.nombre ?? '',
        evento: esEvento ? (sale.evento?.titulo ?? '') : '',
        fecha: (sale.fixture?.fecha ?? sale.evento?.fecha ?? null) as Date | null,
        sector: sale.sector ?? (esEvento ? 'GENERAL' : ''),
        ventaId: sale.id,
        fechaPago: sale.paidAt ?? null,
        footer: 'Ticket no fiscal',
        qrImageUrl: null,
      },
      // Beneficios de bufet por unidad (QR `ENT:<benefitCode>`). Vacío si no aplica.
      beneficios: benefitUnits.map((u) => ({
        codigo: u.codigo,
        benefitCode: u.benefitCode,
        qr: u.benefitCode ? `ENT:${u.benefitCode}` : null,
        beneficioId: u.beneficio?.id ?? null,
        beneficioNombre: u.beneficio?.nombre ?? null,
        porcentaje: u.beneficioPorcentaje?.toString() ?? null,
        usoUnico: u.beneficio?.usoUnico ?? null,
      })),
      templateId,
      templateVersion: template?.version ?? 1,
      logoVersion: asset?.version ?? 1,
    };
  }

  // ── Descuento socio ──────────────────────────────────────
  // Partidos: aplica el mejor beneficio del tipo (global o del torneo).
  // Eventos (torneoId null): solo aplican beneficios globales (entradaTorneoId null).
  private async resolveSocioDiscount(socioUuid: string, torneoId: string | null, subtotal: number) {
    const data = await this.sociosQr.resolve(socioUuid);
    if (!data) throw new NotFoundException({ code: 'SOCIO_NO_ENCONTRADO', message: 'Socio no encontrado' });
    if (data.estado !== 'AL_DIA') {
      throw new BadRequestException({ code: 'SOCIO_NO_AL_DIA', message: `Socio ${data.estado}` });
    }
    const socio = await this.prisma.socio.findUnique({ where: { uuid: socioUuid }, select: { id: true, socioTipoId: true } });
    if (!socio) throw new NotFoundException({ code: 'SOCIO_NO_ENCONTRADO', message: 'Socio no encontrado' });
    const aplicables = await this.prisma.socioBeneficio.findMany({
      where: torneoId
        ? { socioTipoId: socio.socioTipoId, activo: true, OR: [{ entradaTorneoId: null }, { entradaTorneoId: torneoId }] }
        : { socioTipoId: socio.socioTipoId, activo: true, entradaTorneoId: null },
      orderBy: { porcentaje: 'desc' },
    });
    for (const b of aplicables) {
      if (b.limiteDiario) {
        const usados = await this.prisma.socioCanje.count({
          where: { socioBeneficioId: b.id, socioId: socio.id, fecha: { gte: new Date(new Date().setUTCHours(3, 0, 0, 0)) } },
        });
        if (usados >= b.limiteDiario) continue;
      }
      const pct = Number(b.porcentaje) / 100;
      let descuento = Math.round(subtotal * pct * 100) / 100;
      if (b.descuentoMaximo != null) descuento = Math.min(descuento, Number(b.descuentoMaximo));
      return { socioId: socio.id, beneficioId: b.id, descuento };
    }
    throw new BadRequestException({ code: 'SIN_BENEFICIO', message: 'El socio no tiene descuentos para este torneo' });
  }

  async resolveSocioForDevice(socioUuid: string) {
    await this.assertModuleEnabled();
    const data = await this.sociosQr.resolve(socioUuid);
    if (!data) throw new NotFoundException({ code: 'SOCIO_NO_ENCONTRADO', message: 'Socio no encontrado' });
    return data;
  }
}
