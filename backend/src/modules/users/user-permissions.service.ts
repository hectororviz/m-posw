import { BadRequestException, Injectable } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

const ACCESS_CACHE_TTL_MS = 5000; // 5 seconds

interface CacheEntry {
  access: ModuleAccess;
  ts: number;
}

@Injectable()
export class UserPermissionsService {
  private accessCache = new Map<string, CacheEntry>();

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

    // Invalidate all cache entries for this user
    this.invalidateUserCache(userId);
  }

  async resolveAccess(userId: string, module: ModuleKey): Promise<ModuleAccess> {
    const cacheKey = `${userId}:${module}`;
    const cached = this.accessCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < ACCESS_CACHE_TTL_MS) {
      return cached.access;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return 'HIDDEN';
    }

    if (user.role === 'ADMIN') {
      // Cache admin access too
      this.accessCache.set(cacheKey, { access: 'FULL', ts: Date.now() });
      return 'FULL';
    }

    const perm = await this.prisma.userModulePermission.findUnique({
      where: { userId_module: { userId, module } },
    });

    const access = perm?.access ?? 'HIDDEN';
    this.accessCache.set(cacheKey, { access, ts: Date.now() });
    return access;
  }

  private invalidateUserCache(userId: string) {
    const prefix = `${userId}:`;
    for (const key of this.accessCache.keys()) {
      if (key.startsWith(prefix)) {
        this.accessCache.delete(key);
      }
    }
  }
}
