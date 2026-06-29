"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const multer_1 = require("multer");
const path_1 = require("path");
const sharp = require("sharp");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const upload_constants_1 = require("../common/upload.constants");
const update_setting_dto_1 = require("./dto/update-setting.dto");
const settings_service_1 = require("./settings.service");
const uploadDir = (0, path_1.join)(upload_constants_1.UPLOADS_DIR, upload_constants_1.SETTINGS_IMAGE_SUBDIR);
(0, fs_1.mkdirSync)(uploadDir, { recursive: true });
const MIME_TO_EXT = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
};
function safeFilename(file) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
        throw new common_1.BadRequestException('Tipo de archivo no soportado');
    }
    return `${unique}${ext}`;
}
const allowedLogoTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const logoUploadOptions = {
    storage: (0, multer_1.diskStorage)({
        destination: uploadDir,
        filename: (_req, file, cb) => {
            try {
                cb(null, safeFilename(file));
            }
            catch (err) {
                cb(err, '');
            }
        },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!allowedLogoTypes.has(file.mimetype)) {
            cb(new common_1.BadRequestException('Tipo de archivo inválido para logo. Usar PNG, JPEG o WebP.'), false);
            return;
        }
        cb(null, true);
    },
};
const allowedFaviconTypes = new Set(['image/x-icon', 'image/vnd.microsoft.icon', 'image/png']);
const faviconUploadOptions = {
    storage: (0, multer_1.diskStorage)({
        destination: uploadDir,
        filename: (_req, file, cb) => {
            try {
                cb(null, safeFilename(file));
            }
            catch (err) {
                cb(err, '');
            }
        },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!allowedFaviconTypes.has(file.mimetype)) {
            cb(new common_1.BadRequestException('Tipo de archivo inválido para favicon. Usar PNG o ICO.'), false);
            return;
        }
        cb(null, true);
    },
};
const allowedAnimationTypes = new Set(['application/json', 'text/plain', 'application/octet-stream']);
const animationUploadOptions = {
    storage: (0, multer_1.diskStorage)({
        destination: uploadDir,
        filename: (_req, file, cb) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${unique}.json`);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!allowedAnimationTypes.has(file.mimetype)) {
            cb(new common_1.BadRequestException('Tipo de archivo inválido para animación. Usar JSON.'), false);
            return;
        }
        cb(null, true);
    },
};
let SettingsController = class SettingsController {
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    get() {
        return this.settingsService.get();
    }
    update(dto) {
        return this.settingsService.update(dto);
    }
    async uploadLogo(file) {
        if (!file) {
            throw new common_1.BadRequestException('Logo requerido');
        }
        const originalPath = (0, path_1.join)(uploadDir, file.filename);
        const webpName = file.filename.replace(/\.\w+$/, '.webp');
        const webpPath = (0, path_1.join)(uploadDir, webpName);
        try {
            const buffer = (0, fs_1.readFileSync)(originalPath);
            await sharp(buffer)
                .resize({
                width: upload_constants_1.IMAGE_MAX_DIMENSION,
                height: upload_constants_1.IMAGE_MAX_DIMENSION,
                fit: 'inside',
                withoutEnlargement: true,
            })
                .webp({ quality: upload_constants_1.IMAGE_QUALITY })
                .toFile(webpPath);
            if (webpPath !== originalPath) {
                (0, fs_1.unlinkSync)(originalPath);
            }
            return this.settingsService.update({ logoUrl: `/uploads/${upload_constants_1.SETTINGS_IMAGE_SUBDIR}/${webpName}` });
        }
        catch {
            try {
                (0, fs_1.unlinkSync)(originalPath);
            }
            catch { }
            throw new common_1.BadRequestException('Error al procesar la imagen del logo');
        }
    }
    uploadFavicon(file) {
        if (!file) {
            throw new common_1.BadRequestException('Favicon requerido');
        }
        return this.settingsService.update({ faviconUrl: `/uploads/${upload_constants_1.SETTINGS_IMAGE_SUBDIR}/${file.filename}` });
    }
    uploadOkAnimation(file) {
        if (!file) {
            throw new common_1.BadRequestException('Animación OK requerida');
        }
        const filePath = (0, path_1.join)(uploadDir, file.filename);
        try {
            JSON.parse((0, fs_1.readFileSync)(filePath, 'utf8'));
        }
        catch {
            (0, fs_1.unlinkSync)(filePath);
            throw new common_1.BadRequestException('El archivo de animación no contiene JSON válido');
        }
        return this.settingsService.update({ okAnimationUrl: `/uploads/${upload_constants_1.SETTINGS_IMAGE_SUBDIR}/${file.filename}` });
    }
    uploadErrorAnimation(file) {
        if (!file) {
            throw new common_1.BadRequestException('Animación Error requerida');
        }
        const filePath = (0, path_1.join)(uploadDir, file.filename);
        try {
            JSON.parse((0, fs_1.readFileSync)(filePath, 'utf8'));
        }
        catch {
            (0, fs_1.unlinkSync)(filePath);
            throw new common_1.BadRequestException('El archivo de animación no contiene JSON válido');
        }
        return this.settingsService.update({ errorAnimationUrl: `/uploads/${upload_constants_1.SETTINGS_IMAGE_SUBDIR}/${file.filename}` });
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.CONFIGURACION, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_setting_dto_1.UpdateSettingDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('logo'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.CONFIGURACION, client_1.ModuleAccess.FULL),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', logoUploadOptions)),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "uploadLogo", null);
__decorate([
    (0, common_1.Post)('favicon'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.CONFIGURACION, client_1.ModuleAccess.FULL),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', faviconUploadOptions)),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "uploadFavicon", null);
__decorate([
    (0, common_1.Post)('animation-ok'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.CONFIGURACION, client_1.ModuleAccess.FULL),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', animationUploadOptions)),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "uploadOkAnimation", null);
__decorate([
    (0, common_1.Post)('animation-error'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.CONFIGURACION, client_1.ModuleAccess.FULL),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', animationUploadOptions)),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "uploadErrorAnimation", null);
exports.SettingsController = SettingsController = __decorate([
    (0, common_1.Controller)('settings'),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], SettingsController);
