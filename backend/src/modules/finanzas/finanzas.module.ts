import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FinanzasController } from './finanzas.controller';
import { FinanzasService } from './finanzas.service';

@Module({
  controllers: [FinanzasController],
  providers: [PrismaService, FinanzasService],
  exports: [FinanzasService],
})
export class FinanzasModule {}
