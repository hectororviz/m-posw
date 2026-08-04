export interface SendResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
  raw?: unknown;
}

export interface ProviderStatus {
  name: string;
  isConfigured: boolean;
  phoneNumberId?: string;
  businessAccountId?: string;
}

export interface INotificationProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  sendMessage(phone: string, templateName: string, params: Record<string, string>): Promise<SendResult>;
  sendTextMessage(phone: string, text: string): Promise<SendResult>;
  getStatus(): Promise<ProviderStatus>;
  getTemplates?(): Promise<WhatsAppTemplate[]>;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
}
