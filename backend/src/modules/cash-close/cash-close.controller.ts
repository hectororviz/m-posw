import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ClosePeriodDto } from './dto/close-period.dto';
import { CashCloseService } from './cash-close.service';

@Controller('cash-close')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashCloseController {
  constructor(private readonly cashCloseService: CashCloseService) {}

  @Get('current-period')
  @Roles(Role.ADMIN, Role.USER)
  getCurrentPeriod() {
    return this.cashCloseService.getCurrentPeriod();
  }

  @Post('close')
  @Roles(Role.ADMIN, Role.USER)
  closePeriod(@Req() req: { user: { sub: string } }, @Body() dto: ClosePeriodDto) {
    return this.cashCloseService.closePeriod(req.user.sub, dto.note);
  }

  @Get('list')
  @Roles(Role.ADMIN, Role.USER)
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.cashCloseService.list(Number(limit) || 20, Number(offset) || 0);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER)
  getById(@Param('id') id: string) {
    return this.cashCloseService.getById(id);
  }
}
