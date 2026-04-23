"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImageFile = validateImageFile;
exports.buildImageRelativePath = buildImageRelativePath;
exports.resolveImageFilePath = resolveImageFilePath;
exports.saveImageFile = saveImageFile;
exports.deleteImageFolder = deleteImageFolder;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const sharp = require("sharp");
const upload_constants_1 = require("./upload.constants");
function validateImageFile(file) {
    if (!file) {
        throw new common_1.BadRequestException('Archivo requerido');
    }
    if (!upload_constants_1.ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
        throw new common_1.BadRequestException('Tipo de archivo inválido');
    }
    const size = file.size ?? file.buffer?.length ?? 0;
    if (size > upload_constants_1.MAX_IMAGE_BYTES) {
        throw new common_1.BadRequestException('El archivo supera el tamaño máximo permitido');
    }
}
function buildImageRelativePath(scope, id) {
    return `/uploads/${scope}/${id}/image.webp`;
}
function resolveImageFilePath(scope, id) {
    const baseDir = (0, path_1.resolve)(upload_constants_1.UPLOADS_DIR);
    const target = (0, path_1.resolve)(baseDir, scope, id, 'image.webp');
    if (!target.startsWith(`${baseDir}${path_1.sep}`)) {
        throw new common_1.BadRequestException('Ruta inválida');
    }
    return target;
}
async function saveImageFile(scope, id, file) {
    validateImageFile(file);
    const filePath = resolveImageFilePath(scope, id);
    await fs_1.promises.mkdir((0, path_1.dirname)(filePath), { recursive: true });
    await sharp(file.buffer)
        .resize({
        width: upload_constants_1.IMAGE_MAX_DIMENSION,
        height: upload_constants_1.IMAGE_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
    })
        .webp({ quality: upload_constants_1.IMAGE_QUALITY })
        .toFile(filePath);
    return buildImageRelativePath(scope, id);
}
async function deleteImageFolder(scope, id) {
    const baseDir = (0, path_1.resolve)(upload_constants_1.UPLOADS_DIR);
    const folder = (0, path_1.resolve)(baseDir, scope, id);
    if (!folder.startsWith(`${baseDir}${path_1.sep}`)) {
        throw new common_1.BadRequestException('Ruta inválida');
    }
    await fs_1.promises.rm(folder, { recursive: true, force: true });
}
