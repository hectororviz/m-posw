import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBeneficioDto } from './dto/create-beneficio.dto';
import { UpdateBeneficioDto } from './dto/update-beneficio.dto';
import { CreateCanjesDto } from './dto/create-canjes.dto';

@Injectable()
export class SociosBeneficiosService {
  constructor(private prisma: PrismaService) {}

  async findAll(socioTipoId?: string) {
    const where: any = {};
    if (socioTipoId) where.socioTipoId = parseInt(socioTipoId);

    return this.prisma.socioBeneficio.findMany({
      where,
      include: {
        socioTipo: { select: { id: true, nombre: true } },
        categoria: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const b = await this.prisma.socioBeneficio.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Beneficio no encontrado');
    return b;
  }

  async create(dto: CreateBeneficioDto) {
    const existing = await this.prisma.socioBeneficio.findUnique({
      where: { socioTipoId_categoriaProdId: { socioTipoId: dto.socioTipoId, categoriaProdId: dto.categoriaProdId } },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un beneficio para este tipo de socio en esta categoria');
    }
    return this.prisma.socioBeneficio.create({ data: dto });
  }

  async update(id: string, dto: UpdateBeneficioDto) {
    await this.findOne(id);
    return this.prisma.socioBeneficio.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const canjesCount = await this.prisma.socioCanje.count({ where: { socioBeneficioId: id } });
    if (canjesCount > 0) {
      return this.prisma.socioBeneficio.update({ where: { id }, data: { activo: false } });
    }
    return this.prisma.socioBeneficio.delete({ where: { id } });
  }

  async registerCanjes(dto: CreateCanjesDto, userId: string, posId?: string) {
    const registrados: any[] = [];

    for (const item of dto.canjes) {
      const beneficio = await this.prisma.socioBeneficio.findUnique({
        where: { id: item.socioBeneficioId },
      });

      if (!beneficio || !beneficio.activo) continue;

      // Validar límite diario
      if (beneficio.limiteDiario) {
        const hoyInicio = new Date();
        hoyInicio.setUTCHours(3, 0, 0, 0); // UTC-3 medianoche Argentina

        const canjesHoy = await this.prisma.socioCanje.count({
          where: {
            socioBeneficioId: beneficio.id,
            socioId: parseInt(dto.socioId),
            fecha: { gte: hoyInicio },
          },
        });

        if (canjesHoy >= beneficio.limiteDiario) continue;
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
}
