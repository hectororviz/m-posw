"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoOauthController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const select_store_dto_1 = require("./dto/select-store.dto");
const setup_pos_dto_1 = require("./dto/setup-pos.dto");
const token_exchange_dto_1 = require("./dto/token-exchange.dto");
const mercadopago_oauth_service_1 = require("./mercadopago-oauth.service");
let MercadoPagoOauthController = class MercadoPagoOauthController {
    constructor(mpOauthService) {
        this.mpOauthService = mpOauthService;
    }
    connect() {
        return this.mpOauthService.generateConnectUrl();
    }
    token(body) {
        return this.mpOauthService.exchangeToken(body.code);
    }
    status() {
        return this.mpOauthService.getStatus();
    }
    disconnect() {
        return this.mpOauthService.disconnect();
    }
    detectStores() {
        return this.mpOauthService.detectStores();
    }
    selectStore(body) {
        return this.mpOauthService.selectStore(body.storeId, body.posId);
    }
    setupPos(body) {
        return this.mpOauthService.setupPos(body.storeName, body.posName, body.streetName, body.streetNumber, body.cityName, body.stateName, body.zipCode, body.latitude, body.longitude);
    }
    getQr() {
        return this.mpOauthService.getQr();
    }
    async cityByZip(zip) {
        if (!zip) {
            throw new common_1.HttpException('Parametro "zip" requerido', common_1.HttpStatus.BAD_REQUEST);
        }
        const result = await this.mpOauthService.cityByZip(zip);
        if (!result) {
            throw new common_1.HttpException('Ciudad no encontrada para ese codigo postal', common_1.HttpStatus.NOT_FOUND);
        }
        return result;
    }
    async cities(stateName, q) {
        if (q) {
            return this.mpOauthService.searchCities(q);
        }
        return this.mpOauthService.getCities(stateName);
    }
    async citiesList() {
        return this.mpOauthService.getMpCityList();
    }
    async cityZipcodes(city) {
        if (!city) {
            throw new common_1.HttpException('Parametro "city" requerido', common_1.HttpStatus.BAD_REQUEST);
        }
        return this.mpOauthService.getCityZipcodes(city);
    }
    deletePosSetup() {
        return this.mpOauthService.deletePosSetup();
    }
};
exports.MercadoPagoOauthController = MercadoPagoOauthController;
__decorate([
    (0, common_1.Get)('connect'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MercadoPagoOauthController.prototype, "connect", null);
__decorate([
    (0, common_1.Post)('token'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [token_exchange_dto_1.TokenExchangeDto]),
    __metadata("design:returntype", void 0)
], MercadoPagoOauthController.prototype, "token", null);
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MercadoPagoOauthController.prototype, "status", null);
__decorate([
    (0, common_1.Delete)('disconnect'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MercadoPagoOauthController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Get)('detect-stores'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MercadoPagoOauthController.prototype, "detectStores", null);
__decorate([
    (0, common_1.Post)('select-store'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [select_store_dto_1.SelectStoreDto]),
    __metadata("design:returntype", void 0)
], MercadoPagoOauthController.prototype, "selectStore", null);
__decorate([
    (0, common_1.Post)('setup-pos'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [setup_pos_dto_1.SetupPosDto]),
    __metadata("design:returntype", void 0)
], MercadoPagoOauthController.prototype, "setupPos", null);
__decorate([
    (0, common_1.Get)('qr'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MercadoPagoOauthController.prototype, "getQr", null);
__decorate([
    (0, common_1.Get)('city-by-zip'),
    __param(0, (0, common_1.Query)('zip')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MercadoPagoOauthController.prototype, "cityByZip", null);
__decorate([
    (0, common_1.Get)('cities'),
    __param(0, (0, common_1.Query)('stateName')),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MercadoPagoOauthController.prototype, "cities", null);
__decorate([
    (0, common_1.Get)('cities-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MercadoPagoOauthController.prototype, "citiesList", null);
__decorate([
    (0, common_1.Get)('city-zipcodes'),
    __param(0, (0, common_1.Query)('city')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MercadoPagoOauthController.prototype, "cityZipcodes", null);
__decorate([
    (0, common_1.Delete)('setup-pos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MercadoPagoOauthController.prototype, "deletePosSetup", null);
exports.MercadoPagoOauthController = MercadoPagoOauthController = __decorate([
    (0, common_1.Controller)('mp-oauth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.CONFIGURACION, client_1.ModuleAccess.FULL),
    __metadata("design:paramtypes", [mercadopago_oauth_service_1.MercadoPagoOauthService])
], MercadoPagoOauthController);
