import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [UsersModule],
  controllers: [HomeController],
  providers: [HomeService, PrismaService],
})
export class HomeModule {}
