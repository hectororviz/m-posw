import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { PlayerCategoriesController } from './player-categories.controller';
import { PlayerCategoriesService } from './player-categories.service';

@Module({
  imports: [UsersModule],
  controllers: [PlayerCategoriesController],
  providers: [PlayerCategoriesService, PrismaService],
})
export class PlayerCategoriesModule {}
