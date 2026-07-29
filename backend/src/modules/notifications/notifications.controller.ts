import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // --- Config (FULL access) ---

  @Get('config')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getConfig() {
    return this.notificationsService.getConfig();
  }

  @Post('test-connection')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  testConnection() {
    return this.notificationsService.testConnection();
  }

  // --- History ---

  @Get('history')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
  ) {
    return this.notificationsService.getHistory(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      { status, provider },
    );
  }

  // --- Queue ---

  @Get('queue')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getQueue(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getQueue(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      status,
    );
  }

  @Post('queue/cancel-all')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  cancelAllQueued() {
    return this.notificationsService.cancelAllQueued();
  }

  @Get('batch/:batchId/status')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getBatchStatus(@Param('batchId') batchId: string) {
    return this.notificationsService.getBatchStatus(batchId);
  }

  // --- Conversations ---

  @Get('conversations')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getConversations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getConversations(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('conversations/:id/messages')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getConversationMessages(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getConversationMessages(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('conversations/:id/read')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  markConversationRead(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markConversationRead(id);
  }

  @Post('conversations/:id/send')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  sendConversationMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { text: string },
  ) {
    return this.notificationsService.sendConversationMessage(id, body.text);
  }
}
