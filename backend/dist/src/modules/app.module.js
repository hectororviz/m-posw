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
const auth_module_1 = require("./auth/auth.module");
const cash_close_module_1 = require("./cash-close/cash-close.module");
const categories_module_1 = require("./categories/categories.module");
const cash_movements_module_1 = require("./cash-movements/cash-movements.module");
const icons_module_1 = require("./icons/icons.module");
const payments_module_1 = require("./payments/payments.module");
const products_module_1 = require("./products/products.module");
const reports_module_1 = require("./reports/reports.module");
const sales_module_1 = require("./sales/sales.module");
const settings_module_1 = require("./settings/settings.module");
const stats_module_1 = require("./stats/stats.module");
const stock_module_1 = require("./stock/stock.module");
const users_module_1 = require("./users/users.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            auth_module_1.AuthModule,
            cash_close_module_1.CashCloseModule,
            users_module_1.UsersModule,
            categories_module_1.CategoriesModule,
            cash_movements_module_1.CashMovementsModule,
            icons_module_1.IconsModule,
            payments_module_1.PaymentsModule,
            products_module_1.ProductsModule,
            sales_module_1.SalesModule,
            reports_module_1.ReportsModule,
            stats_module_1.StatsModule,
            settings_module_1.SettingsModule,
            stock_module_1.StockModule,
        ],
    })
], AppModule);
