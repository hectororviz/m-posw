"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const mp_config_service_1 = require("../common/mp-config.service");
const treasury_module_1 = require("../treasury/treasury.module");
const internet_vouchers_module_1 = require("../internet-vouchers/internet-vouchers.module");
const payments_controller_1 = require("./payments.controller");
const payments_service_1 = require("./payments.service");
const sales_module_1 = require("../sales/sales.module");
let PaymentsModule = class PaymentsModule {
};
exports.PaymentsModule = PaymentsModule;
exports.PaymentsModule = PaymentsModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => sales_module_1.SalesModule), treasury_module_1.TreasuryModule, internet_vouchers_module_1.InternetVouchersModule],
        controllers: [payments_controller_1.PaymentsController],
        providers: [payments_service_1.PaymentsService, prisma_service_1.PrismaService, mp_config_service_1.MercadoPagoConfigService],
        exports: [payments_service_1.PaymentsService],
    })
], PaymentsModule);
