import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WhatsAppMediaService } from './whatsapp-media.service';

@Controller('notificaciones/media-public')
export class MediaPublicController {
  constructor(private readonly mediaService: WhatsAppMediaService) {}

  @Get(':messageId')
  async getMedia(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Res() res: Response,
  ) {
    const result = await this.mediaService.getMediaPath(messageId);
    if (!result) {
      return res.status(404).json({ error: 'Media no encontrado' });
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(result.filePath, { headers: { 'Content-Type': result.mimeType } });
  }
}
