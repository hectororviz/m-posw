import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { SociosController } from './socios.controller';
import { SociosService } from './socios.service';
import { SociosQrController } from './socios-qr.controller';
import { SociosQrService } from './socios-qr.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SociosController, SociosQrController],
  providers: [SociosService, SociosQrService, PrismaService],
  exports: [SociosService],
})
export class SociosModule {}
