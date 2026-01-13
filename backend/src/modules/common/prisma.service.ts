import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  enableShutdownHooks(app: INestApplication) {
    const shutdown = async () => {
      try {
        await app.close();
      } catch (_) {
        // Ignore shutdown errors.
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('beforeExit', shutdown);
  }
}
