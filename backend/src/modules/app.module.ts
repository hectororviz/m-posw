import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CashCloseModule } from './cash-close/cash-close.module';
import { CashMovementsModule } from './cash-movements/cash-movements.module';
import { IconsModule } from './icons/icons.module';
import { ProductsModule } from './products/products.module';
import { ReportsModule } from './reports/reports.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { StatsModule } from './stats/stats.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    CategoriesModule,
    CashMovementsModule,
    CashCloseModule,
    IconsModule,
    ProductsModule,
    SalesModule,
    ReportsModule,
    StatsModule,
    SettingsModule,
  ],
})
export class AppModule {}
