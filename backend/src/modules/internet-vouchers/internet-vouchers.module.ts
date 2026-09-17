import { Module } from '@nestjs/common';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { InternetPlansController } from './internet-plans.controller';
import { InternetPlansService } from './internet-plans.service';
import { InternetPublicController } from './internet-public.controller';
import { InternetPublicService } from './internet-public.service';
import { InternetVouchersController } from './internet-vouchers.controller';
import { InternetVouchersService } from './internet-vouchers.service';
import { StaffVouchersController } from './staff-vouchers.controller';

@Module({
  controllers: [InternetPublicController, InternetPlansController, InternetVouchersController, StaffVouchersController],
  imports: [UsersModule],
    providers: [InternetPlansService, InternetPublicService, InternetVouchersService, MercadoPagoConfigService, PrismaService],
  exports: [InternetVouchersService, InternetPlansService, InternetPublicService],
})
export class InternetVouchersModule {}
