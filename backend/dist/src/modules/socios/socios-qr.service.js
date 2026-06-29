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
exports.SociosQrService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let SociosQrService = class SociosQrService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolve(uuid) {
        const socio = await this.prisma.socio.findUnique({
            where: { uuid },
            include: { socioTipo: { select: { nombre: true } } },
        });
        if (!socio) {
            return null;
        }
        let estado;
        if (socio.estado === 'INACTIVO') {
            estado = 'INACTIVO';
        }
        else if (socio.estado === 'SUSPENDIDO') {
            estado = 'SUSPENDIDO';
        }
        else {
            const ahora = new Date();
            const anioActual = ahora.getUTCFullYear();
            const mesActual = ahora.getUTCMonth() + 1;
            const cuotasAtrasadas = await this.prisma.socioCuota.findMany({
                where: {
                    socioId: socio.id,
                    estado: { in: ['PENDIENTE', 'PARCIAL'] },
                    OR: [
                        { anio: { lt: anioActual } },
                        { anio: anioActual, mes: { lt: mesActual } },
                    ],
                },
                select: { id: true },
            });
            estado = cuotasAtrasadas.length > 0 ? 'ATRASADO' : 'AL_DIA';
        }
        let beneficios = [];
        if (estado === 'AL_DIA') {
            const beneficiosActivos = await this.prisma.socioBeneficio.findMany({
                where: { socioTipoId: socio.socioTipoId, activo: true },
                include: {
                    categoria: { select: { id: true, name: true } },
                    producto: { select: { id: true, name: true } },
                },
            });
            const hoyInicio = new Date();
            hoyInicio.setUTCHours(3, 0, 0, 0);
            beneficios = await Promise.all(beneficiosActivos.map(async (b) => {
                let disponible = true;
                let motivoNoDisponible = null;
                if (b.limiteDiario) {
                    const canjesHoy = await this.prisma.socioCanje.count({
                        where: {
                            socioBeneficioId: b.id,
                            socioId: socio.id,
                            fecha: { gte: hoyInicio },
                        },
                    });
                    if (canjesHoy >= b.limiteDiario) {
                        disponible = false;
                        motivoNoDisponible = 'Ya canjeado hoy';
                    }
                }
                return {
                    id: b.id,
                    categoriaId: b.categoria?.id || null,
                    categoriaNombre: b.categoria?.name || null,
                    productoId: b.producto?.id || null,
                    productoNombre: b.producto?.name || null,
                    porcentaje: Number(b.porcentaje),
                    descuentoMaximo: b.descuentoMaximo ? Number(b.descuentoMaximo) : null,
                    limiteDiario: b.limiteDiario || null,
                    disponible,
                    motivoNoDisponible,
                };
            }));
        }
        return {
            socio: {
                nombre: `${socio.apellido}, ${socio.nombre}`,
                nroSocio: socio.nroSocio,
                tipo: socio.socioTipo.nombre,
            },
            estado,
            beneficios,
        };
    }
};
exports.SociosQrService = SociosQrService;
exports.SociosQrService = SociosQrService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SociosQrService);
