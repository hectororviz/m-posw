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
exports.AssetsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const client_1 = require("@prisma/client");
const BAJA_STATUS_NAME = 'De Baja';
let AssetsService = class AssetsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(params) {
        const { categoryId, statusId, location, isActive, page = 1, limit = 25 } = params;
        const where = {};
        if (categoryId)
            where.categoryId = categoryId;
        if (statusId)
            where.statusId = statusId;
        if (location)
            where.location = { contains: location, mode: 'insensitive' };
        if (isActive !== undefined)
            where.isActive = isActive;
        else
            where.isActive = true;
        const [data, total] = await Promise.all([
            this.prisma.asset.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    category: true,
                    status: true,
                },
            }),
            this.prisma.asset.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(id) {
        const asset = await this.prisma.asset.findUnique({
            where: { id },
            include: {
                category: true,
                status: true,
            },
        });
        if (!asset)
            throw new common_1.NotFoundException('Bien no encontrado');
        return asset;
    }
    async create(dto, userId) {
        const activoStatus = await this.prisma.assetStatus.findFirst({
            where: { name: 'Activo', isSystem: true },
        });
        if (!activoStatus)
            throw new common_1.BadRequestException('Estado "Activo" no encontrado');
        const asset = await this.prisma.asset.create({
            data: {
                name: dto.name,
                description: dto.description,
                categoryId: dto.categoryId,
                statusId: activoStatus.id,
                location: dto.location,
                acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : null,
                acquisitionValue: dto.acquisitionValue ? new client_1.Prisma.Decimal(dto.acquisitionValue) : null,
                notes: dto.notes,
            },
            include: {
                category: true,
                status: true,
            },
        });
        await this.prisma.assetEvent.create({
            data: {
                assetId: asset.id,
                eventType: 'ALTA',
                statusId: activoStatus.id,
                description: 'Alta del bien',
                eventDate: new Date(),
                userId,
            },
        });
        return asset;
    }
    async update(id, dto, userId) {
        const existing = await this.prisma.asset.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Bien no encontrado');
        const changes = [];
        if (dto.name !== undefined && dto.name !== existing.name) {
            changes.push(`Nombre: "${existing.name}" → "${dto.name}"`);
        }
        if (dto.description !== undefined && dto.description !== existing.description) {
            changes.push('Descripción actualizada');
        }
        if (dto.categoryId !== undefined && dto.categoryId !== existing.categoryId) {
            const oldCat = await this.prisma.assetCategory.findUnique({ where: { id: existing.categoryId } });
            const newCat = await this.prisma.assetCategory.findUnique({ where: { id: dto.categoryId } });
            changes.push(`Categoría: "${oldCat?.name ?? existing.categoryId}" → "${newCat?.name ?? dto.categoryId}"`);
        }
        if (dto.location !== undefined && dto.location !== existing.location) {
            changes.push(`Ubicación: "${existing.location ?? ''}" → "${dto.location}"`);
        }
        if (dto.acquisitionDate !== undefined) {
            const existingStr = existing.acquisitionDate ? existing.acquisitionDate.toISOString().slice(0, 10) : '';
            if (dto.acquisitionDate !== existingStr) {
                changes.push('Fecha de adquisición actualizada');
            }
        }
        if (dto.acquisitionValue !== undefined) {
            const existingStr = existing.acquisitionValue?.toString() ?? '';
            if (dto.acquisitionValue !== existingStr) {
                changes.push('Valor de adquisición actualizado');
            }
        }
        if (dto.notes !== undefined && dto.notes !== existing.notes) {
            changes.push('Notas actualizadas');
        }
        const data = { ...dto };
        if (dto.acquisitionDate !== undefined) {
            data.acquisitionDate = dto.acquisitionDate ? new Date(dto.acquisitionDate) : null;
        }
        if (dto.acquisitionValue !== undefined) {
            data.acquisitionValue = dto.acquisitionValue ? new client_1.Prisma.Decimal(dto.acquisitionValue) : null;
        }
        const updated = await this.prisma.asset.update({
            where: { id },
            data,
            include: { category: true, status: true },
        });
        if (changes.length > 0) {
            await this.prisma.assetEvent.create({
                data: {
                    assetId: id,
                    eventType: 'MODIFICACION',
                    description: changes.join('; '),
                    eventDate: new Date(),
                    userId,
                },
            });
        }
        return updated;
    }
    async changeStatus(id, dto, userId) {
        const existing = await this.prisma.asset.findUnique({
            where: { id },
            include: { status: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Bien no encontrado');
        if (!existing.isActive) {
            throw new common_1.BadRequestException('No se puede cambiar el estado de un bien dado de baja');
        }
        const newStatus = await this.prisma.assetStatus.findUnique({ where: { id: dto.statusId } });
        if (!newStatus)
            throw new common_1.NotFoundException('Estado no encontrado');
        if (newStatus.isSystem && newStatus.name === BAJA_STATUS_NAME) {
            throw new common_1.BadRequestException('No se puede asignar el estado "De Baja" desde este endpoint');
        }
        const updated = await this.prisma.asset.update({
            where: { id },
            data: { statusId: dto.statusId },
            include: { category: true, status: true },
        });
        await this.prisma.assetEvent.create({
            data: {
                assetId: id,
                eventType: 'CAMBIO_ESTADO',
                statusId: dto.statusId,
                description: dto.description || `Estado: "${existing.status.name}" → "${newStatus.name}"`,
                eventDate: new Date(),
                userId,
            },
        });
        return updated;
    }
    async remove(id, userId) {
        const existing = await this.prisma.asset.findUnique({
            where: { id },
            include: { status: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Bien no encontrado');
        if (!existing.isActive) {
            throw new common_1.BadRequestException('El bien ya está dado de baja');
        }
        const bajaStatus = await this.prisma.assetStatus.findFirst({
            where: { name: BAJA_STATUS_NAME, isSystem: true },
        });
        if (!bajaStatus)
            throw new common_1.BadRequestException('Estado "De Baja" no encontrado');
        const updated = await this.prisma.asset.update({
            where: { id },
            data: {
                isActive: false,
                statusId: bajaStatus.id,
            },
            include: { category: true, status: true },
        });
        await this.prisma.assetEvent.create({
            data: {
                assetId: id,
                eventType: 'BAJA',
                statusId: bajaStatus.id,
                description: 'Baja del bien',
                eventDate: new Date(),
                userId,
            },
        });
        return updated;
    }
    async getEvents(id) {
        const asset = await this.prisma.asset.findUnique({ where: { id } });
        if (!asset)
            throw new common_1.NotFoundException('Bien no encontrado');
        return this.prisma.assetEvent.findMany({
            where: { assetId: id },
            orderBy: { eventDate: 'desc' },
            include: {
                status: true,
            },
        });
    }
};
exports.AssetsService = AssetsService;
exports.AssetsService = AssetsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AssetsService);
