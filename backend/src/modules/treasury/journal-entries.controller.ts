import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import {
  CreateJournalEntryDto,
  ListJournalEntriesDto,
  SimpleEntryDto,
  UpdateJournalEntryDto,
  VoidJournalEntryDto,
} from './dto/journal-entry.dto';
import { JournalEntriesService } from './journal-entries.service';

@Controller('treasury/entries')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class JournalEntriesController {
  constructor(private readonly service: JournalEntriesService) {}

  @Get()
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  list(@Query() query: ListJournalEntriesDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  create(@Req() req, @Body() dto: CreateJournalEntryDto) {
    return this.service.create(req.user?.sub || req.user?.id, dto);
  }

  @Post('income')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  createSimpleIncome(@Req() req, @Body() dto: SimpleEntryDto) {
    return this.service.createSimpleIncome(req.user?.sub || req.user?.id, dto);
  }

  @Post('expense')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  createSimpleExpense(@Req() req, @Body() dto: SimpleEntryDto) {
    return this.service.createSimpleExpense(req.user?.sub || req.user?.id, dto);
  }

  @Patch(':id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateJournalEntryDto) {
    return this.service.update(req.user?.sub || req.user?.id, id, dto);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/post')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  post(@Param('id') id: string) {
    return this.service.post(id);
  }

  @Post(':id/void')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  void(@Req() req, @Param('id') id: string, @Body() dto: VoidJournalEntryDto) {
    return this.service.void(id, req.user?.sub || req.user?.id, dto);
  }
}
