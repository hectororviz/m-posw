import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PlayersStatsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const currentYear = new Date().getFullYear();

    const [totalPlayers, totalTournaments, totalCategories, playersInTournaments, totalCoaches] =
      await Promise.all([
        this.prisma.player.count(),
        this.prisma.tournament.count({ where: { year: currentYear } }),
        this.prisma.playerCategory.count(),
        this.prisma.tournamentPlayer.count({
          where: { tournament: { year: currentYear } },
        }),
        this.prisma.coach.count(),
      ]);

    const totalWithoutTournament = await this.prisma.player.count({
      where: { tournaments: { none: { tournament: { year: currentYear } } } },
    });

    // Per-tournament category counts with min/max players
    const tournaments = await this.prisma.tournament.findMany({
      where: { year: currentYear },
      include: {
        players: { select: { playerCategoryId: true } },
        categories: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
    });

    const playersByCategory: {
      tournamentId: number;
      tournamentName: string;
      tournamentMinPlayers: number | null;
      tournamentMaxPlayers: number | null;
      categoryName: string;
      count: number;
    }[] = [];

    for (const t of tournaments) {
      const catMap = t.categories.reduce((map, tc) => {
        map.set(tc.category.id, tc.category.name);
        return map;
      }, new Map<number, string>());

      const countMap = new Map<number, number>();
      for (const tp of t.players) {
        countMap.set(tp.playerCategoryId, (countMap.get(tp.playerCategoryId) ?? 0) + 1);
      }

      for (const [catId, catName] of catMap) {
        playersByCategory.push({
          tournamentId: t.id,
          tournamentName: t.name,
          tournamentMinPlayers: t.minPlayers,
          tournamentMaxPlayers: t.maxPlayers,
          categoryName: catName,
          count: countMap.get(catId) ?? 0,
        });
      }
    }

    playersByCategory.sort((a, b) => b.count - a.count || a.tournamentName.localeCompare(b.tournamentName));

    // Upcoming birthdays (next 20 days) — include category from most recent tournament
    const today = new Date();
    const allPlayers = await this.prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        tournaments: {
          orderBy: { fichadoAt: 'desc' },
          take: 1,
          select: { playerCategoryId: true },
        },
      },
    });

    const categoryIds = [
      ...new Set(
        allPlayers
          .filter((p) => p.tournaments.length > 0)
          .map((p) => p.tournaments[0].playerCategoryId),
      ),
    ];

    const categories = await this.prisma.playerCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const catNameMap = new Map(categories.map((c) => [c.id, c.name]));

    const upcomingBirthdays = allPlayers
      .filter((p) => {
        const birth = new Date(p.birthDate);
        const thisYearBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }
        const diffDays = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / 86400000);
        return diffDays >= 0;
      })
      .map((p) => {
        const birth = new Date(p.birthDate);
        const thisYearBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }
        const catId = p.tournaments[0]?.playerCategoryId;
        return {
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          birthDate: p.birthDate.toISOString(),
          age: thisYearBirthday.getFullYear() - birth.getFullYear(),
          daysUntil: Math.ceil((thisYearBirthday.getTime() - today.getTime()) / 86400000),
          categoryName: catId ? (catNameMap.get(catId) ?? null) : null,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return {
      totalPlayers,
      totalTournaments,
      totalCategories,
      totalCoaches,
      playersInTournaments,
      totalWithoutTournament,
      playersByCategory,
      upcomingBirthdays,
    };
  }
}
