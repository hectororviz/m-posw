import { Controller, Get, Post, Query, Req, Res, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from '../common/prisma.service';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private prisma: PrismaService) {}

  @Get()
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const setting = await this.prisma.setting.findFirst({ orderBy: { createdAt: 'desc' } });
    const verifyToken = setting?.whatsappWebhookVerifyToken;

    if (!verifyToken) {
      this.logger.warn('Webhook verify token not configured');
      return res.status(403).send('Verify token not configured');
    }

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified');
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Verification failed');
  }

  @Post()
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    try {
      const body = req.body;

      if (!body?.entry) {
        return res.status(200).send('ok');
      }

      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          const value = change.value;

          if (value?.messages) {
            for (const msg of value.messages) {
              await this.handleIncomingMessage(value.metadata?.display_phone_number, msg);
            }
          }

          if (value?.statuses) {
            for (const status of value.statuses) {
              await this.handleStatusUpdate(status);
            }
          }
        }
      }

      return res.status(200).send('ok');
    } catch (err: any) {
      this.logger.error(`Webhook error: ${err.message}`);
      return res.status(200).send('ok');
    }
  }

  private async handleIncomingMessage(phoneNumberId: string, msg: any) {
    const from = msg.from;
    const messageId = msg.id;

    let content = '';
    let mediaType: string | null = null;
    let mediaId: string | null = null;
    let mediaMimeType: string | null = null;
    let caption: string | null = null;

    switch (msg.type) {
      case 'text':
        content = msg.text?.body || '';
        break;
      case 'image':
        mediaType = 'image';
        mediaId = msg.image?.id ?? null;
        mediaMimeType = msg.image?.mime_type ?? null;
        caption = msg.image?.caption || null;
        content = caption || '[Imagen]';
        break;
      case 'audio':
        mediaType = 'audio';
        mediaId = msg.audio?.id ?? null;
        mediaMimeType = msg.audio?.mime_type ?? null;
        content = '[Audio]';
        break;
      case 'sticker':
        mediaType = 'sticker';
        mediaId = msg.sticker?.id ?? null;
        mediaMimeType = msg.sticker?.mime_type ?? null;
        content = '[Sticker]';
        break;
      default:
        return;
    }

    this.logger.log(`Incoming WhatsApp ${msg.type} from ${from}: "${content}"`);

    let conversation = await this.prisma.whatsAppConversation.findUnique({
      where: { phoneNumber: from },
    });

    if (!conversation) {
      const acreedor = await this.prisma.acreedor.findFirst({
        where: { telefono: { contains: from.slice(-8) } },
      });

      conversation = await this.prisma.whatsAppConversation.create({
        data: {
          phoneNumber: from,
          acreedorId: acreedor?.id ?? null,
          lastMessageAt: new Date(),
          lastIncomingAt: new Date(),
        },
      });
    } else {
      await this.prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastIncomingAt: new Date(),
          ...(conversation.acreedorId ? {} : await this.tryMatchAcreedor(from)),
        },
      });
    }

    await this.prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content,
        externalMessageId: messageId,
        status: 'delivered',
        mediaType,
        mediaId,
        mediaMimeType,
        caption,
      },
    });
  }

  private async tryMatchAcreedor(phone: string) {
    const acreedor = await this.prisma.acreedor.findFirst({
      where: { telefono: { contains: phone.slice(-8) } },
    });
    return acreedor ? { acreedorId: acreedor.id } : {};
  }

  private async handleStatusUpdate(status: any) {
    const messageId = status.id;
    const newStatus = status.status;

    if (!messageId) return;

    await this.prisma.whatsAppMessage.updateMany({
      where: { externalMessageId: messageId },
      data: { status: newStatus },
    });

    if (newStatus === 'read' || newStatus === 'delivered') {
      await this.prisma.notificationJob.updateMany({
        where: { externalMessageId: messageId },
        data: { status: newStatus === 'delivered' ? 'SENT' : 'SENT' },
      });
    }
  }
}
