import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntradaBeneficioSector, EntradaSector, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { CreateEntradaBeneficioDto } from './dto/create-entrada-beneficio.dto';
import { UpdateEntradaBeneficioDto } from './dto/update-entrada-beneficio.dto';

// Código corto para QR (10 chars, sin ambiguos 0/O/1/I). Payload QR: `ENT:<code>`.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

export function makeBenefitCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function normalizeBenefitCode(input: string): string {
  const clean = (input ?? '').trim().toUpperCase();
  return clean.startsWith('ENT:') ? clean.slice(4) : clean;
}

function scopesFor(sector: EntradaSector): EntradaBeneficioSector[] {
  return sector === 'LOCAL'
    ? [EntradaBeneficioSector.LOCAL, EntradaBeneficioSector.AMBAS]
    : [EntradaBeneficioSector.VISITANTE, EntradaBeneficioSector.AMBAS];
}

@Injectable()
export class EntradasBeneficiosService {
  constructor(private readonly prisma: PrismaService) {}

  // ── ABM ────────────────────────────────────────────────
  list() {
    return this.prisma.entradaBeneficio.findMany({
      include: {
        categoria: { select: { id: true, name: true } },
        producto: { select: { id: true, name: true } },
        internetPlan: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateEntradaBeneficioDto) {
    this.assertDestino(dto);
    return this.prisma.entradaBeneficio.create({
      data: {
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        sector: dto.sector,
        categoriaProdId: dto.categoriaProdId ?? null,
        productoId: dto.productoId ?? null,
        internetPlanId: dto.internetPlanId ?? null,
        porcentaje: new Prisma.Decimal(dto.porcentaje),
        descuentoMaximo: dto.descuentoMaximo != null ? new Prisma.Decimal(dto.descuentoMaximo) : null,
        usoUnico: dto.usoUnico ?? true,
        activo: dto.activo ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateEntradaBeneficioDto) {
    const current = await this.prisma.entradaBeneficio.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Beneficio no encontrado');
    const merged = {
      categoriaProdId: dto.categoriaProdId ?? current.categoriaProdId,
      productoId: dto.productoId ?? current.productoId,
      internetPlanId: dto.internetPlanId ?? current.internetPlanId,
    };
    this.assertDestino(merged);
    const data: Prisma.EntradaBeneficioUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion?.trim() || null;
    if (dto.sector !== undefined) data.sector = dto.sector;
    if (dto.categoriaProdId !== undefined) data.categoria = dto.categoriaProdId ? { connect: { id: dto.categoriaProdId } } : { disconnect: true };
    if (dto.productoId !== undefined) data.producto = dto.productoId ? { connect: { id: dto.productoId } } : { disconnect: true };
    if (dto.internetPlanId !== undefined) data.internetPlan = dto.internetPlanId ? { connect: { id: dto.internetPlanId } } : { disconnect: true };
    if (dto.porcentaje !== undefined) data.porcentaje = new Prisma.Decimal(dto.porcentaje);
    if (dto.descuentoMaximo !== undefined) data.descuentoMaximo = dto.descuentoMaximo != null ? new Prisma.Decimal(dto.descuentoMaximo) : null;
    if (dto.usoUnico !== undefined) data.usoUnico = dto.usoUnico;
    if (dto.activo !== undefined) data.activo = dto.activo;
    return this.prisma.entradaBeneficio.update({ where: { id }, data });
  }

  async remove(id: string) {
    const current = await this.prisma.entradaBeneficio.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Beneficio no encontrado');
    const [units, consumos] = await Promise.all([
      this.prisma.ticketUnit.count({ where: { beneficioId: id } }),
      this.prisma.entradaBeneficioConsumo.count({ where: { beneficioId: id } }),
    ]);
    if (units > 0 || consumos > 0) {
      return this.prisma.entradaBeneficio.update({ where: { id }, data: { activo: false } });
    }
    return this.prisma.entradaBeneficio.delete({ where: { id } });
  }

  private assertDestino(dto: { categoriaProdId?: string | null; productoId?: string | null; internetPlanId?: string | null }) {
    if (!dto.categoriaProdId && !dto.productoId && !dto.internetPlanId) {
      throw new BadRequestException('Debe seleccionar un destino: categoría, producto o plan de internet');
    }
  }

  // ── Asignación automática por sector (al aprobar la venta) ──
  // MVP: un beneficio por entrada — el de mayor porcentaje entre los activos del sector.
  async pickForSector(sector: EntradaSector) {
    const rows = await this.prisma.entradaBeneficio.findMany({
      where: { activo: true, sector: { in: scopesFor(sector) } },
      orderBy: { porcentaje: 'desc' },
      take: 1,
    });
    return rows[0] ?? null;
  }

  // ── Validación / consumo (bufet, puerta, cantina) ──────────
  async validate(rawCode: string, canal: string) {
    const code = normalizeBenefitCode(rawCode);
    if (!code) throw new BadRequestException('Código requerido');
    const unit = await this.prisma.ticketUnit.findUnique({
      where: { benefitCode: code },
      include: {
        beneficio: {
          include: {
            categoria: { select: { id: true, name: true } },
            producto: { select: { id: true, name: true } },
            internetPlan: { select: { id: true, name: true } },
          },
        },
        fixture: { include: { torneo: true, rival: true } },
        sale: { select: { id: true, status: true } },
      },
    });
    if (!unit || !unit.beneficio) {
      throw new NotFoundException({ code: 'BENEFICIO_NO_ENCONTRADO', message: 'Código de beneficio no válido' });
    }
    const consumo = await this.prisma.entradaBeneficioConsumo.findUnique({ where: { ticketUnitId: unit.id } });
    const aprobada = unit.sale.status === 'APPROVED';
    const consumido = !!consumo;
    const disponible = aprobada && unit.beneficio.activo && (!unit.beneficio.usoUnico || !consumido);
    // Log de validación (no bloquea la respuesta si falla)
    this.prisma.entradaBeneficioValidacion
      .create({ data: { beneficioId: unit.beneficioId!, ticketUnitId: unit.id, canal } })
      .catch(() => undefined);
    return {
      code,
      codigo: unit.codigo,
      sector: unit.sector,
      fixture: {
        id: unit.fixtureId,
        torneo: unit.fixture.torneo.nombre,
        rival: unit.fixture.rival.nombre,
        fecha: unit.fixture.fecha,
      },
      venta: { id: unit.sale.id, status: unit.sale.status },
      beneficio: {
        id: unit.beneficio.id,
        nombre: unit.beneficio.nombre,
        descripcion: unit.beneficio.descripcion,
        porcentaje: unit.beneficio.porcentaje.toString(),
        descuentoMaximo: unit.beneficio.descuentoMaximo?.toString() ?? null,
        usoUnico: unit.beneficio.usoUnico,
        destino: {
          categoria: unit.beneficio.categoria,
          producto: unit.beneficio.producto,
          internetPlan: unit.beneficio.internetPlan,
        },
      },
      consumido,
      consumidoAt: consumo?.createdAt ?? null,
      disponible,
      motivoNoDisponible: !aprobada
        ? 'Venta no aprobada'
        : !unit.beneficio.activo
          ? 'Beneficio desactivado'
          : consumido && unit.beneficio.usoUnico
            ? 'Ya consumido'
            : null,
    };
  }

  async consume(rawCode: string, input: { canal: string; deviceId?: string; usuarioId?: string }) {
    const code = normalizeBenefitCode(rawCode);
    const unit = await this.prisma.ticketUnit.findUnique({
      where: { benefitCode: code },
      include: { beneficio: true, sale: { select: { id: true, status: true } } },
    });
    if (!unit || !unit.beneficioId || !unit.beneficio) {
      throw new NotFoundException({ code: 'BENEFICIO_NO_ENCONTRADO', message: 'Código de beneficio no válido' });
    }
    if (unit.sale.status !== 'APPROVED') {
      throw new BadRequestException({ code: 'VENTA_NO_APROBADA', message: 'La venta aún no está aprobada' });
    }
    if (!unit.beneficio.activo) {
      throw new BadRequestException({ code: 'BENEFICIO_INACTIVO', message: 'Beneficio desactivado' });
    }
    // Multiuso: solo loguea, nunca bloquea
    if (!unit.beneficio.usoUnico) {
      await this.prisma.entradaBeneficioValidacion.create({
        data: { beneficioId: unit.beneficioId, ticketUnitId: unit.id, canal: input.canal },
      });
      return { code, codigo: unit.codigo, consumido: false, multiuso: true };
    }
    // Uso único: el unique(ticketUnitId) impone anti-doble a nivel DB
    try {
      await this.prisma.entradaBeneficioConsumo.create({
        data: {
          beneficioId: unit.beneficioId,
          ticketUnitId: unit.id,
          consumidoPorDeviceId: input.deviceId ?? null,
          consumidoPorUsuarioId: input.usuarioId ?? null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'YA_CONSUMIDO', message: 'Este beneficio ya fue consumido' });
      }
      throw error;
    }
    return { code, codigo: unit.codigo, consumido: true, multiuso: false };
  }
}
