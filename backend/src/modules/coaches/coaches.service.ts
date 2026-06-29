import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCoachDto } from './dto/create-coach.dto';
import { UpdateCoachDto } from './dto/update-coach.dto';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class CoachesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, page = 1, limit = 25 } = params;
    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { dni: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.coach.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastName: 'asc' },
        include: {
          _count: { select: { tournaments: true } },
        },
      }),
      this.prisma.coach.count({ where }),
    ]);

    return {
      data: data.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        dni: c.dni,
        birthDate: c.birthDate,
        phone: c.phone,
        email: c.email,
        tournamentCount: c._count.tournaments,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const coach = await this.prisma.coach.findUnique({
      where: { id },
      include: {
        tournaments: {
          include: {
            tournament: { select: { id: true, name: true, year: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!coach) {
      throw new NotFoundException('DT no encontrado');
    }

    return {
      id: coach.id,
      firstName: coach.firstName,
      lastName: coach.lastName,
      dni: coach.dni,
      birthDate: coach.birthDate,
      phone: coach.phone,
      email: coach.email,
      tournaments: coach.tournaments.map((tc) => ({
        id: tc.tournament.id,
        name: tc.tournament.name,
        year: tc.tournament.year,
        categoryId: tc.category.id,
        categoryName: tc.category.name,
        fichadoAt: tc.fichadoAt,
      })),
      createdAt: coach.createdAt,
      updatedAt: coach.updatedAt,
    };
  }

  async create(dto: CreateCoachDto) {
    if (dto.dni) {
      const existing = await this.prisma.coach.findFirst({
        where: { dni: dto.dni },
      });
      if (existing) {
        throw new BadRequestException('Ya existe un DT con ese DNI');
      }
    }

    return this.prisma.coach.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dni: dto.dni,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        phone: dto.phone,
        email: dto.email,
      },
    });
  }

  async update(id: number, dto: UpdateCoachDto) {
    const coach = await this.prisma.coach.findUnique({ where: { id } });
    if (!coach) {
      throw new NotFoundException('DT no encontrado');
    }

    if (dto.dni && dto.dni !== coach.dni) {
      const existing = await this.prisma.coach.findFirst({
        where: { dni: dto.dni },
      });
      if (existing) {
        throw new BadRequestException('Ya existe un DT con ese DNI');
      }
    }

    return this.prisma.coach.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.dni !== undefined && { dni: dto.dni }),
        ...(dto.birthDate !== undefined && { birthDate: new Date(dto.birthDate) }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
      },
    });
  }

  async remove(id: number) {
    const coach = await this.prisma.coach.findUnique({
      where: { id },
      include: { _count: { select: { tournaments: true } } },
    });

    if (!coach) {
      throw new NotFoundException('DT no encontrado');
    }

    if (coach._count.tournaments > 0) {
      throw new BadRequestException('No se puede eliminar un DT que está fichado en torneos');
    }

    return this.prisma.coach.delete({ where: { id } });
  }

  async getTournamentCoaches(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categories: { include: { category: true } },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const tournamentCoaches = await this.prisma.tournamentCoach.findMany({
      where: { tournamentId },
      include: {
        coach: true,
        category: { select: { id: true, name: true } },
      },
    });

    return tournament.categories.map((tc) => {
      const assigned = tournamentCoaches.find(
        (tco) => tco.playerCategoryId === tc.category.id,
      );
      return {
        categoryId: tc.category.id,
        categoryName: tc.category.name,
        coach: assigned
          ? {
              id: assigned.coach.id,
              firstName: assigned.coach.firstName,
              lastName: assigned.coach.lastName,
              dni: assigned.coach.dni,
              fichadoAt: assigned.fichadoAt,
            }
          : null,
      };
    });
  }

  async assignCoach(tournamentId: number, coachId: number, playerCategoryId: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const coach = await this.prisma.coach.findUnique({ where: { id: coachId } });
    if (!coach) {
      throw new NotFoundException('DT no encontrado');
    }

    const category = await this.prisma.playerCategory.findUnique({
      where: { id: playerCategoryId },
    });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    const isCategoryInTournament = await this.prisma.tournamentCategory.findUnique({
      where: {
        tournamentId_playerCategoryId: {
          tournamentId,
          playerCategoryId,
        },
      },
    });
    if (!isCategoryInTournament) {
      throw new BadRequestException('La categoría no pertenece al torneo');
    }

    return this.prisma.tournamentCoach.upsert({
      where: {
        tournamentId_playerCategoryId: {
          tournamentId,
          playerCategoryId,
        },
      },
      create: {
        coachId,
        tournamentId,
        playerCategoryId,
      },
      update: {
        coachId,
      },
      include: {
        coach: true,
        category: { select: { id: true, name: true } },
      },
    });
  }

  async unassignCoach(tournamentId: number, coachId: number) {
    const tc = await this.prisma.tournamentCoach.findFirst({
      where: { tournamentId, coachId },
    });

    if (!tc) {
      throw new NotFoundException('El DT no está fichado en este torneo');
    }

    return this.prisma.tournamentCoach.delete({ where: { id: tc.id } });
  }

  async generateReport(tournamentId?: number, categoryId?: number) {
    const tournaments = tournamentId
      ? await this.prisma.tournament.findMany({
          where: { id: tournamentId },
          orderBy: { year: 'desc' },
        })
      : await this.prisma.tournament.findMany({
          orderBy: [{ year: 'desc' }, { name: 'asc' }],
        });

    if (tournaments.length === 0) {
      throw new NotFoundException('No se encontraron torneos');
    }

    const setting = await this.prisma.setting.findFirst();
    const clubName = setting?.clubName || 'Club';

    const tournamentData: {
      tournament: { name: string; year: number };
      categories: { id: number; name: string }[];
      coachMap: Map<number, { lastName: string; firstName: string }>;
      playersByCategory: Map<number, any[]>;
    }[] = [];

    for (const tournament of tournaments) {
      const categories = await this.prisma.tournamentCategory.findMany({
        where: {
          tournamentId: tournament.id,
          ...(categoryId ? { playerCategoryId: categoryId } : {}),
        },
        include: { category: true },
        orderBy: { category: { name: 'asc' } },
      });

      const coaches = await this.prisma.tournamentCoach.findMany({
        where: { tournamentId: tournament.id },
        include: { coach: true },
      });

      const players = await this.prisma.tournamentPlayer.findMany({
        where: { tournamentId: tournament.id },
        include: { player: true },
      });

      const coachMap = new Map(coaches.map((tc) => [tc.playerCategoryId, tc.coach]));
      const playersByCategory = new Map<number, typeof players>();
      for (const tp of players) {
        if (!playersByCategory.has(tp.playerCategoryId)) {
          playersByCategory.set(tp.playerCategoryId, []);
        }
        playersByCategory.get(tp.playerCategoryId)!.push(tp);
      }

      tournamentData.push({
        tournament: { name: tournament.name, year: tournament.year },
        categories: categories.map((c) => ({ id: c.category.id, name: c.category.name })),
        coachMap,
        playersByCategory: playersByCategory as any,
      });
    }

    return new Promise<{ buffer: Buffer; filename: string }>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const tname = tournaments.length === 1 ? tournaments[0].name : 'torneos';
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `plantel-${tname.replace(/\s+/g, '-')}.pdf`,
        });
      });
      doc.on('error', reject);

      tournamentData.forEach((data, idx) => {
        const { tournament, categories, coachMap, playersByCategory } = data;

        if (idx > 0) doc.addPage();

        doc.fontSize(14).font('Helvetica-Bold').fill('#1a1a1a');
        doc.text(clubName, { align: 'center' });
        doc.fontSize(12).text('Plantel por Torneo', { align: 'center' });
        doc.moveDown(0.8);

        doc.fontSize(11).font('Helvetica-Bold')
          .text(`Torneo: ${tournament.name}`, { continued: false });
        doc.fontSize(10).font('Helvetica')
          .text(`Año: ${tournament.year}`);

        doc.moveDown(0.4);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
        doc.moveDown(0.6);

        for (const cat of categories) {
          const dt = coachMap.get(cat.id);
          const players = playersByCategory.get(cat.id) || [];

          // Ensure enough space for category header + DT + table header (~ 60pt)
          if (doc.y + 60 > doc.page.height - 40) {
            doc.addPage();
          }

          doc.fontSize(11).font('Helvetica-Bold').fill('#1a1a1a')
            .text(`Categoría: ${cat.name}`, 50);
          doc.fontSize(9).font('Helvetica')
            .text(`DT: ${dt ? `${dt.lastName}, ${dt.firstName}` : 'Sin asignar'}`, 50);
          doc.moveDown(0.3);

          const tableTop = doc.y;
          const colX = [50, 80, 250, 400];
          const headers = ['#', 'Apellido', 'Nombre', 'DNI'];

          doc.fontSize(8).font('Helvetica-Bold').fill('#555555');
          headers.forEach((h, i) => {
            doc.text(h, colX[i], tableTop, { width: [30, 170, 150, 145][i], lineBreak: false });
          });

          doc.moveDown(0.15);
          doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#dddddd');
          doc.moveDown(0.15);

          if (players.length === 0) {
            doc.fontSize(8).font('Helvetica').fill('#999999');
            doc.text('Sin jugadores fichados', 50, doc.y, { width: 495 });
            doc.moveDown(0.5);
          } else {
            const bottomMargin = 40;
            const rowHeight = 14;

            doc.fontSize(8).font('Helvetica').fill('#333333');
            players
              .sort((a, b) => a.player.lastName.localeCompare(b.player.lastName))
              .forEach((tp, idx2) => {
                if (doc.y + rowHeight > doc.page.height - bottomMargin) {
                  doc.addPage();
                  doc.moveDown(0.3);
                  const newTableTop = doc.y;
                  doc.fontSize(8).font('Helvetica-Bold').fill('#555555');
                  headers.forEach((h, i) => {
                    doc.text(h, colX[i], newTableTop, { width: [30, 170, 150, 145][i], lineBreak: false });
                  });
                  doc.moveDown(0.15);
                  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#dddddd');
                  doc.moveDown(0.15);
                  doc.fontSize(8).font('Helvetica').fill('#333333');
                }
                const rowY = doc.y;
                doc.text(`${idx2 + 1}`, colX[0], rowY, { width: 30, lineBreak: false });
                doc.text(tp.player.lastName, colX[1], rowY, { width: 170, lineBreak: false });
                doc.text(tp.player.firstName, colX[2], rowY, { width: 150, lineBreak: false });
                doc.text(tp.player.dni || '—', colX[3], rowY, { width: 145, lineBreak: false });
                doc.moveDown(0.35);
              });
          }

          doc.moveDown(0.2);
          doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#eeeeee');
          doc.moveDown(0.5);
          doc.x = 50;
        }
      });

      doc.end();
    });
  }
}
