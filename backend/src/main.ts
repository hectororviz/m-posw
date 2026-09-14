import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './modules/app.module';
import { PrismaService } from './modules/common/prisma.service';
import { UPLOADS_DIR } from './modules/common/upload.constants';
import { GlobalExceptionFilter } from './modules/common/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const port = config.get<number>('PORT') || 3000;
  const corsOrigin = config.get<string>('CORS_ORIGIN');
  const jwtSecret = config.get<string>('JWT_SECRET');

  if (!jwtSecret || jwtSecret.length < 32) {
    logger.error(
      'FATAL: JWT_SECRET no configurado o demasiado corto (mínimo 32 caracteres). ' +
      'Generá uno con: openssl rand -base64 48',
    );
    process.exit(1);
  }

  if (!corsOrigin) {
    logger.error(
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n' +
      '  ALERTA DE SEGURIDAD: CORS_ORIGIN no está configurado.\n' +
      '  CORS deshabilitado. Configurá CORS_ORIGIN en tu .env.\n' +
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
    );
  }

  app.use(helmet());
  app.enableCors({ origin: corsOrigin || false });
  app.getHttpAdapter().getInstance().disable('etag');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  
  // Global exception filter to ensure JSON responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.getHttpAdapter().getInstance().use('/uploads/whatsapp-media', (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(403).json({ message: 'Acceso denegado. Usar GET /notificaciones/media/:id autenticado.' });
  });
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads' });
  app.useStaticAssets(join(process.cwd(), 'public'));

  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  await app.listen(port);
}

bootstrap();
