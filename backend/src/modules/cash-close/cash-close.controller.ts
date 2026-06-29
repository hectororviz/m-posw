import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CashCloseService } from './cash-close.service';
import { ClosePeriodDto } from './dto/close-period.dto';
import { ListCashClosesDto } from './dto/list-cash-closes.dto';

@Controller('cash-close')
@UseGuards(JwtAuthGuard)
export class CashCloseController {
  constructor(private readonly cashCloseService: CashCloseService) {}

  @Get('current-period')
  getCurrentPeriod() {
    return this.cashCloseService.getCurrentPeriod();
  }

  @Post('close')
  closeCurrentPeriod(
    @Req() req: { user: { sub: string } },
    @Body() dto: ClosePeriodDto,
  ) {
    return this.cashCloseService.closeCurrentPeriod(req.user.sub, dto.note);
  }

  @Get('list')
  list(@Query() query: ListCashClosesDto) {
    return this.cashCloseService.list(query.limit, query.offset);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.cashCloseService.getById(id);
  }
}
