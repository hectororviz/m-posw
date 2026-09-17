import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreatePublicCheckoutDto } from './dto/create-public-checkout.dto';
import { InternetPublicService } from './internet-public.service';

@Controller('internet/public')
export class InternetPublicController {
  constructor(private readonly publicService: InternetPublicService) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  getStatus() {
    return this.publicService.getStatus();
  }

  @Get('plans')
  @Header('Cache-Control', 'no-store')
  getPlans() {
    return this.publicService.listPlans();
  }

  @Post('checkout')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(201)
  createCheckout(@Body() dto: CreatePublicCheckoutDto) {
    return this.publicService.createCheckout(dto.planId, dto.returnBaseUrl);
  }

  @Get('orders/:id')
  @Header('Cache-Control', 'no-store')
  getOrder(@Param('id') id: string) {
    return this.publicService.getOrder(id);
  }
}
