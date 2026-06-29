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
exports.AccountingController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ExcelJS = require("exceljs");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const accounting_service_1 = require("./accounting.service");
const ledger_accounts_service_1 = require("../treasury/ledger-accounts.service");
const assign_category_dto_1 = require("./dto/assign-category.dto");
const create_category_dto_1 = require("./dto/create-category.dto");
const create_movement_dto_1 = require("./dto/create-movement.dto");
const query_movements_dto_1 = require("./dto/query-movements.dto");
const update_category_dto_1 = require("./dto/update-category.dto");
const update_movement_dto_1 = require("./dto/update-movement.dto");
let AccountingController = class AccountingController {
    constructor(accountingService, ledgerAccountsService) {
        this.accountingService = accountingService;
        this.ledgerAccountsService = ledgerAccountsService;
    }
    getTreasuryAccounts() {
        return this.ledgerAccountsService.getTreasuryAccounts();
    }
    listCategories(type) {
        return this.accountingService.listCategories(type);
    }
    createCategory(dto) {
        return this.accountingService.createCategory(dto);
    }
    updateCategory(id, dto) {
        return this.accountingService.updateCategory(id, dto);
    }
    deleteCategory(id) {
        return this.accountingService.deleteCategory(id);
    }
    listMovements(query) {
        return this.accountingService.listMovements(query);
    }
    createMovement(dto) {
        return this.accountingService.createMovement(dto);
    }
    updateMovement(id, dto) {
        return this.accountingService.updateMovement(id, dto);
    }
    deleteMovement(id) {
        return this.accountingService.deleteMovement(id);
    }
    listManualMovements(query) {
        return this.accountingService.listManualMovements(query);
    }
    assignCategory(id, dto) {
        return this.accountingService.assignCategoryToManualMovement(id, dto);
    }
    removeCategory(id) {
        return this.accountingService.removeCategoryFromManualMovement(id);
    }
    getSummary(from, to) {
        return this.accountingService.getSummary({
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
        });
    }
    async exportExcel(from, to, res) {
        const data = await this.accountingService.getExportData({
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
        });
        const workbook = new ExcelJS.Workbook();
        const headerFont = { bold: true };
        const arsFormat = '#,##0.00';
        const ws1 = workbook.addWorksheet('Movimientos');
        ws1.columns = [
            { header: 'ID', key: 'id', width: 12 },
            { header: 'Fecha', key: 'date', width: 14 },
            { header: 'Tipo', key: 'type', width: 12 },
            { header: 'Origen', key: 'origin', width: 22 },
            { header: 'Categoría', key: 'category', width: 22 },
            { header: 'Descripción', key: 'description', width: 40 },
            { header: 'Referencia', key: 'reference', width: 14 },
            { header: 'Monto', key: 'amount', width: 16 },
        ];
        const headerRow1 = ws1.getRow(1);
        headerRow1.font = headerFont;
        for (const m of data.movements) {
            const row = ws1.addRow({
                id: m.id.slice(0, 8),
                date: m.date.toISOString().slice(0, 10),
                type: m.type === 'INCOME' ? 'Ingreso' : 'Egreso',
                origin: m.origin,
                category: m.category,
                description: m.description,
                reference: m.reference,
                amount: m.amount,
            });
            row.getCell('amount').numFmt = arsFormat;
        }
        ws1.columns.forEach((col) => {
            let max = (col.header || '').length;
            ws1.getColumn(col.key).values.slice(1).forEach((v) => {
                const len = String(v ?? '').length;
                if (len > max)
                    max = len;
            });
            col.width = Math.min(max + 4, 50);
        });
        const ws2 = workbook.addWorksheet('Resumen por categoría');
        ws2.columns = [
            { header: 'Categoría', key: 'category', width: 30 },
            { header: 'Tipo', key: 'type', width: 14 },
            { header: 'Total', key: 'total', width: 16 },
        ];
        const headerRow2 = ws2.getRow(1);
        headerRow2.font = headerFont;
        for (const c of data.categorySummary) {
            if (c.total === 0)
                continue;
            const row = ws2.addRow({
                category: c.category,
                type: c.type === 'INCOME' ? 'Ingreso' : 'Egreso',
                total: c.total,
            });
            row.getCell('total').numFmt = arsFormat;
        }
        ws2.columns.forEach((col) => {
            let max = (col.header || '').length;
            ws2.getColumn(col.key).values.slice(1).forEach((v) => {
                const len = String(v ?? '').length;
                if (len > max)
                    max = len;
            });
            col.width = Math.min(max + 4, 50);
        });
        const buffer = await workbook.xlsx.writeBuffer();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="contabilidad.xlsx"',
        });
        res.send(Buffer.from(buffer));
    }
};
exports.AccountingController = AccountingController;
__decorate([
    (0, common_1.Get)('accounts/treasury'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "getTreasuryAccounts", null);
__decorate([
    (0, common_1.Get)('categories'),
    __param(0, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "listCategories", null);
__decorate([
    (0, common_1.Post)('categories'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_category_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Patch)('categories/:id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_category_dto_1.UpdateCategoryDto]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "updateCategory", null);
__decorate([
    (0, common_1.Delete)('categories/:id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "deleteCategory", null);
__decorate([
    (0, common_1.Get)('movements'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_movements_dto_1.QueryMovementsDto]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "listMovements", null);
__decorate([
    (0, common_1.Post)('movements'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_movement_dto_1.CreateMovementDto]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "createMovement", null);
__decorate([
    (0, common_1.Patch)('movements/:id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_movement_dto_1.UpdateMovementDto]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "updateMovement", null);
__decorate([
    (0, common_1.Delete)('movements/:id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "deleteMovement", null);
__decorate([
    (0, common_1.Get)('manual-movements'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_movements_dto_1.QueryManualMovementsDto]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "listManualMovements", null);
__decorate([
    (0, common_1.Post)('manual-movements/:id/category'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, assign_category_dto_1.AssignCategoryDto]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "assignCategory", null);
__decorate([
    (0, common_1.Delete)('manual-movements/:id/category'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "removeCategory", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AccountingController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('export'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AccountingController.prototype, "exportExcel", null);
exports.AccountingController = AccountingController = __decorate([
    (0, common_1.Controller)('accounting'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.TESORERIA, client_1.ModuleAccess.READ),
    __metadata("design:paramtypes", [accounting_service_1.AccountingService,
        ledger_accounts_service_1.LedgerAccountsService])
], AccountingController);
