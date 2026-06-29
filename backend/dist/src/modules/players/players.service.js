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
exports.PlayersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const ExcelJS = require("exceljs");
let PlayersService = class PlayersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(params) {
        const { search, sex, page = 1, limit = 25 } = params;
        const where = {};
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { dni: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (sex) {
            where.sex = sex;
        }
        const [data, total] = await Promise.all([
            this.prisma.player.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { lastName: 'asc' },
                include: {
                    _count: { select: { tournaments: true } },
                },
            }),
            this.prisma.player.count({ where }),
        ]);
        return {
            data: data.map((p) => ({
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
                dni: p.dni,
                birthDate: p.birthDate,
                sex: p.sex,
                tournamentCount: p._count.tournaments,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            })),
            total,
            page,
            limit,
        };
    }
    async findOne(id) {
        const player = await this.prisma.player.findUnique({
            where: { id },
            include: {
                tournaments: {
                    include: {
                        tournament: { select: { id: true, name: true, year: true } },
                    },
                },
            },
        });
        if (!player) {
            throw new common_1.NotFoundException('Jugador no encontrado');
        }
        return {
            id: player.id,
            firstName: player.firstName,
            lastName: player.lastName,
            dni: player.dni,
            birthDate: player.birthDate,
            sex: player.sex,
            tournaments: player.tournaments.map((tp) => ({
                id: tp.tournament.id,
                name: tp.tournament.name,
                year: tp.tournament.year,
                playerCategoryId: tp.playerCategoryId,
                fichadoAt: tp.fichadoAt,
            })),
            createdAt: player.createdAt,
            updatedAt: player.updatedAt,
        };
    }
    async create(dto) {
        if (dto.dni) {
            const existing = await this.prisma.player.findFirst({
                where: { dni: dto.dni },
            });
            if (existing) {
                throw new common_1.BadRequestException('Ya existe un jugador con ese DNI');
            }
        }
        return this.prisma.player.create({
            data: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                dni: dto.dni,
                birthDate: new Date(dto.birthDate),
                sex: dto.sex,
            },
        });
    }
    async update(id, dto) {
        const player = await this.prisma.player.findUnique({ where: { id } });
        if (!player) {
            throw new common_1.NotFoundException('Jugador no encontrado');
        }
        if (dto.dni && dto.dni !== player.dni) {
            const existing = await this.prisma.player.findFirst({
                where: { dni: dto.dni },
            });
            if (existing) {
                throw new common_1.BadRequestException('Ya existe un jugador con ese DNI');
            }
        }
        return this.prisma.player.update({
            where: { id },
            data: {
                ...(dto.firstName !== undefined && { firstName: dto.firstName }),
                ...(dto.lastName !== undefined && { lastName: dto.lastName }),
                ...(dto.dni !== undefined && { dni: dto.dni }),
                ...(dto.birthDate !== undefined && { birthDate: new Date(dto.birthDate) }),
                ...(dto.sex !== undefined && { sex: dto.sex }),
            },
        });
    }
    async remove(id) {
        const player = await this.prisma.player.findUnique({
            where: { id },
        });
        if (!player) {
            throw new common_1.NotFoundException('Jugador no encontrado');
        }
        return this.prisma.player.delete({ where: { id } });
    }
    async importExcel(file) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet) {
            throw new common_1.BadRequestException('El archivo no contiene hojas');
        }
        const resultados = { creados: 0, errores: [] };
        const rows = [];
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1)
                return;
            const values = {};
            row.eachCell((cell, colNumber) => {
                const header = sheet.getRow(1).getCell(colNumber).value;
                if (header) {
                    values[String(header).trim()] = cell.value;
                }
            });
            if (Object.keys(values).length > 0)
                rows.push(values);
        });
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                const firstName = row['Nombre']?.toString().trim();
                const lastName = row['Apellido']?.toString().trim();
                const dni = row['DNI']?.toString().trim().replace(/\.0$/, '');
                const birthDateRaw = row['Fecha de Nacimiento'];
                const sexRaw = row['Sexo']?.toString().trim().toUpperCase();
                if (!firstName || !lastName) {
                    resultados.errores.push({
                        fila: i + 2,
                        mensaje: 'Faltan campos obligatorios (Nombre, Apellido)',
                    });
                    continue;
                }
                let birthDate;
                if (typeof birthDateRaw === 'number') {
                    const excelEpoch = Date.UTC(1899, 11, 30);
                    birthDate = new Date(excelEpoch + birthDateRaw * 86400000);
                }
                else if (typeof birthDateRaw === 'string') {
                    const parts = birthDateRaw.split('/');
                    if (parts.length === 3) {
                        birthDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
                    }
                    else {
                        birthDate = new Date(birthDateRaw);
                    }
                }
                else if (birthDateRaw instanceof Date) {
                    birthDate = birthDateRaw;
                }
                else {
                    resultados.errores.push({ fila: i + 2, mensaje: 'Fecha de nacimiento inválida' });
                    continue;
                }
                if (isNaN(birthDate.getTime())) {
                    resultados.errores.push({ fila: i + 2, mensaje: 'Fecha de nacimiento inválida' });
                    continue;
                }
                let sex;
                if (sexRaw === 'M' || sexRaw === 'MASCULINO') {
                    sex = 'M';
                }
                else if (sexRaw === 'F' || sexRaw === 'FEMENINO') {
                    sex = 'F';
                }
                else {
                    resultados.errores.push({ fila: i + 2, mensaje: 'Sexo inválido (usar M o F)' });
                    continue;
                }
                if (dni) {
                    const existing = await this.prisma.player.findFirst({ where: { dni } });
                    if (existing) {
                        resultados.errores.push({
                            fila: i + 2,
                            mensaje: `DNI ${dni} ya existe`,
                        });
                        continue;
                    }
                }
                await this.prisma.player.create({
                    data: { firstName, lastName, dni, birthDate, sex },
                });
                resultados.creados++;
            }
            catch (err) {
                resultados.errores.push({
                    fila: i + 2,
                    mensaje: err.message || 'Error desconocido',
                });
            }
        }
        return resultados;
    }
    async exportExcel(params) {
        const { search, sex } = params;
        const where = {};
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { dni: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (sex) {
            where.sex = sex;
        }
        const players = await this.prisma.player.findMany({
            where,
            orderBy: { lastName: 'asc' },
            include: { _count: { select: { tournaments: true } } },
        });
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Jugadores');
        ws.columns = [
            { header: 'Apellido', key: 'lastName', width: 25 },
            { header: 'Nombre', key: 'firstName', width: 25 },
            { header: 'DNI', key: 'dni', width: 15 },
            { header: 'Fecha de Nacimiento', key: 'birthDate', width: 18 },
            { header: 'Sexo', key: 'sex', width: 12 },
            { header: 'Torneos', key: 'tournamentCount', width: 10 },
        ];
        for (const p of players) {
            ws.addRow({
                lastName: p.lastName,
                firstName: p.firstName,
                dni: p.dni,
                birthDate: p.birthDate.toISOString().slice(0, 10),
                sex: p.sex === 'M' ? 'Masculino' : 'Femenino',
                tournamentCount: p._count.tournaments,
            });
        }
        return workbook.xlsx.writeBuffer();
    }
};
exports.PlayersService = PlayersService;
exports.PlayersService = PlayersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlayersService);
