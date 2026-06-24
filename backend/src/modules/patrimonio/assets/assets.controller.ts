import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../../common/module-access.guard';
import { RequireModule } from '../../common/module-access.decorator';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { ChangeStatusDto } from './dto/change-status.dto';

@Controller('assets')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.READ)
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('statusId') statusId?: string,
    @Query('location') location?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assetsService.findAll({
      categoryId: categoryId ? +categoryId : undefined,
      statusId: statusId ? +statusId : undefined,
      location,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get(':id')
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.assetsService.findOne(id);
  }

  @Post()
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  create(@Body() dto: CreateAssetDto, @Req() req: any) {
    return this.assetsService.create(dto, req.user.id);
  }

  @Patch(':id')
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssetDto,
    @Req() req: any,
  ) {
    return this.assetsService.update(id, dto, req.user.id);
  }

  @Patch(':id/status')
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStatusDto,
    @Req() req: any,
  ) {
    return this.assetsService.changeStatus(id, dto, req.user.id);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.FULL)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.assetsService.remove(id, req.user.id);
  }

  @Get(':id/events')
  @RequireModule(ModuleKey.PATRIMONIO, ModuleAccess.READ)
  getEvents(@Param('id', ParseIntPipe) id: number) {
    return this.assetsService.getEvents(id);
  }
}
