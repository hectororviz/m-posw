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

export interface PhoneInfo {
  displayName: string;
  verifiedName: string;
  phoneNumber: string;
  qualityRating: string;
}

export interface INotificationProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  sendMessage(phone: string, templateName: string, headerParams: string[], bodyParams: string[]): Promise<SendResult>;
  sendTextMessage(phone: string, text: string): Promise<SendResult>;
  getStatus(): Promise<ProviderStatus>;
  getPhoneInfo?(): Promise<PhoneInfo>;
  getTemplates?(): Promise<WhatsAppTemplate[]>;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  headerText?: string;
  bodyText?: string;
}
