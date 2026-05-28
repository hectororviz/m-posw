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
exports.LedgerAccountsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const roles_guard_1 = require("../common/roles.guard");
const ledger_account_dto_1 = require("./dto/ledger-account.dto");
const ledger_accounts_service_1 = require("./ledger-accounts.service");
let LedgerAccountsController = class LedgerAccountsController {
    constructor(service) {
        this.service = service;
    }
    list() {
        return this.service.list();
    }
    listFlat() {
        return this.service.listFlat();
    }
    listImputable() {
        return this.service.listImputable();
    }
    getAssetAccountsImputable() {
        return this.service.getAssetAccountsImputable();
    }
    getRevenueAccountsImputable() {
        return this.service.getRevenueAccountsImputable();
    }
    getExpenseAccountsImputable() {
        return this.service.getExpenseAccountsImputable();
    }
    getById(id) {
        return this.service.getById(id);
    }
    create(dto) {
        return this.service.create(dto);
    }
    update(id, dto) {
        return this.service.update(id, dto);
    }
    toggleActive(id) {
        return this.service.toggleActive(id);
    }
};
exports.LedgerAccountsController = LedgerAccountsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerAccountsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('flat'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerAccountsController.prototype, "listFlat", null);
__decorate([
    (0, common_1.Get)('imputable'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerAccountsController.prototype, "listImputable", null);
__decorate([
    (0, common_1.Get)('asset-imputable'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerAccountsController.prototype, "getAssetAccountsImputable", null);
__decorate([
    (0, common_1.Get)('revenue-imputable'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerAccountsController.prototype, "getRevenueAccountsImputable", null);
__decorate([
    (0, common_1.Get)('expense-imputable'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerAccountsController.prototype, "getExpenseAccountsImputable", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LedgerAccountsController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ledger_account_dto_1.CreateLedgerAccountDto]),
    __metadata("design:returntype", void 0)
], LedgerAccountsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ledger_account_dto_1.UpdateLedgerAccountDto]),
    __metadata("design:returntype", void 0)
], LedgerAccountsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/toggle-active'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LedgerAccountsController.prototype, "toggleActive", null);
exports.LedgerAccountsController = LedgerAccountsController = __decorate([
    (0, common_1.Controller)('treasury/accounts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:paramtypes", [ledger_accounts_service_1.LedgerAccountsService])
], LedgerAccountsController);
