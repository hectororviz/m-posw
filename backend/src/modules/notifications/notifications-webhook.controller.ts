import { Body, Controller, Headers, HttpCode, Logger, Post, RawBodyRequest, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('webhooks')
export class NotificationsWebhookController {
  private readonly logger = new Logger(NotificationsWebhookController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('httpsms')
  @HttpCode(200)
  async handleHttpsmsWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-event-type') eventType?: string,
    @Headers('authorization') authorization?: string,
    @Body() payload?: any,
  ) {
    const rawBody = (req as any).rawBody ?? req.body?.toString();

    this.logger.debug(`httpsms webhook: event=${eventType}`);

    try {
      await this.notificationsService.handleWebhook(
        eventType || 'unknown',
        payload || {},
        rawBody,
        authorization,
      );
    } catch (err) {
      this.logger.error(`Webhook error: ${err}`);
      throw err;
    }

    return { received: true };
  }
}
