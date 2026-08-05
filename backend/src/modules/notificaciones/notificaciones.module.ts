import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { WhatsAppCloudProvider } from './providers/whatsapp-cloud.provider';
import { WhatsAppWebhookController } from './webhook.controller';

@Module({
  controllers: [NotificacionesController, WhatsAppWebhookController],
  providers: [NotificacionesService, PrismaService, WhatsAppCloudProvider],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
