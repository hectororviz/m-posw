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
exports.JournalEntriesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const roles_guard_1 = require("../common/roles.guard");
const journal_entry_dto_1 = require("./dto/journal-entry.dto");
const journal_entries_service_1 = require("./journal-entries.service");
let JournalEntriesController = class JournalEntriesController {
    constructor(service) {
        this.service = service;
    }
    list(query) {
        return this.service.list(query);
    }
    getById(id) {
        return this.service.getById(id);
    }
    create(req, dto) {
        return this.service.create(req.user?.sub || req.user?.id, dto);
    }
    createSimpleIncome(req, dto) {
        return this.service.createSimpleIncome(req.user?.sub || req.user?.id, dto);
    }
    createSimpleExpense(req, dto) {
        return this.service.createSimpleExpense(req.user?.sub || req.user?.id, dto);
    }
    update(req, id, dto) {
        return this.service.update(req.user?.sub || req.user?.id, id, dto);
    }
    delete(id) {
        return this.service.delete(id);
    }
    post(id) {
        return this.service.post(id);
    }
    void(req, id, dto) {
        return this.service.void(id, req.user?.sub || req.user?.id, dto);
    }
};
exports.JournalEntriesController = JournalEntriesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [journal_entry_dto_1.ListJournalEntriesDto]),
    __metadata("design:returntype", void 0)
], JournalEntriesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], JournalEntriesController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, journal_entry_dto_1.CreateJournalEntryDto]),
    __metadata("design:returntype", void 0)
], JournalEntriesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('income'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, journal_entry_dto_1.SimpleEntryDto]),
    __metadata("design:returntype", void 0)
], JournalEntriesController.prototype, "createSimpleIncome", null);
__decorate([
    (0, common_1.Post)('expense'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, journal_entry_dto_1.SimpleEntryDto]),
    __metadata("design:returntype", void 0)
], JournalEntriesController.prototype, "createSimpleExpense", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, journal_entry_dto_1.UpdateJournalEntryDto]),
    __metadata("design:returntype", void 0)
], JournalEntriesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], JournalEntriesController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':id/post'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], JournalEntriesController.prototype, "post", null);
__decorate([
    (0, common_1.Post)(':id/void'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, journal_entry_dto_1.VoidJournalEntryDto]),
    __metadata("design:returntype", void 0)
], JournalEntriesController.prototype, "void", null);
exports.JournalEntriesController = JournalEntriesController = __decorate([
    (0, common_1.Controller)('treasury/entries'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:paramtypes", [journal_entries_service_1.JournalEntriesService])
], JournalEntriesController);
