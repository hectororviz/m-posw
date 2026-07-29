export const NOTIFICATION_PROVIDER = 'NOTIFICATION_PROVIDER';

export interface SendResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface SmsManualPayload {
  phoneNumber: string;
  text: string;
  smsLink: string;
}

export interface NotificationProvider {
  readonly name: string;
  sendSms(to: string, text: string): Promise<SendResult>;
  getManualPayload(to: string, text: string): SmsManualPayload;
}
