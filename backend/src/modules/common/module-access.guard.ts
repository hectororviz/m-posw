import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleAccess } from '@prisma/client';
import { MODULE_ACCESS_KEY } from './module-access.decorator';
import { UserPermissionsService } from '../users/user-permissions.service';

const ACCESS_LEVEL: Record<ModuleAccess, number> = {
  HIDDEN: 0,
  READ: 1,
  FULL: 2,
};

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<{ module: string; minAccess: ModuleAccess }>(
      MODULE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const access = await this.userPermissionsService.resolveAccess(
      user.id,
      metadata.module as any,
    );

    return ACCESS_LEVEL[access] >= ACCESS_LEVEL[metadata.minAccess];
  }
}
