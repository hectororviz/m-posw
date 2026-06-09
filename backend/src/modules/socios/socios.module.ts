import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { SociosController } from './socios.controller';
import { SociosService } from './socios.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SociosController],
  providers: [SociosService, PrismaService],
  exports: [SociosService],
})
export class SociosModule {}
