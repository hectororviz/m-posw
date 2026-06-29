"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const accounting_module_1 = require("./accounting/accounting.module");
const acreedores_module_1 = require("./acreedores/acreedores.module");
const auth_module_1 = require("./auth/auth.module");
const cash_close_module_1 = require("./cash-close/cash-close.module");
const categories_module_1 = require("./categories/categories.module");
const cash_movements_module_1 = require("./cash-movements/cash-movements.module");
const icons_module_1 = require("./icons/icons.module");
const mercadopago_oauth_module_1 = require("./mercadopago-oauth/mercadopago-oauth.module");
const payments_module_1 = require("./payments/payments.module");
const products_module_1 = require("./products/products.module");
const reports_module_1 = require("./reports/reports.module");
const sales_module_1 = require("./sales/sales.module");
const settings_module_1 = require("./settings/settings.module");
const stats_module_1 = require("./stats/stats.module");
const stock_module_1 = require("./stock/stock.module");
const internet_vouchers_module_1 = require("./internet-vouchers/internet-vouchers.module");
const socios_module_1 = require("./socios/socios.module");
const treasury_module_1 = require("./treasury/treasury.module");
const users_module_1 = require("./users/users.module");
const home_module_1 = require("./home/home.module");
const ligas_module_1 = require("./ligas/ligas.module");
const players_module_1 = require("./players/players.module");
const player_categories_module_1 = require("./player-categories/player-categories.module");
const tournaments_module_1 = require("./tournaments/tournaments.module");
const players_stats_module_1 = require("./players-stats/players-stats.module");
const patrimonio_module_1 = require("./patrimonio/patrimonio.module");
const coaches_module_1 = require("./coaches/coaches.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
            accounting_module_1.AccountingModule,
            acreedores_module_1.AcreedoresModule,
            treasury_module_1.TreasuryModule,
            auth_module_1.AuthModule,
            cash_close_module_1.CashCloseModule,
            users_module_1.UsersModule,
            categories_module_1.CategoriesModule,
            cash_movements_module_1.CashMovementsModule,
            icons_module_1.IconsModule,
            internet_vouchers_module_1.InternetVouchersModule,
            ligas_module_1.LigasModule,
            mercadopago_oauth_module_1.MercadoPagoOauthModule,
            payments_module_1.PaymentsModule,
            products_module_1.ProductsModule,
            sales_module_1.SalesModule,
            reports_module_1.ReportsModule,
            stats_module_1.StatsModule,
            settings_module_1.SettingsModule,
            socios_module_1.SociosModule,
            stock_module_1.StockModule,
            home_module_1.HomeModule,
            players_module_1.PlayersModule,
            player_categories_module_1.PlayerCategoriesModule,
            tournaments_module_1.TournamentsModule,
            players_stats_module_1.PlayersStatsModule,
            patrimonio_module_1.PatrimonioModule,
            coaches_module_1.CoachesModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
