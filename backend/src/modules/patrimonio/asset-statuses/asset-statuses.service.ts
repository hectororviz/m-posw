import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class AssetStatusesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.assetStatus.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { assets: true } },
      },
    });
  }

  async create(dto: CreateStatusDto) {
    const existing = await this.prisma.assetStatus.findUnique({ where: { name: dto.name } });
    if (existing) throw new BadRequestException('Ya existe un estado con ese nombre');

    return this.prisma.assetStatus.create({ data: { name: dto.name } });
  }

  async update(id: number, dto: UpdateStatusDto) {
    const status = await this.prisma.assetStatus.findUnique({ where: { id } });
    if (!status) throw new NotFoundException('Estado no encontrado');

    if (status.isSystem) {
      throw new ForbiddenException('No se puede modificar un estado del sistema');
    }

    if (dto.name !== undefined) {
      const existing = await this.prisma.assetStatus.findUnique({ where: { name: dto.name } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Ya existe un estado con ese nombre');
      }
    }

    return this.prisma.assetStatus.update({ where: { id }, data: dto });
  }

  async toggle(id: number) {
    const status = await this.prisma.assetStatus.findUnique({ where: { id } });
    if (!status) throw new NotFoundException('Estado no encontrado');

    if (status.isSystem) {
      throw new ForbiddenException('No se puede modificar un estado del sistema');
    }

    return this.prisma.assetStatus.update({
      where: { id },
      data: { isActive: !status.isActive },
    });
  }

  async remove(id: number) {
    const status = await this.prisma.assetStatus.findUnique({
      where: { id },
      include: { _count: { select: { assets: true } } },
    });
    if (!status) throw new NotFoundException('Estado no encontrado');

    if (status.isSystem) {
      throw new ForbiddenException('No se puede eliminar un estado del sistema');
    }

    if (status._count.assets > 0) {
      throw new BadRequestException('No se puede eliminar un estado que tiene bienes asociados');
    }

    return this.prisma.assetStatus.delete({ where: { id } });
  }
}
