import { Body, Controller, Delete, Get, HttpException, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { SelectStoreDto } from './dto/select-store.dto';
import { SetupPosDto } from './dto/setup-pos.dto';
import { TokenExchangeDto } from './dto/token-exchange.dto';
import { MercadoPagoOauthService } from './mercadopago-oauth.service';

@Controller('mp-oauth')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
export class MercadoPagoOauthController {
  constructor(private readonly mpOauthService: MercadoPagoOauthService) {}

  @Get('connect')
  connect() {
    return this.mpOauthService.generateConnectUrl();
  }

  @Post('token')
  token(@Body() body: TokenExchangeDto) {
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
  selectStore(@Body() body: SelectStoreDto) {
    return this.mpOauthService.selectStore(body.storeId, body.posId);
  }

  @Post('setup-pos')
  setupPos(@Body() body: SetupPosDto) {
    return this.mpOauthService.setupPos(
      body.storeName,
      body.posName,
      body.streetName,
      body.streetNumber,
      body.cityName,
      body.stateName,
      body.zipCode,
      body.latitude,
      body.longitude,
    );
  }

  @Get('qr')
  getQr() {
    return this.mpOauthService.getQr();
  }

  @Get('city-by-zip')
  async cityByZip(@Query('zip') zip?: string) {
    if (!zip) {
      throw new HttpException('Parametro "zip" requerido', HttpStatus.BAD_REQUEST);
    }
    const result = await this.mpOauthService.cityByZip(zip);
    if (!result) {
      throw new HttpException('Ciudad no encontrada para ese codigo postal', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('cities')
  async cities(@Query('stateName') stateName?: string, @Query('q') q?: string) {
    if (q) {
      return this.mpOauthService.searchCities(q);
    }
    return this.mpOauthService.getCities(stateName);
  }

  @Get('cities-list')
  async citiesList() {
    return this.mpOauthService.getMpCityList();
  }

  @Get('city-zipcodes')
  async cityZipcodes(@Query('city') city?: string) {
    if (!city) {
      throw new HttpException('Parametro "city" requerido', HttpStatus.BAD_REQUEST);
    }
    return this.mpOauthService.getCityZipcodes(city);
  }

  @Delete('setup-pos')
  deletePosSetup() {
    return this.mpOauthService.deletePosSetup();
  }
}
