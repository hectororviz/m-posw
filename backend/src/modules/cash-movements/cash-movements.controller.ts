import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CashMovementsService } from './cash-movements.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { VoidCashMovementDto } from './dto/void-cash-movement.dto';

@Controller('cash-movements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashMovementsController {
  constructor(private readonly cashMovementsService: CashMovementsService) {}

  @Get('current')
  @Roles(Role.ADMIN, Role.USER)
  listCurrent(@Query('includeVoided') includeVoided?: string) {
    const include = includeVoided === 'true';
    return this.cashMovementsService.listCurrent(include);
  }

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateCashMovementDto) {
    return this.cashMovementsService.createMovement(req.user.sub, dto);
  }

  @Post(':id/void')
  @Roles(Role.ADMIN)
  void(@Req() req: { user: { sub: string } }, @Param('id') id: string, @Body() dto: VoidCashMovementDto) {
    return this.cashMovementsService.voidMovement(id, req.user.sub, dto.voidReason);
  }
}
