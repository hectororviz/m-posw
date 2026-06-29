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
exports.UserPermissionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const ACCESS_CACHE_TTL_MS = 5000;
let UserPermissionsService = class UserPermissionsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.accessCache = new Map();
    }
    async getPermissions(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        if (!user) {
            throw new common_1.BadRequestException('Usuario no encontrado');
        }
        if (user.role === 'ADMIN') {
            return [];
        }
        const permissions = await this.prisma.userModulePermission.findMany({
            where: { userId },
            select: { module: true, access: true },
        });
        return permissions;
    }
    async setPermissions(userId, permissions) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        if (!user) {
            throw new common_1.BadRequestException('Usuario no encontrado');
        }
        if (user.role === 'ADMIN') {
            throw new common_1.BadRequestException('No se pueden modificar los permisos del administrador');
        }
        for (const p of permissions) {
            if (p.module === 'POS' && p.access === 'READ') {
                throw new common_1.BadRequestException('El módulo POS solo acepta HIDDEN o FULL');
            }
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.userModulePermission.deleteMany({ where: { userId } });
            if (permissions.length > 0) {
                await tx.userModulePermission.createMany({
                    data: permissions.map((p) => ({
                        userId,
                        module: p.module,
                        access: p.access,
                    })),
                });
            }
        });
        this.invalidateUserCache(userId);
    }
    async resolveAccess(userId, module) {
        const cacheKey = `${userId}:${module}`;
        const cached = this.accessCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < ACCESS_CACHE_TTL_MS) {
            return cached.access;
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        if (!user) {
            return 'HIDDEN';
        }
        if (user.role === 'ADMIN') {
            this.accessCache.set(cacheKey, { access: 'FULL', ts: Date.now() });
            return 'FULL';
        }
        const perm = await this.prisma.userModulePermission.findUnique({
            where: { userId_module: { userId, module } },
        });
        const access = perm?.access ?? 'HIDDEN';
        this.accessCache.set(cacheKey, { access, ts: Date.now() });
        return access;
    }
    invalidateUserCache(userId) {
        const prefix = `${userId}:`;
        for (const key of this.accessCache.keys()) {
            if (key.startsWith(prefix)) {
                this.accessCache.delete(key);
            }
        }
    }
};
exports.UserPermissionsService = UserPermissionsService;
exports.UserPermissionsService = UserPermissionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserPermissionsService);
