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
var LigasService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LigasService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../common/prisma.service");
let LigasService = LigasService_1 = class LigasService {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        this.logger = new common_1.Logger(LigasService_1.name);
    }
    getSupabaseUrl() {
        return this.config.get('SUPABASE_URL');
    }
    getSupabaseKey() {
        return this.config.get('SUPABASE_ANON_KEY');
    }
    async supabaseGet(path) {
        const url = `${this.getSupabaseUrl()}/rest/v1${path}`;
        const headers = {
            apikey: this.getSupabaseKey(),
            Authorization: `Bearer ${this.getSupabaseKey()}`,
        };
        const res = await fetch(url, { headers });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Supabase ${res.status}: ${body}`);
        }
        return res.json();
    }
    async getLeagues() {
        return this.supabaseGet('/leagues?active=eq.true&order=created_at.asc');
    }
    async getCategories(leagueId) {
        return this.supabaseGet(`/categories?league_id=eq.${leagueId}&order=name.asc`);
    }
    async getTeams(leagueId) {
        const matches = await this.supabaseGet(`/matches?league_id=eq.${leagueId}&select=local_team_id,away_team_id&limit=10000`);
        const teamIds = new Set();
        for (const m of matches) {
            if (m.local_team_id)
                teamIds.add(m.local_team_id);
            if (m.away_team_id)
                teamIds.add(m.away_team_id);
        }
        if (teamIds.size === 0)
            return [];
        const ids = Array.from(teamIds);
        const chunks = [];
        for (let i = 0; i < ids.length; i += 50) {
            chunks.push(ids.slice(i, i + 50));
        }
        const allTeams = [];
        for (const chunk of chunks) {
            const filter = chunk.map((id) => `id.eq.${id}`).join(',');
            const teams = await this.supabaseGet(`/teams?select=id,name,short_name,logo_url,city&or=(${filter})&order=name.asc`);
            allTeams.push(...teams);
        }
        return allTeams;
    }
    async getMatchesByLeague(leagueId) {
        return this.supabaseGet(`/matches?league_id=eq.${leagueId}&order=matchday.asc&limit=10000`);
    }
    async getStandings(leagueId, categoryId) {
        let path = `/matches?league_id=eq.${leagueId}`;
        if (categoryId) {
            path += `&category_id=eq.${categoryId}`;
        }
        path += '&order=matchday.asc&limit=10000';
        const matches = await this.supabaseGet(path);
        const teams = await this.getTeams(leagueId);
        const teamMap = new Map();
        for (const t of teams) {
            teamMap.set(t.id, t);
        }
        const finishedMatches = matches.filter((m) => m.status === 'finalizado');
        const teamIds = new Set();
        for (const m of finishedMatches) {
            if (m.local_team_id)
                teamIds.add(m.local_team_id);
            if (m.away_team_id)
                teamIds.add(m.away_team_id);
        }
        const stats = new Map();
        for (const id of teamIds) {
            stats.set(id, { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 });
        }
        for (const m of finishedMatches) {
            if (m.local_goals == null || m.away_goals == null)
                continue;
            if (!m.local_team_id || !m.away_team_id)
                continue;
            const localStats = stats.get(m.local_team_id);
            const awayStats = stats.get(m.away_team_id);
            if (!localStats || !awayStats)
                continue;
            localStats.pj++;
            awayStats.pj++;
            localStats.gf += m.local_goals;
            localStats.gc += m.away_goals;
            awayStats.gf += m.away_goals;
            awayStats.gc += m.local_goals;
            if (m.local_goals > m.away_goals) {
                localStats.pg++;
                awayStats.pp++;
            }
            else if (m.local_goals < m.away_goals) {
                awayStats.pg++;
                localStats.pp++;
            }
            else {
                localStats.pe++;
                awayStats.pe++;
            }
        }
        const rows = [];
        for (const [teamId, s] of stats) {
            const team = teamMap.get(teamId);
            if (!team)
                continue;
            rows.push({
                position: 0,
                teamId,
                teamName: team.name,
                teamShortName: team.short_name,
                pj: s.pj,
                pg: s.pg,
                pe: s.pe,
                pp: s.pp,
                gf: s.gf,
                gc: s.gc,
                dg: s.gf - s.gc,
                pts: s.pg * 3 + s.pe,
            });
        }
        rows.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
        for (let i = 0; i < rows.length; i++) {
            rows[i].position = i + 1;
        }
        return rows;
    }
    async getNextMatches(teamId, leagueId) {
        const todayIso = new Date().toISOString().slice(0, 10);
        this.logger.log(`getNextMatches teamId=${teamId} leagueId=${leagueId} today=${todayIso}`);
        const [rawMatches, categories] = await Promise.all([
            this.supabaseGet(`/matches?league_id=eq.${leagueId}&or=(local_team_id.eq.${teamId},away_team_id.eq.${teamId})&status=eq.pendiente&order=matchday.asc&limit=50`),
            this.getCategories(leagueId),
        ]);
        this.logger.log(`Supabase returned ${rawMatches.length} pending matches for team ${teamId} in league ${leagueId}`);
        const teams = await this.getTeams(leagueId);
        const teamMap = new Map();
        for (const t of teams)
            teamMap.set(t.id, t);
        const catMap = new Map();
        for (const c of categories)
            catMap.set(c.id, c.name);
        const mapped = rawMatches.map((m) => {
            const isLocal = m.local_team_id === teamId;
            const opponentId = isLocal ? m.away_team_id : m.local_team_id;
            const opponent = opponentId ? teamMap.get(opponentId) : null;
            const isPast = !!m.match_date && m.match_date < todayIso;
            return {
                id: m.id,
                matchday: m.matchday,
                match_date: m.match_date,
                categoryName: catMap.get(m.category_id) ?? '?',
                opponentName: opponent?.name ?? '?',
                isLocal,
                isPast,
            };
        });
        const pastCount = mapped.filter((m) => m.isPast).length;
        const futureCount = mapped.length - pastCount;
        this.logger.log(`Next matches: ${futureCount} future/undated, ${pastCount} past-dated`);
        mapped.sort((a, b) => {
            if (a.isPast !== b.isPast)
                return a.isPast ? 1 : -1;
            const aDate = a.match_date ?? '9999';
            const bDate = b.match_date ?? '9999';
            if (a.isPast)
                return bDate.localeCompare(aDate);
            return aDate.localeCompare(bDate);
        });
        return mapped;
    }
    async getResults(teamId, leagueId, categoryId) {
        let path = `/matches?league_id=eq.${leagueId}&or=(local_team_id.eq.${teamId},away_team_id.eq.${teamId})&status=neq.pendiente&order=match_date.desc&limit=100`;
        if (categoryId) {
            path += `&category_id=eq.${categoryId}`;
        }
        const [matches, categories] = await Promise.all([
            this.supabaseGet(path),
            this.getCategories(leagueId),
        ]);
        const teams = await this.getTeams(leagueId);
        const teamMap = new Map();
        for (const t of teams)
            teamMap.set(t.id, t);
        const catMap = new Map();
        for (const c of categories)
            catMap.set(c.id, c.name);
        return matches.map((m) => {
            const localTeam = teamMap.get(m.local_team_id ?? '');
            const awayTeam = teamMap.get(m.away_team_id ?? '');
            const isLocal = m.local_team_id === teamId;
            const ourGoals = isLocal ? m.local_goals : m.away_goals;
            const theirGoals = isLocal ? m.away_goals : m.local_goals;
            return {
                id: m.id,
                matchday: m.matchday,
                match_date: m.match_date,
                categoryName: catMap.get(m.category_id) ?? '?',
                localName: localTeam?.name ?? '?',
                localGoals: m.local_goals,
                awayGoals: m.away_goals,
                awayName: awayTeam?.name ?? '?',
                isWon: ourGoals != null && theirGoals != null && ourGoals > theirGoals,
                isDraw: ourGoals != null && theirGoals != null && ourGoals === theirGoals,
            };
        });
    }
    async getAllMatches(teamId, leagueId) {
        const [matches, categories] = await Promise.all([
            this.supabaseGet(`/matches?league_id=eq.${leagueId}&or=(local_team_id.eq.${teamId},away_team_id.eq.${teamId})&order=matchday.asc&limit=200`),
            this.getCategories(leagueId),
        ]);
        const teams = await this.getTeams(leagueId);
        const teamMap = new Map();
        for (const t of teams)
            teamMap.set(t.id, t);
        const catMap = new Map();
        for (const c of categories)
            catMap.set(c.id, c.name);
        const grouped = new Map();
        for (const m of matches) {
            if (m.matchday == null)
                continue;
            const arr = grouped.get(m.matchday);
            if (arr)
                arr.push(m);
            else
                grouped.set(m.matchday, [m]);
        }
        const result = [];
        for (const [matchday, dayMatches] of grouped) {
            const first = dayMatches[0];
            const isLocal = first.local_team_id === teamId;
            const opponentId = isLocal ? first.away_team_id : first.local_team_id;
            const opponent = opponentId ? teamMap.get(opponentId) : null;
            const categoryMatches = dayMatches.map((m) => {
                const catIsLocal = m.local_team_id === teamId;
                const ourGoals = catIsLocal ? m.local_goals : m.away_goals;
                const theirGoals = catIsLocal ? m.away_goals : m.local_goals;
                return {
                    id: m.id,
                    categoryName: catMap.get(m.category_id) ?? '?',
                    status: m.status,
                    localGoals: m.local_goals,
                    awayGoals: m.away_goals,
                    isLocal: catIsLocal,
                    isWon: ourGoals != null && theirGoals != null && ourGoals > theirGoals,
                    isDraw: ourGoals != null && theirGoals != null && ourGoals === theirGoals,
                };
            });
            result.push({
                matchday,
                match_date: first.match_date,
                opponentName: opponent?.name ?? '?',
                isLocal,
                matches: categoryMatches,
            });
        }
        return result;
    }
    async getConfigs() {
        return this.prisma.ligasConfig.findMany({
            orderBy: { createdAt: 'asc' },
        });
    }
    async createConfig(dto) {
        return this.prisma.ligasConfig.create({ data: dto });
    }
    async deleteConfig(id) {
        return this.prisma.ligasConfig.delete({ where: { id } });
    }
};
exports.LigasService = LigasService;
exports.LigasService = LigasService = LigasService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], LigasService);
