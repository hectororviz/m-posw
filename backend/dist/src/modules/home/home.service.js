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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const user_permissions_service_1 = require("../users/user-permissions.service");
let HomeService = class HomeService {
    constructor(prisma, userPermissionsService) {
        this.prisma = prisma;
        this.userPermissionsService = userPermissionsService;
    }
    async getMetrics(userId, role) {
        const result = {};
        if (role === 'ADMIN') {
            const [pos, socios, acreedores, internet, stock] = await Promise.all([
                this.getPosMetrics(),
                this.getSociosMetrics(),
                this.getAcreedoresMetrics(),
                this.getInternetMetrics(),
                this.getStockMetrics(),
            ]);
            if (pos)
                result.pos = pos;
            if (socios)
                result.socios = socios;
            if (acreedores)
                result.acreedores = acreedores;
            if (internet)
                result.internet = internet;
            if (stock)
                result.stock = stock;
            return result;
        }
        const modules = ['POS', 'SOCIOS', 'ACREEDORES', 'INTERNET', 'PRODUCTOS'];
        const accessMap = new Map();
        for (const mod of modules) {
            accessMap.set(mod, await this.userPermissionsService.resolveAccess(userId, mod));
        }
        const promises = [];
        if (accessMap.get('POS') === 'FULL') {
            promises.push(this.getPosMetrics().then((m) => { if (m)
                result.pos = m; }));
        }
        if (['READ', 'FULL'].includes(accessMap.get('SOCIOS'))) {
            promises.push(this.getSociosMetrics().then((m) => { if (m)
                result.socios = m; }));
        }
        if (['READ', 'FULL'].includes(accessMap.get('ACREEDORES'))) {
            promises.push(this.getAcreedoresMetrics().then((m) => { if (m)
                result.acreedores = m; }));
        }
        if (['READ', 'FULL'].includes(accessMap.get('INTERNET'))) {
            promises.push(this.getInternetMetrics().then((m) => { if (m)
                result.internet = m; }));
        }
        if (['READ', 'FULL'].includes(accessMap.get('PRODUCTOS'))) {
            promises.push(this.getStockMetrics().then((m) => { if (m)
                result.stock = m; }));
        }
        await Promise.all(promises);
        return result;
    }
    async getPosMetrics() {
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const yesterdayStart = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayEnd = new Date(today.getTime() - 1);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgoStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
        const twoWeeksAgoEnd = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000 - 1);
        const [ventasHoy, ventasAyer, ventasSemana, ventasSemanaPasada] = await Promise.all([
            this.prisma.sale.aggregate({
                _sum: { total: true },
                where: { status: 'APPROVED', createdAt: { gte: today } },
            }),
            this.prisma.sale.aggregate({
                _sum: { total: true },
                where: { status: 'APPROVED', createdAt: { gte: yesterdayStart, lt: today } },
            }),
            this.prisma.sale.aggregate({
                _sum: { total: true },
                where: {
                    status: 'APPROVED',
                    createdAt: { gte: weekAgo },
                },
            }),
            this.prisma.sale.aggregate({
                _sum: { total: true },
                where: {
                    status: 'APPROVED',
                    createdAt: { gte: twoWeeksAgoStart, lt: weekAgo },
                },
            }),
        ]);
        return {
            ventasHoy: Number(ventasHoy._sum.total || 0),
            ventasAyer: Number(ventasAyer._sum.total || 0),
            ventasSemana: Number(ventasSemana._sum.total || 0),
            ventasSemanaPasada: Number(ventasSemanaPasada._sum.total || 0),
        };
    }
    async getSociosMetrics() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const [activos, cuotasVencidasRaw] = await Promise.all([
            this.prisma.socio.count({ where: { estado: 'ACTIVO' } }),
            this.prisma.socioCuota.findMany({
                where: {
                    estado: { not: 'PAGADO' },
                    OR: [
                        { anio: { lt: currentYear } },
                        { anio: currentYear, mes: { lt: currentMonth } },
                    ],
                },
                select: { socioId: true },
                distinct: ['socioId'],
            }),
        ]);
        return { activos, cuotasVencidas: cuotasVencidasRaw.length };
    }
    async getAcreedoresMetrics() {
        const [fiadosGroup, pagosGroup, acreedoresActivos] = await Promise.all([
            this.prisma.fiadoVenta.groupBy({ by: ['acreedorId'], _sum: { monto: true } }),
            this.prisma.pagoAcreedor.groupBy({ by: ['acreedorId'], _sum: { monto: true } }),
            this.prisma.acreedor.findMany({ where: { activo: true }, select: { id: true } }),
        ]);
        const deudaMap = new Map();
        for (const f of fiadosGroup)
            deudaMap.set(f.acreedorId, Number(f._sum.monto || 0));
        for (const p of pagosGroup) {
            deudaMap.set(p.acreedorId, (deudaMap.get(p.acreedorId) || 0) - Number(p._sum.monto || 0));
        }
        let deudaTotal = 0;
        let activos = 0;
        for (const a of acreedoresActivos) {
            const deuda = deudaMap.get(a.id) || 0;
            if (deuda > 0) {
                activos++;
                deudaTotal += deuda;
            }
        }
        return { activos, deudaTotal };
    }
    async getInternetMetrics() {
        const [vouchersActivos, vencenHoyResult] = await Promise.all([
            this.prisma.saleVoucher.count({ where: { active: true } }),
            this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count
         FROM "SaleVoucher" sv
         JOIN "InternetPlan" ip ON sv."planId" = ip.id
         WHERE sv.active = true
           AND sv."createdAt" + (ip.duration * INTERVAL '1 second') >= CURRENT_DATE
           AND sv."createdAt" + (ip.duration * INTERVAL '1 second') < CURRENT_DATE + INTERVAL '1 day'`),
        ]);
        return {
            vouchersActivos,
            vouchersVencenHoy: vencenHoyResult[0]?.count ?? 0,
        };
    }
    async getStockMetrics() {
        const [productos, categorias] = await Promise.all([
            this.prisma.product.count({ where: { active: true } }),
            this.prisma.category.count(),
        ]);
        return { productos, categorias };
    }
};
exports.HomeService = HomeService;
exports.HomeService = HomeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        user_permissions_service_1.UserPermissionsService])
], HomeService);
