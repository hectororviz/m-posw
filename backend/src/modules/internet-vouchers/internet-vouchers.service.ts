import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';

interface GenerateResponse {
  pin: string;
  plan_name: string;
  valid_hours: number;
  bandwidth_down: string;
  bandwidth_up: string;
}

@Injectable()
export class InternetVouchersService {
  private readonly logger = new Logger(InternetVouchersService.name);
  private readonly apiUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.apiUrl = this.config.get<string>('VOUCHER_API_URL', 'http://api-radius:3001/api');
  }

  async generateVoucher(planId: string, saleId: string) {
    const plan = await this.prisma.internetPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new Error(`Plan de internet ${planId} no encontrado`);
    }

    this.logger.log(`Generando voucher para plan ${plan.name} (sale ${saleId})`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.apiUrl}/vouchers/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_name: plan.name,
          duration: plan.duration,
          download: plan.downloadBandwidth,
          upload: plan.uploadBandwidth,
          idle_timeout: plan.idleTimeout,
          sale_id: saleId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`api-radius error ${response.status}: ${err.error || 'unknown'}`);
      }

      const data: GenerateResponse = await response.json();

      const voucher = await this.prisma.saleVoucher.create({
        data: {
          saleId,
          planId: plan.id,
          pin: data.pin,
        },
      });

      this.logger.log(`Voucher generado: ${data.pin} | plan: ${plan.name}`);
      return voucher;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateVouchersForSale(saleId: string) {
    const setting = await this.prisma.setting.findFirst();
    if (!setting?.enableInternetModule) return [];

    const saleItems = await this.prisma.saleItem.findMany({
      where: { saleId },
      include: { product: true },
    });

    const vouchers = [];

    for (const item of saleItems) {
      const plan = await this.prisma.internetPlan.findFirst({
        where: { productId: item.productId, active: true },
      });

      if (!plan) continue;

      for (let i = 0; i < item.quantity; i++) {
        try {
          const voucher = await this.generateVoucher(plan.id, saleId);
          vouchers.push(voucher);
        } catch (err) {
          this.logger.error(`Error generando voucher para plan ${plan.id}: ${err}`);
        }
      }
    }

    this.logger.log(`Venta ${saleId}: ${vouchers.length} voucher(s) generado(s)`);
    return vouchers;
  }

  async generateVouchersForSaleInTx(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    saleId: string,
  ) {
    const setting = await tx.setting.findFirst();
    if (!setting?.enableInternetModule) return [];

    const saleItems = await tx.saleItem.findMany({
      where: { saleId },
      include: { product: true },
    });

    const vouchers = [];

    for (const item of saleItems) {
      const plan = await tx.internetPlan.findFirst({
        where: { productId: item.productId, active: true },
      });

      if (!plan) continue;

      for (let i = 0; i < item.quantity; i++) {
        const controllers: AbortController[] = [];
        const timeouts: ReturnType<typeof setTimeout>[] = [];

        try {
          const ac = new AbortController();
          controllers.push(ac);
          const t = setTimeout(() => ac.abort(), 10000);
          timeouts.push(t);

          const response = await fetch(`${this.apiUrl}/vouchers/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan_name: plan.name,
              duration: plan.duration,
              download: plan.downloadBandwidth,
              upload: plan.uploadBandwidth,
              idle_timeout: plan.idleTimeout,
              sale_id: saleId,
            }),
            signal: ac.signal,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`api-radius error ${response.status}: ${err.error || 'unknown'}`);
          }

          const data: GenerateResponse = await response.json();

          const voucher = await tx.saleVoucher.create({
            data: {
              saleId,
              planId: plan.id,
              pin: data.pin,
            },
          });

          vouchers.push(voucher);
          this.logger.log(`Voucher generado (tx): ${data.pin} | plan: ${plan.name}`);
        } catch (err) {
          this.logger.error(`Error generando voucher para plan ${plan.id} (tx): ${err}`);
        } finally {
          for (const t of timeouts) clearTimeout(t);
        }
      }
    }

    return vouchers;
  }

  async deactivateVoucher(pin: string) {
    try {
      const response = await fetch(`${this.apiUrl}/vouchers/${pin}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`api-radius error ${response.status}: ${err.error || 'unknown'}`);
      }

      await this.prisma.saleVoucher.updateMany({
        where: { pin },
        data: { active: false },
      });

      this.logger.log(`Voucher desactivado: ${pin}`);
      return { success: true };
    } catch (err) {
      this.logger.error(`Error desactivando voucher ${pin}: ${err}`);
      throw err;
    }
  }

  async deactivateBySale(saleId: string) {
    try {
      const response = await fetch(`${this.apiUrl}/vouchers/deactivate-by-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_id: saleId }),
      });

      const data = await response.json().catch(() => ({}));

      await this.prisma.saleVoucher.updateMany({
        where: { saleId, active: true },
        data: { active: false },
      });

      this.logger.log(`Vouchers desactivados para venta ${saleId}`);
      return data;
    } catch (err) {
      this.logger.error(`Error desactivando vouchers para venta ${saleId}: ${err}`);
      throw err;
    }
  }

  async getVoucher(pin: string) {
    try {
      const response = await fetch(`${this.apiUrl}/vouchers/${pin}`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }
}
