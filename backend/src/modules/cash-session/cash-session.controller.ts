import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CashSessionService } from './cash-session.service';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

@Controller('cash-session')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashSessionController {
  constructor(private readonly cashSessionService: CashSessionService) {}

  @Get('current')
  @Roles(Role.ADMIN, Role.USER)
  getCurrent() {
    return this.cashSessionService.getCurrent();
  }

  @Post('open')
  @Roles(Role.ADMIN, Role.USER)
  open(@Req() req: { user: { sub: string } }, @Body() dto: OpenCashSessionDto) {
    return this.cashSessionService.open(req.user.sub, dto);
  }

  @Post('close')
  @Roles(Role.ADMIN, Role.USER)
  close(@Req() req: { user: { sub: string } }, @Body() dto: CloseCashSessionDto) {
    return this.cashSessionService.close(req.user.sub, dto);
  }

  @Get(':id/summary')
  @Roles(Role.ADMIN, Role.USER)
  summary(@Param('id') id: string) {
    return this.cashSessionService.summaryBySession(id);
  }
}
