import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import * as http from 'http';
import * as https from 'https';

const DEFAULT_MESSAGE_TEMPLATE =
  'Hola {{nombre}}, te recordamos que tenés una deuda pendiente de ${{saldo}} con {{dias}} días de antigüedad. Por favor regularizá tu situación a la brevedad. Gracias.';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private async getOpenwaConfig() {
    const setting = await this.prisma.setting.findFirst();
    return {
      apiUrl: setting?.openwaApiUrl || this.config.get<string>('OPENWA_API_URL', 'http://localhost:2785/api'),
      apiKey: setting?.openwaApiKey || this.config.get<string>('OPENWA_API_KEY', ''),
      sessionName: setting?.openwaSessionName || this.config.get<string>('OPENWA_SESSION_NAME', 'mposw'),
      messageTemplate: setting?.openwaMessageTemplate || DEFAULT_MESSAGE_TEMPLATE,
    };
  }

  async sendMessage(phoneNumber: string, text: string, sourceModule = 'ACREEDORES', acreedorId?: number) {
    const { apiUrl, apiKey, sessionName } = await this.getOpenwaConfig();

    if (!apiUrl) throw new BadRequestException('URL de OpenWA no configurada');
    if (!apiKey) throw new BadRequestException('API Key de OpenWA no configurada');

    const body = JSON.stringify({
      chatId: phoneNumber,
      text,
    });

    try {
      const data = await this.httpPost(`${apiUrl}/sessions/${sessionName}/messages/send-text`, body, apiKey);

      await this.prisma.notificationLog.create({
        data: {
          recipient: phoneNumber,
          phoneNumber,
          messageText: text,
          status: 'SENT',
          acreedorId: acreedorId ?? null,
          sourceModule,
        },
      });

      this.logger.log(`WhatsApp sent to ${phoneNumber}: ${text.substring(0, 80)}...`);
      return { success: true, messageId: data?.messageId, timestamp: data?.timestamp };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';

      await this.prisma.notificationLog.create({
        data: {
          recipient: phoneNumber,
          phoneNumber,
          messageText: text,
          status: 'FAILED',
          errorMessage: errorMsg,
          acreedorId: acreedorId ?? null,
          sourceModule,
        },
      });

      this.logger.error(`WhatsApp failed to ${phoneNumber}: ${errorMsg}`);
      throw new BadRequestException(`Error al enviar mensaje: ${errorMsg}`);
    }
  }

  async getSessionStatus() {
    const { apiUrl, apiKey, sessionName } = await this.getOpenwaConfig();

    if (!apiUrl) return { status: 'no_config' };
    if (!apiKey) return { status: 'no_api_key' };

    try {
      const data = await this.httpGet(`${apiUrl}/sessions/${sessionName}`, apiKey);
      return data;
    } catch {
      return { status: 'unknown' };
    }
  }

  async getQrCode() {
    const { apiUrl, apiKey, sessionName } = await this.getOpenwaConfig();

    if (!apiUrl) throw new BadRequestException('URL de OpenWA no configurada');
    if (!apiKey) throw new BadRequestException('API Key de OpenWA no configurada');

    try {
      const data = await this.httpGet(`${apiUrl}/sessions/${sessionName}/qr`, apiKey);
      return JSON.parse(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      throw new BadRequestException(`Error al obtener QR: ${errorMsg}`);
    }
  }

  async startSession() {
    const { apiUrl, apiKey, sessionName } = await this.getOpenwaConfig();

    if (!apiUrl) throw new BadRequestException('URL de OpenWA no configurada');
    if (!apiKey) throw new BadRequestException('API Key de OpenWA no configurada');

    try {
      const body = JSON.stringify({ name: sessionName });
      await this.httpPost(`${apiUrl}/sessions`, body, apiKey);
      await this.httpPost(`${apiUrl}/sessions/${sessionName}/start`, '{}', apiKey);
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      throw new BadRequestException(`Error al iniciar sesión: ${errorMsg}`);
    }
  }

  private httpPost(fullUrl: string, body: string, apiKey: string): Promise<any> {
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = mod.request(
        {
          protocol: parsed.protocol,
          host: parsed.host,
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-API-Key': apiKey,
          },
          timeout: 15000,
          rejectUnauthorized: false,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`OpenWA error ${res.statusCode}: ${parsed.error || parsed.message || 'unknown'}`));
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new Error(`OpenWA invalid response: ${data.substring(0, 200)}`));
            }
          });
        },
      );

      req.on('error', (err) => reject(new Error(`OpenWA request failed: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OpenWA request timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  private httpGet(urlStr: string, apiKey: string): Promise<string> {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = mod.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          timeout: 15000,
          rejectUnauthorized: false,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`OpenWA error ${res.statusCode}`));
            } else {
              resolve(data);
            }
          });
        },
      );

      req.on('error', (err) => reject(new Error(`OpenWA request failed: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OpenWA request timeout'));
      });

      req.end();
    });
  }
}
