import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { InternetVouchersModule } from '../internet-vouchers/internet-vouchers.module';
import { AcreedoresModule } from '../acreedores/acreedores.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { MercadoPagoWebhookController } from './webhooks/mercadopago-webhook.controller';
import { MercadoPagoInstoreService } from './services/mercadopago-instore.service';
import { MercadoPagoQueryService } from './services/mercadopago-query.service';
import { MercadoPagoWebhookProcessorService } from './services/mercadopago-webhook-processor.service';
import { RefundsService } from './services/refunds.service';
import { WebhookRetriesService } from './services/webhook-retries.service';
import { WebhookRetriesController } from './webhooks/webhook-retries.controller';
import { SalesGateway } from './websockets/sales.gateway';

@Module({
  imports: [ScheduleModule.forRoot(), InternetVouchersModule, AcreedoresModule],
  controllers: [SalesController, MercadoPagoWebhookController, WebhookRetriesController],
  providers: [
    SalesService,
    PrismaService,
    MercadoPagoConfigService,
    MercadoPagoInstoreService,
    MercadoPagoQueryService,
    MercadoPagoWebhookProcessorService,
    RefundsService,
    WebhookRetriesService,
    SalesGateway,
  ],
  exports: [SalesService, MercadoPagoInstoreService, MercadoPagoQueryService, RefundsService],
})
export class SalesModule {}
