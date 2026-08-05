import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get('config')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getConfig() {
    return this.notificacionesService.getConfig();
  }

  @Post('test')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  testConnection() {
    return this.notificacionesService.testConnection();
  }

  @Get('history')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('acreedorId') acreedorId?: string,
  ) {
    return this.notificacionesService.getHistory(
      parseInt(page || '1'),
      parseInt(limit || '50'),
      { status, acreedorId: acreedorId ? parseInt(acreedorId) : undefined },
    );
  }

  @Get('queue')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getQueue(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.notificacionesService.getQueue(
      parseInt(page || '1'),
      parseInt(limit || '50'),
      status,
    );
  }

  @Post('queue/retry')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  retryFailed(@Body('jobIds') jobIds: number[]) {
    return this.notificacionesService.retryFailed(jobIds);
  }

  @Post('queue/pause')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  pause() {
    return this.notificacionesService.pause();
  }

  @Post('queue/resume')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  resume() {
    return this.notificacionesService.resume();
  }

  @Post('queue/cancel-all')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  cancelAll() {
    return this.notificacionesService.cancelAll();
  }

  @Get('conversations')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getConversations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificacionesService.getConversations(
      parseInt(page || '1'),
      parseInt(limit || '50'),
    );
  }

  @Get('conversations/:id/messages')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.READ)
  getConversationMessages(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificacionesService.getConversationMessages(
      id,
      parseInt(page || '1'),
      parseInt(limit || '50'),
    );
  }

  @Post('conversations/:id/send')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  sendConversationMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body('text') text: string,
  ) {
    return this.notificacionesService.sendConversationMessage(id, text);
  }

  @Post('conversations/send')
  @RequireModule(ModuleKey.NOTIFICACIONES, ModuleAccess.FULL)
  sendNewConversationMessage(
    @Body('phone') phone: string,
    @Body('text') text: string,
  ) {
    return this.notificacionesService.sendNewConversationMessage(phone, text);
  }
}
