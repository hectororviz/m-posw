import { Controller, Get, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { PlayersStatsService } from './players-stats.service';

@Controller('players-stats')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class PlayersStatsController {
  constructor(private readonly playersStatsService: PlayersStatsService) {}

  @Get('dashboard')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  getDashboard() {
    return this.playersStatsService.getDashboard();
  }
}
