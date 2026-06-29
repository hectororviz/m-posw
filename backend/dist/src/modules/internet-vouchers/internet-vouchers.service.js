"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var InternetVouchersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternetVouchersService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../common/prisma.service");
const http = require("http");
let InternetVouchersService = InternetVouchersService_1 = class InternetVouchersService {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        this.logger = new common_1.Logger(InternetVouchersService_1.name);
        this.apiUrl = this.config.get('VOUCHER_API_URL', 'http://api-radius:3001/api');
    }
    async generateVoucher(planId, saleId) {
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
    async generateVouchersForSale(saleId) {
        const setting = await this.prisma.setting.findFirst();
        if (!setting?.enableInternetModule)
            return [];
        const saleItems = await this.prisma.saleItem.findMany({
            where: { saleId },
            include: { product: true },
        });
        const vouchers = [];
        for (const item of saleItems) {
            const plan = await this.prisma.internetPlan.findFirst({
                where: { productId: item.productId, active: true },
            });
            if (!plan)
                continue;
            for (let i = 0; i < item.quantity; i++) {
                try {
                    const voucher = await this.generateVoucher(plan.id, saleId);
                    vouchers.push(voucher);
                }
                catch (err) {
                    this.logger.error(`Error generando voucher para plan ${plan.id}: ${err}`);
                }
            }
        }
        this.logger.log(`Venta ${saleId}: ${vouchers.length} voucher(s) generado(s)`);
        return vouchers;
    }
    async generateVouchersForSaleInTx(tx, saleId) {
        const setting = await tx.setting.findFirst();
        if (!setting?.enableInternetModule)
            return [];
        const saleItems = await tx.saleItem.findMany({
            where: { saleId },
            include: { product: true },
        });
        const vouchers = [];
        for (const item of saleItems) {
            const plan = await tx.internetPlan.findFirst({
                where: { productId: item.productId, active: true },
            });
            if (!plan)
                continue;
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
                }
                catch (err) {
                    this.logger.error(`Error generando voucher para plan ${plan.id} (tx): ${err}`);
                }
            }
        }
        return vouchers;
    }
    async deactivateVoucher(pin) {
        try {
            await this.httpRequest(`${this.apiUrl}/vouchers/${pin}`, 'DELETE');
            await this.prisma.saleVoucher.updateMany({
                where: { pin },
                data: { active: false },
            });
            this.logger.log(`Voucher desactivado: ${pin}`);
            return { success: true };
        }
        catch (err) {
            this.logger.error(`Error desactivando voucher ${pin}: ${err}`);
            throw err;
        }
    }
    async deactivateBySale(saleId) {
        try {
            const body = JSON.stringify({ sale_id: saleId });
            const data = await this.httpPost(`${this.apiUrl}/vouchers/deactivate-by-sale`, body);
            await this.prisma.saleVoucher.updateMany({
                where: { saleId, active: true },
                data: { active: false },
            });
            this.logger.log(`Vouchers desactivados para venta ${saleId}`);
            return data;
        }
        catch (err) {
            this.logger.error(`Error desactivando vouchers para venta ${saleId}: ${err}`);
            throw err;
        }
    }
    async getVoucher(pin) {
        try {
            const data = await this.httpRequest(`${this.apiUrl}/vouchers/${pin}`, 'GET');
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    async httpGet(urlStr) {
        return this.httpRequest(urlStr, 'GET');
    }
    httpPost(fullUrl, body) {
        const parsed = new URL(fullUrl);
        return new Promise((resolve, reject) => {
            const req = http.request({
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
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk.toString(); });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(`api-radius error ${res.statusCode}: ${parsed.error || 'unknown'}`));
                        }
                        else {
                            resolve(parsed);
                        }
                    }
                    catch {
                        reject(new Error(`api-radius invalid response: ${data.substring(0, 200)}`));
                    }
                });
            });
            req.on('error', (err) => reject(new Error(`api-radius request failed: ${err.message}`)));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('api-radius request timeout'));
            });
            req.write(body);
            req.end();
        });
    }
    httpRequest(urlStr, method) {
        return new Promise((resolve, reject) => {
            const url = new URL(urlStr);
            const req = http.request({
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname,
                method,
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(`api-radius error ${res.statusCode}`));
                    }
                    else {
                        resolve(data);
                    }
                });
            });
            req.on('error', (err) => reject(new Error(`api-radius request failed: ${err.message}`)));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('api-radius request timeout'));
            });
            req.end();
        });
    }
};
exports.InternetVouchersService = InternetVouchersService;
exports.InternetVouchersService = InternetVouchersService = InternetVouchersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], InternetVouchersService);
