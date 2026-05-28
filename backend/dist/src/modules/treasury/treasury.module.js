"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreasuryModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const ledger_accounts_controller_1 = require("./ledger-accounts.controller");
const ledger_accounts_service_1 = require("./ledger-accounts.service");
const journal_entries_controller_1 = require("./journal-entries.controller");
const journal_entries_service_1 = require("./journal-entries.service");
const reports_controller_1 = require("./reports.controller");
const reports_service_1 = require("./reports.service");
let TreasuryModule = class TreasuryModule {
};
exports.TreasuryModule = TreasuryModule;
exports.TreasuryModule = TreasuryModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            ledger_accounts_controller_1.LedgerAccountsController,
            journal_entries_controller_1.JournalEntriesController,
            reports_controller_1.TreasuryReportsController,
        ],
        providers: [
            prisma_service_1.PrismaService,
            ledger_accounts_service_1.LedgerAccountsService,
            journal_entries_service_1.JournalEntriesService,
            reports_service_1.TreasuryReportsService,
        ],
    })
], TreasuryModule);
