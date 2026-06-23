import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { PlayerCategoriesService } from './player-categories.service';
import { CreatePlayerCategoryDto } from './dto/create-player-category.dto';
import { UpdatePlayerCategoryDto } from './dto/update-player-category.dto';

@Controller('player-categories')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class PlayerCategoriesController {
  constructor(
    private readonly playerCategoriesService: PlayerCategoriesService,
  ) {}

  @Get()
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  findAll() {
    return this.playerCategoriesService.findAll();
  }

  @Get(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.playerCategoriesService.findOne(id);
  }

  @Post()
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  create(@Body() dto: CreatePlayerCategoryDto) {
    return this.playerCategoriesService.create(dto);
  }

  @Put(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlayerCategoryDto,
  ) {
    return this.playerCategoriesService.update(id, dto);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.PLAYERS, ModuleAccess.FULL)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.playerCategoriesService.remove(id);
  }
}
