import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { INotificationProvider, SendResult, ProviderStatus, PhoneInfo, WhatsAppTemplate } from './provider.interface';

@Injectable()
export class WhatsAppCloudProvider implements INotificationProvider {
  readonly name = 'whatsapp-cloud';
  private readonly baseUrl = 'https://graph.facebook.com/v21.0';
  private readonly logger = new Logger(WhatsAppCloudProvider.name);

  constructor(private prisma: PrismaService) {}

  get isConfigured(): boolean {
    return true;
  }

  private async getConfig() {
    const setting = await this.prisma.setting.findFirst();
    return {
      phoneNumberId: setting?.whatsappPhoneNumberId,
      accessToken: setting?.whatsappAccessToken,
      businessAccountId: setting?.whatsappBusinessAccountId,
      webhookVerifyToken: setting?.whatsappWebhookVerifyToken,
    };
  }

  private async isActuallyConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return !!(config.phoneNumberId && config.accessToken);
  }

  async sendMessage(phone: string, templateName: string, params: string[]): Promise<SendResult> {
    const config = await this.getConfig();
    if (!config.phoneNumberId || !config.accessToken) {
      return { success: false, error: 'WhatsApp Cloud API no configurada' };
    }

    const to = phone.replace(/[^0-9]/g, '');

    const components = params.length > 0 ? [{
      type: 'body',
      parameters: params.map((value) => ({
        type: 'text',
        text: value,
      })),
    }] : [];

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es_AR' },
        ...(components.length > 0 ? { components } : {}),
      },
    };

    try {
      const url = `${this.baseUrl}/${config.phoneNumberId}/messages`;
      this.logger.log(`Sending WhatsApp template message to ${to}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`WhatsApp API error: ${JSON.stringify(data)}`);
        return {
          success: false,
          error: (data as any)?.error?.message || `HTTP ${response.status}`,
          raw: data,
        };
      }

      return {
        success: true,
        externalMessageId: (data as any)?.messages?.[0]?.id,
        raw: data,
      };
    } catch (err: any) {
      this.logger.error(`WhatsApp send failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async sendTextMessage(phone: string, text: string): Promise<SendResult> {
    const config = await this.getConfig();
    if (!config.phoneNumberId || !config.accessToken) {
      return { success: false, error: 'WhatsApp Cloud API no configurada' };
    }

    const to = phone.replace(/[^0-9]/g, '');

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    };

    try {
      const url = `${this.baseUrl}/${config.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: (data as any)?.error?.message || `HTTP ${response.status}`,
          raw: data,
        };
      }

      return {
        success: true,
        externalMessageId: (data as any)?.messages?.[0]?.id,
        raw: data,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getPhoneInfo(): Promise<PhoneInfo> {
    const config = await this.getConfig();
    if (!config.phoneNumberId || !config.accessToken) {
      return { displayName: '', verifiedName: '', phoneNumber: '', qualityRating: '' };
    }

    try {
      const url = `${this.baseUrl}/${config.phoneNumberId}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${config.accessToken}` },
      });
      const data = await response.json();
      return {
        displayName: (data as any)?.display_phone_number || '',
        verifiedName: (data as any)?.verified_name || '',
        phoneNumber: (data as any)?.display_phone_number || '',
        qualityRating: (data as any)?.quality_rating || 'UNKNOWN',
      };
    } catch {
      return { displayName: '', verifiedName: '', phoneNumber: '', qualityRating: '' };
    }
  }

  async getTemplates(): Promise<WhatsAppTemplate[]> {
    const config = await this.getConfig();
    if (!config.businessAccountId || !config.accessToken) {
      return [];
    }

    try {
      const url = `${this.baseUrl}/${config.businessAccountId}/message_templates?limit=100`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${config.accessToken}` },
      });
      const data = await response.json();
      return ((data as any)?.data || []).map((t: any) => ({
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category,
      }));
    } catch {
      return [];
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    const config = await this.getConfig();
    return {
      name: this.name,
      isConfigured: !!(config.phoneNumberId && config.accessToken),
      phoneNumberId: config.phoneNumberId || undefined,
      businessAccountId: config.businessAccountId || undefined,
    };
  }
}
