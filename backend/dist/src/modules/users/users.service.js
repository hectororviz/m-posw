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
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        if (!dto?.password) {
            throw new common_1.BadRequestException('Password requerido');
        }
        const role = dto.role || 'USER';
        if (role === 'USER' && (!dto.externalPosId || dto.externalPosId.trim().length === 0)) {
            throw new common_1.BadRequestException('externalPosId requerido para cajas');
        }
        const existingByName = await this.prisma.user.findUnique({ where: { name: dto.name } });
        if (existingByName) {
            throw new common_1.BadRequestException('Usuario ya registrado');
        }
        if (dto.email) {
            const existingByEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
            if (existingByEmail) {
                throw new common_1.BadRequestException('Email ya registrado');
            }
        }
        const password = await bcrypt.hash(dto.password, 10);
        try {
            return await this.prisma.user.create({
                data: {
                    email: dto.email,
                    name: dto.name,
                    password,
                    role,
                    active: true,
                    externalPosId: dto.externalPosId,
                    externalStoreId: dto.externalStoreId,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    active: true,
                    externalPosId: true,
                    externalStoreId: true,
                },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const target = error.meta?.target;
                const targets = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
                if (targets.includes('email')) {
                    throw new common_1.BadRequestException('Email ya registrado');
                }
                if (targets.includes('name')) {
                    throw new common_1.BadRequestException('Usuario ya registrado');
                }
                throw new common_1.BadRequestException('Usuario ya registrado');
            }
            throw error;
        }
    }
    list() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
                externalPosId: true,
                externalStoreId: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    listForLogin() {
        return this.prisma.user.findMany({
            where: { active: true },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
                externalPosId: true,
            },
            orderBy: { name: 'asc' },
        });
    }
    async update(id, dto) {
        const data = { ...dto };
        if (dto.password) {
            data.password = await bcrypt.hash(dto.password, 10);
        }
        return this.prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
                externalPosId: true,
                externalStoreId: true,
            },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
