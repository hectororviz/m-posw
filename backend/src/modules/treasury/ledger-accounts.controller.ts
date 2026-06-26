import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { CreateLedgerAccountDto, UpdateLedgerAccountDto } from './dto/ledger-account.dto';
import { LedgerAccountsService } from './ledger-accounts.service';

@Controller('treasury/accounts')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class LedgerAccountsController {
  constructor(private readonly service: LedgerAccountsService) {}

  @Get()
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  list() {
    return this.service.list();
  }

  @Get('flat')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  listFlat() {
    return this.service.listFlat();
  }

  @Get('imputable')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  listImputable() {
    return this.service.listImputable();
  }

  @Get('asset-imputable')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  getAssetAccountsImputable() {
    return this.service.getAssetAccountsImputable();
  }

  @Get('revenue-imputable')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  getRevenueAccountsImputable() {
    return this.service.getRevenueAccountsImputable();
  }

  @Get('expense-imputable')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  getExpenseAccountsImputable() {
    return this.service.getExpenseAccountsImputable();
  }

  @Get(':id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  create(@Body() dto: CreateLedgerAccountDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  update(@Param('id') id: string, @Body() dto: UpdateLedgerAccountDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/toggle-active')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  toggleActive(@Param('id') id: string) {
    return this.service.toggleActive(id);
  }
}
