import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.REPORTES, ModuleAccess.READ)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('summary')
  summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statsService.summary(from, to);
  }

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
