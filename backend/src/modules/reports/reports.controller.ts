import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('products')
  summaryByProduct(@Query() query: ReportQueryDto) {
    return this.reportsService.summaryByProduct(query);
  }

  @Get('categories')
  summaryByCategory(@Query() query: ReportQueryDto) {
    return this.reportsService.summaryByCategory(query);
  }

  @Get('export')
  async export(@Query() query: ReportQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.exportSummary(query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=miBPS-resumen.xlsx');
    res.send(buffer);
  }
}
