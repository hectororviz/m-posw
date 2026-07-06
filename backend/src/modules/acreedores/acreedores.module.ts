import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TreasuryModule } from '../treasury/treasury.module';
import { UsersModule } from '../users/users.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AcreedoresController } from './acreedores.controller';
import { AcreedoresService } from './acreedores.service';

@Module({
  imports: [TreasuryModule, UsersModule, WhatsappModule],
  controllers: [AcreedoresController],
  providers: [AcreedoresService, PrismaService],
  exports: [AcreedoresService],
})
export class AcreedoresModule {}
