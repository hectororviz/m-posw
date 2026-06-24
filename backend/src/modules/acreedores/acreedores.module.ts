import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TreasuryModule } from '../treasury/treasury.module';
import { UsersModule } from '../users/users.module';
import { AcreedoresController } from './acreedores.controller';
import { AcreedoresService } from './acreedores.service';

@Module({
  imports: [TreasuryModule, UsersModule],
  controllers: [AcreedoresController],
  providers: [AcreedoresService, PrismaService],
  exports: [AcreedoresService],
})
export class AcreedoresModule {}
