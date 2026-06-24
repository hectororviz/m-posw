import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePlayerCategoryDto } from './dto/create-player-category.dto';
import { UpdatePlayerCategoryDto } from './dto/update-player-category.dto';

@Injectable()
export class PlayerCategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const categories = await this.prisma.playerCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        tournaments: {
          include: {
            tournament: { select: { id: true, name: true } },
          },
        },
      },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      restrictionType: c.restrictionType,
      ageMin: c.ageMin,
      ageMax: c.ageMax,
      ageCutoffMonth: c.ageCutoffMonth,
      ageCutoffDay: c.ageCutoffDay,
      birthYear: c.birthYear,
      active: c.active,
      tournaments: c.tournaments.map((tc) => ({
        id: tc.tournament.id,
        name: tc.tournament.name,
      })),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async findOne(id: number) {
    const category = await this.prisma.playerCategory.findUnique({
      where: { id },
      include: {
        tournaments: {
          include: {
            tournament: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return {
      id: category.id,
      name: category.name,
      restrictionType: category.restrictionType,
      ageMin: category.ageMin,
      ageMax: category.ageMax,
      ageCutoffMonth: category.ageCutoffMonth,
      ageCutoffDay: category.ageCutoffDay,
      birthYear: category.birthYear,
      active: category.active,
      tournaments: category.tournaments.map((tc) => ({
        id: tc.tournament.id,
        name: tc.tournament.name,
      })),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async create(dto: CreatePlayerCategoryDto) {
    return this.prisma.playerCategory.create({
      data: {
        name: dto.name,
        restrictionType: dto.restrictionType,
        ageMin: dto.ageMin,
        ageMax: dto.ageMax,
        ageCutoffMonth: dto.ageCutoffMonth ?? 12,
        ageCutoffDay: dto.ageCutoffDay ?? 31,
        birthYear: dto.birthYear,
      },
    });
  }

  async update(id: number, dto: UpdatePlayerCategoryDto) {
    const category = await this.prisma.playerCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return this.prisma.playerCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.restrictionType !== undefined && { restrictionType: dto.restrictionType }),
        ...(dto.ageMin !== undefined && { ageMin: dto.ageMin }),
        ...(dto.ageMax !== undefined && { ageMax: dto.ageMax }),
        ...(dto.ageCutoffMonth !== undefined && { ageCutoffMonth: dto.ageCutoffMonth }),
        ...(dto.ageCutoffDay !== undefined && { ageCutoffDay: dto.ageCutoffDay }),
        ...(dto.birthYear !== undefined && { birthYear: dto.birthYear }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async remove(id: number) {
    const category = await this.prisma.playerCategory.findUnique({
      where: { id },
      include: {
        tournaments: {
          include: {
            tournament: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (category.tournaments.length > 0) {
      const names = category.tournaments
        .map((tc) => tc.tournament.name)
        .join(', ');
      throw new BadRequestException(
        `No se puede eliminar la categoría porque está en uso en los torneos: ${names}`,
      );
    }

    return this.prisma.playerCategory.delete({ where: { id } });
  }
}
