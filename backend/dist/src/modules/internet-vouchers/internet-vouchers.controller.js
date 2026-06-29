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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternetVouchersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const prisma_service_1 = require("../common/prisma.service");
const generate_voucher_dto_1 = require("./dto/generate-voucher.dto");
const internet_vouchers_service_1 = require("./internet-vouchers.service");
let InternetVouchersController = class InternetVouchersController {
    constructor(vouchersService, prisma) {
        this.vouchersService = vouchersService;
        this.prisma = prisma;
    }
    async getStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [active, todayCount, total] = await Promise.all([
            this.prisma.saleVoucher.count({ where: { active: true } }),
            this.prisma.saleVoucher.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
            this.prisma.saleVoucher.count(),
        ]);
        return {
            active_vouchers: active,
            generated_today: todayCount,
            total_vouchers: total,
        };
    }
    async listVouchers(saleId) {
        const vouchers = await this.prisma.saleVoucher.findMany({
            where: saleId ? { saleId } : undefined,
            include: {
                plan: true,
                sale: { select: { orderNumber: true, createdAt: true, paidAt: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return vouchers.map((v) => ({
            id: v.id,
            saleOrderNumber: v.sale.orderNumber,
            planName: v.plan.name,
            planDuration: v.plan.duration,
            active: v.active,
            createdAt: v.createdAt,
            saleCreatedAt: v.sale.createdAt,
            salePaidAt: v.sale.paidAt,
        }));
    }
    generate(dto) {
        return this.vouchersService.generateVoucher(dto.planId, dto.saleId);
    }
    getVoucher(pin) {
        return this.vouchersService.getVoucher(pin);
    }
    async deactivateById(id) {
        const voucher = await this.prisma.saleVoucher.findUnique({ where: { id } });
        if (!voucher)
            return { error: 'Voucher no encontrado' };
        return this.vouchersService.deactivateVoucher(voucher.pin);
    }
    deactivate(pin) {
        return this.vouchersService.deactivateVoucher(pin);
    }
};
exports.InternetVouchersController = InternetVouchersController;
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InternetVouchersController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('list'),
    __param(0, (0, common_1.Query)('saleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InternetVouchersController.prototype, "listVouchers", null);
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [generate_voucher_dto_1.GenerateVoucherDto]),
    __metadata("design:returntype", void 0)
], InternetVouchersController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)(':pin'),
    __param(0, (0, common_1.Param)('pin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InternetVouchersController.prototype, "getVoucher", null);
__decorate([
    (0, common_1.Delete)('id/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InternetVouchersController.prototype, "deactivateById", null);
__decorate([
    (0, common_1.Delete)(':pin'),
    __param(0, (0, common_1.Param)('pin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InternetVouchersController.prototype, "deactivate", null);
exports.InternetVouchersController = InternetVouchersController = __decorate([
    (0, common_1.Controller)('internet/vouchers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [internet_vouchers_service_1.InternetVouchersService,
        prisma_service_1.PrismaService])
], InternetVouchersController);
