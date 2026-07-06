import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  controllers: [WhatsappController],
  imports: [UsersModule],
  providers: [WhatsappService, PrismaService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
