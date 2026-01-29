import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './modules/app.module';
import { PrismaService } from './modules/common/prisma.service';
import { UPLOADS_DIR } from './modules/common/upload.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3000;
  const corsOrigin = config.get<string>('CORS_ORIGIN') || '*';

  app.enableCors({ origin: corsOrigin });
  app.disable('etag');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads' });
  app.useStaticAssets(join(process.cwd(), 'public'));

  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  await app.listen(port);
}

bootstrap();
