"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashMovementsModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const cash_movements_controller_1 = require("./cash-movements.controller");
const cash_movements_service_1 = require("./cash-movements.service");
let CashMovementsModule = class CashMovementsModule {
};
exports.CashMovementsModule = CashMovementsModule;
exports.CashMovementsModule = CashMovementsModule = __decorate([
    (0, common_1.Module)({
        controllers: [cash_movements_controller_1.CashMovementsController],
        providers: [cash_movements_service_1.CashMovementsService, prisma_service_1.PrismaService],
    })
], CashMovementsModule);
