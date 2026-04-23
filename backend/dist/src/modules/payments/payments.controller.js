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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const roles_guard_1 = require("../common/roles.guard");
const payments_service_1 = require("./payments.service");
const transfer_dto_1 = require("./dto/transfer.dto");
let PaymentsController = class PaymentsController {
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    async pollTransfer(req, dto) {
        return this.paymentsService.pollTransfer(dto.monto_esperado, req.user.sub);
    }
    async confirmTransfer(req, dto) {
        return this.paymentsService.confirmTransfer(dto.payment_id, dto.monto_recibido, dto.monto_esperado, req.user.sub, dto.items);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)('poll-transfer'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, transfer_dto_1.PollTransferDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "pollTransfer", null);
__decorate([
    (0, common_1.Post)('confirm-transfer'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "confirmTransfer", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.Controller)('payments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
