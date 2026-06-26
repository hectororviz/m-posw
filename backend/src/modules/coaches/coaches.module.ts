import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { CoachesController } from './coaches.controller';
import { TournamentCoachesController } from './tournament-coaches.controller';
import { CoachesService } from './coaches.service';

@Module({
  imports: [UsersModule],
  controllers: [CoachesController, TournamentCoachesController],
  providers: [CoachesService, PrismaService],
  exports: [CoachesService],
})
export class CoachesModule {}
