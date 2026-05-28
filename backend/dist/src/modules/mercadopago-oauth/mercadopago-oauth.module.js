"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoOauthModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../common/prisma.service");
const mp_config_service_1 = require("../common/mp-config.service");
const mercadopago_oauth_controller_1 = require("./mercadopago-oauth.controller");
const mercadopago_oauth_service_1 = require("./mercadopago-oauth.service");
const auth_module_1 = require("../auth/auth.module");
let MercadoPagoOauthModule = class MercadoPagoOauthModule {
};
exports.MercadoPagoOauthModule = MercadoPagoOauthModule;
exports.MercadoPagoOauthModule = MercadoPagoOauthModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, schedule_1.ScheduleModule.forRoot()],
        controllers: [mercadopago_oauth_controller_1.MercadoPagoOauthController],
        providers: [mercadopago_oauth_service_1.MercadoPagoOauthService, mp_config_service_1.MercadoPagoConfigService, prisma_service_1.PrismaService],
        exports: [mp_config_service_1.MercadoPagoConfigService],
    })
], MercadoPagoOauthModule);
