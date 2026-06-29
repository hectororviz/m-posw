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
exports.CoachesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const PDFDocument = require("pdfkit");
let CoachesService = class CoachesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(params) {
        const { search, page = 1, limit = 25 } = params;
        const where = {};
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
    async findOne(id) {
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
            throw new common_1.NotFoundException('DT no encontrado');
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
    async create(dto) {
        if (dto.dni) {
            const existing = await this.prisma.coach.findFirst({
                where: { dni: dto.dni },
            });
            if (existing) {
                throw new common_1.BadRequestException('Ya existe un DT con ese DNI');
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
    async update(id, dto) {
        const coach = await this.prisma.coach.findUnique({ where: { id } });
        if (!coach) {
            throw new common_1.NotFoundException('DT no encontrado');
        }
        if (dto.dni && dto.dni !== coach.dni) {
            const existing = await this.prisma.coach.findFirst({
                where: { dni: dto.dni },
            });
            if (existing) {
                throw new common_1.BadRequestException('Ya existe un DT con ese DNI');
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
    async remove(id) {
        const coach = await this.prisma.coach.findUnique({
            where: { id },
            include: { _count: { select: { tournaments: true } } },
        });
        if (!coach) {
            throw new common_1.NotFoundException('DT no encontrado');
        }
        if (coach._count.tournaments > 0) {
            throw new common_1.BadRequestException('No se puede eliminar un DT que está fichado en torneos');
        }
        return this.prisma.coach.delete({ where: { id } });
    }
    async getTournamentCoaches(tournamentId) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                categories: { include: { category: true } },
            },
        });
        if (!tournament) {
            throw new common_1.NotFoundException('Torneo no encontrado');
        }
        const tournamentCoaches = await this.prisma.tournamentCoach.findMany({
            where: { tournamentId },
            include: {
                coach: true,
                category: { select: { id: true, name: true } },
            },
        });
        return tournament.categories.map((tc) => {
            const assigned = tournamentCoaches.find((tco) => tco.playerCategoryId === tc.category.id);
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
    async assignCoach(tournamentId, coachId, playerCategoryId) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
        });
        if (!tournament) {
            throw new common_1.NotFoundException('Torneo no encontrado');
        }
        const coach = await this.prisma.coach.findUnique({ where: { id: coachId } });
        if (!coach) {
            throw new common_1.NotFoundException('DT no encontrado');
        }
        const category = await this.prisma.playerCategory.findUnique({
            where: { id: playerCategoryId },
        });
        if (!category) {
            throw new common_1.NotFoundException('Categoría no encontrada');
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
            throw new common_1.BadRequestException('La categoría no pertenece al torneo');
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
    async unassignCoach(tournamentId, coachId) {
        const tc = await this.prisma.tournamentCoach.findFirst({
            where: { tournamentId, coachId },
        });
        if (!tc) {
            throw new common_1.NotFoundException('El DT no está fichado en este torneo');
        }
        return this.prisma.tournamentCoach.delete({ where: { id: tc.id } });
    }
    async generateReport(tournamentId, categoryId) {
        const tournaments = tournamentId
            ? await this.prisma.tournament.findMany({
                where: { id: tournamentId },
                orderBy: { year: 'desc' },
            })
            : await this.prisma.tournament.findMany({
                orderBy: [{ year: 'desc' }, { name: 'asc' }],
            });
        if (tournaments.length === 0) {
            throw new common_1.NotFoundException('No se encontraron torneos');
        }
        const setting = await this.prisma.setting.findFirst();
        const clubName = setting?.clubName || 'Club';
        const tournamentData = [];
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
            const playersByCategory = new Map();
            for (const tp of players) {
                if (!playersByCategory.has(tp.playerCategoryId)) {
                    playersByCategory.set(tp.playerCategoryId, []);
                }
                playersByCategory.get(tp.playerCategoryId).push(tp);
            }
            tournamentData.push({
                tournament: { name: tournament.name, year: tournament.year },
                categories: categories.map((c) => ({ id: c.category.id, name: c.category.name })),
                coachMap,
                playersByCategory: playersByCategory,
            });
        }
        return new Promise((resolve, reject) => {
            const chunks = [];
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'portrait',
                margins: { top: 40, bottom: 40, left: 50, right: 50 },
            });
            doc.on('data', (chunk) => chunks.push(chunk));
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
                if (idx > 0)
                    doc.addPage();
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
                    doc.fontSize(11).font('Helvetica-Bold').fill('#1a1a1a')
                        .text(`Categoría: ${cat.name}`);
                    doc.fontSize(9).font('Helvetica')
                        .text(`DT: ${dt ? `${dt.lastName}, ${dt.firstName}` : 'Sin asignar'}`);
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
                    }
                    else {
                        doc.fontSize(8).font('Helvetica').fill('#333333');
                        players
                            .sort((a, b) => a.player.lastName.localeCompare(b.player.lastName))
                            .forEach((tp, idx2) => {
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
                }
            });
            doc.end();
        });
    }
};
exports.CoachesService = CoachesService;
exports.CoachesService = CoachesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CoachesService);
