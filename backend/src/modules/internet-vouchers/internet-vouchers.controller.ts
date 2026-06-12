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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [active, todayCount, total] = await Promise.all([
      this.prisma.saleVoucher.count({ where: { active: true } }),
      this.prisma.saleVoucher.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      this.prisma.saleVoucher.count(),
    ]);

    return {
      active_vouchers: active,
      generated_today: todayCount,
      total_vouchers: total,
    };
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

  @Delete('id/:id')
  async deactivateById(@Param('id') id: string) {
    const voucher = await this.prisma.saleVoucher.findUnique({ where: { id } });
    if (!voucher) return { error: 'Voucher no encontrado' };
    return this.vouchersService.deactivateVoucher(voucher.pin);
  }

  @Delete(':pin')
  deactivate(@Param('pin') pin: string) {
    return this.vouchersService.deactivateVoucher(pin);
  }
}
