import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreatePublicCheckoutDto } from './dto/create-public-checkout.dto';
import { InternetPublicService } from './internet-public.service';

@Controller('internet/public')
export class InternetPublicController {
  constructor(private readonly publicService: InternetPublicService) {}

  @Get('status')
  getStatus() {
    return this.publicService.getStatus();
  }

  @Get('plans')
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
  getOrder(@Param('id') id: string) {
    return this.publicService.getOrder(id);
  }
}
