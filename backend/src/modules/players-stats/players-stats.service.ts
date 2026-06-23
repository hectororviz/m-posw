import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PlayersStatsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const currentYear = new Date().getFullYear();

    const tournaments = await this.prisma.tournament.findMany({
      where: { year: currentYear },
      include: {
        players: {
          select: { playerCategoryId: true },
        },
        categories: {
          include: {
            category: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const totalPlayersRegistered = await this.prisma.player.count();

    const playersWithTournamentThisYear = new Set<number>();
    for (const t of tournaments) {
      for (const tp of t.players) {
        // We need to get the playerId; the include already has it via TournamentPlayer
      }
    }

    const allTournamentPlayersThisYear = await this.prisma.tournamentPlayer.findMany({
      where: { tournament: { year: currentYear } },
      select: { playerId: true },
    });

    const fichadosSet = new Set(allTournamentPlayersThisYear.map((tp) => tp.playerId));
    const totalWithoutTournament = totalPlayersRegistered - fichadosSet.size;

    const tournamentData = tournaments.map((t) => {
      const categoryMap = new Map<number, { name: string; count: number }>();
      for (const cat of t.categories) {
        categoryMap.set(cat.category.id, { name: cat.category.name, count: 0 });
      }
      for (const tp of t.players) {
        const entry = categoryMap.get(tp.playerCategoryId);
        if (entry) entry.count++;
      }

      return {
        id: t.id,
        name: t.name,
        year: t.year,
        totalPlayers: t.players.length,
        byCategory: Array.from(categoryMap.values()),
      };
    });

    return {
      tournaments: tournamentData,
      totalPlayersRegistered,
      totalWithoutTournament,
    };
  }
}
