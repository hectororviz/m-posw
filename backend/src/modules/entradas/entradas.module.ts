import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { SalesModule } from '../sales/sales.module';
import { SociosModule } from '../socios/socios.module';
import { MercadoPagoOauthModule } from '../mercadopago-oauth/mercadopago-oauth.module';
import { EntradasAdminController } from './entradas-admin.controller';
import { EntradasDeviceController } from './entradas-device.controller';
import { EntradasSharedController } from './entradas-shared.controller';
import { EntradasAdminService } from './entradas-admin.service';
import { EntradasSalesService } from './entradas-sales.service';
import { EntradasDeviceGuard } from './device.guard';
import { EntradasFlexibleGuard } from './entradas-flexible.guard';

@Module({
  controllers: [EntradasSharedController, EntradasAdminController, EntradasDeviceController],
  imports: [UsersModule, SalesModule, SociosModule, MercadoPagoOauthModule],
  providers: [EntradasAdminService, EntradasSalesService, EntradasDeviceGuard, EntradasFlexibleGuard, PrismaService],
  exports: [EntradasAdminService, EntradasSalesService],
})
export class EntradasModule {}
