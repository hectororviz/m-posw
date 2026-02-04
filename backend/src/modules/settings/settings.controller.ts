import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Express } from 'express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { SETTINGS_IMAGE_SUBDIR, UPLOADS_DIR } from '../common/upload.constants';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SettingsService } from './settings.service';

const uploadDir = join(UPLOADS_DIR, SETTINGS_IMAGE_SUBDIR);
mkdirSync(uploadDir, { recursive: true });

const logoUploadOptions = {
  storage: diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new BadRequestException('Tipo de archivo inválido para logo'), false);
      return;
    }
    cb(null, true);
  },
};

const allowedFaviconTypes = new Set(['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml']);
const faviconUploadOptions = {
  storage: logoUploadOptions.storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!allowedFaviconTypes.has(file.mimetype)) {
      cb(new BadRequestException('Tipo de archivo inválido para favicon'), false);
      return;
    }
    cb(null, true);
  },
};

const allowedAnimationTypes = new Set(['application/json', 'text/plain', 'application/octet-stream']);
const animationUploadOptions = {
  storage: logoUploadOptions.storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!allowedAnimationTypes.has(file.mimetype) && extension !== '.json') {
      cb(new BadRequestException('Tipo de archivo inválido para animación'), false);
      return;
    }
    cb(null, true);
  },
};

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get() {
    return this.settingsService.get();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Body() dto: UpdateSettingDto) {
    console.log('Update settings dto:', dto);
    return this.settingsService.update(dto);
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', logoUploadOptions))
  uploadLogo(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Logo requerido');
    }
    return this.settingsService.update({ logoUrl: `/uploads/${SETTINGS_IMAGE_SUBDIR}/${file.filename}` });
  }

  @Post('favicon')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', faviconUploadOptions))
  uploadFavicon(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Favicon requerido');
    }
    return this.settingsService.update({ faviconUrl: `/uploads/${SETTINGS_IMAGE_SUBDIR}/${file.filename}` });
  }

  @Post('animation-ok')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', animationUploadOptions))
  uploadOkAnimation(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Animación OK requerida');
    }
    return this.settingsService.update({ okAnimationUrl: `/uploads/${SETTINGS_IMAGE_SUBDIR}/${file.filename}` });
  }

  @Post('animation-error')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', animationUploadOptions))
  uploadErrorAnimation(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Animación Error requerida');
    }
    return this.settingsService.update({ errorAnimationUrl: `/uploads/${SETTINGS_IMAGE_SUBDIR}/${file.filename}` });
  }
}
