import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { CashMovementsService } from './cash-movements.service';

@Controller('cash-movements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashMovementsController {
  constructor(private readonly cashMovementsService: CashMovementsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateCashMovementDto) {
    return this.cashMovementsService.create(req.user.sub, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.USER)
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.cashMovementsService.list(Number(limit) || 50, Number(offset) || 0);
  }
}
