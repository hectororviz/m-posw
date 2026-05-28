import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { MercadoPagoOauthService } from './mercadopago-oauth.service';

@Controller('mp-oauth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class MercadoPagoOauthController {
  constructor(private readonly mpOauthService: MercadoPagoOauthService) {}

  @Get('connect')
  connect() {
    return this.mpOauthService.generateConnectUrl();
  }

  @Post('token')
  token(@Body() body: { code: string }) {
    return this.mpOauthService.exchangeToken(body.code);
  }

  @Get('status')
  status() {
    return this.mpOauthService.getStatus();
  }

  @Delete('disconnect')
  disconnect() {
    return this.mpOauthService.disconnect();
  }

  @Get('detect-stores')
  detectStores() {
    return this.mpOauthService.detectStores();
  }

  @Post('select-store')
  selectStore(@Body() body: { storeId: string; posId: string }) {
    return this.mpOauthService.selectStore(body.storeId, body.posId);
  }

  @Post('setup-pos')
  setupPos(@Body() body: { storeName: string; posName: string; streetName: string; streetNumber: string; cityName: string; stateName: string; zipCode: string }) {
    return this.mpOauthService.setupPos(
      body.storeName,
      body.posName,
      body.streetName,
      body.streetNumber,
      body.cityName,
      body.stateName,
      body.zipCode,
    );
  }

  @Get('qr')
  getQr() {
    return this.mpOauthService.getQr();
  }

  @Delete('setup-pos')
  deletePosSetup() {
    return this.mpOauthService.deletePosSetup();
  }
}
