import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { PlayersStatsController } from './players-stats.controller';
import { PlayersStatsService } from './players-stats.service';

@Module({
  imports: [UsersModule],
  controllers: [PlayersStatsController],
  providers: [PlayersStatsService, PrismaService],
})
export class PlayersStatsModule {}
