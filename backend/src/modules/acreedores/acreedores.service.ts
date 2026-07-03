import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { JournalEntriesService } from '../treasury/journal-entries.service';
import { CreateAcreedorDto } from './dto/create-acreedor.dto';
import { UpdateAcreedorDto } from './dto/update-acreedor.dto';
import { CreatePagoDto } from './dto/create-pago.dto';
import { CreateAjusteDto } from './dto/create-ajuste.dto';

interface FiadoVentaRaw {
  id: number;
  monto: number;
  createdAt: Date;
  ventaId: string;
  saldoRestante?: number;
}

interface AjusteRaw {
  monto: number;
  fecha: Date;
}

interface PagoRaw {
  monto: number;
  fecha: Date;
}

interface FiadoVentaConSaldo {
  id: number;
  monto: number;
  createdAt: string;
  ventaId: string;
  saldoRestante: number;
}

interface AjusteConSaldo {
  id: number;
  monto: number;
  fecha: string;
  descripcion: string | null;
  saldoRestante: number;
  esAjuste: true;
}

type DeudaEntry = FiadoVentaConSaldo | AjusteConSaldo;

interface FifoResult {
  deudaMasAntigua: string | null;
  diasSinPagar: number | null;
  alertaDeuda: boolean;
  fiadoVentasConSaldo: FiadoVentaConSaldo[];
  ajustesConSaldo: AjusteConSaldo[];
}

@Injectable()
export class AcreedoresService {
  constructor(
    private prisma: PrismaService,
    private journalEntriesService: JournalEntriesService,
  ) {}

