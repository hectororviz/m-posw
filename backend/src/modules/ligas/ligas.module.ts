import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LigasController } from './ligas.controller';
import { LigasService } from './ligas.service';

@Module({
  controllers: [LigasController],
  providers: [LigasService, PrismaService],
})
export class LigasModule {}
