import { Module, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { InternetVouchersModule } from '../internet-vouchers/internet-vouchers.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [forwardRef(() => SalesModule), InternetVouchersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService, MercadoPagoConfigService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
