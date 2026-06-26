import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AccountingModule } from './accounting/accounting.module';
import { AcreedoresModule } from './acreedores/acreedores.module';
import { AuthModule } from './auth/auth.module';
import { CashCloseModule } from './cash-close/cash-close.module';
import { CategoriesModule } from './categories/categories.module';
import { CashMovementsModule } from './cash-movements/cash-movements.module';
import { IconsModule } from './icons/icons.module';
import { MercadoPagoOauthModule } from './mercadopago-oauth/mercadopago-oauth.module';
import { PaymentsModule } from './payments/payments.module';
import { ProductsModule } from './products/products.module';
import { ReportsModule } from './reports/reports.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { StatsModule } from './stats/stats.module';
import { StockModule } from './stock/stock.module';
import { InternetVouchersModule } from './internet-vouchers/internet-vouchers.module';
import { SociosModule } from './socios/socios.module';
import { TreasuryModule } from './treasury/treasury.module';
import { UsersModule } from './users/users.module';
import { HomeModule } from './home/home.module';
import { LigasModule } from './ligas/ligas.module';
import { PlayersModule } from './players/players.module';
import { PlayerCategoriesModule } from './player-categories/player-categories.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { PlayersStatsModule } from './players-stats/players-stats.module';
import { PatrimonioModule } from './patrimonio/patrimonio.module';
import { CoachesModule } from './coaches/coaches.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    AccountingModule,
    AcreedoresModule,
    TreasuryModule,
    AuthModule,
    CashCloseModule,
    UsersModule,
    CategoriesModule,
    CashMovementsModule,
    IconsModule,
    InternetVouchersModule,
    LigasModule,
    MercadoPagoOauthModule,
    PaymentsModule,
    ProductsModule,
    SalesModule,
    ReportsModule,
    StatsModule,
    SettingsModule,
    SociosModule,
    StockModule,
    HomeModule,
    PlayersModule,
    PlayerCategoriesModule,
    TournamentsModule,
    PlayersStatsModule,
    PatrimonioModule,
    CoachesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
