import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationQueueService } from './notification-queue.service';

@Module({
  controllers: [WhatsappController],
  imports: [UsersModule],
  providers: [WhatsappService, NotificationGateway, NotificationQueueService, PrismaService],
  exports: [WhatsappService, NotificationQueueService, NotificationGateway],
})
export class WhatsappModule {}
