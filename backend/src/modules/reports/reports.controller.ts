import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.REPORTES, ModuleAccess.READ)
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
