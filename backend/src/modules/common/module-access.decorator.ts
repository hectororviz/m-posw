import { SetMetadata } from '@nestjs/common';
import { ModuleKey, ModuleAccess } from '@prisma/client';

export const MODULE_ACCESS_KEY = 'moduleAccess';

export const RequireModule = (module: ModuleKey, minAccess: ModuleAccess) =>
  SetMetadata(MODULE_ACCESS_KEY, { module, minAccess });
