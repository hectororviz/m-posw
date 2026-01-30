import { BadRequestException } from '@nestjs/common';
import type { Express } from 'express';
import { promises as fs } from 'fs';
import { dirname, resolve, sep } from 'path';
import sharp = require('sharp');
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_MAX_DIMENSION,
  IMAGE_QUALITY,
  MAX_IMAGE_BYTES,
  UPLOADS_DIR,
} from './upload.constants';

type ImageScope = 'categories' | 'products';

export function validateImageFile(file?: Express.Multer.File) {
  if (!file) {
    throw new BadRequestException('Archivo requerido');
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    throw new BadRequestException('Tipo de archivo inválido');
  }
  const size = file.size ?? file.buffer?.length ?? 0;
  if (size > MAX_IMAGE_BYTES) {
    throw new BadRequestException('El archivo supera el tamaño máximo permitido');
  }
}

export function buildImageRelativePath(scope: ImageScope, id: string) {
  return `/uploads/${scope}/${id}/image.webp`;
}

export function resolveImageFilePath(scope: ImageScope, id: string) {
  const baseDir = resolve(UPLOADS_DIR);
  const target = resolve(baseDir, scope, id, 'image.webp');
  if (!target.startsWith(`${baseDir}${sep}`)) {
    throw new BadRequestException('Ruta inválida');
  }
  return target;
}

export async function saveImageFile(scope: ImageScope, id: string, file: Express.Multer.File) {
  validateImageFile(file);
  const filePath = resolveImageFilePath(scope, id);
  await fs.mkdir(dirname(filePath), { recursive: true });
  await sharp(file.buffer)
    .resize({
      width: IMAGE_MAX_DIMENSION,
      height: IMAGE_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: IMAGE_QUALITY })
    .toFile(filePath);
  return buildImageRelativePath(scope, id);
}

export async function deleteImageFolder(scope: ImageScope, id: string) {
  const baseDir = resolve(UPLOADS_DIR);
  const folder = resolve(baseDir, scope, id);
  if (!folder.startsWith(`${baseDir}${sep}`)) {
    throw new BadRequestException('Ruta inválida');
  }
  await fs.rm(folder, { recursive: true, force: true });
}
