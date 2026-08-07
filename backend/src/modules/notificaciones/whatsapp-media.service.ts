import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../common/prisma.service';
import { UPLOADS_DIR, WHATSAPP_MEDIA_SUBDIR } from '../common/upload.constants';

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const MEDIA_DOWNLOAD_TIMEOUT_MS = 30000;
const BASE_URL = 'https://graph.facebook.com/v21.0';

function mimeToExt(mime: string): string {
  if (!mime) return '.bin';
  const normalized = mime.split(';')[0].trim();
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/aac': '.aac',
    'audio/amr': '.amr',
    'audio/wav': '.wav',
  };
  return map[normalized] || path.extname(normalized) || '.bin';
}

@Injectable()
export class WhatsAppMediaService {
  private readonly logger = new Logger(WhatsAppMediaService.name);
  private readonly downloadLocks = new Map<number, Promise<string | null>>();

  constructor(private prisma: PrismaService) {}

  async getMediaPath(messageId: number): Promise<{ filePath: string; mimeType: string } | null> {
    const message = await this.prisma.whatsAppMessage.findUnique({
      where: { id: messageId },
    });

    if (!message?.mediaId || !message?.mediaType || !message?.mediaMimeType) {
      return null;
    }

    const ext = mimeToExt(message.mediaMimeType);
    const dir = path.join(UPLOADS_DIR, WHATSAPP_MEDIA_SUBDIR, String(message.conversationId));
    const filePath = path.join(dir, `${messageId}${ext}`);

    if (fs.existsSync(filePath)) {
      return { filePath, mimeType: message.mediaMimeType };
    }

    return this.downloadMedia(messageId, message.mediaId, message.mediaMimeType, dir, filePath);
  }

  private async downloadMedia(
    messageId: number,
    mediaId: string,
    mimeType: string,
    dir: string,
    filePath: string,
  ): Promise<{ filePath: string; mimeType: string } | null> {
    const existingLock = this.downloadLocks.get(messageId);
    if (existingLock) {
      const result = await existingLock;
      return result ? { filePath: result, mimeType } : null;
    }

    const downloadPromise = this.doDownload(mediaId, dir, filePath, mimeType);
    this.downloadLocks.set(messageId, downloadPromise);

    try {
      const result = await downloadPromise;
      return result ? { filePath: result, mimeType } : null;
    } finally {
      this.downloadLocks.delete(messageId);
    }
  }

  private async doDownload(
    mediaId: string,
    dir: string,
    filePath: string,
    mimeType: string,
  ): Promise<string | null> {
    const setting = await this.prisma.setting.findFirst({ orderBy: { createdAt: 'desc' } });
    const accessToken = setting?.whatsappAccessToken;
    if (!accessToken) {
      this.logger.error('WhatsApp access token not configured');
      return null;
    }

    try {
      const mediaUrl = await this.fetchMediaUrl(mediaId, accessToken);
      if (!mediaUrl) return null;

      await fs.promises.mkdir(dir, { recursive: true });

      const success = await this.downloadBinary(mediaUrl, filePath, accessToken);
      if (!success) return null;

      return filePath;
    } catch (err: any) {
      this.logger.error(`Failed to download media ${mediaId}: ${err.message}`);
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      return null;
    }
  }

  private async fetchMediaUrl(mediaId: string, accessToken: string): Promise<string | null> {
    const url = `${BASE_URL}/${mediaId}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MEDIA_DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`Media API error for ${mediaId}: ${JSON.stringify(data)}`);
        return null;
      }

      const downloadUrl = (data as any)?.url;
      if (!downloadUrl) return null;

      const fileSize = (data as any)?.file_size;
      if (fileSize && fileSize > MAX_MEDIA_BYTES) {
        this.logger.warn(`Media ${mediaId} exceeds max size: ${fileSize}`);
        return null;
      }

      return downloadUrl;
    } catch (err: any) {
      this.logger.error(`Failed to fetch media URL for ${mediaId}: ${err.message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async downloadBinary(
    downloadUrl: string,
    filePath: string,
    accessToken: string,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MEDIA_DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.error(`Download failed: HTTP ${response.status}`);
        return false;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.promises.writeFile(filePath, buffer);

      return true;
    } catch (err: any) {
      this.logger.error(`Binary download failed: ${err.message}`);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async deleteMediaFile(conversationId: number, messageId: number): Promise<void> {
    const dir = path.join(UPLOADS_DIR, WHATSAPP_MEDIA_SUBDIR, String(conversationId));

    try {
      const files = await fs.promises.readdir(dir);
      const prefix = `${messageId}.`;
      for (const file of files) {
        if (file.startsWith(prefix)) {
          await fs.promises.unlink(path.join(dir, file));
          this.logger.log(`Deleted media file: ${file}`);
        }
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        this.logger.error(`Failed to delete media for message ${messageId}: ${err.message}`);
      }
    }
  }

  async deleteConversationMedia(conversationId: number): Promise<void> {
    const dir = path.join(UPLOADS_DIR, WHATSAPP_MEDIA_SUBDIR, String(conversationId));

    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
      this.logger.log(`Deleted conversation media dir: ${conversationId}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        this.logger.error(`Failed to delete media dir for conversation ${conversationId}: ${err.message}`);
      }
    }
  }
}
