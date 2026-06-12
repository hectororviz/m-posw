import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { InternetPlansService } from './internet-plans.service';

@Controller('internet/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
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
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plansService.remove(id);
  }
}
