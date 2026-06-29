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
exports.SociosBeneficiosService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let SociosBeneficiosService = class SociosBeneficiosService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(socioTipoId) {
        const where = {};
        if (socioTipoId)
            where.socioTipoId = parseInt(socioTipoId);
        return this.prisma.socioBeneficio.findMany({
            where,
            include: {
                socioTipo: { select: { id: true, nombre: true } },
                categoria: { select: { id: true, name: true } },
                producto: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id) {
        const b = await this.prisma.socioBeneficio.findUnique({ where: { id } });
        if (!b)
            throw new common_1.NotFoundException('Beneficio no encontrado');
        return b;
    }
    async create(dto) {
        if (!dto.categoriaProdId && !dto.productoId) {
            throw new common_1.BadRequestException('Debe seleccionar una categoria o un producto');
        }
        if (dto.categoriaProdId) {
            const existing = await this.prisma.socioBeneficio.findFirst({
                where: { socioTipoId: dto.socioTipoId, categoriaProdId: dto.categoriaProdId },
            });
            if (existing) {
                throw new common_1.BadRequestException('Ya existe un beneficio para este tipo de socio en esta categoria');
            }
        }
        if (dto.productoId) {
            const existing = await this.prisma.socioBeneficio.findFirst({
                where: { socioTipoId: dto.socioTipoId, productoId: dto.productoId },
            });
            if (existing) {
                throw new common_1.BadRequestException('Ya existe un beneficio para este tipo de socio en este producto');
            }
        }
        return this.prisma.socioBeneficio.create({ data: dto });
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.socioBeneficio.update({ where: { id }, data: dto });
    }
    async remove(id) {
        await this.findOne(id);
        const canjesCount = await this.prisma.socioCanje.count({ where: { socioBeneficioId: id } });
        if (canjesCount > 0) {
            return this.prisma.socioBeneficio.update({ where: { id }, data: { activo: false } });
        }
        return this.prisma.socioBeneficio.delete({ where: { id } });
    }
    async registerCanjes(dto, userId, posId) {
        const registrados = [];
        for (const item of dto.canjes) {
            const beneficio = await this.prisma.socioBeneficio.findUnique({
                where: { id: item.socioBeneficioId },
            });
            if (!beneficio || !beneficio.activo)
                continue;
            if (beneficio.limiteDiario) {
                const hoyInicio = new Date();
                hoyInicio.setUTCHours(3, 0, 0, 0);
                const canjesHoy = await this.prisma.socioCanje.count({
                    where: {
                        socioBeneficioId: beneficio.id,
                        socioId: parseInt(dto.socioId),
                        fecha: { gte: hoyInicio },
                    },
                });
                if (canjesHoy >= beneficio.limiteDiario)
                    continue;
            }
            const canje = await this.prisma.socioCanje.create({
                data: {
                    socioBeneficioId: item.socioBeneficioId,
                    socioId: parseInt(dto.socioId),
                    ventaId: dto.ventaId,
                    montoDescontado: item.montoDescontado,
                    usuarioId: userId,
                    posId: posId || null,
                },
            });
            registrados.push({
                id: canje.id,
                socioBeneficioId: canje.socioBeneficioId,
                montoDescontado: Number(canje.montoDescontado),
            });
        }
        return { canjes: registrados };
    }
};
exports.SociosBeneficiosService = SociosBeneficiosService;
exports.SociosBeneficiosService = SociosBeneficiosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SociosBeneficiosService);
