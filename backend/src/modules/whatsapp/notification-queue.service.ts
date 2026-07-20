import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { NotificationGateway } from './notification.gateway';

interface EnqueuedJob {
  id: number;
  creditorId: number;
  batchId: string;
  phoneNumber: string;
  text: string;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  private running = false;
  private paused = false;
  private activeBatchId: string | null = null;
  private cancelRequested = false;

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private gateway: NotificationGateway,
  ) {}

  async enqueueBatch(
    jobs: Array<{ creditorId: number; phoneNumber: string; text: string }>,
    batchId: string,
  ): Promise<{ batchId: string; total: number }> {
    const created: EnqueuedJob[] = [];

    for (const job of jobs) {
      const record = await this.prisma.notificationJob.create({
        data: {
          creditorId: job.creditorId,
          status: 'QUEUED',
          batchId,
          type: 'DEBT_REMINDER',
          channel: 'WHATSAPP',
          payload: {
            phoneNumber: job.phoneNumber,
            messageText: job.text,
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

    this.processQueue(batchId, created);

    return { batchId, total: created.length };
  }

  private async processQueue(batchId: string, jobs: EnqueuedJob[]) {
    if (this.running) {
      this.logger.warn(`Queue already running (batch: ${this.activeBatchId}), new jobs will be picked up`);
      return;
    }

    this.running = true;
    this.activeBatchId = batchId;

    this.logger.log(`Starting batch ${batchId} with ${jobs.length} jobs`);

    for (const job of jobs) {
      if (this.cancelRequested) {
        this.logger.log(`Cancel requested for batch ${batchId}, stopping`);
        this.cancelBatch(batchId);
        break;
      }

      while (this.paused) {
        this.logger.log(`Queue paused (batch ${batchId}), waiting...`);
        this.gateway.notifyJobUpdated({
          batchId,
          creditorId: 0,
          jobId: 0,
          status: 'PAUSED',
        });
        await this.sleep(2000);
      }

      const dbJob = await this.prisma.notificationJob.findUnique({ where: { id: job.id } });
      if (dbJob?.status === 'CANCELLED') {
        this.logger.log(`Job ${job.id} was cancelled, skipping`);
        this.gateway.notifyJobUpdated({
          batchId,
          creditorId: job.creditorId,
          jobId: job.id,
          status: 'CANCELLED',
        });
        continue;
      }

      const setting = await this.prisma.setting.findFirst();
      const minDelay = (setting?.openwaMinDelay ?? 30) * 1000;
      const maxDelay = (setting?.openwaMaxDelay ?? 120) * 1000;
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

      if (job !== jobs[0]) {
        this.logger.log(`Waiting ${Math.round(delay / 1000)}s before next job (batch ${batchId})`);
        await this.sleep(delay);
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
        attempts: (dbJob?.attempts ?? 0) + 1,
      });

      try {
        await this.whatsappService.sendMessage(
          job.phoneNumber,
          job.text,
          'ACREEDORES',
          job.creditorId,
        );

        await this.prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: 'SENT',
            completedAt: new Date(),
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
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        const dbJob = await this.prisma.notificationJob.findUnique({ where: { id: job.id } });
        const attempts = (dbJob?.attempts ?? 0) + 1;
        const maxAttempts = dbJob?.maxAttempts ?? 3;

        if (attempts < maxAttempts) {
          await this.prisma.notificationJob.update({
            where: { id: job.id },
            data: {
              status: 'RETRYING',
              error: errorMsg,
              attempts,
            },
          });

          this.gateway.notifyJobUpdated({
            batchId,
            creditorId: job.creditorId,
            jobId: job.id,
            status: 'RETRYING',
            error: errorMsg,
            attempts,
          });
        } else {
          await this.prisma.notificationJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              error: errorMsg,
              completedAt: new Date(),
              attempts,
            },
          });

          this.gateway.notifyJobUpdated({
            batchId,
            creditorId: job.creditorId,
            jobId: job.id,
            status: 'FAILED',
            completedAt: new Date().toISOString(),
            error: errorMsg,
            attempts,
          });
        }

        this.logger.error(`Job ${job.id} failed for creditor ${job.creditorId}: ${errorMsg}`);
      }
    }

    this.running = false;
    this.activeBatchId = null;
    this.paused = false;
    this.cancelRequested = false;
    this.logger.log(`Batch ${batchId} completed`);
  }

  async cancelBatch(batchId: string): Promise<{ cancelled: number }> {
    const result = await this.prisma.notificationJob.updateMany({
      where: { batchId, status: { in: ['QUEUED', 'RETRYING'] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    return { cancelled: result.count };
  }

  async pauseQueue(): Promise<void> {
    this.paused = true;
    this.logger.log('Queue paused');
  }

  async resumeQueue(): Promise<void> {
    this.paused = false;
    this.logger.log('Queue resumed');
  }

  isQueuePaused(): boolean {
    return this.paused;
  }

  async requestCancelQueue(): Promise<void> {
    this.cancelRequested = true;
    this.logger.log(`Cancel requested for batch ${this.activeBatchId}`);
  }

  async listQueue(status?: string, page = 1, limit = 50) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.notificationJob.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          acreedor: {
            select: { id: true, nombre: true },
          },
        },
      }),
      this.prisma.notificationJob.count({ where }),
    ]);

    const counts: Record<string, number> = {};
    const countResults = await this.prisma.notificationJob.groupBy({
      by: ['status'],
      _count: { id: true },
    });
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
      isPaused: this.paused,
      activeBatchId: this.activeBatchId,
    };
  }

  async retryJobs(jobIds: number[]): Promise<{ retried: number }> {
    const result = await this.prisma.notificationJob.updateMany({
      where: {
        id: { in: jobIds },
        status: { in: ['FAILED', 'CANCELLED'] },
      },
      data: {
        status: 'QUEUED',
        error: null,
        completedAt: null,
        startedAt: null,
      },
    });

    if (result.count > 0) {
      const retriedJobs = await this.prisma.notificationJob.findMany({
        where: { id: { in: jobIds }, status: 'QUEUED' },
      });

      const enqueued: EnqueuedJob[] = retriedJobs.map((j) => ({
        id: j.id,
        creditorId: j.creditorId ?? 0,
        batchId: `retry-${Date.now()}`,
        phoneNumber: (j.payload as any)?.phoneNumber ?? '',
        text: (j.payload as any)?.messageText ?? '',
      }));

      if (enqueued.length > 0 && !this.running) {
        this.processQueue(`retry-${Date.now()}`, enqueued);
      }
    }

    return { retried: result.count };
  }

  async cancelAllQueued(): Promise<{ cancelled: number }> {
    const result = await this.prisma.notificationJob.updateMany({
      where: { status: { in: ['QUEUED', 'RETRYING', 'PROCESSING'] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    this.cancelRequested = true;

    return { cancelled: result.count };
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
        createdAt: true,
        startedAt: true,
        completedAt: true,
        payload: true,
      },
    });

    const total = jobs.length;
    const sent = jobs.filter((j) => j.status === 'SENT').length;
    const failed = jobs.filter((j) => j.status === 'FAILED').length;
    const queued = jobs.filter((j) => j.status === 'QUEUED' || j.status === 'PROCESSING' || j.status === 'RETRYING').length;
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
        createdAt: j.createdAt?.toISOString() ?? null,
        startedAt: j.startedAt?.toISOString() ?? null,
        completedAt: j.completedAt?.toISOString() ?? null,
      })),
    };
  }

  isQueueRunning(): boolean {
    return this.running;
  }

  getActiveBatchId(): string | null {
    return this.activeBatchId;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
