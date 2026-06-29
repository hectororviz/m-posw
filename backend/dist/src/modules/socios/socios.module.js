"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SociosModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../common/prisma.service");
const treasury_module_1 = require("../treasury/treasury.module");
const socios_controller_1 = require("./socios.controller");
const socios_service_1 = require("./socios.service");
const socios_qr_controller_1 = require("./socios-qr.controller");
const socios_qr_service_1 = require("./socios-qr.service");
const socios_beneficios_controller_1 = require("./socios-beneficios.controller");
const socios_beneficios_service_1 = require("./socios-beneficios.service");
let SociosModule = class SociosModule {
};
exports.SociosModule = SociosModule;
exports.SociosModule = SociosModule = __decorate([
    (0, common_1.Module)({
        imports: [schedule_1.ScheduleModule.forRoot(), treasury_module_1.TreasuryModule],
        controllers: [
            socios_beneficios_controller_1.SociosBeneficiosController,
            socios_beneficios_controller_1.SociosCanjesController,
            socios_qr_controller_1.SociosQrController,
            socios_controller_1.SociosController,
        ],
        providers: [socios_service_1.SociosService, socios_qr_service_1.SociosQrService, socios_beneficios_service_1.SociosBeneficiosService, prisma_service_1.PrismaService],
        exports: [socios_service_1.SociosService, socios_beneficios_service_1.SociosBeneficiosService],
    })
], SociosModule);
