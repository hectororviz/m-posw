import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

@Module({
  imports: [UsersModule],
  controllers: [TournamentsController],
  providers: [TournamentsService, PrismaService],
})
export class TournamentsModule {}
