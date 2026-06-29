import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { LigasController } from './ligas.controller';
import { LigasService } from './ligas.service';

@Module({
  controllers: [LigasController],
  imports: [UsersModule],
    providers: [LigasService, PrismaService],
})
export class LigasModule {}
