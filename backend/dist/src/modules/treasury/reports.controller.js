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
exports.TreasuryReportsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const report_query_dto_1 = require("./dto/report-query.dto");
const reports_service_1 = require("./reports.service");
let TreasuryReportsController = class TreasuryReportsController {
    constructor(service) {
        this.service = service;
    }
    summary(query) {
        return this.service.summary(query.from, query.to);
    }
    ledgerBook(query) {
        return this.service.ledgerBook(query.from, query.to);
    }
    ledgerAccount(query) {
        return this.service.ledgerAccount(query.accountId, query.from, query.to);
    }
    trialBalance(query) {
        return this.service.trialBalance(query.from, query.to);
    }
    incomeStatement(query) {
        return this.service.incomeStatement(query.from, query.to);
    }
    availabilities(asOf) {
        return this.service.availabilityBalances(asOf);
    }
    async exportLedgerBook(query, res) {
        const buffer = await this.service.exportLedgerBook(query.from, query.to);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=libro-diario.xlsx');
        res.send(buffer);
    }
    async exportLedgerAccount(query, res) {
        const buffer = await this.service.exportLedgerAccount(query.accountId, query.from, query.to);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=mayor-contable.xlsx');
        res.send(buffer);
    }
    async exportTrialBalance(query, res) {
        const buffer = await this.service.exportTrialBalance(query.from, query.to);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=balance-sumas-saldos.xlsx');
        res.send(buffer);
    }
    async exportIncomeStatement(query, res) {
        const buffer = await this.service.exportIncomeStatement(query.from, query.to);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=estado-resultados.xlsx');
        res.send(buffer);
    }
    async exportAvailabilities(asOf, res) {
        const buffer = await this.service.exportAvailabilityBalances(asOf);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=disponibilidades.xlsx');
        res.send(buffer);
    }
};
exports.TreasuryReportsController = TreasuryReportsController;
__decorate([
    (0, common_1.Get)('summary'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_query_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], TreasuryReportsController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('ledger-book'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_query_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], TreasuryReportsController.prototype, "ledgerBook", null);
__decorate([
    (0, common_1.Get)('ledger-account'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_query_dto_1.LedgerAccountQueryDto]),
    __metadata("design:returntype", void 0)
], TreasuryReportsController.prototype, "ledgerAccount", null);
__decorate([
    (0, common_1.Get)('trial-balance'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_query_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], TreasuryReportsController.prototype, "trialBalance", null);
__decorate([
    (0, common_1.Get)('income-statement'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_query_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], TreasuryReportsController.prototype, "incomeStatement", null);
__decorate([
    (0, common_1.Get)('availabilities'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)('asOf')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TreasuryReportsController.prototype, "availabilities", null);
__decorate([
    (0, common_1.Get)('export/ledger-book'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_query_dto_1.DateRangeDto, Object]),
    __metadata("design:returntype", Promise)
], TreasuryReportsController.prototype, "exportLedgerBook", null);
__decorate([
    (0, common_1.Get)('export/ledger-account'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_query_dto_1.LedgerAccountQueryDto, Object]),
    __metadata("design:returntype", Promise)
], TreasuryReportsController.prototype, "exportLedgerAccount", null);
__decorate([
    (0, common_1.Get)('export/trial-balance'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_query_dto_1.DateRangeDto, Object]),
    __metadata("design:returntype", Promise)
], TreasuryReportsController.prototype, "exportTrialBalance", null);
__decorate([
    (0, common_1.Get)('export/income-statement'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_query_dto_1.DateRangeDto, Object]),
    __metadata("design:returntype", Promise)
], TreasuryReportsController.prototype, "exportIncomeStatement", null);
__decorate([
    (0, common_1.Get)('export/availabilities'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)('asOf')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TreasuryReportsController.prototype, "exportAvailabilities", null);
exports.TreasuryReportsController = TreasuryReportsController = __decorate([
    (0, common_1.Controller)('treasury/reports'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    __metadata("design:paramtypes", [reports_service_1.TreasuryReportsService])
], TreasuryReportsController);
