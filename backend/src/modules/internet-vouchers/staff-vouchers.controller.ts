import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { CreateStaffVoucherDto } from './dto/create-staff-voucher.dto';
import { InternetVouchersService } from './internet-vouchers.service';

@Controller('internet/staff-vouchers')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.INTERNET, ModuleAccess.READ)
export class StaffVouchersController {
  constructor(private readonly vouchersService: InternetVouchersService) {}

  @Get()
  list() {
    return this.vouchersService.listStaffVouchers();
  }

  @Post()
  @RequireModule(ModuleKey.INTERNET, ModuleAccess.FULL)
  create(@Req() req: any, @Body() dto: CreateStaffVoucherDto) {
    return this.vouchersService.createStaffVoucher(req.user?.sub || req.user?.id, dto);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.INTERNET, ModuleAccess.FULL)
  deactivate(@Req() req: any, @Param('id') id: string) {
    return this.vouchersService.deactivateStaffVoucher(id, req.user?.sub || req.user?.id);
  }
}
