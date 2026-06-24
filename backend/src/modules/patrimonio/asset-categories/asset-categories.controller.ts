import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../../common/module-access.guard';
import { RequireModule } from '../../common/module-access.decorator';
import { AssetCategoriesService } from './asset-categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('asset-categories')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class AssetCategoriesController {
  constructor(private readonly assetCategoriesService: AssetCategoriesService) {}

  @Get()
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.READ)
  findAll() {
    return this.assetCategoriesService.findAll();
  }

  @Post()
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  create(@Body() dto: CreateCategoryDto) {
    return this.assetCategoriesService.create(dto);
  }

  @Patch(':id')
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.assetCategoriesService.update(id, dto);
  }

  @Patch(':id/toggle')
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.assetCategoriesService.toggle(id);
  }
}
