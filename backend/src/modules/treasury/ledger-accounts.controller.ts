import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateLedgerAccountDto, UpdateLedgerAccountDto } from './dto/ledger-account.dto';
import { LedgerAccountsService } from './ledger-accounts.service';

@Controller('treasury/accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class LedgerAccountsController {
  constructor(private readonly service: LedgerAccountsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('flat')
  listFlat() {
    return this.service.listFlat();
  }

  @Get('imputable')
  listImputable() {
    return this.service.listImputable();
  }

  @Get('asset-imputable')
  getAssetAccountsImputable() {
    return this.service.getAssetAccountsImputable();
  }

  @Get('revenue-imputable')
  getRevenueAccountsImputable() {
    return this.service.getRevenueAccountsImputable();
  }

  @Get('expense-imputable')
  getExpenseAccountsImputable() {
    return this.service.getExpenseAccountsImputable();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  create(@Body() dto: CreateLedgerAccountDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLedgerAccountDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string) {
    return this.service.toggleActive(id);
  }
}
