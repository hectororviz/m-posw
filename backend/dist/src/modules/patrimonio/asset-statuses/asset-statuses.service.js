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
exports.AssetStatusesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let AssetStatusesService = class AssetStatusesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.assetStatus.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { assets: true } },
            },
        });
    }
    async create(dto) {
        const existing = await this.prisma.assetStatus.findUnique({ where: { name: dto.name } });
        if (existing)
            throw new common_1.BadRequestException('Ya existe un estado con ese nombre');
        return this.prisma.assetStatus.create({ data: { name: dto.name } });
    }
    async update(id, dto) {
        const status = await this.prisma.assetStatus.findUnique({ where: { id } });
        if (!status)
            throw new common_1.NotFoundException('Estado no encontrado');
        if (status.isSystem) {
            throw new common_1.ForbiddenException('No se puede modificar un estado del sistema');
        }
        if (dto.name !== undefined) {
            const existing = await this.prisma.assetStatus.findUnique({ where: { name: dto.name } });
            if (existing && existing.id !== id) {
                throw new common_1.BadRequestException('Ya existe un estado con ese nombre');
            }
        }
        return this.prisma.assetStatus.update({ where: { id }, data: dto });
    }
    async toggle(id) {
        const status = await this.prisma.assetStatus.findUnique({ where: { id } });
        if (!status)
            throw new common_1.NotFoundException('Estado no encontrado');
        if (status.isSystem) {
            throw new common_1.ForbiddenException('No se puede modificar un estado del sistema');
        }
        return this.prisma.assetStatus.update({
            where: { id },
            data: { isActive: !status.isActive },
        });
    }
    async remove(id) {
        const status = await this.prisma.assetStatus.findUnique({
            where: { id },
            include: { _count: { select: { assets: true } } },
        });
        if (!status)
            throw new common_1.NotFoundException('Estado no encontrado');
        if (status.isSystem) {
            throw new common_1.ForbiddenException('No se puede eliminar un estado del sistema');
        }
        if (status._count.assets > 0) {
            throw new common_1.BadRequestException('No se puede eliminar un estado que tiene bienes asociados');
        }
        return this.prisma.assetStatus.delete({ where: { id } });
    }
};
exports.AssetStatusesService = AssetStatusesService;
exports.AssetStatusesService = AssetStatusesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AssetStatusesService);
