import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CashMovementsModule } from './cash-movements/cash-movements.module';
import { CashSessionsModule } from './cash-sessions/cash-sessions.module';
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
    CashSessionsModule,
    CashMovementsModule,
    IconsModule,
    ProductsModule,
    SalesModule,
    ReportsModule,
    StatsModule,
    SettingsModule,
  ],
})
export class AppModule {}
