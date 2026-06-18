import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import type { CreateLigaConfigDto } from './dto/create-liga-config.dto';

interface SupabaseLeague {
  id: string;
  name: string;
  active: boolean;
}

interface SupabaseCategory {
  id: string;
  name: string;
  league_id: string;
}

interface SupabaseTeam {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  city: string;
}

interface SupabaseMatch {
  id: string;
  league_id: string;
  category_id: string;
  local_team_id: string;
  away_team_id: string;
  matchday: number | null;
  match_date: string | null;
  status: string;
  local_goals: number | null;
  away_goals: number | null;
}

export interface StandingRow {
  position: number;
  teamId: string;
  teamName: string;
  teamShortName: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
}

export interface NextMatch {
  id: string;
  matchday: number | null;
  match_date: string | null;
  categoryName: string;
  opponentName: string;
  isLocal: boolean;
  isPast: boolean;
}

export interface MatchResult {
  id: string;
  matchday: number | null;
  match_date: string | null;
  categoryName: string;
  localName: string;
  localGoals: number | null;
  awayGoals: number | null;
  awayName: string;
  isWon: boolean;
  isDraw: boolean;
}

@Injectable()
export class LigasService {
  private readonly logger = new Logger(LigasService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private getSupabaseUrl() {
    return this.config.get<string>('SUPABASE_URL');
  }

  private getSupabaseKey() {
    return this.config.get<string>('SUPABASE_ANON_KEY');
  }

  private async supabaseGet<T>(path: string): Promise<T> {
    const url = `${this.getSupabaseUrl()}/rest/v1${path}`;
    const headers: Record<string, string> = {
      apikey: this.getSupabaseKey(),
      Authorization: `Bearer ${this.getSupabaseKey()}`,
    };
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async getLeagues(): Promise<SupabaseLeague[]> {
    return this.supabaseGet<SupabaseLeague[]>('/leagues?active=eq.true&order=created_at.asc');
  }

  async getCategories(leagueId: string): Promise<SupabaseCategory[]> {
    return this.supabaseGet<SupabaseCategory[]>(
      `/categories?league_id=eq.${leagueId}&order=name.asc`,
    );
  }

  async getTeams(leagueId: string): Promise<SupabaseTeam[]> {
    const matches = await this.supabaseGet<SupabaseMatch[]>(
      `/matches?league_id=eq.${leagueId}&select=local_team_id,away_team_id&limit=10000`,
    );
    const teamIds = new Set<string>();
    for (const m of matches) {
      if (m.local_team_id) teamIds.add(m.local_team_id);
      if (m.away_team_id) teamIds.add(m.away_team_id);
    }
    if (teamIds.size === 0) return [];
    const ids = Array.from(teamIds);
    // Supabase REST in filter: split into chunks of 50 to avoid URL length issues
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 50) {
      chunks.push(ids.slice(i, i + 50));
    }
    const allTeams: SupabaseTeam[] = [];
    for (const chunk of chunks) {
      const filter = chunk.map((id) => `id.eq.${id}`).join(',');
      const teams = await this.supabaseGet<SupabaseTeam[]>(
        `/teams?select=id,name,short_name,logo_url,city&or=(${filter})&order=name.asc`,
      );
      allTeams.push(...teams);
    }
    return allTeams;
  }

  async getMatchesByLeague(leagueId: string): Promise<SupabaseMatch[]> {
    return this.supabaseGet<SupabaseMatch[]>(
      `/matches?league_id=eq.${leagueId}&order=matchday.asc&limit=10000`,
    );
  }

  async getStandings(
    leagueId: string,
    categoryId?: string,
  ): Promise<StandingRow[]> {
    let path = `/matches?league_id=eq.${leagueId}`;
    if (categoryId) {
      path += `&category_id=eq.${categoryId}`;
    }
    path += '&order=matchday.asc&limit=10000';

    const matches = await this.supabaseGet<SupabaseMatch[]>(path);

    const teams = await this.getTeams(leagueId);
    const teamMap = new Map<string, SupabaseTeam>();
    for (const t of teams) {
      teamMap.set(t.id, t);
    }

    const finishedMatches = matches.filter((m) => m.status === 'finalizado');

    // Collect all team IDs that appear in finished matches
    const teamIds = new Set<string>();
    for (const m of finishedMatches) {
      if (m.local_team_id) teamIds.add(m.local_team_id);
      if (m.away_team_id) teamIds.add(m.away_team_id);
    }

    const stats = new Map<
      string,
      { pj: number; pg: number; pe: number; pp: number; gf: number; gc: number }
    >();

    for (const id of teamIds) {
      stats.set(id, { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 });
    }

    for (const m of finishedMatches) {
      if (m.local_goals == null || m.away_goals == null) continue;
      if (!m.local_team_id || !m.away_team_id) continue;

      const localStats = stats.get(m.local_team_id);
      const awayStats = stats.get(m.away_team_id);
      if (!localStats || !awayStats) continue;

      localStats.pj++;
      awayStats.pj++;
      localStats.gf += m.local_goals;
      localStats.gc += m.away_goals;
      awayStats.gf += m.away_goals;
      awayStats.gc += m.local_goals;

      if (m.local_goals > m.away_goals) {
        localStats.pg++;
        awayStats.pp++;
      } else if (m.local_goals < m.away_goals) {
        awayStats.pg++;
        localStats.pp++;
      } else {
        localStats.pe++;
        awayStats.pe++;
      }
    }

    const rows: StandingRow[] = [];
    for (const [teamId, s] of stats) {
      const team = teamMap.get(teamId);
      if (!team) continue;
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

    // Sort by points desc, goal difference desc, goals for desc
    rows.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);

    for (let i = 0; i < rows.length; i++) {
      rows[i].position = i + 1;
    }

    return rows;
  }

  async getNextMatches(
    teamId: string,
    leagueId: string,
  ): Promise<NextMatch[]> {
    const todayIso = new Date().toISOString().slice(0, 10);
    this.logger.log(
      `getNextMatches teamId=${teamId} leagueId=${leagueId} today=${todayIso}`,
    );

    const [rawMatches, categories] = await Promise.all([
      this.supabaseGet<SupabaseMatch[]>(
        `/matches?league_id=eq.${leagueId}&or=(local_team_id.eq.${teamId},away_team_id.eq.${teamId})&status=eq.pendiente&order=matchday.asc&limit=50`,
      ),
      this.getCategories(leagueId),
    ]);

    this.logger.log(
      `Supabase returned ${rawMatches.length} pending matches for team ${teamId} in league ${leagueId}`,
    );

    const teams = await this.getTeams(leagueId);
    const teamMap = new Map<string, SupabaseTeam>();
    for (const t of teams) teamMap.set(t.id, t);

    const catMap = new Map<string, string>();
    for (const c of categories) catMap.set(c.id, c.name);

    const mapped: NextMatch[] = rawMatches.map((m) => {
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
    this.logger.log(
      `Next matches: ${futureCount} future/undated, ${pastCount} past-dated`,
    );

    // future/undated first (by match_date asc), then past (by match_date desc)
    mapped.sort((a, b) => {
      if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
      const aDate = a.match_date ?? '9999';
      const bDate = b.match_date ?? '9999';
      if (a.isPast) return bDate.localeCompare(aDate); // past: most recent first
      return aDate.localeCompare(bDate); // future: soonest first
    });

    return mapped;
  }

  async getResults(
    teamId: string,
    leagueId: string,
    categoryId?: string,
  ): Promise<MatchResult[]> {
    let path = `/matches?league_id=eq.${leagueId}&or=(local_team_id.eq.${teamId},away_team_id.eq.${teamId})&status=neq.pendiente&order=match_date.desc&limit=100`;
    if (categoryId) {
      path += `&category_id=eq.${categoryId}`;
    }

    const [matches, categories] = await Promise.all([
      this.supabaseGet<SupabaseMatch[]>(path),
      this.getCategories(leagueId),
    ]);

    const teams = await this.getTeams(leagueId);
    const teamMap = new Map<string, SupabaseTeam>();
    for (const t of teams) teamMap.set(t.id, t);

    const catMap = new Map<string, string>();
    for (const c of categories) catMap.set(c.id, c.name);

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

  async getConfigs() {
    return this.prisma.ligasConfig.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async createConfig(dto: CreateLigaConfigDto) {
    return this.prisma.ligasConfig.create({ data: dto });
  }

  async deleteConfig(id: string) {
    return this.prisma.ligasConfig.delete({ where: { id } });
  }
}
