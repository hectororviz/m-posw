import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserPermissionsService } from './user-permissions.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserPermissionsService, PrismaService],
  exports: [UsersService, UserPermissionsService],
})
export class UsersModule {}
