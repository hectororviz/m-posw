import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CashSessionsService } from './cash-sessions.service';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

@Controller('cash-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Get('current')
  @Roles(Role.ADMIN, Role.USER)
  getCurrent() {
    return this.cashSessionsService.requireOpenSession();
  }

  @Post('open')
  @Roles(Role.ADMIN, Role.USER)
  open(@Req() req: { user: { sub: string } }, @Body() dto: OpenCashSessionDto) {
    return this.cashSessionsService.openSession(req.user.sub, dto);
  }

  @Post('close')
  @Roles(Role.ADMIN, Role.USER)
  close(@Req() req: { user: { sub: string } }) {
    return this.cashSessionsService.closeSession(req.user.sub);
  }
}
