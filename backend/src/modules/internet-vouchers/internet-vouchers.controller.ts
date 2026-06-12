import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { GenerateVoucherDto } from './dto/generate-voucher.dto';
import { InternetVouchersService } from './internet-vouchers.service';

@Controller('internet/vouchers')
@UseGuards(JwtAuthGuard)
export class InternetVouchersController {
  constructor(private readonly vouchersService: InternetVouchersService) {}

  @Post('generate')
  generate(@Body() dto: GenerateVoucherDto) {
    return this.vouchersService.generateVoucher(dto.planId, dto.saleId);
  }

  @Get(':pin')
  getVoucher(@Param('pin') pin: string) {
    return this.vouchersService.getVoucher(pin);
  }

  @Delete(':pin')
  deactivate(@Param('pin') pin: string) {
    return this.vouchersService.deactivateVoucher(pin);
  }
}
