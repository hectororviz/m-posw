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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma_service_1 = require("../common/prisma.service");
const user_permissions_service_1 = require("./user-permissions.service");
let UsersService = class UsersService {
    constructor(prisma, userPermissionsService) {
        this.prisma = prisma;
        this.userPermissionsService = userPermissionsService;
    }
    async create(dto) {
        if (!dto?.password) {
            throw new common_1.BadRequestException('Password requerido');
        }
        const existingByUsername = await this.prisma.user.findUnique({ where: { username: dto.username } });
        if (existingByUsername) {
            throw new common_1.BadRequestException('Usuario ya registrado');
        }
        const password = await bcrypt.hash(dto.password, 10);
        try {
            const user = await this.prisma.user.create({
                data: {
                    username: dto.username,
                    password,
                    role: 'USER',
                    active: true,
                    homeModule: dto.homeModule ?? null,
                    homeSmartphoneModule: dto.homeSmartphoneModule ?? null,
                },
                select: {
                    id: true,
                    username: true,
                    role: true,
                    active: true,
                    homeModule: true,
                    homeSmartphoneModule: true,
                    externalPosId: true,
                    externalStoreId: true,
                },
            });
            if (dto.permissions && dto.permissions.length > 0) {
                await this.userPermissionsService.setPermissions(user.id, dto.permissions);
            }
            const permissions = await this.userPermissionsService.getPermissions(user.id);
            return { ...user, permissions };
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new common_1.BadRequestException('Usuario ya registrado');
            }
            throw error;
        }
    }
    async list() {
        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                active: true,
                homeModule: true,
                homeSmartphoneModule: true,
                externalPosId: true,
                externalStoreId: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        const result = [];
        for (const user of users) {
            const permissions = user.role === 'ADMIN'
                ? []
                : await this.userPermissionsService.getPermissions(user.id);
            result.push({ ...user, permissions });
        }
        return result;
    }
    async update(id, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { role: true },
        });
        if (!user) {
            throw new common_1.BadRequestException('Usuario no encontrado');
        }
        if (user.role === 'ADMIN') {
            throw new common_1.BadRequestException('No se puede modificar al administrador');
        }
        const data = {};
        if (dto.username !== undefined)
            data.username = dto.username;
        if (dto.active !== undefined)
            data.active = dto.active;
        if (dto.homeModule !== undefined)
            data.homeModule = dto.homeModule;
        if (dto.homeSmartphoneModule !== undefined)
            data.homeSmartphoneModule = dto.homeSmartphoneModule;
        if (dto.externalPosId !== undefined)
            data.externalPosId = dto.externalPosId;
        if (dto.externalStoreId !== undefined)
            data.externalStoreId = dto.externalStoreId;
        if (dto.password) {
            data.password = await bcrypt.hash(dto.password, 10);
        }
        const result = await this.prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                username: true,
                role: true,
                active: true,
                homeModule: true,
                homeSmartphoneModule: true,
                externalPosId: true,
                externalStoreId: true,
            },
        });
        if (dto.permissions !== undefined) {
            await this.userPermissionsService.setPermissions(id, dto.permissions);
        }
        const permissions = await this.userPermissionsService.getPermissions(result.id);
        return { ...result, permissions };
    }
    async remove(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { role: true, username: true },
        });
        if (!user) {
            throw new common_1.BadRequestException('Usuario no encontrado');
        }
        if (user.role === 'ADMIN') {
            throw new common_1.BadRequestException('No se puede eliminar al administrador');
        }
        return this.prisma.user.delete({
            where: { id },
            select: { id: true, username: true },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        user_permissions_service_1.UserPermissionsService])
], UsersService);
