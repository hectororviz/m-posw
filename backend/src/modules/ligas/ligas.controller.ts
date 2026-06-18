import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateLigaConfigDto } from './dto/create-liga-config.dto';
import { LigasService } from './ligas.service';

@Controller('ligas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class LigasController {
  constructor(private readonly ligasService: LigasService) {}

  @Get('leagues')
  getLeagues() {
    return this.ligasService.getLeagues();
  }

  @Get('leagues/:id/categories')
  getCategories(@Param('id') id: string) {
    return this.ligasService.getCategories(id);
  }

  @Get('leagues/:id/teams')
  getTeams(@Param('id') id: string) {
    return this.ligasService.getTeams(id);
  }

  @Get('standings')
  getStandings(
    @Query('leagueId') leagueId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.ligasService.getStandings(leagueId, categoryId);
  }

  @Get('teams/:id/next-matches')
  getNextMatches(
    @Param('id') id: string,
    @Query('leagueId') leagueId: string,
  ) {
    return this.ligasService.getNextMatches(id, leagueId);
  }

  @Get('teams/:id/results')
  getResults(
    @Param('id') id: string,
    @Query('leagueId') leagueId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.ligasService.getResults(id, leagueId, categoryId);
  }

  @Get('configs')
  getConfigs() {
    return this.ligasService.getConfigs();
  }

  @Post('configs')
  createConfig(@Body() dto: CreateLigaConfigDto) {
    return this.ligasService.createConfig(dto);
  }

  @Delete('configs/:id')
  deleteConfig(@Param('id') id: string) {
    return this.ligasService.deleteConfig(id);
  }
}
