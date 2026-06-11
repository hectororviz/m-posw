import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { TreasuryModule } from '../treasury/treasury.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { MercadoPagoWebhookController } from './webhooks/mercadopago-webhook.controller';
import { MercadoPagoInstoreService } from './services/mercadopago-instore.service';
import { MercadoPagoQueryService } from './services/mercadopago-query.service';
import { MercadoPagoWebhookProcessorService } from './services/mercadopago-webhook-processor.service';
import { SalesGateway } from './websockets/sales.gateway';

@Module({
  imports: [TreasuryModule],
  controllers: [SalesController, MercadoPagoWebhookController],
  providers: [
    SalesService,
    PrismaService,
    MercadoPagoConfigService,
    MercadoPagoInstoreService,
    MercadoPagoQueryService,
    MercadoPagoWebhookProcessorService,
    SalesGateway,
  ],
  exports: [SalesService],
})
export class SalesModule {}
