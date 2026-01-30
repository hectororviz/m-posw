import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { MercadoPagoWebhookController } from './webhooks/mercadopago-webhook.controller';
import { MercadoPagoInstoreService } from './services/mercadopago-instore.service';

@Module({
  controllers: [SalesController, MercadoPagoWebhookController],
  providers: [SalesService, PrismaService, MercadoPagoInstoreService],
})
export class SalesModule {}
