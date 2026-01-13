import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('totals-by-day')
  totalsByDay() {
    return this.statsService.totalsByDay();
  }

  @Get('totals-by-month')
  totalsByMonth() {
    return this.statsService.totalsByMonth();
  }

  @Get('average-daily-by-category')
  averageDailyByCategory() {
    return this.statsService.averageDailyByCategory();
  }

  @Get('average-daily-by-product')
  averageDailyByProduct() {
    return this.statsService.averageDailyByProduct();
  }
}
