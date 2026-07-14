import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { JournalEntriesService } from '../treasury/journal-entries.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationQueueService } from '../whatsapp/notification-queue.service';
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
  saldoFavor: number;
}

@Injectable()
export class AcreedoresService {
  constructor(
    private prisma: PrismaService,
    private journalEntriesService: JournalEntriesService,
    private whatsappService: WhatsappService,
    private notificationQueueService: NotificationQueueService,
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

    const saldoFavor = pagoRemaining > 0.001 ? parseFloat(pagoRemaining.toFixed(2)) : 0;

    return {
      deudaMasAntigua,
      diasSinPagar,
      alertaDeuda,
      fiadoVentasConSaldo,
      ajustesConSaldo,
      saldoFavor,
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
    let creditoTotal = 0;
    let acreedoresConDeuda = 0;
    let acreedoresConCredito = 0;

    for (const a of acreedores) {
      const totalFiado = a.fiadoVentas.reduce((sum, fv) => sum + Number(fv.monto), 0);
      const totalAjustes = a.ajustes.reduce((sum, aj) => sum + Number(aj.monto), 0);
      const totalPagado = a.pagos.reduce((sum, p) => sum + Number(p.monto), 0);
      const saldo = totalFiado + totalAjustes - totalPagado;
      if (saldo > 0) {
        deudaTotal += saldo;
        acreedoresConDeuda++;
      } else if (saldo < 0) {
        creditoTotal += Math.abs(saldo);
        acreedoresConCredito++;
      }
    }

    return { deudaTotal, creditoTotal, acreedoresConDeuda, acreedoresConCredito };
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
      const { alertaDeuda, diasSinPagar, saldoFavor } = this.calculateFifo(
        a.fiadoVentas as unknown as FiadoVentaRaw[],
        a.ajustes as unknown as AjusteRaw[],
        a.pagos as unknown as PagoRaw[],
      );
      const saldo = totalFiado + totalAjustes - totalPagado;
      return {
        id: a.id,
        nombre: a.nombre,
        telefono: a.telefono,
        notas: a.notas,
        activo: a.activo,
        createdAt: a.createdAt,
        alertaDeuda: saldo <= 0 ? false : alertaDeuda,
        diasSinPagar: saldo <= 0 ? null : diasSinPagar,
        saldo,
        saldoFavor: saldo < 0 ? Math.abs(saldo) : 0,
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
    const saldoBruto = totalFiado + totalAjustes - totalPagado;
    const saldoPendiente = saldoBruto > 0 ? parseFloat(saldoBruto.toFixed(2)) : 0;
    const saldoFavor = saldoBruto < 0 ? parseFloat(Math.abs(saldoBruto).toFixed(2)) : 0;

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
      saldoFavor,
      deudaMasAntigua: saldoBruto > 0 ? deudaMasAntigua : null,
      diasSinPagar: saldoBruto > 0 ? diasSinPagar : null,
      alertaDeuda: saldoBruto <= 0 ? false : alertaDeuda,
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

  async notificarDeuda(id: number) {
    const setting = await this.prisma.setting.findFirst();
    if (!setting?.enableWhatsappModule) {
      throw new BadRequestException('El módulo de WhatsApp no está habilitado');
    }

    if (!setting?.openwaApiUrl || !setting?.openwaApiKey) {
      throw new BadRequestException('OpenWA no está configurado (URL y API Key requeridos)');
    }

    const acreedor = await this.findOne(id);

    if (!acreedor.telefono) {
      throw new BadRequestException('El acreedor no tiene teléfono registrado');
    }

    const deuda = await this.getDeuda(id);

    if (deuda.saldoPendiente <= 0) {
      throw new BadRequestException('El acreedor no tiene deuda pendiente');
    }

    const template =
      setting.openwaMessageTemplate ||
      'Hola {{nombre}}, te recordamos que tenés una deuda pendiente de ${{saldo}} con {{dias}} días de antigüedad. Por favor regularizá tu situación a la brevedad. Gracias.';

    const saldoStr = deuda.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const dias = deuda.diasSinPagar ?? 0;

    const text = template
      .replace(/\{\{nombre\}\}/g, acreedor.nombre)
      .replace(/\{\{saldo\}\}/g, saldoStr)
      .replace(/\{\{dias\}\}/g, String(dias));

    const phoneNumber = this.formatPhoneNumber(acreedor.telefono);

    return this.whatsappService.sendMessage(phoneNumber, text, 'ACREEDORES', id);
  }

  private formatPhoneNumber(tel: string): string {
    let cleaned = tel.replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('549')) {
      if (cleaned.startsWith('54')) {
        cleaned = '549' + cleaned.slice(2);
      } else if (cleaned.startsWith('9')) {
        cleaned = '54' + cleaned;
      } else {
        cleaned = '549' + cleaned;
      }
    }
    return cleaned + '@c.us';
  }

  async notificarDeudaBatch(acreedorIds: number[]) {
    const setting = await this.prisma.setting.findFirst();
    if (!setting?.enableWhatsappModule) {
      throw new BadRequestException('El módulo de WhatsApp no está habilitado');
    }

    if (!setting?.openwaApiUrl || !setting?.openwaApiKey) {
      throw new BadRequestException('OpenWA no está configurado (URL y API Key requeridos)');
    }

    const template =
      setting.openwaMessageTemplate ||
      'Hola {{nombre}}, te recordamos que tenés una deuda pendiente de ${{saldo}} con {{dias}} días de antigüedad. Por favor regularizá tu situación a la brevedad. Gracias.';

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const details: Array<{
      acreedorId: number;
      nombre: string;
      telefono: string | null;
      enviable: boolean;
      omitido: boolean;
      motivo: string;
      jobId: number | null;
      status: string;
    }> = [];

    let enviables = 0;
    let sinTelefono = 0;
    let sinDeuda = 0;

    for (const id of acreedorIds) {
      const acreedor = await this.prisma.acreedor.findUnique({ where: { id } });
      if (!acreedor) {
        details.push({
          acreedorId: id,
          nombre: `#${id}`,
          telefono: null,
          enviable: false,
          omitido: true,
          motivo: 'Acreedor no encontrado',
          jobId: null,
          status: 'SKIPPED',
        });
        continue;
      }

      if (!acreedor.telefono) {
        details.push({
          acreedorId: id,
          nombre: acreedor.nombre,
          telefono: null,
          enviable: false,
          omitido: true,
          motivo: 'Sin teléfono',
          jobId: null,
          status: 'SKIPPED',
        });
        sinTelefono++;
        continue;
      }

      const deuda = await this.getDeuda(id);
      if (deuda.saldoPendiente <= 0) {
        details.push({
          acreedorId: id,
          nombre: acreedor.nombre,
          telefono: acreedor.telefono,
          enviable: false,
          omitido: true,
          motivo: 'Sin deuda pendiente',
          jobId: null,
          status: 'SKIPPED',
        });
        sinDeuda++;
        continue;
      }

      enviables++;
      details.push({
        acreedorId: id,
        nombre: acreedor.nombre,
        telefono: acreedor.telefono,
        enviable: true,
        omitido: false,
        motivo: '',
        jobId: null,
        status: 'QUEUED',
      });
    }

    const minTime = Math.ceil(enviables * (setting.openwaMinDelay ?? 30) / 60);
    const maxTime = Math.ceil(enviables * (setting.openwaMaxDelay ?? 120) / 60);
    const tiempoEstimado = minTime === maxTime ? `${minTime} minutos` : `${minTime} a ${maxTime} minutos`;

    if (enviables === 0) {
      throw new BadRequestException('Ninguno de los acreedores seleccionados es enviable');
    }

    const finalJobs: Array<{ creditorId: number; phoneNumber: string; text: string }> = [];
    for (const d of details.filter((d) => d.enviable)) {
      const acreedor = await this.prisma.acreedor.findUnique({ where: { id: d.acreedorId } });
      if (!acreedor) continue;
      const deudaCheck = await this.getDeuda(d.acreedorId);
      const saldoStr = deudaCheck.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const dias = deudaCheck.diasSinPagar ?? 0;
      const text = template
        .replace(/\{\{nombre\}\}/g, acreedor.nombre)
        .replace(/\{\{saldo\}\}/g, saldoStr)
        .replace(/\{\{dias\}\}/g, String(dias));
      finalJobs.push({
        creditorId: d.acreedorId,
        phoneNumber: this.formatPhoneNumber(acreedor.telefono!),
        text,
      });
    }

    await this.notificationQueueService.enqueueBatch(finalJobs, batchId);

    for (let i = 0; i < details.length; i++) {
      if (details[i].enviable) {
        const dbJob = await this.prisma.notificationJob.findFirst({
          where: { batchId, creditorId: details[i].acreedorId },
          orderBy: { id: 'desc' },
        });
        details[i].jobId = dbJob?.id ?? null;
      }
    }

    return {
      batchId,
      total: acreedorIds.length,
      enviables,
      sinTelefono,
      sinDeuda,
      omitidos: sinTelefono + sinDeuda,
      tiempoEstimado,
      details,
    };
  }

  async getBatchStatus(batchId: string) {
    return this.notificationQueueService.getBatchStatus(batchId);
  }

  async getNotificaciones(acreedorId: number) {
    return this.prisma.notificationJob.findMany({
      where: { creditorId: acreedorId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        channel: true,
        status: true,
        attempts: true,
        error: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        payload: true,
      },
      take: 50,
    });
  }

  async getNotificationStatus(acreedorIds: number[]) {
    if (acreedorIds.length === 0) {
      return {};
    }

    const jobs = await this.prisma.notificationJob.findMany({
      where: { creditorId: { in: acreedorIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        creditorId: true,
        status: true,
        completedAt: true,
        createdAt: true,
        error: true,
        attempts: true,
      },
    });

    const result: Record<number, {
      status: string;
      completedAt: string | null;
      createdAt: string | null;
      error: string | null;
      attempts: number;
    } | null> = {};

    for (const id of acreedorIds) {
      const latest = jobs.find((j) => j.creditorId === id);
      result[id] = latest
        ? {
            status: latest.status,
            completedAt: latest.completedAt?.toISOString() ?? null,
            createdAt: latest.createdAt?.toISOString() ?? null,
            error: latest.error,
            attempts: latest.attempts,
          }
        : null;
    }

    return result;
  }
}
