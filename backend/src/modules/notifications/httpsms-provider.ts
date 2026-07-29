import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { NotificationProvider, SendResult, SmsManualPayload } from './notification-provider.interface';

interface HttpSmsConfig {
  apiKey: string;
  baseUrl: string;
  fromNumber: string;
}

@Injectable()
export class HttpSmsProvider implements NotificationProvider {
  readonly name = 'httpsms';
  private readonly logger = new Logger(HttpSmsProvider.name);

  constructor(private config: HttpSmsConfig) {}

  async sendSms(to: string, text: string): Promise<SendResult> {
    const url = `${this.config.baseUrl}/v1/messages/send`;

    const body = JSON.stringify({
      content: text,
      from: this.config.fromNumber,
      to,
    });

    this.logger.log(`Sending SMS via httpSMS to ${to}: ${text.substring(0, 60)}...`);

    try {
      const data = await this.httpPost(url, body, this.config.apiKey);
      this.logger.log(`httpSMS accepted: ${JSON.stringify(data)}`);
      return {
        success: true,
        externalMessageId: data?.data?.id || data?.id || data?.messageId || undefined,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.error(`httpSMS send failed to ${to}: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  async getStatus(): Promise<{ connected: boolean; phoneOnline: boolean }> {
    return this.healthCheck();
  }

  private async healthCheck(): Promise<{ connected: boolean; phoneOnline: boolean }> {
    const url = `${this.config.baseUrl}/v1/messages/send`;
    const body = JSON.stringify({
      content: 'health-check',
      from: this.config.fromNumber,
      to: this.config.fromNumber,
      request_id: `health-${Date.now()}`,
    });

    try {
      await this.httpPost(url, body, this.config.apiKey);
      return { connected: true, phoneOnline: false };
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.includes('401')) {
        return { connected: false, phoneOnline: false };
      }
      return { connected: true, phoneOnline: false };
    }
  }

  getManualPayload(to: string, text: string): SmsManualPayload {
    return {
      phoneNumber: to,
      text,
      smsLink: `sms:${to}?body=${encodeURIComponent(text)}`,
    };
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
            'x-api-key': apiKey,
          },
          timeout: 15000,
          rejectUnauthorized: false,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (res.statusCode && res.statusCode >= 400) {
                this.logger.error(
                  `httpSMS HTTP ${res.statusCode} for ${fullUrl}: ${data.substring(0, 300)}`,
                );
                reject(
                  new Error(
                    `httpSMS error ${res.statusCode}: ${JSON.stringify(parsed)}`,
                  ),
                );
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new Error(`httpSMS invalid response: ${data.substring(0, 200)}`));
            }
          });
        },
      );

      req.on('error', (err) => reject(new Error(`httpSMS request failed: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('httpSMS request timeout'));
      });

      req.write(body);
      req.end();
    });
  }
}
