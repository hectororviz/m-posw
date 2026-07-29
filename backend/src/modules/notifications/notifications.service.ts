import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { HttpSmsProvider } from './httpsms-provider';
import { SmsManualProvider } from './sms-manual-provider';
import { NotificationProvider } from './notification-provider.interface';
import { NotificationGateway } from './notification.gateway';
import { normalizeArgentinaPhone } from './phone-normalize';
import * as crypto from 'crypto';

const DEFAULT_DEBT_TEMPLATE =
  'Hola {{nombre}}, tenés un saldo pendiente de ${{saldo}} en {{club}} ({{dias}} días).';

export interface EnqueuedJob {
  id: number;
  creditorId: number;
  batchId: string;
  phoneNumber: string;
  text: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private running = false;
  private activeBatchId: string | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private gateway: NotificationGateway,
  ) {}

  async getConfig() {
    const setting = await this.prisma.setting.findFirst();
    const apiKey = setting?.httpsmsApiKey || this.configService.get<string>('HTTPSMS_API_KEY', '');
    const baseUrl = (setting?.httpsmsBaseUrl || this.configService.get<string>('HTTPSMS_BASE_URL', 'https://api.httpsms.com')).replace(/\/+$/, '');
    const fromNumber = setting?.httpsmsFromNumber || '';
    const signingKey = setting?.httpsmsSigningKey || '';

    const template = setting?.debtReminderTemplate || DEFAULT_DEBT_TEMPLATE;
    const enabled = setting?.enableNotificationsModule ?? false;

    let provider: string = 'manual';
    let phoneOnline = false;
    let connected = false;

    if (enabled && apiKey && baseUrl) {
      try {
        const providerInstance = this.createHttpSmsProvider(apiKey, baseUrl, fromNumber);
        const status = await providerInstance.getStatus();
        connected = status.connected;
        phoneOnline = status.phoneOnline;
        if (connected) {
          provider = 'httpsms';
        }
      } catch {
        connected = false;
      }
    }

    return {
      enabled,
      provider,
      connected,
      phoneOnline,
      hasApiKey: !!apiKey,
      hasBaseUrl: !!baseUrl,
      hasFromNumber: !!fromNumber,
      hasSigningKey: !!signingKey,
      template,
      fromNumber,
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const setting = await this.prisma.setting.findFirst();
    const apiKey = setting?.httpsmsApiKey || '';
    const baseUrl = (setting?.httpsmsBaseUrl || 'https://api.httpsms.com').replace(/\/+$/, '');
    const fromNumber = setting?.httpsmsFromNumber || '';

    if (!apiKey) throw new BadRequestException('API Key no configurada');
    if (!baseUrl) throw new BadRequestException('Base URL no configurada');
    if (!fromNumber) throw new BadRequestException('Número de origen no configurado');

    try {
      const provider = this.createHttpSmsProvider(apiKey, baseUrl, fromNumber);
      const status = await provider.getStatus();
      if (status.connected) {
        return { ok: true, message: 'Conexión exitosa. API Key válida.' };
      } else {
        return { ok: false, message: 'API Key inválida o httpSMS no responde.' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      return { ok: false, message: msg };
    }
  }

  private createProvider(): NotificationProvider {
    const setting = this.getSettingSync();
    return this.buildProvider(setting);
  }

  private createHttpSmsProvider(apiKey: string, baseUrl: string, fromNumber: string): HttpSmsProvider {
    return new HttpSmsProvider({ apiKey, baseUrl, fromNumber });
  }

  private buildProvider(setting: any): NotificationProvider {
    const apiKey = setting?.httpsmsApiKey || '';
    const baseUrl = (setting?.httpsmsBaseUrl || 'https://api.httpsms.com').replace(/\/+$/, '');
    const fromNumber = setting?.httpsmsFromNumber || '';

    if (apiKey && baseUrl && fromNumber) {
      return this.createHttpSmsProvider(apiKey, baseUrl, fromNumber);
    }
    return new SmsManualProvider();
  }

  private async getSetting(): Promise<any> {
    return this.prisma.setting.findFirst();
  }

  private getSettingSync(): any {
    return null;
  }

  async getHistory(page = 1, limit = 50, filters?: { status?: string; provider?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.provider) where.channel = filters.provider;

    const [jobs, total] = await Promise.all([
      this.prisma.notificationJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          acreedor: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.notificationJob.count({ where }),
    ]);

    return { jobs, total, page, limit };
  }

  async getQueue(page = 1, limit = 50, status?: string) {
    const where: any = {};
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      this.prisma.notificationJob.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          acreedor: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.notificationJob.count({ where }),
    ]);

    const countResults = await this.prisma.notificationJob.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const counts: Record<string, number> = {};
    for (const c of countResults) {
      counts[c.status] = c._count.id;
    }

    return {
      jobs,
      total,
      page,
      limit,
      counts,
      isRunning: this.running,
      activeBatchId: this.activeBatchId,
    };
  }

  async enqueueBatch(
    jobs: Array<{ creditorId: number; phoneNumber: string; text: string }>,
    batchId: string,
  ) {
    const created: EnqueuedJob[] = [];
    const setting = await this.getSetting();
    const provider = this.buildProvider(setting);
    const providerName = provider.name;

    for (const job of jobs) {
      const record = await this.prisma.notificationJob.create({
        data: {
          creditorId: job.creditorId,
          status: 'QUEUED',
          batchId,
          type: 'DEBT_REMINDER',
          channel: providerName === 'httpsms' ? 'SMS' : 'MANUAL',
          provider: providerName,
          payload: {
            phoneNumber: job.phoneNumber,
            messageText: job.text,
            smsLink: provider.getManualPayload(job.phoneNumber, job.text).smsLink,
          },
        },
      });
      created.push({
        id: record.id,
        creditorId: job.creditorId,
        batchId,
        phoneNumber: job.phoneNumber,
        text: job.text,
      });
    }

    if (providerName === 'httpsms') {
      this.processQueue(batchId, created, provider);
    }

    return { batchId, total: created.length };
  }

  private async processQueue(batchId: string, jobs: EnqueuedJob[], provider: NotificationProvider) {
    if (this.running) {
      this.logger.warn(`Queue already running (batch: ${this.activeBatchId}), new jobs will be picked up`);
      return;
    }

    this.running = true;
    this.activeBatchId = batchId;
    this.logger.log(`Starting batch ${batchId} with ${jobs.length} jobs via ${provider.name}`);

    for (const job of jobs) {
      const dbJob = await this.prisma.notificationJob.findUnique({ where: { id: job.id } });
      if (dbJob?.status === 'CANCELLED') {
        this.gateway.notifyJobUpdated({
          batchId,
          creditorId: job.creditorId,
          jobId: job.id,
          status: 'CANCELLED',
        });
        continue;
      }

      await this.prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      this.gateway.notifyJobUpdated({
        batchId,
        creditorId: job.creditorId,
        jobId: job.id,
        status: 'PROCESSING',
      });

      try {
        const result = await provider.sendSms(job.phoneNumber, job.text);

        if (result.success) {
          await this.prisma.notificationJob.update({
            where: { id: job.id },
            data: {
              status: 'SENT',
              completedAt: new Date(),
              externalMessageId: result.externalMessageId || undefined,
            },
          });

          this.gateway.notifyJobUpdated({
            batchId,
            creditorId: job.creditorId,
            jobId: job.id,
            status: 'SENT',
            completedAt: new Date().toISOString(),
          });

          this.logger.log(`Job ${job.id} sent to creditor ${job.creditorId}`);
        } else {
          await this.prisma.notificationJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              error: result.error || 'Error desconocido',
              completedAt: new Date(),
            },
          });

          this.gateway.notifyJobUpdated({
            batchId,
            creditorId: job.creditorId,
            jobId: job.id,
            status: 'FAILED',
            completedAt: new Date().toISOString(),
            error: result.error || 'Error desconocido',
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';

        await this.prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: errorMsg,
            completedAt: new Date(),
          },
        });

        this.gateway.notifyJobUpdated({
          batchId,
          creditorId: job.creditorId,
          jobId: job.id,
          status: 'FAILED',
          completedAt: new Date().toISOString(),
          error: errorMsg,
        });

        this.logger.error(`Job ${job.id} failed for creditor ${job.creditorId}: ${errorMsg}`);
      }
    }

    this.running = false;
    this.activeBatchId = null;
    this.logger.log(`Batch ${batchId} completed`);
  }

  async getBatchStatus(batchId: string) {
    const jobs = await this.prisma.notificationJob.findMany({
      where: { batchId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        creditorId: true,
        status: true,
        attempts: true,
        error: true,
        provider: true,
        externalMessageId: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        payload: true,
      },
    });

    const total = jobs.length;
    const sent = jobs.filter((j) => j.status === 'SENT').length;
    const failed = jobs.filter((j) => j.status === 'FAILED').length;
    const queued = jobs.filter((j) => j.status === 'QUEUED' || j.status === 'PROCESSING').length;
    const cancelled = jobs.filter((j) => j.status === 'CANCELLED').length;

    return {
      batchId,
      total,
      sent,
      failed,
      queued,
      cancelled,
      isRunning: this.running && this.activeBatchId === batchId,
      jobs: jobs.map((j) => ({
        id: j.id,
        creditorId: j.creditorId,
        status: j.status,
        attempts: j.attempts,
        error: j.error,
        provider: j.provider,
        externalMessageId: j.externalMessageId,
        createdAt: j.createdAt?.toISOString() ?? null,
        startedAt: j.startedAt?.toISOString() ?? null,
        completedAt: j.completedAt?.toISOString() ?? null,
        payload: j.payload,
      })),
    };
  }

  async cancelAllQueued(): Promise<{ cancelled: number }> {
    const result = await this.prisma.notificationJob.updateMany({
      where: { status: { in: ['QUEUED', 'PROCESSING'] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    return { cancelled: result.count };
  }

  // --- Conversations ---

  async getConversations(page = 1, limit = 50) {
    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        orderBy: [
          { unreadCount: 'desc' },
          { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.conversation.count(),
    ]);

    const result = await Promise.all(
      conversations.map(async (conv) => {
        const acreedor = await this.prisma.acreedor.findUnique({
          where: { id: conv.memberId },
          select: { id: true, nombre: true },
        });
        return {
          id: conv.id,
          memberId: conv.memberId,
          memberName: acreedor?.nombre || `#${conv.memberId}`,
          phoneNumber: conv.phoneNumber,
          lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
          unreadCount: conv.unreadCount,
          lastMessage: conv.messages[0] || null,
          createdAt: conv.createdAt.toISOString(),
        };
      }),
    );

    return { conversations: result, total, page, limit };
  }

  async getConversationMessages(conversationId: number, page = 1, limit = 50) {
    const [messages, total] = await Promise.all([
      this.prisma.conversationMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.conversationMessage.count({ where: { conversationId } }),
    ]);

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { memberId: true, phoneNumber: true },
    });

    const acreedor = conv
      ? await this.prisma.acreedor.findUnique({
          where: { id: conv.memberId },
          select: { id: true, nombre: true },
        })
      : null;

    return {
      conversationId,
      memberId: conv?.memberId,
      memberName: acreedor?.nombre || `#${conv?.memberId}`,
      phoneNumber: conv?.phoneNumber,
      messages: messages.reverse(),
      total,
      page,
      limit,
    };
  }

  async markConversationRead(conversationId: number) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }

  async sendConversationMessage(conversationId: number, text: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) throw new BadRequestException('Conversación no encontrada');

    const setting = await this.getSetting();
    const provider = this.buildProvider(setting);

    if (provider.name === 'manual') {
      const payload = provider.getManualPayload(conv.phoneNumber, text);
      await this.prisma.conversationMessage.create({
        data: {
          conversationId: conv.id,
          direction: 'OUTBOUND',
          content: text,
        },
      });
      await this.prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return { success: true, smsLink: payload.smsLink };
    }

    const result = await provider.sendSms(conv.phoneNumber, text);

    await this.prisma.conversationMessage.create({
      data: {
        conversationId: conv.id,
        direction: 'OUTBOUND',
        externalMessageId: result.externalMessageId || undefined,
        content: text,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: {
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return result;
  }

  // --- Webhook processing ---

  async handleWebhook(eventType: string, rawPayload: any, rawBody?: string, signature?: string): Promise<void> {
    const setting = await this.getSetting();
    const signingKey = setting?.httpsmsSigningKey || '';

    if (signingKey) {
      this.verifyHttpsmsSignature(rawBody || JSON.stringify(rawPayload), signature, signingKey);
    }

    switch (eventType) {
      case 'message.phone.received':
        await this.handleInboundSms(rawPayload);
        break;
      case 'message.phone.sent':
        await this.handleMessageSent(rawPayload);
        break;
      case 'message.phone.delivered':
        await this.handleMessageDelivered(rawPayload);
        break;
      case 'message.send.failed':
      case 'message.send.expired':
        await this.handleMessageFailed(rawPayload, eventType);
        break;
      case 'phone.heartbeat.online':
      case 'phone.heartbeat.offline':
        this.logger.log(`Phone heartbeat: ${eventType}`);
        break;
      default:
        this.logger.debug(`Unhandled webhook event: ${eventType}`);
    }
  }

  private verifyHttpsmsSignature(rawBody: string, signature?: string, signingKey?: string) {
    if (!signature || !signingKey) {
      this.logger.warn('Missing httpsms webhook signature or signing key, skipping verification');
      return;
    }

    try {
      const token = signature.startsWith('Bearer ') ? signature.slice(7) : signature;
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      const dataToSign = `${parts[0]}.${parts[1]}`;
      const hmac = crypto.createHmac('sha256', signingKey);
      hmac.update(dataToSign);
      const expectedSignature = hmac.digest('base64url');

      if (expectedSignature !== parts[2]) {
        this.logger.warn('Invalid httpsms webhook signature');
        throw new Error('Invalid webhook signature');
      }

      this.logger.debug(`Webhook signature verified for event: ${payload?.event_type || 'unknown'}`);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err}`);
      throw new Error('Invalid webhook signature');
    }
  }

  private async handleInboundSms(payload: any) {
    const contact = payload?.contact || payload?.from || '';
    const content = payload?.content || payload?.text || payload?.body || '';
    const externalId = payload?.id || payload?.messageId;

    if (!contact || !content) {
      this.logger.warn(`Inbound SMS missing contact or content: ${JSON.stringify(payload)}`);
      return;
    }

    const normalizedPhone = normalizeArgentinaPhone(contact);

    const existingMsg = externalId
      ? await this.prisma.conversationMessage.findFirst({
          where: { externalMessageId: String(externalId) },
        })
      : null;

    if (existingMsg) {
      this.logger.debug(`Duplicate inbound SMS ${externalId}, ignoring`);
      return;
    }

    const acreedor = await this.prisma.acreedor.findFirst({
      where: { telefono: { not: null } },
    });

    let memberId = acreedor?.id ?? 0;
    let matched = false;

    if (acreedor?.telefono) {
      const normalizedAcreedor = normalizeArgentinaPhone(acreedor.telefono);
      if (normalizedAcreedor === normalizedPhone) {
        matched = true;
      }
    }

    if (!matched) {
      const allAcreedores = await this.prisma.acreedor.findMany({
        where: { telefono: { not: null } },
        select: { id: true, nombre: true, telefono: true },
      });

      for (const a of allAcreedores) {
        if (a.telefono && normalizeArgentinaPhone(a.telefono) === normalizedPhone) {
          memberId = a.id;
          matched = true;
          break;
        }
      }

      if (!matched) {
        const acreedorByPhone = await this.prisma.acreedor.findFirst({
          where: { telefono: contact },
        });
        if (acreedorByPhone) {
          memberId = acreedorByPhone.id;
        }
      }
    }

    let conv = await this.prisma.conversation.findFirst({
      where: { phoneNumber: normalizedPhone },
    });

    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          memberId,
          phoneNumber: normalizedPhone,
          lastMessageAt: new Date(),
          unreadCount: 1,
        },
      });
    } else {
      await this.prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
          updatedAt: new Date(),
          memberId: matched ? memberId : conv.memberId,
        },
      });
    }

    await this.prisma.conversationMessage.create({
      data: {
        conversationId: conv.id,
        direction: 'INBOUND',
        externalMessageId: externalId ? String(externalId) : undefined,
        content,
      },
    });

    this.gateway.notifyNewMessage({
      conversationId: conv.id,
      memberId: conv.memberId,
      content,
      createdAt: new Date().toISOString(),
    });

    this.logger.log(`Inbound SMS from ${normalizedPhone} (member ${memberId})`);
  }

  private async handleMessageSent(payload: any) {
    const externalId = payload?.id || payload?.messageId;
    if (!externalId) return;

    await this.prisma.notificationJob.updateMany({
      where: { externalMessageId: String(externalId), status: { in: ['SENT', 'PROCESSING'] } },
      data: { status: 'SENT' },
    });

    this.logger.log(`Message ${externalId} marked as SENT`);
  }

  private async handleMessageDelivered(payload: any) {
    const externalId = payload?.id || payload?.messageId;
    if (!externalId) return;

    await this.prisma.notificationJob.updateMany({
      where: { externalMessageId: String(externalId) },
      data: { status: 'ENTREGADO' },
    });

    this.logger.log(`Message ${externalId} marked as ENTREGADO`);
  }

  private async handleMessageFailed(payload: any, eventType: string) {
    const externalId = payload?.id || payload?.messageId;
    const error = payload?.error || payload?.reason || `${eventType}`;

    if (!externalId) return;

    await this.prisma.notificationJob.updateMany({
      where: { externalMessageId: String(externalId) },
      data: {
        status: 'ERROR',
        error: String(error),
        completedAt: new Date(),
      },
    });

    this.logger.log(`Message ${externalId} marked as ERROR: ${error}`);
  }

  normalizePhone(tel: string): string {
    return normalizeArgentinaPhone(tel);
  }
}
