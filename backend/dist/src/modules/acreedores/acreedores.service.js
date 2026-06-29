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
exports.AcreedoresService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const journal_entries_service_1 = require("../treasury/journal-entries.service");
let AcreedoresService = class AcreedoresService {
    constructor(prisma, journalEntriesService) {
        this.prisma = prisma;
        this.journalEntriesService = journalEntriesService;
    }
    calculateFifo(fiadoVentas, pagos) {
        const sortedVentas = [...fiadoVentas].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const sortedPagos = [...pagos].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        let pagoRemaining = sortedPagos.reduce((sum, p) => sum + Number(p.monto), 0);
        let deudaMasAntigua = null;
        const fiadoVentasConSaldo = [];
        for (const venta of sortedVentas) {
            const monto = Number(venta.monto);
            const aplicado = Math.min(monto, pagoRemaining);
            const saldo = monto - aplicado;
            pagoRemaining -= aplicado;
            if (saldo > 0 && !deudaMasAntigua) {
                deudaMasAntigua = venta.createdAt.toISOString();
            }
            fiadoVentasConSaldo.push({
                id: venta.id,
                monto,
                createdAt: venta.createdAt.toISOString(),
                ventaId: venta.ventaId,
                saldoRestante: saldo,
            });
        }
        let diasSinPagar = null;
        let alertaDeuda = false;
        if (deudaMasAntigua) {
            const ahora = new Date();
            const fechaDeuda = new Date(deudaMasAntigua);
            diasSinPagar = Math.floor((ahora.getTime() - fechaDeuda.getTime()) / (1000 * 60 * 60 * 24));
            alertaDeuda = diasSinPagar >= 30;
        }
        return { deudaMasAntigua, diasSinPagar, alertaDeuda, fiadoVentasConSaldo };
    }
    async getResumen() {
        const acreedores = await this.prisma.acreedor.findMany({
            include: {
                fiadoVentas: true,
                pagos: true,
            },
        });
        let deudaTotal = 0;
        let acreedoresConDeuda = 0;
        for (const a of acreedores) {
            const totalFiado = a.fiadoVentas.reduce((sum, fv) => sum + Number(fv.monto), 0);
            const totalPagado = a.pagos.reduce((sum, p) => sum + Number(p.monto), 0);
            const saldo = totalFiado - totalPagado;
            deudaTotal += saldo;
            if (saldo > 0)
                acreedoresConDeuda++;
        }
        return { deudaTotal, acreedoresConDeuda };
    }
    async findAll() {
        const acreedores = await this.prisma.acreedor.findMany({
            include: {
                fiadoVentas: { orderBy: { createdAt: 'asc' } },
                pagos: true,
            },
            orderBy: { nombre: 'asc' },
        });
        return acreedores.map((a) => {
            const totalFiado = a.fiadoVentas.reduce((sum, fv) => sum + Number(fv.monto), 0);
            const totalPagado = a.pagos.reduce((sum, p) => sum + Number(p.monto), 0);
            const { alertaDeuda, diasSinPagar } = this.calculateFifo(a.fiadoVentas, a.pagos);
            return {
                id: a.id,
                nombre: a.nombre,
                telefono: a.telefono,
                notas: a.notas,
                activo: a.activo,
                createdAt: a.createdAt,
                alertaDeuda,
                diasSinPagar,
                saldo: totalFiado - totalPagado,
            };
        });
    }
    async findOne(id) {
        const acreedor = await this.prisma.acreedor.findUnique({ where: { id } });
        if (!acreedor) {
            throw new common_1.NotFoundException('Acreedor no encontrado');
        }
        return acreedor;
    }
    create(dto) {
        return this.prisma.acreedor.create({ data: dto });
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.acreedor.update({
            where: { id },
            data: dto,
        });
    }
    async toggleActive(id) {
        const acreedor = await this.findOne(id);
        return this.prisma.acreedor.update({
            where: { id },
            data: { activo: !acreedor.activo },
        });
    }
    async getDeuda(id) {
        await this.findOne(id);
        const fiadoVentas = await this.prisma.fiadoVenta.findMany({
            where: { acreedorId: id },
            orderBy: { createdAt: 'desc' },
            select: { id: true, monto: true, createdAt: true, ventaId: true },
        });
        const pagos = await this.prisma.pagoAcreedor.findMany({
            where: { acreedorId: id },
            orderBy: { fecha: 'desc' },
            select: { id: true, monto: true, medioPago: true, fecha: true, notas: true },
        });
        const totalFiado = fiadoVentas.reduce((sum, fv) => sum + Number(fv.monto), 0);
        const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
        const saldoPendiente = totalFiado - totalPagado;
        const { deudaMasAntigua, diasSinPagar, alertaDeuda, fiadoVentasConSaldo } = this.calculateFifo(fiadoVentas, pagos);
        return {
            fiadoVentas: fiadoVentasConSaldo,
            pagos,
            totalFiado,
            totalPagado,
            saldoPendiente,
            deudaMasAntigua,
            diasSinPagar,
            alertaDeuda,
        };
    }
    async addPago(userId, acreedorId, dto) {
        const acreedor = await this.findOne(acreedorId);
        if (dto.monto <= 0) {
            throw new common_1.BadRequestException('El monto debe ser mayor a 0');
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
            throw new common_1.BadRequestException('Cuenta de tesorería no encontrada');
        }
        const deudoresFiadosAccount = await this.prisma.ledgerAccount.findUnique({
            where: { code: '1.2.03' },
        });
        if (!deudoresFiadosAccount) {
            throw new common_1.BadRequestException('Cuenta contable 1.2.03 no encontrada');
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
};
exports.AcreedoresService = AcreedoresService;
exports.AcreedoresService = AcreedoresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        journal_entries_service_1.JournalEntriesService])
], AcreedoresService);
