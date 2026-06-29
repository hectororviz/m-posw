import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { InternetPlansService } from './internet-plans.service';

@Controller('internet/plans')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.INTERNET, ModuleAccess.READ)
export class InternetPlansController {
  constructor(private readonly plansService: InternetPlansService) {}

  @Get()
  findAll() {
    return this.plansService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.plansService.findById(id);
  }

  @Post()
  @RequireModule(ModuleKey.INTERNET, ModuleAccess.FULL)
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Patch(':id')
  @RequireModule(ModuleKey.INTERNET, ModuleAccess.FULL)
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.INTERNET, ModuleAccess.FULL)
  remove(@Param('id') id: string) {
    return this.plansService.remove(id);
  }
}
