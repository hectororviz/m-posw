import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { CashMovementsService } from './cash-movements.service';

@Controller('cash-movements')
@UseGuards(JwtAuthGuard)
export class CashMovementsController {
  constructor(private readonly cashMovementsService: CashMovementsService) {}

  @Post()
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateCashMovementDto) {
    return this.cashMovementsService.create(req.user.sub, dto);
  }

  @Get()
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.cashMovementsService.list(Number(limit) || 50, Number(offset) || 0);
  }
}
