import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { FinanzasModule } from '../finanzas/finanzas.module';
import { MpAuditoriaController } from './mp-auditoria.controller';
import { MpAuditoriaService } from './mp-auditoria.service';

@Module({
  imports: [ScheduleModule.forRoot(), FinanzasModule],
  controllers: [MpAuditoriaController],
  providers: [MpAuditoriaService, PrismaService, MercadoPagoConfigService],
  exports: [MpAuditoriaService],
})
export class MpAuditoriaModule {}
