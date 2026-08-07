import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { WhatsAppCloudProvider } from './providers/whatsapp-cloud.provider';

@Injectable()
export class NotificacionesService implements OnModuleInit {
  private readonly logger = new Logger(NotificacionesService.name);
  private isProcessing = false;
  private isPaused = false;

  constructor(
    private prisma: PrismaService,
    private whatsappProvider: WhatsAppCloudProvider,
  ) {}

  onModuleInit() {
    this.processQueue();
  }

  async getConfig() {
    const setting = await this.prisma.setting.findFirst({ orderBy: { createdAt: 'desc' } });
    const isConfigured = !!(setting?.whatsappPhoneNumberId && setting?.whatsappAccessToken);

    return {
      enabled: setting?.enableNotificationsModule ?? false,
      provider: this.whatsappProvider.name,
      isConfigured,
      phoneNumberId: setting?.whatsappPhoneNumberId || null,
      businessAccountId: setting?.whatsappBusinessAccountId || null,
      hasPhoneNumberId: !!setting?.whatsappPhoneNumberId,
      hasAccessToken: !!setting?.whatsappAccessToken,
      hasBusinessAccountId: !!setting?.whatsappBusinessAccountId,
      hasWebhookVerifyToken: !!setting?.whatsappWebhookVerifyToken,
    };
  }

  async testConnection() {
    const status = await this.whatsappProvider.getStatus();
    if (!status.isConfigured) {
      throw new BadRequestException('WhatsApp Cloud API no está configurada. Ingresá Phone Number ID y Access Token.');
    }
    return { ok: true, message: 'WhatsApp Cloud API configurada correctamente', phoneNumberId: status.phoneNumberId };
  }

  normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('549')) {
      if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
      if (cleaned.startsWith('15')) cleaned = cleaned.slice(2);
      cleaned = '549' + cleaned;
    }
    return cleaned;
  }

  async getHistory(page: number, limit: number, filters?: { status?: string; acreedorId?: number }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.acreedorId) where.acreedorId = filters.acreedorId;

    const [jobs, total] = await Promise.all([
      this.prisma.notificationJob.findMany({
        where: { ...where, status: { notIn: ['QUEUED', 'PROCESSING'] } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { acreedor: { select: { id: true, nombre: true } } },
      }),
      this.prisma.notificationJob.count({ where }),
    ]);

    return { jobs, total, page, limit };
  }

  async getQueue(page: number, limit: number, status?: string) {
    const where: any = {};
    if (status) where.status = status;

    const [jobs, total, counts] = await Promise.all([
      this.prisma.notificationJob.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { acreedor: { select: { id: true, nombre: true } } },
      }),
      this.prisma.notificationJob.count({ where }),
      (async () => {
        const statuses = await this.prisma.notificationJob.groupBy({
          by: ['status'],
          _count: true,
        });
        const map: Record<string, number> = {};
        for (const s of statuses) map[s.status] = s._count;
        return map;
      })(),
    ]);

    return {
      jobs,
      total,
      page,
      limit,
      counts,
      isRunning: this.isProcessing,
      isPaused: this.isPaused,
      activeBatchId: jobs.find(j => j.status === 'PROCESSING')?.batchId || null,
    };
  }

  async cancelAll() {
    await this.prisma.notificationJob.updateMany({
      where: { status: 'QUEUED' },
      data: { status: 'CANCELLED', error: 'Cancelado por el usuario', completedAt: new Date() },
    });
    return { cancelled: true };
  }

  async pause() {
    this.isPaused = true;
    return { paused: true };
  }

  async resume() {
    this.isPaused = false;
    this.processQueue();
    return { resumed: true };
  }

  async retryFailed(jobIds: number[]) {
    await this.prisma.notificationJob.updateMany({
      where: { id: { in: jobIds }, status: 'FAILED' },
      data: { status: 'QUEUED', attempts: 0, error: null, scheduledAt: null },
    });
    this.processQueue();
    return { retried: true };
  }

  async enqueueBatch(jobs: Array<{ acreedorId: number; phoneNumber: string; recipientName: string; templateParams?: { header: string[]; body: string[] } }>, batchId: string) {
    const setting = await this.prisma.setting.findFirst({ orderBy: { createdAt: 'desc' } });
    const templateName = setting?.whatsappTemplateName || 'debt_reminder';
    const created = [];

    for (const job of jobs) {
      const j = await this.prisma.notificationJob.create({
        data: {
          recipientName: job.recipientName,
          phoneNumber: job.phoneNumber,
          acreedorId: job.acreedorId,
          channel: 'WHATSAPP',
          status: 'QUEUED',
          batchId,
          templateName,
          templateParams: job.templateParams || { header: [], body: [] },
        },
      });
      created.push(j);
    }

    this.processQueue();
    return created;
  }

  async getBatchStatus(batchId: string) {
    const jobs = await this.prisma.notificationJob.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        acreedorId: true,
        status: true,
        attempts: true,
        error: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const queued = jobs.filter(j => j.status === 'QUEUED').length;
    const processing = jobs.filter(j => j.status === 'PROCESSING').length;
    const sent = jobs.filter(j => j.status === 'SENT').length;
    const failed = jobs.filter(j => j.status === 'FAILED').length;
    const cancelled = jobs.filter(j => j.status === 'CANCELLED').length;

    return {
      batchId,
      total: jobs.length,
      sent,
      failed,
      queued,
      cancelled,
      isRunning: queued > 0 || processing > 0,
      jobs: jobs.map(j => ({
        id: j.id,
        creditorId: j.acreedorId,
        status: j.status,
        attempts: j.attempts,
        error: j.error,
        createdAt: j.createdAt?.toISOString() ?? null,
        startedAt: j.startedAt?.toISOString() ?? null,
        completedAt: j.completedAt?.toISOString() ?? null,
      })),
    };
  }

  private async processQueue() {
    if (this.isProcessing || this.isPaused) return;
    this.isProcessing = true;

    try {
      while (!this.isPaused) {
        const job = await this.prisma.notificationJob.findFirst({
          where: { status: 'QUEUED' },
          orderBy: { createdAt: 'asc' },
        });

        if (!job) break;

        await this.prisma.notificationJob.update({
          where: { id: job.id },
          data: { status: 'PROCESSING', startedAt: new Date(), attempts: job.attempts + 1 },
        });

        const rawParams = job.templateParams;
        let headerParams: string[] = [];
        let bodyParams: string[] = [];

        if (Array.isArray(rawParams)) {
          bodyParams = rawParams as string[];
        } else if (rawParams && typeof rawParams === 'object') {
          headerParams = (rawParams as any).header || [];
          bodyParams = (rawParams as any).body || [];
        }

        const sendText = [...headerParams, ...bodyParams].join(' - ');

        let result;
        if (job.templateName) {
          result = await this.whatsappProvider.sendMessage(
            job.phoneNumber,
            job.templateName,
            headerParams,
            bodyParams,
          );
        } else {
          result = await this.whatsappProvider.sendTextMessage(job.phoneNumber, 'Notificación de m-POSw');
        }

        const isConfigured = await this.whatsappProvider.getStatus();

        if (result.success) {
          await this.prisma.notificationJob.update({
            where: { id: job.id },
            data: {
              status: 'SENT',
              completedAt: new Date(),
              externalMessageId: result.externalMessageId,
            },
          });

          await this.prisma.notificationLog.create({
            data: {
              recipient: job.recipientName,
              phoneNumber: job.phoneNumber,
              channel: 'WHATSAPP',
              status: 'SENT',
              messageText: sendText || 'Template message',
              templateUsed: job.templateName,
              externalMessageId: result.externalMessageId,
              acreedorId: job.acreedorId,
            },
          });

          const phone = job.phoneNumber.replace(/[^0-9]/g, '');
          let conv = await this.prisma.whatsAppConversation.findUnique({
            where: { phoneNumber: phone },
          });
          if (!conv) {
            conv = await this.prisma.whatsAppConversation.create({
              data: { phoneNumber: phone, acreedorId: job.acreedorId },
            });
          } else if (!conv.acreedorId && job.acreedorId) {
            await this.prisma.whatsAppConversation.update({
              where: { id: conv.id },
              data: { acreedorId: job.acreedorId },
            });
          }
          await this.prisma.whatsAppConversation.update({
            where: { id: conv.id },
            data: { lastMessageAt: new Date() },
          });
          await this.prisma.whatsAppMessage.create({
            data: {
              conversationId: conv.id,
              direction: 'OUTBOUND',
              content: `-- NOTIFICACIÓN ENVIADA --`,
              externalMessageId: result.externalMessageId,
              status: 'sent',
            },
          });
        } else if (!isConfigured.isConfigured) {
          await this.prisma.notificationJob.update({
            where: { id: job.id },
            data: { status: 'FAILED', error: 'WhatsApp Cloud API no configurada', completedAt: new Date() },
          });
          this.logger.warn('WhatsApp Cloud API not configured, stopping queue');
          break;
        } else {
          if (job.attempts >= job.maxAttempts) {
            await this.prisma.notificationJob.update({
              where: { id: job.id },
              data: { status: 'FAILED', error: result.error, completedAt: new Date() },
            });

            await this.prisma.notificationLog.create({
              data: {
                recipient: job.recipientName,
                phoneNumber: job.phoneNumber,
                channel: 'WHATSAPP',
                status: 'FAILED',
                messageText: sendText || 'Template message',
                templateUsed: job.templateName,
                errorMessage: result.error,
                acreedorId: job.acreedorId,
              },
            });
          } else {
            await this.prisma.notificationJob.update({
              where: { id: job.id },
              data: { status: 'QUEUED', error: result.error, scheduledAt: new Date(Date.now() + 30000) },
            });
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async getUnreadCount() {
    const conversations = await this.prisma.whatsAppConversation.findMany({
      select: { id: true, lastReadAt: true },
    });

    const counts = await Promise.all(
      conversations.map(async (conv) => {
        const where: any = { conversationId: conv.id, direction: 'INBOUND' };
        if (conv.lastReadAt) {
          where.createdAt = { gt: conv.lastReadAt };
        }
        return this.prisma.whatsAppMessage.count({ where });
      }),
    );

    return { total: counts.reduce((sum, c) => sum + c, 0) };
  }

  async markAllConversationsAsRead() {
    await this.prisma.whatsAppConversation.updateMany({
      data: { lastReadAt: new Date() },
    });
  }

  async getConversations(page: number, limit: number) {
    const [conversations, total] = await Promise.all([
      this.prisma.whatsAppConversation.findMany({
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          acreedor: { select: { id: true, nombre: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.whatsAppConversation.count(),
    ]);

    const now = Date.now();
    const mapped = await Promise.all(
      conversations.map(async (c) => {
        const windowOpen = c.lastIncomingAt
          ? (now - new Date(c.lastIncomingAt).getTime()) < 24 * 60 * 60 * 1000
          : false;

        const unreadWhere: any = { conversationId: c.id, direction: 'INBOUND' };
        if (c.lastReadAt) {
          unreadWhere.createdAt = { gt: c.lastReadAt };
        }
        const unreadCount = await this.prisma.whatsAppMessage.count({ where: unreadWhere });

        return {
          id: c.id,
          phoneNumber: c.phoneNumber,
          acreedor: c.acreedor,
          lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
          lastIncomingAt: c.lastIncomingAt?.toISOString() ?? null,
          lastReadAt: c.lastReadAt?.toISOString() ?? null,
          windowOpen,
          unreadCount,
          lastMessage: c.messages[0] ?? null,
          createdAt: c.createdAt.toISOString(),
        };
      }),
    );

    return { conversations: mapped, total, page, limit };
  }

  async getConversationMessages(conversationId: number, page: number, limit: number) {
    const conv = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      include: { acreedor: { select: { id: true, nombre: true } } },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');

    const now = Date.now();
    const windowOpen = conv.lastIncomingAt
      ? (now - new Date(conv.lastIncomingAt).getTime()) < 24 * 60 * 60 * 1000
      : false;

    const [messages, total] = await Promise.all([
      this.prisma.whatsAppMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.whatsAppMessage.count({ where: { conversationId } }),
    ]);

    return {
      conversationId: conv.id,
      acreedorId: conv.acreedorId,
      acreedor: conv.acreedor,
      phoneNumber: conv.phoneNumber,
      windowOpen,
      messages,
      total,
      page,
      limit,
    };
  }

  async sendConversationMessage(conversationId: number, text: string) {
    if (!text?.trim()) throw new BadRequestException('El mensaje no puede estar vacío');

    const conv = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');

    const now = Date.now();
    const windowOpen = conv.lastIncomingAt
      ? (now - new Date(conv.lastIncomingAt).getTime()) < 24 * 60 * 60 * 1000
      : false;

    if (!windowOpen) {
      throw new BadRequestException('La ventana de 24 horas está cerrada. Solo se pueden enviar templates.');
    }

    const result = await this.whatsappProvider.sendTextMessage(conv.phoneNumber, text);

    if (!result.success) {
      throw new BadRequestException(result.error || 'Error al enviar mensaje');
    }

    await this.prisma.whatsAppMessage.create({
      data: {
        conversationId: conv.id,
        direction: 'OUTBOUND',
        content: text,
        externalMessageId: result.externalMessageId,
        status: 'sent',
      },
    });

    await this.prisma.whatsAppConversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date() },
    });

    return { success: true, externalMessageId: result.externalMessageId };
  }

  async deleteConversationMessage(conversationId: number, messageId: number) {
    const message = await this.prisma.whatsAppMessage.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!message) throw new BadRequestException('Mensaje no encontrado');

    await this.prisma.whatsAppMessage.delete({ where: { id: messageId } });

    const remaining = await this.prisma.whatsAppMessage.count({ where: { conversationId } });
    if (remaining === 0) {
      await this.prisma.whatsAppConversation.delete({ where: { id: conversationId } });
    } else {
      const lastMsg = await this.prisma.whatsAppMessage.findFirst({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
      });
      const lastIncoming = await this.prisma.whatsAppMessage.findFirst({
        where: { conversationId, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
      });
      await this.prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: lastMsg?.createdAt ?? null,
          lastIncomingAt: lastIncoming?.createdAt ?? null,
        },
      });
    }

    return { deleted: true };
  }

  async deleteConversation(conversationId: number) {
    const conv = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');

    await this.prisma.whatsAppConversation.delete({ where: { id: conversationId } });
    return { deleted: true };
  }

  async sendNewConversationMessage(phone: string, text: string) {
    if (!text?.trim()) throw new BadRequestException('El mensaje no puede estar vacío');

    const cleanedPhone = phone.replace(/[^0-9]/g, '');
    let conv = await this.prisma.whatsAppConversation.findUnique({
      where: { phoneNumber: cleanedPhone },
    });

    if (!conv) {
      conv = await this.prisma.whatsAppConversation.create({
        data: { phoneNumber: cleanedPhone },
      });
    }

    return this.sendConversationMessage(conv.id, text);
  }
}
