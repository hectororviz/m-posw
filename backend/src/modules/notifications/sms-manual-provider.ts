import { Injectable } from '@nestjs/common';
import { NotificationProvider, SendResult, SmsManualPayload } from './notification-provider.interface';

@Injectable()
export class SmsManualProvider implements NotificationProvider {
  readonly name = 'manual';

  async sendSms(_to: string, _text: string): Promise<SendResult> {
    return { success: false, error: 'El modo manual no envía automáticamente. Use el enlace sms: para abrir la app nativa.' };
  }

  getManualPayload(to: string, text: string): SmsManualPayload {
    return {
      phoneNumber: to,
      text,
      smsLink: `sms:${to}?body=${encodeURIComponent(text)}`,
    };
  }
}
