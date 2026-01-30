import { Module } from '@nestjs/common';
import { IconsController } from './icons.controller';
import { IconsService } from './icons.service';

@Module({
  controllers: [IconsController],
  providers: [IconsService],
})
export class IconsModule {}
