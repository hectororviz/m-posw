import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    search?: string;
    sex?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, sex, page = 1, limit = 25 } = params;
    const where: any = {};

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

  async findOne(id: number) {
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
      throw new NotFoundException('Jugador no encontrado');
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

  async create(dto: CreatePlayerDto) {
    if (dto.dni) {
      const existing = await this.prisma.player.findFirst({
        where: { dni: dto.dni },
      });
      if (existing) {
        throw new BadRequestException('Ya existe un jugador con ese DNI');
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

  async update(id: number, dto: UpdatePlayerDto) {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
    }

    if (dto.dni && dto.dni !== player.dni) {
      const existing = await this.prisma.player.findFirst({
        where: { dni: dto.dni },
      });
      if (existing) {
        throw new BadRequestException('Ya existe un jugador con ese DNI');
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

  async remove(id: number) {
    const player = await this.prisma.player.findUnique({
      where: { id },
    });
    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
    }

    return this.prisma.player.delete({ where: { id } });
  }

  async importExcel(file: Express.Multer.File) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('El archivo no contiene hojas');
    }

    const resultados = { creados: 0, errores: [] as { fila: number; mensaje: string }[] };

    const rows: any[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = sheet.getRow(1).getCell(colNumber).value;
        if (header) {
          values[String(header).trim()] = cell.value;
        }
      });
      if (Object.keys(values).length > 0) rows.push(values);
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

        let birthDate: Date;
        if (typeof birthDateRaw === 'number') {
          const excelEpoch = Date.UTC(1899, 11, 30);
          birthDate = new Date(excelEpoch + birthDateRaw * 86400000);
        } else if (typeof birthDateRaw === 'string') {
          const parts = birthDateRaw.split('/');
          if (parts.length === 3) {
            birthDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
          } else {
            birthDate = new Date(birthDateRaw);
          }
        } else if (birthDateRaw instanceof Date) {
          birthDate = birthDateRaw;
        } else {
          resultados.errores.push({ fila: i + 2, mensaje: 'Fecha de nacimiento inválida' });
          continue;
        }

        if (isNaN(birthDate.getTime())) {
          resultados.errores.push({ fila: i + 2, mensaje: 'Fecha de nacimiento inválida' });
          continue;
        }

        let sex: 'M' | 'F';
        if (sexRaw === 'M' || sexRaw === 'MASCULINO') {
          sex = 'M';
        } else if (sexRaw === 'F' || sexRaw === 'FEMENINO') {
          sex = 'F';
        } else {
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
      } catch (err: any) {
        resultados.errores.push({
          fila: i + 2,
          mensaje: err.message || 'Error desconocido',
        });
      }
    }

    return resultados;
  }

  async exportExcel(params: { search?: string; sex?: string }) {
    const { search, sex } = params;
    const where: any = {};

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
}
