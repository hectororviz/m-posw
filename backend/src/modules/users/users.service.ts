import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    if (!dto?.password) {
      throw new BadRequestException('Password requerido');
    }
    const existingByName = await this.prisma.user.findUnique({ where: { name: dto.name } });
    if (existingByName) {
      throw new BadRequestException('Usuario ya registrado');
    }
    if (dto.email) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingByEmail) {
        throw new BadRequestException('Email ya registrado');
      }
    }
    const password = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          password,
          role: dto.role || 'USER',
          active: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target;
        const targets = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
        if (targets.includes('email')) {
          throw new BadRequestException('Email ya registrado');
        }
        if (targets.includes('name')) {
          throw new BadRequestException('Usuario ya registrado');
        }
        throw new BadRequestException('Usuario ya registrado');
      }
      throw error;
    }
  }

  list() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
      },
    });
  }
}
