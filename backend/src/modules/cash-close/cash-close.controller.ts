import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { CashCloseService } from './cash-close.service';
import { ClosePeriodDto } from './dto/close-period.dto';
import { ListCashClosesDto } from './dto/list-cash-closes.dto';

@Controller('cash-close')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class CashCloseController {
  constructor(private readonly cashCloseService: CashCloseService) {}

  @Get('current-period')
  @RequireModule(ModuleKey.VENTAS, ModuleAccess.READ)
  getCurrentPeriod() {
    return this.cashCloseService.getCurrentPeriod();
  }

  @Post('close')
  @RequireModule(ModuleKey.POS, ModuleAccess.FULL)
  closeCurrentPeriod(
    @Req() req: { user: { sub: string } },
    @Body() dto: ClosePeriodDto,
  ) {
    return this.cashCloseService.closeCurrentPeriod(req.user.sub, dto.note);
  }

  @Get('list')
  @RequireModule(ModuleKey.VENTAS, ModuleAccess.READ)
  list(@Query() query: ListCashClosesDto) {
    return this.cashCloseService.list(query.limit, query.offset);
  }

  @Get(':id')
  @RequireModule(ModuleKey.VENTAS, ModuleAccess.READ)
  getById(@Param('id') id: string) {
    return this.cashCloseService.getById(id);
  }
}
