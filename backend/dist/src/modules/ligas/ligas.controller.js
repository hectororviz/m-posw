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
exports.LigasController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const create_liga_config_dto_1 = require("./dto/create-liga-config.dto");
const ligas_service_1 = require("./ligas.service");
let LigasController = class LigasController {
    constructor(ligasService) {
        this.ligasService = ligasService;
    }
    getLeagues() {
        return this.ligasService.getLeagues();
    }
    getCategories(id) {
        return this.ligasService.getCategories(id);
    }
    getTeams(id) {
        return this.ligasService.getTeams(id);
    }
    getStandings(leagueId, categoryId) {
        return this.ligasService.getStandings(leagueId, categoryId);
    }
    getNextMatches(id, leagueId) {
        return this.ligasService.getNextMatches(id, leagueId);
    }
    getResults(id, leagueId, categoryId) {
        return this.ligasService.getResults(id, leagueId, categoryId);
    }
    getAllMatches(id, leagueId) {
        return this.ligasService.getAllMatches(id, leagueId);
    }
    getConfigs() {
        return this.ligasService.getConfigs();
    }
    createConfig(dto) {
        return this.ligasService.createConfig(dto);
    }
    deleteConfig(id) {
        return this.ligasService.deleteConfig(id);
    }
};
exports.LigasController = LigasController;
__decorate([
    (0, common_1.Get)('leagues'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LigasController.prototype, "getLeagues", null);
__decorate([
    (0, common_1.Get)('leagues/:id/categories'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LigasController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)('leagues/:id/teams'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LigasController.prototype, "getTeams", null);
__decorate([
    (0, common_1.Get)('standings'),
    __param(0, (0, common_1.Query)('leagueId')),
    __param(1, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LigasController.prototype, "getStandings", null);
__decorate([
    (0, common_1.Get)('teams/:id/next-matches'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('leagueId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LigasController.prototype, "getNextMatches", null);
__decorate([
    (0, common_1.Get)('teams/:id/results'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('leagueId')),
    __param(2, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], LigasController.prototype, "getResults", null);
__decorate([
    (0, common_1.Get)('teams/:id/all-matches'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('leagueId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LigasController.prototype, "getAllMatches", null);
__decorate([
    (0, common_1.Get)('configs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LigasController.prototype, "getConfigs", null);
__decorate([
    (0, common_1.Post)('configs'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.LIGAS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_liga_config_dto_1.CreateLigaConfigDto]),
    __metadata("design:returntype", void 0)
], LigasController.prototype, "createConfig", null);
__decorate([
    (0, common_1.Delete)('configs/:id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.LIGAS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LigasController.prototype, "deleteConfig", null);
exports.LigasController = LigasController = __decorate([
    (0, common_1.Controller)('ligas'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.LIGAS, client_1.ModuleAccess.READ),
    __metadata("design:paramtypes", [ligas_service_1.LigasService])
], LigasController);
