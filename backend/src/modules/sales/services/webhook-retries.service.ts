import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class WebhookRetriesService {
  private readonly logger = new Logger(WebhookRetriesService.name);

  constructor(private prisma: PrismaService) {}

  async listRetries(requester: { id: string; role: string }, query: { status?: string; page?: number; limit?: number }) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un administrador puede ver reintentos de webhook');
    }
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where = query.status ? { status: query.status } : {};
    const [total, data] = await Promise.all([
      this.prisma.webhookRetry.count({ where }),
      this.prisma.webhookRetry.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          provider: true,
          topic: true,
          resourceId: true,
          requestId: true,
          attempts: true,
          nextRetryAt: true,
          lastError: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return { data, total, page, limit };
  }

  async retryNow(id: string, requester: { id: string; role: string }) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un administrador puede reintentar webhooks');
    }
    const existing = await this.prisma.webhookRetry.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Reintento no encontrado');
    }
    const updated = await this.prisma.webhookRetry.update({
      where: { id },
      data: { status: 'PENDING', attempts: 0, nextRetryAt: new Date(), lastError: null },
    });
    this.logger.log(`Webhook retry manual id=${id} topic=${existing.topic} by=${requester.id}`);
    return updated;
  }
}
