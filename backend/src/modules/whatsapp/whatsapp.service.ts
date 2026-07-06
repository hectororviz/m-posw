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
    let apiUrl = setting?.openwaApiUrl || this.config.get<string>('OPENWA_API_URL', 'http://localhost:2785/api');
    apiUrl = apiUrl.replace(/\/+$/, '');
    if (!apiUrl.endsWith('/api')) {
      apiUrl += '/api';
    }
    return {
      apiUrl,
      apiKey: setting?.openwaApiKey || this.config.get<string>('OPENWA_API_KEY', ''),
      sessionName: setting?.openwaSessionName || this.config.get<string>('OPENWA_SESSION_NAME', 'mposw'),
      messageTemplate: setting?.openwaMessageTemplate || DEFAULT_MESSAGE_TEMPLATE,
    };
  }

  private async resolveSessionId(): Promise<string> {
    const { apiUrl, apiKey, sessionName } = await this.getOpenwaConfig();

    if (!apiUrl) throw new BadRequestException('URL de OpenWA no configurada');
    if (!apiKey) throw new BadRequestException('API Key de OpenWA no configurada');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(sessionName)) {
      return sessionName;
    }

    try {
      const sessions = await this.httpGetJson(`${apiUrl}/sessions`, apiKey);
      if (Array.isArray(sessions)) {
        const match = sessions.find(
          (s: any) => s.name === sessionName || s.id === sessionName,
        );
        if (match?.id) {
          this.logger.log(`Resolved session name "${sessionName}" to UUID ${match.id}`);
          return match.id;
        }
      }
    } catch (err) {
      this.logger.warn(`Could not resolve session name "${sessionName}": ${err}`);
    }

    return sessionName;
  }

  async sendMessage(phoneNumber: string, text: string, sourceModule = 'ACREEDORES', acreedorId?: number) {
    const { apiUrl, apiKey } = await this.getOpenwaConfig();
    const sessionId = await this.resolveSessionId();

    if (!apiUrl) throw new BadRequestException('URL de OpenWA no configurada');
    if (!apiKey) throw new BadRequestException('API Key de OpenWA no configurada');

    const fullUrl = `${apiUrl}/sessions/${sessionId}/messages/send-text`;
    const body = JSON.stringify({
      chatId: phoneNumber,
      text,
    });

    this.logger.log(`Sending WhatsApp via ${fullUrl} | chatId: ${phoneNumber}`);

    try {
      const data = await this.httpPost(fullUrl, body, apiKey);

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
    const { apiUrl, apiKey } = await this.getOpenwaConfig();

    if (!apiUrl) return { status: 'no_config' };
    if (!apiKey) return { status: 'no_api_key' };

    try {
      const sessionId = await this.resolveSessionId();
      const data = await this.httpGetJson(`${apiUrl}/sessions/${sessionId}`, apiKey);
      return data;
    } catch {
      return { status: 'unknown' };
    }
  }

  async getQrCode() {
    const { apiUrl, apiKey } = await this.getOpenwaConfig();

    if (!apiUrl) throw new BadRequestException('URL de OpenWA no configurada');
    if (!apiKey) throw new BadRequestException('API Key de OpenWA no configurada');

    try {
      const sessionId = await this.resolveSessionId();
      const data = await this.httpGet(`${apiUrl}/sessions/${sessionId}/qr`, apiKey);
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
      const sessionId = await this.resolveSessionId();
      await this.httpPost(`${apiUrl}/sessions/${sessionId}/start`, '{}', apiKey);
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
                this.logger.error(`OpenWA HTTP ${res.statusCode} for ${fullUrl}: ${data.substring(0, 300)}`);
                reject(new Error(`OpenWA error ${res.statusCode}: ${parsed.error || parsed.message || data.substring(0, 200)}`));
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

  private async httpGetJson(urlStr: string, apiKey: string): Promise<any> {
    const data = await this.httpGet(urlStr, apiKey);
    return JSON.parse(data);
  }
}
