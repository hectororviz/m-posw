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
import { AssetStatusesService } from './asset-statuses.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('asset-statuses')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class AssetStatusesController {
  constructor(private readonly assetStatusesService: AssetStatusesService) {}

  @Get()
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.READ)
  findAll() {
    return this.assetStatusesService.findAll();
  }

  @Post()
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  create(@Body() dto: CreateStatusDto) {
    return this.assetStatusesService.create(dto);
  }

  @Patch(':id')
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStatusDto) {
    return this.assetStatusesService.update(id, dto);
  }

  @Patch(':id/toggle')
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.assetStatusesService.toggle(id);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.assetStatusesService.remove(id);
  }
}
