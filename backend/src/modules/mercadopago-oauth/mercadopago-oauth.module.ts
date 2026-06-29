import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from '../users/users.module';
import { PrismaService } from '../common/prisma.service';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { MercadoPagoOauthController } from './mercadopago-oauth.controller';
import { MercadoPagoOauthService } from './mercadopago-oauth.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, ScheduleModule.forRoot(), UsersModule],
  controllers: [MercadoPagoOauthController],
  providers: [MercadoPagoOauthService, MercadoPagoConfigService, PrismaService],
  exports: [MercadoPagoConfigService],
})
export class MercadoPagoOauthModule {}
