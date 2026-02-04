import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RequireCashOpenGuard } from '../common/require-cash-open.guard';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { MercadoPagoWebhookController } from './webhooks/mercadopago-webhook.controller';
import { MercadoPagoInstoreService } from './services/mercadopago-instore.service';
import { MercadoPagoQueryService } from './services/mercadopago-query.service';
import { MercadoPagoWebhookProcessorService } from './services/mercadopago-webhook-processor.service';
import { SalesGateway } from './websockets/sales.gateway';

@Module({
  controllers: [SalesController, MercadoPagoWebhookController],
  providers: [
    SalesService,
    PrismaService,
    MercadoPagoInstoreService,
    MercadoPagoQueryService,
    MercadoPagoWebhookProcessorService,
    SalesGateway,
    RequireCashOpenGuard,
  ],
})
export class SalesModule {}
