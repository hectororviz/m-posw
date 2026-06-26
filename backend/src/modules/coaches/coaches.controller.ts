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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { CoachesService } from './coaches.service';
import { CreateCoachDto } from './dto/create-coach.dto';
import { UpdateCoachDto } from './dto/update-coach.dto';
import { AssignCoachDto } from './dto/assign-coach.dto';

@Controller('coaches')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class CoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  @Get()
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coachesService.findAll({
      search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('report')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  async report(
    @Query('tournamentId') tournamentId?: string,
    @Query('categoryId') categoryId?: string,
    @Res() res?: Response,
  ) {
    const { buffer, filename } = await this.coachesService.generateReport(
      tournamentId ? +tournamentId : undefined,
      categoryId ? +categoryId : undefined,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.coachesService.findOne(id);
  }

  @Post()
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  create(@Body() dto: CreateCoachDto) {
    return this.coachesService.create(dto);
  }

  @Put(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCoachDto) {
    return this.coachesService.update(id, dto);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coachesService.remove(id);
  }
}
