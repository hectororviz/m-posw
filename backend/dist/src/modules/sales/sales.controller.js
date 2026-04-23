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
exports.SalesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const roles_guard_1 = require("../common/roles.guard");
const create_manual_movement_dto_1 = require("./dto/create-manual-movement.dto");
const create_sale_dto_1 = require("./dto/create-sale.dto");
const sales_service_1 = require("./sales.service");
let SalesController = class SalesController {
    constructor(salesService) {
        this.salesService = salesService;
    }
    createCash(req, dto) {
        return this.salesService.createCashSale(req.user.sub, dto);
    }
    createQr(req, dto) {
        return this.salesService.createQrSale(req.user.sub, dto);
    }
    list(req) {
        return this.salesService.listSales({ id: req.user.sub, role: req.user.role });
    }
    createManualMovement(req, dto) {
        return this.salesService.createManualMovement(req.user.sub, dto);
    }
    listManualMovements(req) {
        return this.salesService.listManualMovements({ id: req.user.sub, role: req.user.role });
    }
    getById(req, id) {
        return this.salesService.getSaleById(id, { id: req.user.sub, role: req.user.role });
    }
    getStatus(req, id) {
        return this.salesService.getSaleStatus(id, { id: req.user.sub, role: req.user.role });
    }
    getPaymentStatus(req, id, res) {
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });
        return this.salesService.getPaymentStatus(id, { id: req.user.sub, role: req.user.role });
    }
    completeSale(req, id) {
        return this.salesService.completeSale(id, { id: req.user.sub, role: req.user.role });
    }
    cancelQrSale(req, id) {
        return this.salesService.cancelQrSale(id, { id: req.user.sub, role: req.user.role });
    }
    markTicketPrinted(req, id) {
        return this.salesService.markTicketPrinted(id, { id: req.user.sub, role: req.user.role });
    }
};
exports.SalesController = SalesController;
__decorate([
    (0, common_1.Post)('cash'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_sale_dto_1.CreateCashSaleDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createCash", null);
__decorate([
    (0, common_1.Post)('qr'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_sale_dto_1.CreateQrSaleDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createQr", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('manual-movements'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_manual_movement_dto_1.CreateManualMovementDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createManualMovement", null);
__decorate([
    (0, common_1.Get)('manual-movements'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listManualMovements", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(':id/status'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)(':id/payment-status'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "getPaymentStatus", null);
__decorate([
    (0, common_1.Post)(':id/complete'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "completeSale", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "cancelQrSale", null);
__decorate([
    (0, common_1.Post)(':id/ticket-printed'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "markTicketPrinted", null);
exports.SalesController = SalesController = __decorate([
    (0, common_1.Controller)('sales'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [sales_service_1.SalesService])
], SalesController);
