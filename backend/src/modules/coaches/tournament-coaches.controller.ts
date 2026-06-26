import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { CoachesService } from './coaches.service';
import { AssignCoachDto } from './dto/assign-coach.dto';

@Controller('tournaments/:tournamentId/coaches')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class TournamentCoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  @Get()
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  getCoaches(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return this.coachesService.getTournamentCoaches(tournamentId);
  }

  @Post()
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  assignCoach(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() dto: AssignCoachDto,
  ) {
    return this.coachesService.assignCoach(
      tournamentId,
      dto.coachId,
      dto.playerCategoryId,
    );
  }

  @Delete(':coachId')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  unassignCoach(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('coachId', ParseIntPipe) coachId: number,
  ) {
    return this.coachesService.unassignCoach(tournamentId, coachId);
  }
}
