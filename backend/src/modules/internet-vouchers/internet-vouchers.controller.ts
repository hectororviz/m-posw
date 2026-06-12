import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../common/prisma.service';
import { GenerateVoucherDto } from './dto/generate-voucher.dto';
import { InternetVouchersService } from './internet-vouchers.service';

@Controller('internet/vouchers')
@UseGuards(JwtAuthGuard)
export class InternetVouchersController {
  constructor(
    private readonly vouchersService: InternetVouchersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  async getStats() {
    try {
      const data = await this.vouchersService.httpGet(`${this.vouchersService.apiUrl}/stats`);
      return JSON.parse(data);
    } catch {
      return { active_vouchers: 0, generated_today: 0, used_today: 0, total_vouchers: 0 };
    }
  }

  @Get('list')
  async listVouchers(@Query('saleId') saleId?: string) {
    const vouchers = await this.prisma.saleVoucher.findMany({
      where: saleId ? { saleId } : undefined,
      include: {
        plan: true,
        sale: { select: { orderNumber: true, createdAt: true, paidAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return vouchers.map((v) => ({
      id: v.id,
      saleOrderNumber: v.sale.orderNumber,
      planName: v.plan.name,
      planDuration: v.plan.duration,
      active: v.active,
      createdAt: v.createdAt,
      saleCreatedAt: v.sale.createdAt,
      salePaidAt: v.sale.paidAt,
    }));
  }

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
