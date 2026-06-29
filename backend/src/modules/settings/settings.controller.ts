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
import { ModuleAccess, ModuleKey } from '@prisma/client';
import type { Express } from 'express';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { diskStorage } from 'multer';
import { join } from 'path';
import sharp = require('sharp');
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { SETTINGS_IMAGE_SUBDIR, UPLOADS_DIR, IMAGE_MAX_DIMENSION, IMAGE_QUALITY } from '../common/upload.constants';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SettingsService } from './settings.service';

const uploadDir = join(UPLOADS_DIR, SETTINGS_IMAGE_SUBDIR);
mkdirSync(uploadDir, { recursive: true });

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
};

function safeFilename(file: Express.Multer.File) {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = MIME_TO_EXT[file.mimetype];
  if (!ext) {
    throw new BadRequestException('Tipo de archivo no soportado');
  }
  return `${unique}${ext}`;
}

const allowedLogoTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const logoUploadOptions = {
  storage: diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      try {
        cb(null, safeFilename(file));
      } catch (err) {
        cb(err as Error, '');
      }
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!allowedLogoTypes.has(file.mimetype)) {
      cb(new BadRequestException('Tipo de archivo inválido para logo. Usar PNG, JPEG o WebP.'), false);
      return;
    }
    cb(null, true);
  },
};

const allowedFaviconTypes = new Set(['image/x-icon', 'image/vnd.microsoft.icon', 'image/png']);
const faviconUploadOptions = {
  storage: diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      try {
        cb(null, safeFilename(file));
      } catch (err) {
        cb(err as Error, '');
      }
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!allowedFaviconTypes.has(file.mimetype)) {
      cb(new BadRequestException('Tipo de archivo inválido para favicon. Usar PNG o ICO.'), false);
      return;
    }
    cb(null, true);
  },
};

const allowedAnimationTypes = new Set(['application/json', 'text/plain', 'application/octet-stream']);
const animationUploadOptions = {
  storage: diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}.json`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!allowedAnimationTypes.has(file.mimetype)) {
      cb(new BadRequestException('Tipo de archivo inválido para animación. Usar JSON.'), false);
      return;
    }
    cb(null, true);
  },
};

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  get() {
    return this.settingsService.get();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, ModuleAccessGuard)
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  update(@Body() dto: UpdateSettingDto) {
    return this.settingsService.update(dto);
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard, ModuleAccessGuard)
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  @UseInterceptors(FileInterceptor('file', logoUploadOptions))
  async uploadLogo(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Logo requerido');
    }
    const originalPath = join(uploadDir, file.filename);
    const webpName = file.filename.replace(/\.\w+$/, '.webp');
    const webpPath = join(uploadDir, webpName);
    try {
      const buffer = readFileSync(originalPath);
      await sharp(buffer)
        .resize({
          width: IMAGE_MAX_DIMENSION,
          height: IMAGE_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: IMAGE_QUALITY })
        .toFile(webpPath);
      if (webpPath !== originalPath) {
        unlinkSync(originalPath);
      }
      return this.settingsService.update({ logoUrl: `/uploads/${SETTINGS_IMAGE_SUBDIR}/${webpName}` });
    } catch {
      try { unlinkSync(originalPath); } catch { /* cleanup failed silently */ }
      throw new BadRequestException('Error al procesar la imagen del logo');
    }
  }

  @Post('favicon')
  @UseGuards(JwtAuthGuard, ModuleAccessGuard)
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  @UseInterceptors(FileInterceptor('file', faviconUploadOptions))
  uploadFavicon(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Favicon requerido');
    }
    return this.settingsService.update({ faviconUrl: `/uploads/${SETTINGS_IMAGE_SUBDIR}/${file.filename}` });
  }

  @Post('animation-ok')
  @UseGuards(JwtAuthGuard, ModuleAccessGuard)
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  @UseInterceptors(FileInterceptor('file', animationUploadOptions))
  uploadOkAnimation(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Animación OK requerida');
    }
    const filePath = join(uploadDir, file.filename);
    try {
      JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      unlinkSync(filePath);
      throw new BadRequestException('El archivo de animación no contiene JSON válido');
    }
    return this.settingsService.update({ okAnimationUrl: `/uploads/${SETTINGS_IMAGE_SUBDIR}/${file.filename}` });
  }

  @Post('animation-error')
  @UseGuards(JwtAuthGuard, ModuleAccessGuard)
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  @UseInterceptors(FileInterceptor('file', animationUploadOptions))
  uploadErrorAnimation(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Animación Error requerida');
    }
    const filePath = join(uploadDir, file.filename);
    try {
      JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      unlinkSync(filePath);
      throw new BadRequestException('El archivo de animación no contiene JSON válido');
    }
    return this.settingsService.update({ errorAnimationUrl: `/uploads/${SETTINGS_IMAGE_SUBDIR}/${file.filename}` });
  }
}
