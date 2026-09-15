import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPermissionsService } from './user-permissions.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private userPermissionsService: UserPermissionsService,
  ) {}

  async create(dto: CreateUserDto) {
    if (!dto?.password) {
      throw new BadRequestException('Password requerido');
    }

    const existingByUsername = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existingByUsername) {
      throw new BadRequestException('Usuario ya registrado');
    }

    const password = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          password,
          role: 'USER',
          active: true,
          homeModule: dto.homeModule ?? null,
          homeSmartphoneModule: dto.homeSmartphoneModule ?? null,
        },
        select: {
          id: true,
          username: true,
          role: true,
          active: true,
          homeModule: true,
          homeSmartphoneModule: true,
          externalPosId: true,
          externalStoreId: true,
        },
      });

      if (dto.permissions && dto.permissions.length > 0) {
        await this.userPermissionsService.setPermissions(user.id, dto.permissions);
      }

      const permissions = await this.userPermissionsService.getPermissions(user.id);

      return { ...user, permissions };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Usuario ya registrado');
      }
      throw error;
    }
  }

  async list() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        active: true,
        homeModule: true,
        homeSmartphoneModule: true,
        externalPosId: true,
        externalStoreId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = [];
    for (const user of users) {
      const permissions = user.role === 'ADMIN'
        ? []
        : await this.userPermissionsService.getPermissions(user.id);
      result.push({ ...user, permissions });
    }

    return result;
  }

  async update(id: string, dto: UpdateUserDto, requesterId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('No se puede modificar al administrador');
    }

    if (requesterId && id === requesterId && dto.active === false) {
      throw new BadRequestException('No podés desactivar tu propio usuario');
    }

    const data: Record<string, unknown> = {};
    if (dto.username !== undefined) data.username = dto.username;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.homeModule !== undefined) data.homeModule = dto.homeModule;
    if (dto.homeSmartphoneModule !== undefined) data.homeSmartphoneModule = dto.homeSmartphoneModule;
    if (dto.externalPosId !== undefined) data.externalPosId = dto.externalPosId;
    if (dto.externalStoreId !== undefined) data.externalStoreId = dto.externalStoreId;
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    try {
      const result = await this.prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          username: true,
          role: true,
          active: true,
          homeModule: true,
          homeSmartphoneModule: true,
          externalPosId: true,
          externalStoreId: true,
        },
      });

      if (dto.permissions !== undefined) {
        await this.userPermissionsService.setPermissions(id, dto.permissions);
      }

      const permissions = await this.userPermissionsService.getPermissions(result.id);

      return { ...result, permissions };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Usuario ya registrado');
      }
      throw error;
    }
  }

  async remove(id: string, requesterId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, username: true },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('No se puede eliminar al administrador');
    }

    if (requesterId && id === requesterId) {
      throw new BadRequestException('No podés eliminar tu propio usuario');
    }

    const [salesCount, movementsCount, closesCount] = await Promise.all([
      this.prisma.sale.count({ where: { userId: id } }),
      this.prisma.manualMovement.count({ where: { userId: id } }),
      this.prisma.cashClose.count({ where: { closedByUserId: id } }),
    ]);

    if (salesCount > 0 || movementsCount > 0 || closesCount > 0) {
      throw new BadRequestException(
        'No se puede eliminar: el usuario tiene ventas o movimientos asociados. Desactívalo en su lugar.',
      );
    }

    try {
      return await this.prisma.user.delete({
        where: { id },
        select: { id: true, username: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException(
          'No se puede eliminar: el usuario tiene registros asociados. Desactívalo en su lugar.',
        );
      }
      throw error;
    }
  }
}
