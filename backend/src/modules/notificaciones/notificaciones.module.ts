import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { WhatsAppCloudProvider } from './providers/whatsapp-cloud.provider';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppWebhookController } from './webhook.controller';

@Module({
  imports: [UsersModule],
  controllers: [NotificacionesController, WhatsAppWebhookController],
  providers: [NotificacionesService, PrismaService, WhatsAppCloudProvider, WhatsAppMediaService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
