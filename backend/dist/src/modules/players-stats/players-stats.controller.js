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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayersStatsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const players_stats_service_1 = require("./players-stats.service");
let PlayersStatsController = class PlayersStatsController {
    constructor(playersStatsService) {
        this.playersStatsService = playersStatsService;
    }
    getDashboard() {
        return this.playersStatsService.getDashboard();
    }
};
exports.PlayersStatsController = PlayersStatsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlayersStatsController.prototype, "getDashboard", null);
exports.PlayersStatsController = PlayersStatsController = __decorate([
    (0, common_1.Controller)('players-stats'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    __metadata("design:paramtypes", [players_stats_service_1.PlayersStatsService])
], PlayersStatsController);
