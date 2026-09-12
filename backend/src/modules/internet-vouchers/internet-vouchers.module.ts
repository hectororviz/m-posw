import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { InternetPlansController } from './internet-plans.controller';
import { InternetPlansService } from './internet-plans.service';
import { InternetVouchersController } from './internet-vouchers.controller';
import { InternetVouchersService } from './internet-vouchers.service';
import { StaffVouchersController } from './staff-vouchers.controller';

@Module({
  controllers: [InternetPlansController, InternetVouchersController, StaffVouchersController],
  imports: [UsersModule],
    providers: [InternetPlansService, InternetVouchersService, PrismaService],
  exports: [InternetVouchersService, InternetPlansService],
})
export class InternetVouchersModule {}
