import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { FinanzasService } from './finanzas.service';
import {
  CreateMoneyAccountDto,
  CreateMoneyCategoryDto,
  CreateMoneyMovementDto,
  CreateResponsableDto,
  CreateTraspasoDto,
  ListMovementsDto,
  MonthlyQueryDto,
  SummaryQueryDto,
  UpdateMoneyAccountDto,
  UpdateMoneyCategoryDto,
  VoidMovementDto,
} from './dto/finanzas.dto';

@Controller('finanzas')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class FinanzasController {
  constructor(private readonly service: FinanzasService) {}

  @Get('accounts')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  accounts() {
    return this.service.listAccounts();
  }

  @Post('accounts')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  createAccount(@Body() dto: CreateMoneyAccountDto) {
    return this.service.createAccount(dto);
  }

  @Patch('accounts/:id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  updateAccount(@Param('id') id: string, @Body() dto: UpdateMoneyAccountDto) {
    return this.service.updateAccount(id, dto);
  }

  @Get('categories')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  categories() {
    return this.service.listCategories();
  }

  @Post('categories')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  createCategory(@Body() dto: CreateMoneyCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  updateCategory(@Param('id') id: string, @Body() dto: UpdateMoneyCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @Get('summary')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  summary(@Query() query: SummaryQueryDto) {
    return this.service.summary(query);
  }

  @Get('categories/:id/detail')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  categoryDetail(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListMovementsDto) {
    return this.service.categoryDetail(id, query);
  }

  @Get('movements')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  movements(@Query() query: ListMovementsDto) {
    return this.service.movements(query);
  }

  @Post('movements')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  createMovement(@Req() req: { user?: { sub?: string; id?: string } }, @Body() dto: CreateMoneyMovementDto) {
    return this.service.createMovement(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('movements/:id/anular')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  voidMovement(@Param('id') id: string, @Body() dto: VoidMovementDto) {
    return this.service.voidMovement(id, dto?.reason);
  }

  @Get('monthly')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  monthly(@Query() query: MonthlyQueryDto) {
    return this.service.monthly(query.year ?? new Date().getFullYear());
  }

  @Post('traspasos')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  createTraspaso(@Req() req: { user?: { sub?: string; id?: string } }, @Body() dto: CreateTraspasoDto) {
    return this.service.createTraspaso(req.user?.sub ?? req.user?.id, dto);
  }

  @Post('backfill-ventas')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  backfillVentas(@Body() dto: { since?: string }) {
    return this.service.backfillVentas(dto?.since);
  }

  @Get('responsables')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  responsables() {
    return this.service.listResponsables();
  }

  @Post('responsables')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  createResponsable(@Body() dto: CreateResponsableDto) {
    return this.service.createResponsable(dto.nombre);
  }

  @Patch('responsables/:id/toggle')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  toggleResponsable(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.toggleResponsable(id);
  }
}
