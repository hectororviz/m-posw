import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TreasuryModule } from '../treasury/treasury.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AcreedoresController } from './acreedores.controller';
import { AcreedoresService } from './acreedores.service';

@Module({
  imports: [TreasuryModule, NotificacionesModule],
  controllers: [AcreedoresController],
  providers: [AcreedoresService, PrismaService],
  exports: [AcreedoresService],
})
export class AcreedoresModule {}
