import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { QuickExpenseService } from './quick-expense.service';

@Controller('treasury/quick-expense/buttons')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class QuickExpenseController {
  constructor(private readonly service: QuickExpenseService) {}

  @Get()
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  list() {
    return this.service.listButtons();
  }

  @Get('all')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  listAll() {
    return this.service.listAllButtons();
  }

  @Post()
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  create(@Body() dto: { label: string; assetAccountId: string; expenseAccountId: string }) {
    return this.service.createButton(dto);
  }

  @Patch(':id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { label?: string; assetAccountId?: string; expenseAccountId?: string; position?: number; active?: boolean },
  ) {
    return this.service.updateButton(id, dto);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteButton(id);
  }

  @Post('submit')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  submitExpense(
    @Req() req: any,
    @Body() dto: { buttonId: number; amount: number; note?: string },
  ) {
    return this.service.submitExpense(req.user?.sub || req.user?.id, dto);
  }
}
