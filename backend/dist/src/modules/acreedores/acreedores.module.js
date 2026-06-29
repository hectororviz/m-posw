"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcreedoresModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const treasury_module_1 = require("../treasury/treasury.module");
const users_module_1 = require("../users/users.module");
const acreedores_controller_1 = require("./acreedores.controller");
const acreedores_service_1 = require("./acreedores.service");
let AcreedoresModule = class AcreedoresModule {
};
exports.AcreedoresModule = AcreedoresModule;
exports.AcreedoresModule = AcreedoresModule = __decorate([
    (0, common_1.Module)({
        imports: [treasury_module_1.TreasuryModule, users_module_1.UsersModule],
        controllers: [acreedores_controller_1.AcreedoresController],
        providers: [acreedores_service_1.AcreedoresService, prisma_service_1.PrismaService],
        exports: [acreedores_service_1.AcreedoresService],
    })
], AcreedoresModule);
