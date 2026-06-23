import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';

@Module({
  imports: [UsersModule],
  controllers: [PlayersController],
  providers: [PlayersService, PrismaService],
})
export class PlayersModule {}
