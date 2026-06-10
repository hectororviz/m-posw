import { Module, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [forwardRef(() => SalesModule)],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService, MercadoPagoConfigService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
