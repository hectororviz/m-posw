import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { FicharJugadoresDto } from './dto/fichar-jugadores.dto';

@Controller('tournaments')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  findAll(
    @Query('year') year?: string,
    @Query('allowedSex') allowedSex?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tournamentsService.findAll({
      year: year ? +year : undefined,
      allowedSex,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tournamentsService.findOne(id);
  }

  @Post()
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  create(@Body() dto: CreateTournamentDto) {
    return this.tournamentsService.create(dto);
  }

  @Put(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(id, dto);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tournamentsService.remove(id);
  }

  @Get(':id/players')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  getPlayers(
    @Param('id', ParseIntPipe) id: number,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.tournamentsService.getPlayers(id, {
      search,
      categoryId: categoryId ? +categoryId : undefined,
    });
  }

  @Post(':id/players/eligible')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  getEligiblePlayers(@Param('id', ParseIntPipe) id: number) {
    return this.tournamentsService.getEligiblePlayers(id);
  }

  @Post(':id/players')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  ficharJugadores(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FicharJugadoresDto,
  ) {
    return this.tournamentsService.ficharJugadores(id, dto.playerIds);
  }

  @Delete(':id/players/:playerId')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  desficharJugador(
    @Param('id', ParseIntPipe) id: number,
    @Param('playerId', ParseIntPipe) playerId: number,
  ) {
    return this.tournamentsService.desficharJugador(id, playerId);
  }
}
