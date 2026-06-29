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
exports.TournamentCoachesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const coaches_service_1 = require("./coaches.service");
const assign_coach_dto_1 = require("./dto/assign-coach.dto");
let TournamentCoachesController = class TournamentCoachesController {
    constructor(coachesService) {
        this.coachesService = coachesService;
    }
    getCoaches(tournamentId) {
        return this.coachesService.getTournamentCoaches(tournamentId);
    }
    assignCoach(tournamentId, dto) {
        return this.coachesService.assignCoach(tournamentId, dto.coachId, dto.playerCategoryId);
    }
    unassignCoach(tournamentId, coachId) {
        return this.coachesService.unassignCoach(tournamentId, coachId);
    }
};
exports.TournamentCoachesController = TournamentCoachesController;
__decorate([
    (0, common_1.Get)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Param)('tournamentId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TournamentCoachesController.prototype, "getCoaches", null);
__decorate([
    (0, common_1.Post)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('tournamentId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, assign_coach_dto_1.AssignCoachDto]),
    __metadata("design:returntype", void 0)
], TournamentCoachesController.prototype, "assignCoach", null);
__decorate([
    (0, common_1.Delete)(':coachId'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('tournamentId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('coachId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", void 0)
], TournamentCoachesController.prototype, "unassignCoach", null);
exports.TournamentCoachesController = TournamentCoachesController = __decorate([
    (0, common_1.Controller)('tournaments/:tournamentId/coaches'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    __metadata("design:paramtypes", [coaches_service_1.CoachesService])
], TournamentCoachesController);
