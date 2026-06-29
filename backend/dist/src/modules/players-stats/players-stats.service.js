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
exports.PlayersStatsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let PlayersStatsService = class PlayersStatsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboard() {
        const currentYear = new Date().getFullYear();
        const [totalPlayers, totalTournaments, totalCategories, playersInTournaments, totalCoaches] = await Promise.all([
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
        const tournaments = await this.prisma.tournament.findMany({
            where: { year: currentYear },
            include: {
                players: { select: { playerCategoryId: true } },
                categories: {
                    include: { category: { select: { id: true, name: true } } },
                },
            },
        });
        const playersByCategory = [];
        for (const t of tournaments) {
            const catMap = t.categories.reduce((map, tc) => {
                map.set(tc.category.id, tc.category.name);
                return map;
            }, new Map());
            const countMap = new Map();
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
            ...new Set(allPlayers
                .filter((p) => p.tournaments.length > 0)
                .map((p) => p.tournaments[0].playerCategoryId)),
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
                type: 'player',
            };
        });
        const coaches = await this.prisma.coach.findMany({
            where: { birthDate: { not: null } },
            select: { id: true, firstName: true, lastName: true, birthDate: true },
        });
        const coachBirthdays = coaches
            .filter((c) => {
            const birth = new Date(c.birthDate);
            const thisYearBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
            if (thisYearBirthday < today) {
                thisYearBirthday.setFullYear(today.getFullYear() + 1);
            }
            const diffDays = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / 86400000);
            return diffDays >= 0;
        })
            .map((c) => {
            const birth = new Date(c.birthDate);
            const thisYearBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
            if (thisYearBirthday < today) {
                thisYearBirthday.setFullYear(today.getFullYear() + 1);
            }
            return {
                id: c.id,
                firstName: c.firstName,
                lastName: c.lastName,
                birthDate: c.birthDate.toISOString(),
                age: thisYearBirthday.getFullYear() - birth.getFullYear(),
                daysUntil: Math.ceil((thisYearBirthday.getTime() - today.getTime()) / 86400000),
                categoryName: 'DT',
                type: 'coach',
            };
        });
        const allBirthdays = [...upcomingBirthdays, ...coachBirthdays]
            .sort((a, b) => a.daysUntil - b.daysUntil);
        return {
            totalPlayers,
            totalTournaments,
            totalCategories,
            totalCoaches,
            playersInTournaments,
            totalWithoutTournament,
            playersByCategory,
            upcomingBirthdays: allBirthdays,
        };
    }
};
exports.PlayersStatsService = PlayersStatsService;
exports.PlayersStatsService = PlayersStatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlayersStatsService);
