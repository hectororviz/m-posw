"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const path_1 = require("path");
const app_module_1 = require("./modules/app.module");
const prisma_service_1 = require("./modules/common/prisma.service");
const upload_constants_1 = require("./modules/common/upload.constants");
const global_exception_filter_1 = require("./modules/common/global-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    const port = config.get('PORT') || 3000;
    const corsOrigin = config.get('CORS_ORIGIN') || '*';
    const webhookSecretLength = config.get('MP_WEBHOOK_SECRET')?.length ?? 0;
    const logger = new common_1.Logger('Bootstrap');
    app.enableCors({ origin: corsOrigin });
    app.getHttpAdapter().getInstance().disable('etag');
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new global_exception_filter_1.GlobalExceptionFilter());
    app.useStaticAssets(upload_constants_1.UPLOADS_DIR, { prefix: '/uploads' });
    app.useStaticAssets((0, path_1.join)(process.cwd(), 'public'));
    const prismaService = app.get(prisma_service_1.PrismaService);
    prismaService.enableShutdownHooks(app);
    logger.debug(`MercadoPago webhook secret length: ${webhookSecretLength}`);
    await app.listen(port);
}
bootstrap();
