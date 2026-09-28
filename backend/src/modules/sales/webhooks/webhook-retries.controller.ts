import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../../common/module-access.guard';
import { RequireModule } from '../../common/module-access.decorator';
import { WebhookRetriesService } from '../services/webhook-retries.service';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class WebhookRetriesController {
  constructor(private readonly retriesService: WebhookRetriesService) {}

  @Get('retries')
  @RequireModule(ModuleKey.VENTAS, ModuleAccess.FULL)
  list(
    @Req() req: { user: { sub: string; role: string } },
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.retriesService.listRetries(
      { id: req.user.sub, role: req.user.role },
      { status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined },
    );
  }

  @Post('retries/:id/retry')
  @RequireModule(ModuleKey.VENTAS, ModuleAccess.FULL)
  retry(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.retriesService.retryNow(id, { id: req.user.sub, role: req.user.role });
  }
}