  private calculateFifo(
    fiadoVentas: FiadoVentaRaw[],
    ajustes: AjusteRaw[],
    pagos: PagoRaw[],
  ): FifoResult {
    const sortedVentas = [...fiadoVentas].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const sortedAjustes = [...ajustes].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );
    const sortedPagos = [...pagos].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );

    const deudaEntries: Array<{ date: Date; monto: number; venta?: FiadoVentaRaw; ajuste?: AjusteRaw }> = [
      ...sortedVentas.map((v) => ({ date: new Date(v.createdAt), monto: Number(v.monto), venta: v })),
      ...sortedAjustes.map((a, idx) => ({ date: new Date(a.fecha), monto: Number(a.monto), ajuste: a, _idx: idx })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let pagoRemaining = sortedPagos.reduce((sum, p) => sum + Number(p.monto), 0);

    let deudaMasAntigua: string | null = null;
    const fiadoVentasConSaldo: FiadoVentaConSaldo[] = [];
    const ajustesConSaldo: AjusteConSaldo[] = [];
    let ajusteSeq = 1;

    for (const entry of deudaEntries) {
      const aplicado = Math.min(entry.monto, pagoRemaining);
      const saldo = entry.monto - aplicado;
      pagoRemaining -= aplicado;

      if (saldo > 0 && !deudaMasAntigua) {
        deudaMasAntigua = entry.date.toISOString();
      }

      if (entry.venta) {
        fiadoVentasConSaldo.push({
          id: entry.venta.id,
          monto: entry.monto,
          createdAt: entry.venta.createdAt.toISOString(),
          ventaId: entry.venta.ventaId,
          saldoRestante: saldo,
        });
      } else if (entry.ajuste) {
        ajustesConSaldo.push({
          id: ajusteSeq++,
          monto: entry.monto,
          fecha: entry.date.toISOString(),
          descripcion: (entry.ajuste as unknown as { descripcion?: string | null }).descripcion ?? null,
          saldoRestante: saldo,
          esAjuste: true as const,
        });
      }
    }

    let diasSinPagar: number | null = null;
    let alertaDeuda = false;

    if (deudaMasAntigua) {
      const ahora = new Date();
      const fechaDeuda = new Date(deudaMasAntigua);
      diasSinPagar = Math.floor(
        (ahora.getTime() - fechaDeuda.getTime()) / (1000 * 60 * 60 * 24),
      );
      alertaDeuda = diasSinPagar >= 30;
    }

    return {
      deudaMasAntigua,
      diasSinPagar,
      alertaDeuda,
      fiadoVentasConSaldo,
      ajustesConSaldo,
    };
  }

  async getResumen() {
    const acreedores = await this.prisma.acreedor.findMany({
      include: {
        fiadoVentas: true,
        pagos: true,
        ajustes: true,
      },
    });

    let deudaTotal = 0;
    let acreedoresConDeuda = 0;

    for (const a of acreedores) {
      const totalFiado = a.fiadoVentas.reduce((sum, fv) => sum + Number(fv.monto), 0);
      const totalAjustes = a.ajustes.reduce((sum, aj) => sum + Number(aj.monto), 0);
      const totalPagado = a.pagos.reduce((sum, p) => sum + Number(p.monto), 0);
      const saldo = totalFiado + totalAjustes - totalPagado;
      deudaTotal += saldo;
      if (saldo > 0) acreedoresConDeuda++;
    }

    return { deudaTotal, acreedoresConDeuda };
  }

  async findAll() {
    const acreedores = await this.prisma.acreedor.findMany({
      include: {
        fiadoVentas: { orderBy: { createdAt: 'asc' } },
        pagos: true,
        ajustes: true,
      },
      orderBy: { nombre: 'asc' },
    });

    return acreedores.map((a) => {
      const totalFiado = a.fiadoVentas.reduce((sum, fv) => sum + Number(fv.monto), 0);
      const totalAjustes = a.ajustes.reduce((sum, aj) => sum + Number(aj.monto), 0);
      const totalPagado = a.pagos.reduce((sum, p) => sum + Number(p.monto), 0);
      const { alertaDeuda, diasSinPagar } = this.calculateFifo(
        a.fiadoVentas as unknown as FiadoVentaRaw[],
        a.ajustes as unknown as AjusteRaw[],
        a.pagos as unknown as PagoRaw[],
      );
      return {
        id: a.id,
        nombre: a.nombre,
        telefono: a.telefono,
        notas: a.notas,
        activo: a.activo,
        createdAt: a.createdAt,
        alertaDeuda,
        diasSinPagar,
        saldo: totalFiado + totalAjustes - totalPagado,
      };
    });
  }

  async findOne(id: number) {
    const acreedor = await this.prisma.acreedor.findUnique({ where: { id } });
    if (!acreedor) {
      throw new NotFoundException('Acreedor no encontrado');
    }
    return acreedor;
  }

  create(dto: CreateAcreedorDto) {
    return this.prisma.acreedor.create({ data: dto });
  }

  async update(id: number, dto: UpdateAcreedorDto) {
    await this.findOne(id);
    return this.prisma.acreedor.update({
      where: { id },
      data: dto,
    });
  }

  async toggleActive(id: number) {
    const acreedor = await this.findOne(id);
    return this.prisma.acreedor.update({
      where: { id },
      data: { activo: !acreedor.activo },
    });
  }

  async getDeuda(id: number) {
    await this.findOne(id);

    const fiadoVentas = await this.prisma.fiadoVenta.findMany({
      where: { acreedorId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, monto: true, createdAt: true, ventaId: true },
    });

    const ajustes = await this.prisma.ajusteAcreedor.findMany({
      where: { acreedorId: id },
      orderBy: { fecha: 'desc' },
      select: { id: true, monto: true, fecha: true, descripcion: true },
    });

    const pagos = await this.prisma.pagoAcreedor.findMany({
      where: { acreedorId: id },
      orderBy: { fecha: 'desc' },
      select: { id: true, monto: true, medioPago: true, fecha: true, notas: true },
    });

    const totalFiado = fiadoVentas.reduce((sum, fv) => sum + Number(fv.monto), 0);
    const totalAjustes = ajustes.reduce((sum, a) => sum + Number(a.monto), 0);
    const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
    const saldoPendiente = totalFiado + totalAjustes - totalPagado;

    const { deudaMasAntigua, diasSinPagar, alertaDeuda, fiadoVentasConSaldo, ajustesConSaldo } =
      this.calculateFifo(
        fiadoVentas as unknown as FiadoVentaRaw[],
        ajustes as unknown as AjusteRaw[],
        pagos as unknown as PagoRaw[],
      );

    return {
      fiadoVentas: fiadoVentasConSaldo,
      ajustes: ajustesConSaldo,
      pagos,
      totalFiado: totalFiado + totalAjustes,
      totalPagado,
      saldoPendiente,
      deudaMasAntigua,
      diasSinPagar,
      alertaDeuda,
    };
  }

  async addPago(userId: string, acreedorId: number, dto: CreatePagoDto) {
    const acreedor = await this.findOne(acreedorId);

    if (dto.monto <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    const [year, month, day] = dto.fecha.split('-').map(Number);
    const setting = await this.prisma.setting.findFirst();

    if (!setting?.enableAutoJournalAcreedores) {
      return this.prisma.pagoAcreedor.create({
        data: {
          acreedorId,
          monto: dto.monto,
          medioPago: dto.medioPago || '',
          fecha: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
          notas: dto.notas,
          treasuryAccountId: dto.treasuryAccountId,
        },
      });
    }

    const treasuryAccount = await this.prisma.ledgerAccount.findUnique({
      where: { id: dto.treasuryAccountId },
    });
    if (!treasuryAccount) {
      throw new BadRequestException('Cuenta de tesorería no encontrada');
    }

    const deudoresFiadosAccount = await this.prisma.ledgerAccount.findUnique({
      where: { code: '1.2.03' },
    });
    if (!deudoresFiadosAccount) {
      throw new BadRequestException('Cuenta contable 1.2.03 no encontrada');
    }

    const deuda = await this.getDeuda(acreedorId);
    const esTotal = deuda.saldoPendiente <= dto.monto + 0.001;
    const tipoPago = esTotal ? 'Total' : 'Parcial';

    const result = await this.prisma.$transaction(async (tx) => {
      const pago = await tx.pagoAcreedor.create({
        data: {
          acreedorId,
          monto: dto.monto,
          medioPago: dto.medioPago || '',
          fecha: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
          notas: dto.notas,
        },
      });

      const entry = await this.journalEntriesService.createAutomatedEntry(tx, userId, {
        date: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
        description: `Pago acreedor - ${acreedor.nombre} (acreedor #${acreedor.id}) - ${tipoPago} $${dto.monto.toFixed(2)}`,
        lines: [
          { accountId: dto.treasuryAccountId, debit: dto.monto, credit: 0 },
          { accountId: deudoresFiadosAccount.id, debit: 0, credit: dto.monto },
        ],
        sourceType: 'PAGO_ACREEDOR',
        sourceId: pago.id,
      });

      await tx.pagoAcreedor.update({
        where: { id: pago.id },
        data: { journalEntryId: entry.id, treasuryAccountId: dto.treasuryAccountId },
      });

      return pago;
    });

    return result;
  }

  async addAjuste(acreedorId: number, dto: CreateAjusteDto) {
    await this.findOne(acreedorId);

    if (dto.monto <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    const [year, month, day] = dto.fecha.split('-').map(Number);

    return this.prisma.ajusteAcreedor.create({
      data: {
        acreedorId,
        monto: dto.monto,
        descripcion: dto.descripcion,
        fecha: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
      },
    });
  }
}
