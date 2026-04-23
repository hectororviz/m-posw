"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const sales_controller_1 = require("./sales.controller");
const sales_service_1 = require("./sales.service");
const mercadopago_webhook_controller_1 = require("./webhooks/mercadopago-webhook.controller");
const mercadopago_instore_service_1 = require("./services/mercadopago-instore.service");
const mercadopago_query_service_1 = require("./services/mercadopago-query.service");
const mercadopago_webhook_processor_service_1 = require("./services/mercadopago-webhook-processor.service");
const sales_gateway_1 = require("./websockets/sales.gateway");
let SalesModule = class SalesModule {
};
exports.SalesModule = SalesModule;
exports.SalesModule = SalesModule = __decorate([
    (0, common_1.Module)({
        controllers: [sales_controller_1.SalesController, mercadopago_webhook_controller_1.MercadoPagoWebhookController],
        providers: [
            sales_service_1.SalesService,
            prisma_service_1.PrismaService,
            mercadopago_instore_service_1.MercadoPagoInstoreService,
            mercadopago_query_service_1.MercadoPagoQueryService,
            mercadopago_webhook_processor_service_1.MercadoPagoWebhookProcessorService,
            sales_gateway_1.SalesGateway,
        ],
    })
], SalesModule);
