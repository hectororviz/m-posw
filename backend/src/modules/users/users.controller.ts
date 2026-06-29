import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.READ)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  list() {
    return this.usersService.list();
  }

  @Patch(':id')
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
