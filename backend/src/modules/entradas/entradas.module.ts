import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { SalesModule } from '../sales/sales.module';
import { SociosModule } from '../socios/socios.module';
import { MercadoPagoOauthModule } from '../mercadopago-oauth/mercadopago-oauth.module';
import { EntradasAdminController } from './entradas-admin.controller';
import { EntradasDeviceController } from './entradas-device.controller';
import { DeviceLookupController } from './device-lookup.controller';
import { DeviceMeController } from './device-me.controller';
import { DispositivosController } from './dispositivos.controller';
import { PosDeviceController } from './pos-device.controller';
import { EntradasSharedController } from './entradas-shared.controller';
import { EntradasAdminService } from './entradas-admin.service';
import { EntradasBeneficiosService } from './entradas-beneficios.service';
import { EntradasSalesService } from './entradas-sales.service';
import { PosDeviceService } from './pos-device.service';
import { EntradasDeviceGuard } from './device.guard';
import { EntradasFlexibleGuard } from './entradas-flexible.guard';

@Module({
  controllers: [EntradasSharedController, EntradasAdminController, EntradasDeviceController, DeviceLookupController, DeviceMeController, DispositivosController, PosDeviceController],
  imports: [UsersModule, SalesModule, SociosModule, MercadoPagoOauthModule],
  providers: [EntradasAdminService, EntradasBeneficiosService, EntradasSalesService, PosDeviceService, EntradasDeviceGuard, EntradasFlexibleGuard, PrismaService],
  exports: [EntradasAdminService, EntradasBeneficiosService, EntradasSalesService],
})
export class EntradasModule {}
