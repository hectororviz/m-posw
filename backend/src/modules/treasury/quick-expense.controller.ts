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
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { QuickExpenseService } from './quick-expense.service';

@Controller('treasury/quick-expense/buttons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class QuickExpenseController {
  constructor(private readonly service: QuickExpenseService) {}

  @Get()
  list() {
    return this.service.listButtons();
  }

  @Get('all')
  listAll() {
    return this.service.listAllButtons();
  }

  @Post()
  create(@Body() dto: { label: string; assetAccountId: string; expenseAccountId: string }) {
    return this.service.createButton(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { label?: string; assetAccountId?: string; expenseAccountId?: string; position?: number; active?: boolean },
  ) {
    return this.service.updateButton(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteButton(id);
  }
}
