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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const DEFAULT_SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';
const DEFAULT_STORE_NAME = 'MiBPS Demo';
const DEFAULT_ACCENT_COLOR = '#0ea5e9';
const DEFAULT_CLUB_NAME = '';
const DEFAULT_OK_ANIMATION_URL = '/animations/ok.json';
const DEFAULT_ERROR_ANIMATION_URL = '/animations/error.json';
let SettingsService = class SettingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get() {
        const settings = await this.prisma.setting.upsert({
            where: { id: DEFAULT_SETTING_ID },
            create: {
                id: DEFAULT_SETTING_ID,
                storeName: DEFAULT_STORE_NAME,
                clubName: DEFAULT_CLUB_NAME,
                enableTicketPrinting: false,
                logoUrl: null,
                faviconUrl: null,
                okAnimationUrl: null,
                errorAnimationUrl: null,
                accentColor: DEFAULT_ACCENT_COLOR,
                enableCashPayment: true,
                enableQrPayment: true,
                enableTransferPayment: true,
                movementInReasons: [],
                movementOutReasons: [],
            },
            update: {},
        });
        return {
            ...settings,
            okAnimationUrl: settings.okAnimationUrl ?? DEFAULT_OK_ANIMATION_URL,
            errorAnimationUrl: settings.errorAnimationUrl ?? DEFAULT_ERROR_ANIMATION_URL,
        };
    }
    async update(dto) {
        return this.prisma.setting.upsert({
            where: { id: DEFAULT_SETTING_ID },
            create: {
                id: DEFAULT_SETTING_ID,
                storeName: dto.storeName ?? DEFAULT_STORE_NAME,
                clubName: dto.clubName ?? DEFAULT_CLUB_NAME,
                enableTicketPrinting: dto.enableTicketPrinting ?? false,
                logoUrl: dto.logoUrl ?? null,
                faviconUrl: dto.faviconUrl ?? null,
                okAnimationUrl: dto.okAnimationUrl ?? null,
                errorAnimationUrl: dto.errorAnimationUrl ?? null,
                accentColor: dto.accentColor ?? DEFAULT_ACCENT_COLOR,
                enableCashPayment: dto.enableCashPayment ?? true,
                enableQrPayment: dto.enableQrPayment ?? true,
                enableTransferPayment: dto.enableTransferPayment ?? true,
                movementInReasons: dto.movementInReasons ?? [],
                movementOutReasons: dto.movementOutReasons ?? [],
            },
            update: {
                ...(dto.storeName !== undefined ? { storeName: dto.storeName } : {}),
                ...(dto.clubName !== undefined ? { clubName: dto.clubName } : {}),
                ...(dto.enableTicketPrinting !== undefined
                    ? { enableTicketPrinting: dto.enableTicketPrinting }
                    : {}),
                ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
                ...(dto.faviconUrl !== undefined ? { faviconUrl: dto.faviconUrl } : {}),
                ...(dto.okAnimationUrl !== undefined ? { okAnimationUrl: dto.okAnimationUrl } : {}),
                ...(dto.errorAnimationUrl !== undefined ? { errorAnimationUrl: dto.errorAnimationUrl } : {}),
                ...(dto.accentColor !== undefined ? { accentColor: dto.accentColor } : {}),
                ...(dto.enableCashPayment !== undefined ? { enableCashPayment: dto.enableCashPayment } : {}),
                ...(dto.enableQrPayment !== undefined ? { enableQrPayment: dto.enableQrPayment } : {}),
                ...(dto.enableTransferPayment !== undefined ? { enableTransferPayment: dto.enableTransferPayment } : {}),
                ...(dto.movementInReasons !== undefined ? { movementInReasons: dto.movementInReasons } : {}),
                ...(dto.movementOutReasons !== undefined ? { movementOutReasons: dto.movementOutReasons } : {}),
            },
        });
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettingsService);
