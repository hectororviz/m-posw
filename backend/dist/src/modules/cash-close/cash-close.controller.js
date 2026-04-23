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
exports.CashCloseController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const roles_guard_1 = require("../common/roles.guard");
const cash_close_service_1 = require("./cash-close.service");
const close_period_dto_1 = require("./dto/close-period.dto");
const list_cash_closes_dto_1 = require("./dto/list-cash-closes.dto");
let CashCloseController = class CashCloseController {
    constructor(cashCloseService) {
        this.cashCloseService = cashCloseService;
    }
    getCurrentPeriod() {
        return this.cashCloseService.getCurrentPeriod();
    }
    closeCurrentPeriod(req, dto) {
        return this.cashCloseService.closeCurrentPeriod(req.user.sub, dto.note);
    }
    list(query) {
        return this.cashCloseService.list(query.limit, query.offset);
    }
    getById(id) {
        return this.cashCloseService.getById(id);
    }
};
exports.CashCloseController = CashCloseController;
__decorate([
    (0, common_1.Get)('current-period'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CashCloseController.prototype, "getCurrentPeriod", null);
__decorate([
    (0, common_1.Post)('close'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, close_period_dto_1.ClosePeriodDto]),
    __metadata("design:returntype", void 0)
], CashCloseController.prototype, "closeCurrentPeriod", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_cash_closes_dto_1.ListCashClosesDto]),
    __metadata("design:returntype", void 0)
], CashCloseController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.USER),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CashCloseController.prototype, "getById", null);
exports.CashCloseController = CashCloseController = __decorate([
    (0, common_1.Controller)('cash-close'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [cash_close_service_1.CashCloseService])
], CashCloseController);
