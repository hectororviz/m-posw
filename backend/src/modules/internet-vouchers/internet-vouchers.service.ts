import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import * as http from 'http';

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

    const body = JSON.stringify({
      plan_name: plan.name,
      duration: plan.duration,
      download: plan.downloadBandwidth,
      upload: plan.uploadBandwidth,
      idle_timeout: plan.idleTimeout,
      sale_id: saleId,
    });

    const data = await this.httpPost(`${this.apiUrl}/vouchers/generate`, body);

    const voucher = await this.prisma.saleVoucher.create({
      data: {
        saleId,
        planId: plan.id,
        pin: data.pin,
      },
    });

    this.logger.log(`Voucher generado: ${data.pin} | plan: ${plan.name}`);
    return voucher;
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
        try {
          const body = JSON.stringify({
            plan_name: plan.name,
            duration: plan.duration,
            download: plan.downloadBandwidth,
            upload: plan.uploadBandwidth,
            idle_timeout: plan.idleTimeout,
            sale_id: saleId,
          });
          const data = await this.httpPost(`${this.apiUrl}/vouchers/generate`, body);

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
        }
      }
    }

    return vouchers;
  }

  async deactivateVoucher(pin: string) {
    try {
      await this.httpRequest(`${this.apiUrl}/vouchers/${pin}`, 'DELETE');
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
      const body = JSON.stringify({ sale_id: saleId });
      const data = await this.httpPost(`${this.apiUrl}/vouchers/deactivate-by-sale`, body);

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
      const data = await this.httpRequest(`${this.apiUrl}/vouchers/${pin}`, 'GET');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private httpPost(fullUrl: string, body: string): Promise<GenerateResponse> {
    const parsed = new URL(fullUrl);
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          protocol: parsed.protocol,
          host: parsed.host,
          hostname: parsed.hostname,
          port: parsed.port || 80,
          path: parsed.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`api-radius error ${res.statusCode}: ${parsed.error || 'unknown'}`));
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new Error(`api-radius invalid response: ${data.substring(0, 200)}`));
            }
          });
        },
      );

      req.on('error', (err) => reject(new Error(`api-radius request failed: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('api-radius request timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  private httpRequest(urlStr: string, method: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port || 80,
          path: url.pathname,
          method,
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`api-radius error ${res.statusCode}`));
            } else {
              resolve(data);
            }
          });
        },
      );

      req.on('error', (err) => reject(new Error(`api-radius request failed: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('api-radius request timeout'));
      });

      req.end();
    });
  }
}
