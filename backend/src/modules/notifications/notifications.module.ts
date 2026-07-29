import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsWebhookController } from './notifications-webhook.controller';
import { NotificationsService } from './notifications.service';
import { NotificationGateway } from './notification.gateway';

@Module({
  controllers: [NotificationsController, NotificationsWebhookController],
  imports: [UsersModule],
  providers: [NotificationsService, NotificationGateway, PrismaService],
  exports: [NotificationsService, NotificationGateway],
})
export class NotificationsModule {}
