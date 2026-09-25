import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntradaBeneficioSector, EntradaPayMethod, EntradaSaleStatus, EntradaSector, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { SociosQrService } from '../socios/socios-qr.service';
import { MercadoPagoInstoreService } from '../sales/services/mercadopago-instore.service';
import { CreateIntentDto } from './dto/create-intent.dto';
import { makeBenefitCode } from './entradas-beneficios.service';
import type { EntradasDeviceContext } from './device.guard';

const SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';
const QR_TTL_MINUTES = 10;
const INTENT_RATE_LIMIT_PER_MIN = 10;

const pad3 = (n: number) => String(n).padStart(3, '0');

function prefixFor(sector: EntradaSector): string {
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

  // ── Fixtures vigentes ────────────────────────────────────
  async vigentes() {
    await this.assertModuleEnabled();
    const now = new Date();
    const fixtures = await this.prisma.entradaFixture.findMany({
      where: { activo: true, ventanaDesde: { lte: now }, ventanaHasta: { gte: now } },
      include: { torneo: true, rival: true },
      orderBy: { ventanaDesde: 'asc' },
    });
    const withCounts = await Promise.all(
      fixtures
        .filter((f) => f.torneo.activo && f.rival.activo)
        .map(async (f) => {
          const [vendidosL, vendidosV] = await Promise.all([
            this.prisma.ticketUnit.count({ where: { fixtureId: f.id, sector: 'LOCAL' } }),
            this.prisma.ticketUnit.count({ where: { fixtureId: f.id, sector: 'VISITANTE' } }),
          ]);
          return {
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
    return { now, fixtures: withCounts };
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
        include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } } },
      });
      if (existing) return this.toStatusPayload(existing);
    }

    const now = new Date();
    const fixture = await this.prisma.entradaFixture.findUnique({
      where: { id: dto.fixtureId },
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
        sector: dto.sector,
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
      await this.mpInstore.putTicketOrder({
        externalReference,
        title: `Entradas ${fixture.torneo.nombre} vs ${fixture.rival.nombre}`,
        description: `Entradas ${dto.sector} x${dto.cantidad} ${fixture.torneo.nombre}`,
        totalAmount: total,
      });
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
    // El QR Instore es estático por POS (Setting.mpEntradasQrData,
    // imagen fija del POS dedicado a entradas); el PUT anterior asocia
    // el monto a esa orden. El POS muestra siempre la misma imagen
    // mientras haya una sola orden activa en ese POS.
    const mpSetting = await this.prisma.setting.findUnique({
      where: { id: SETTING_ID },
      select: { mpEntradasQrData: true },
    });
    const pending = await this.prisma.ticketSale.findUnique({
      where: { id: sale.id },
      include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } } },
    });
    const payload = await this.toStatusPayload(pending!);
    return {
      ...payload,
      qrImageUrl: mpSetting?.mpEntradasQrData ?? payload.datos.qrImageUrl ?? null,
    };
  }

  async status(saleId: string, device: EntradasDeviceContext) {
    const sale = await this.prisma.ticketSale.findFirst({
      where: { id: saleId, deviceId: device.id },
      include: {
        units: { orderBy: { nro: 'asc' } },
        fixture: { include: { torneo: true, rival: true } },
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
        await this.mpInstore.deleteOrder('entradas');
      } catch (error) {
        this.logger.warn(`No se pudo borrar orden MP del ticket ${saleId}: ${error}`);
      }
    }
    const updated = await this.prisma.ticketSale.update({
      where: { id: sale.id },
      data: { status: 'CANCELLED' },
      include: { units: true, fixture: { include: { torneo: true, rival: true } } },
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

  /** Aprueba y genera unidades L-xxx/V-xxx con contador atómico por (fixture, sector). */
  async approveSale(saleId: string, paidAt: Date, mp?: { paymentId?: string | null; merchantOrderId?: string | null }) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.ticketSale.findUnique({ where: { id: saleId } });
      if (!sale) throw new NotFoundException('Venta no encontrada');
      if (sale.status === EntradaSaleStatus.APPROVED) {
        return tx.ticketSale.findUnique({
          where: { id: saleId },
          include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } } },
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
            include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } } },
          });
        }
        throw new BadRequestException({ code: 'NO_APROBABLE', message: `Venta en estado ${current?.status}` });
      }
      const counter = await tx.entradaContador.upsert({
        where: { fixtureId_sector: { fixtureId: sale.fixtureId, sector: sale.sector } },
        create: { fixtureId: sale.fixtureId, sector: sale.sector, ultimoNro: sale.cantidad },
        update: { ultimoNro: { increment: sale.cantidad } },
      });
      const startNro = counter.ultimoNro - sale.cantidad + 1;
      const prefix = prefixFor(sale.sector);
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
      const entradaBeneficio = rows[0] ?? null;
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
        include: { units: { orderBy: { nro: 'asc' } }, fixture: { include: { torneo: true, rival: true } } },
      });
    });
  }

  // ── Payload al POS ───────────────────────────────────────
  private async toStatusPayload(
    sale: Prisma.TicketSaleGetPayload<{ include: { units: true; fixture: { include: { torneo: true; rival: true } } } }> & {
      units: { codigo: string }[];
    },
  ) {
    const anySale = sale as unknown as {
      fixture?: { torneo?: { nombre?: string }; rival?: { nombre?: string }; fecha?: Date };
      units?: { codigo: string }[];
    };
    const [template, asset, setting, benefitUnits] = await Promise.all([
      this.prisma.entradaTicketTemplate.findUnique({ where: { id: 'default' } }),
      this.prisma.entradaTicketAsset.findUnique({ where: { id: 'escudo' } }),
      this.prisma.setting.findUnique({ where: { id: SETTING_ID }, select: { clubName: true, mpEntradasQrData: true } }),
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
      codigos,
      cantidad: sale.cantidad,
      precioUnit: sale.precioUnit.toString(),
      descuento: sale.descuento.toString(),
      total: sale.total.toString(),
      paymentMethod: sale.paymentMethod,
      paidAt: sale.paidAt,
      datos: {
        club: setting?.clubName ?? '',
        torneo: anySale.fixture?.torneo?.nombre ?? '',
        rival: anySale.fixture?.rival?.nombre ?? '',
        fecha: anySale.fixture?.fecha ?? null,
        sector: sale.sector,
        ventaId: sale.id,
        fechaPago: sale.paidAt ?? null,
        footer: 'Ticket no fiscal',
        qrImageUrl: setting?.mpEntradasQrData ?? null,
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
      templateVersion: template?.version ?? 1,
      logoVersion: asset?.version ?? 1,
    };
  }

  // ── Descuento socio (futuro) ─────────────────────────────
  private async resolveSocioDiscount(socioUuid: string, torneoId: string, subtotal: number) {
    const data = await this.sociosQr.resolve(socioUuid);
    if (!data) throw new NotFoundException({ code: 'SOCIO_NO_ENCONTRADO', message: 'Socio no encontrado' });
    if (data.estado !== 'AL_DIA') {
      throw new BadRequestException({ code: 'SOCIO_NO_AL_DIA', message: `Socio ${data.estado}` });
    }
    const socio = await this.prisma.socio.findUnique({ where: { uuid: socioUuid }, select: { id: true, socioTipoId: true } });
    if (!socio) throw new NotFoundException({ code: 'SOCIO_NO_ENCONTRADO', message: 'Socio no encontrado' });
    const aplicables = await this.prisma.socioBeneficio.findMany({
      where: { socioTipoId: socio.socioTipoId, activo: true, OR: [{ entradaTorneoId: null }, { entradaTorneoId: torneoId }] },
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
