import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

@Injectable()
export class TournamentsService {
  private readonly logger = new Logger(TournamentsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    year?: number;
    allowedSex?: string;
    page?: number;
    limit?: number;
  }) {
    const { year, allowedSex, page = 1, limit = 25 } = params;
    const where: any = {};

    if (year) where.year = +year;
    if (allowedSex) where.allowedSex = allowedSex;

    const [data, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ year: 'desc' }, { name: 'asc' }],
        include: {
          categories: {
            include: { category: { select: { id: true, name: true } } },
          },
          _count: { select: { players: true } },
        },
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return {
      data: data.map((t) => ({
        id: t.id,
        name: t.name,
        year: t.year,
        allowedSex: t.allowedSex,
        birthYearMin: t.birthYearMin,
        birthYearMax: t.birthYearMax,
        minPlayers: t.minPlayers,
        maxPlayers: t.maxPlayers,
        categories: t.categories.map((tc) => ({
          id: tc.category.id,
          name: tc.category.name,
        })),
        playerCount: t._count.players,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                restrictionType: true,
                ageMin: true,
                ageMax: true,
                ageCutoffMonth: true,
                ageCutoffDay: true,
                birthYear: true,
              },
            },
          },
        },
        _count: { select: { players: true } },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return {
      id: tournament.id,
      name: tournament.name,
      year: tournament.year,
      allowedSex: tournament.allowedSex,
      birthYearMin: tournament.birthYearMin,
      birthYearMax: tournament.birthYearMax,
      minPlayers: tournament.minPlayers,
      maxPlayers: tournament.maxPlayers,
      categories: tournament.categories.map((tc) => tc.category),
      playerCount: tournament._count.players,
      createdAt: tournament.createdAt,
      updatedAt: tournament.updatedAt,
    };
  }

  async create(dto: CreateTournamentDto) {
    this.validateBirthYearRange(dto.birthYearMin, dto.birthYearMax);
    const tournament = await this.prisma.tournament.create({
      data: {
        name: dto.name,
        year: dto.year,
        allowedSex: dto.allowedSex,
        birthYearMin: dto.birthYearMin,
        birthYearMax: dto.birthYearMax,
        minPlayers: dto.minPlayers,
        maxPlayers: dto.maxPlayers,
      },
    });

    if (dto.categoryIds && dto.categoryIds.length > 0) {
      await this.prisma.tournamentCategory.createMany({
        data: dto.categoryIds.map((catId) => ({
          tournamentId: tournament.id,
          playerCategoryId: catId,
        })),
      });
    }

    return this.findOne(tournament.id);
  }

  async update(id: number, dto: UpdateTournamentDto) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id } });
    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const effectiveMin = dto.birthYearMin !== undefined ? dto.birthYearMin : tournament.birthYearMin;
    const effectiveMax = dto.birthYearMax !== undefined ? dto.birthYearMax : tournament.birthYearMax;
    this.validateBirthYearRange(effectiveMin, effectiveMax);

    const updated = await this.prisma.tournament.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.year !== undefined && { year: dto.year }),
        ...(dto.allowedSex !== undefined && { allowedSex: dto.allowedSex }),
        ...(dto.birthYearMin !== undefined && { birthYearMin: dto.birthYearMin }),
        ...(dto.birthYearMax !== undefined && { birthYearMax: dto.birthYearMax }),
        ...(dto.minPlayers !== undefined && { minPlayers: dto.minPlayers }),
        ...(dto.maxPlayers !== undefined && { maxPlayers: dto.maxPlayers }),
      },
    });

    if (dto.categoryIds !== undefined) {
      await this.prisma.tournamentCategory.deleteMany({
        where: { tournamentId: id },
      });
      if (dto.categoryIds.length > 0) {
        await this.prisma.tournamentCategory.createMany({
          data: dto.categoryIds.map((catId) => ({
            tournamentId: id,
            playerCategoryId: catId,
          })),
        });
      }
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { players: true } } },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (tournament._count.players > 0) {
      throw new BadRequestException(
        'No se puede eliminar el torneo porque tiene jugadores fichados',
      );
    }

    return this.prisma.tournament.delete({ where: { id } });
  }

  async getPlayers(tournamentId: number, params: { search?: string; categoryId?: number }) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const where: any = { tournamentId };
    if (params.categoryId) {
      where.playerCategoryId = params.categoryId;
    }

    const tournamentPlayers = await this.prisma.tournamentPlayer.findMany({
      where,
      include: {
        player: true,
      },
      orderBy: { fichadoAt: 'desc' },
    });

    let players = tournamentPlayers.map((tp) => ({
      id: tp.player.id,
      firstName: tp.player.firstName,
      lastName: tp.player.lastName,
      dni: tp.player.dni,
      birthDate: tp.player.birthDate,
      sex: tp.player.sex,
      playerCategoryId: tp.playerCategoryId,
      fichadoAt: tp.fichadoAt,
    }));

    if (params.search) {
      const s = params.search.toLowerCase();
      players = players.filter(
        (p) =>
          p.firstName.toLowerCase().includes(s) ||
          p.lastName.toLowerCase().includes(s) ||
          p.dni.includes(s),
      );
    }

    return players;
  }

  async getEligiblePlayers(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const allPlayers = await this.prisma.player.findMany({
      orderBy: { lastName: 'asc' },
    });

    const fichados = await this.prisma.tournamentPlayer.findMany({
      where: { tournamentId },
    });
    const fichadoSet = new Set(fichados.map((f) => f.playerId));

    const yearTournaments = await this.prisma.tournament.findMany({
      where: {
        year: tournament.year,
        id: { not: tournamentId },
      },
      include: {
        players: { select: { playerId: true } },
      },
    });

    const otherTournamentMap = new Map<number, string>();
    for (const ot of yearTournaments) {
      for (const tp of ot.players) {
        if (!otherTournamentMap.has(tp.playerId)) {
          otherTournamentMap.set(tp.playerId, ot.name);
        }
      }
    }

    const result = allPlayers
      .filter((player) => {
        if (tournament.allowedSex !== 'X' && player.sex !== tournament.allowedSex) {
          return false;
        }
        const birthYear = player.birthDate.getFullYear();
        if (tournament.birthYearMin && birthYear < tournament.birthYearMin) {
          return false;
        }
        if (tournament.birthYearMax && birthYear > tournament.birthYearMax) {
          return false;
        }
        return true;
      })
      .map((player) => {
        const assignedCategoryId = this.computeCategory(
          player.birthDate,
          tournament.year,
          tournament.categories.map((tc) => tc.category),
        );

        return {
          id: player.id,
          firstName: player.firstName,
          lastName: player.lastName,
          dni: player.dni,
          birthDate: player.birthDate,
          sex: player.sex,
          assignedCategoryId,
          alreadyFichado: fichadoSet.has(player.id),
          fichadoEnOtroTorneoMismoAnio: otherTournamentMap.has(player.id),
          otroTorneoNombre: otherTournamentMap.get(player.id) || null,
        };
      });

    return result;
  }

  async ficharJugadores(tournamentId: number, playerIds: number[]) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const categories = tournament.categories.map((tc) => tc.category);
    if (categories.length === 0) {
      throw new BadRequestException(
        'El torneo no tiene categorías habilitadas. Agregá categorías antes de fichar jugadores.',
      );
    }

    const players = await this.prisma.player.findMany({
      where: { id: { in: playerIds } },
    });

    const errores: { playerId: number; mensaje: string }[] = [];
    const fichajes: { playerId: number; playerCategoryId: number }[] = [];

    for (const player of players) {
      const catId = this.computeCategory(player.birthDate, tournament.year, categories);
      if (!catId) {
        errores.push({
          playerId: player.id,
          mensaje: `El jugador ${player.lastName}, ${player.firstName} no encaja en ninguna categoría del torneo`,
        });
        continue;
      }

      const existing = await this.prisma.tournamentPlayer.findUnique({
        where: {
          playerId_tournamentId: {
            playerId: player.id,
            tournamentId,
          },
        },
      });
      if (existing) {
        errores.push({
          playerId: player.id,
          mensaje: `El jugador ${player.lastName}, ${player.firstName} ya está fichado en este torneo`,
        });
        continue;
      }

      fichajes.push({ playerId: player.id, playerCategoryId: catId });
    }

    if (fichajes.length > 0) {
      await this.prisma.tournamentPlayer.createMany({
        data: fichajes.map((f) => ({
          playerId: f.playerId,
          tournamentId,
          playerCategoryId: f.playerCategoryId,
        })),
      });
    }

    return {
      fichados: fichajes.length,
      errores: errores.map((e) => e.mensaje),
    };
  }

  async desficharJugador(tournamentId: number, playerId: number) {
    const tp = await this.prisma.tournamentPlayer.findUnique({
      where: {
        playerId_tournamentId: { playerId, tournamentId },
      },
    });

    if (!tp) {
      throw new NotFoundException('El jugador no está fichado en este torneo');
    }

    return this.prisma.tournamentPlayer.delete({
      where: { id: tp.id },
    });
  }

  private computeCategory(
    birthDate: Date,
    tournamentYear: number,
    categories: Array<{
      id: number;
      restrictionType: string;
      ageMin?: number | null;
      ageMax?: number | null;
      ageCutoffMonth?: number | null;
      ageCutoffDay?: number | null;
      birthYear?: number | null;
    }>,
  ): number | null {
    const birthYear = birthDate.getFullYear();

    for (const cat of categories) {
      if (cat.restrictionType === 'BIRTH_YEAR') {
        if (cat.birthYear && birthYear === cat.birthYear) {
          return cat.id;
        }
      } else if (cat.restrictionType === 'AGE') {
        const cutoffMonth = cat.ageCutoffMonth ?? 12;
        const cutoffDay = cat.ageCutoffDay ?? 31;
        const cutoffDate = new Date(tournamentYear, cutoffMonth - 1, cutoffDay);

        let age = tournamentYear - birthYear;
        if (
          birthDate.getMonth() > cutoffDate.getMonth() ||
          (birthDate.getMonth() === cutoffDate.getMonth() &&
            birthDate.getDate() > cutoffDate.getDate())
        ) {
          age--;
        }

        const minOk = cat.ageMin == null || age >= cat.ageMin;
        const maxOk = cat.ageMax == null || age <= cat.ageMax;

        if (minOk && maxOk) {
          return cat.id;
        }
      }
    }

    return null;
  }

  private validateBirthYearRange(min?: number | null, max?: number | null) {
    if (min != null && max != null && min > max) {
      throw new BadRequestException(
        `El año de nacimiento mínimo (${min}) no puede ser mayor al máximo (${max})`,
      );
    }
  }
}
