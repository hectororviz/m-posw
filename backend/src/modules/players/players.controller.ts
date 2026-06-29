import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Controller('players')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  findAll(
    @Query('search') search?: string,
    @Query('sex') sex?: string,
    @Query('birthYear') birthYear?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.playersService.findAll({
      search,
      sex,
      birthYear,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('export')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  async exportExcel(
    @Query('search') search?: string,
    @Query('sex') sex?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.playersService.exportExcel({ search, sex });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=jugadores.xlsx');
    res.send(buffer);
  }

  @Get(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.playersService.findOne(id);
  }

  @Post()
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  create(@Body() dto: CreatePlayerDto) {
    return this.playersService.create(dto);
  }

  @Post('import-excel')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@UploadedFile() file: Express.Multer.File) {
    return this.playersService.importExcel(file);
  }

  @Put(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlayerDto) {
    return this.playersService.update(id, dto);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.playersService.remove(id);
  }
}
