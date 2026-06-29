"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternetVouchersModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const internet_plans_controller_1 = require("./internet-plans.controller");
const internet_plans_service_1 = require("./internet-plans.service");
const internet_vouchers_controller_1 = require("./internet-vouchers.controller");
const internet_vouchers_service_1 = require("./internet-vouchers.service");
let InternetVouchersModule = class InternetVouchersModule {
};
exports.InternetVouchersModule = InternetVouchersModule;
exports.InternetVouchersModule = InternetVouchersModule = __decorate([
    (0, common_1.Module)({
        controllers: [internet_plans_controller_1.InternetPlansController, internet_vouchers_controller_1.InternetVouchersController],
        providers: [internet_plans_service_1.InternetPlansService, internet_vouchers_service_1.InternetVouchersService, prisma_service_1.PrismaService],
        exports: [internet_vouchers_service_1.InternetVouchersService, internet_plans_service_1.InternetPlansService],
    })
], InternetVouchersModule);
