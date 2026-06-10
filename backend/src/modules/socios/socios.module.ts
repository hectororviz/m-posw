import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { SociosController } from './socios.controller';
import { SociosService } from './socios.service';
import { SociosQrController } from './socios-qr.controller';
import { SociosQrService } from './socios-qr.service';
import { SociosBeneficiosController, SociosCanjesController } from './socios-beneficios.controller';
import { SociosBeneficiosService } from './socios-beneficios.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    SociosBeneficiosController,
    SociosCanjesController,
    SociosQrController,
    SociosController,
  ],
  providers: [SociosService, SociosQrService, SociosBeneficiosService, PrismaService],
  exports: [SociosService, SociosBeneficiosService],
})
export class SociosModule {}
