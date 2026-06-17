import { BadRequestException, Injectable } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class UserPermissionsService {
  constructor(private prisma: PrismaService) {}

  async getPermissions(userId: string): Promise<{ module: ModuleKey; access: ModuleAccess }[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.role === 'ADMIN') {
      return [];
    }

    const permissions = await this.prisma.userModulePermission.findMany({
      where: { userId },
      select: { module: true, access: true },
    });

    return permissions;
  }

  async setPermissions(
    userId: string,
    permissions: { module: ModuleKey; access: ModuleAccess }[],
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('No se pueden modificar los permisos del administrador');
    }

    for (const p of permissions) {
      if (p.module === 'POS' && p.access === 'READ') {
        throw new BadRequestException('El módulo POS solo acepta HIDDEN o FULL');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userModulePermission.deleteMany({ where: { userId } });

      if (permissions.length > 0) {
        await tx.userModulePermission.createMany({
          data: permissions.map((p) => ({
            userId,
            module: p.module,
            access: p.access,
          })),
        });
      }
    });
  }

  async resolveAccess(userId: string, module: ModuleKey): Promise<ModuleAccess> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return 'HIDDEN';
    }

    if (user.role === 'ADMIN') {
      return 'FULL';
    }

    const perm = await this.prisma.userModulePermission.findUnique({
      where: { userId_module: { userId, module } },
    });

    return perm?.access ?? 'HIDDEN';
  }
}
