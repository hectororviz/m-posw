import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { PrismaService } from '../common/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { NotificationQueueService } from './notification-queue.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.WHATSAPP, ModuleAccess.FULL)
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly queueService: NotificationQueueService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  getStatus() {
    return this.whatsappService.getSessionStatus();
  }

  @Get('qr')
  getQr() {
    return this.whatsappService.getQrCode();
  }

  @Post('start')
  startSession() {
    return this.whatsappService.startSession();
  }

  @Post('send')
  sendMessage(@Body() dto: SendMessageDto) {
    return this.whatsappService.sendMessage(
      dto.phoneNumber,
      dto.text,
      dto.sourceModule ?? 'MANUAL',
      dto.acreedorId,
    );
  }

  @Get('logs')
  async getLogs() {
    const logs = await this.prisma.notificationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return logs;
  }

  @Get('queue')
  async getQueue(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.queueService.listQueue(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('queue/retry')
  async retryJobs(@Body() body: { jobIds: number[] }) {
    return this.queueService.retryJobs(body.jobIds);
  }

  @Post('queue/pause')
  async pauseQueue() {
    await this.queueService.pauseQueue();
    return { paused: true };
  }

  @Post('queue/resume')
  async resumeQueue() {
    await this.queueService.resumeQueue();
    return { paused: false };
  }

  @Post('queue/cancel-all')
  async cancelAllQueued() {
    return this.queueService.cancelAllQueued();
  }
}
