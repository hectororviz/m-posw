import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { FinanzasModule } from '../finanzas/finanzas.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AcreedoresController } from './acreedores.controller';
import { AcreedoresService } from './acreedores.service';
import { AcreedoresInteresesService } from './acreedores-intereses.service';

@Module({
  imports: [ScheduleModule.forRoot(), FinanzasModule, NotificacionesModule],
  controllers: [AcreedoresController],
  providers: [AcreedoresService, AcreedoresInteresesService, PrismaService],
  exports: [AcreedoresService, AcreedoresInteresesService],
})
export class AcreedoresModule {}
