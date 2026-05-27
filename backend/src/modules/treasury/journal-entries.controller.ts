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
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import {
  CreateJournalEntryDto,
  ListJournalEntriesDto,
  SimpleEntryDto,
  UpdateJournalEntryDto,
  VoidJournalEntryDto,
} from './dto/journal-entry.dto';
import { JournalEntriesService } from './journal-entries.service';

@Controller('treasury/entries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class JournalEntriesController {
  constructor(private readonly service: JournalEntriesService) {}

  @Get()
  list(@Query() query: ListJournalEntriesDto) {
    return this.service.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  create(@Req() req, @Body() dto: CreateJournalEntryDto) {
    return this.service.create(req.user?.sub || req.user?.id, dto);
  }

  @Post('income')
  createSimpleIncome(@Req() req, @Body() dto: SimpleEntryDto) {
    return this.service.createSimpleIncome(req.user?.sub || req.user?.id, dto);
  }

  @Post('expense')
  createSimpleExpense(@Req() req, @Body() dto: SimpleEntryDto) {
    return this.service.createSimpleExpense(req.user?.sub || req.user?.id, dto);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateJournalEntryDto) {
    return this.service.update(req.user?.sub || req.user?.id, id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/post')
  post(@Param('id') id: string) {
    return this.service.post(id);
  }

  @Post(':id/void')
  void(@Req() req, @Param('id') id: string, @Body() dto: VoidJournalEntryDto) {
    return this.service.void(id, req.user?.sub || req.user?.id, dto);
  }
}
