import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UsersModule } from '../users/users.module';
import { AssetsController } from './assets/assets.controller';
import { AssetsService } from './assets/assets.service';
import { AssetCategoriesController } from './asset-categories/asset-categories.controller';
import { AssetCategoriesService } from './asset-categories/asset-categories.service';
import { AssetStatusesController } from './asset-statuses/asset-statuses.controller';
import { AssetStatusesService } from './asset-statuses/asset-statuses.service';

@Module({
  imports: [UsersModule],
  controllers: [
    AssetsController,
    AssetCategoriesController,
    AssetStatusesController,
  ],
  providers: [
    AssetsService,
    AssetCategoriesService,
    AssetStatusesService,
    PrismaService,
  ],
})
export class PatrimonioModule {}
