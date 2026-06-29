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
exports.TournamentsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const tournaments_service_1 = require("./tournaments.service");
const create_tournament_dto_1 = require("./dto/create-tournament.dto");
const update_tournament_dto_1 = require("./dto/update-tournament.dto");
const fichar_jugadores_dto_1 = require("./dto/fichar-jugadores.dto");
let TournamentsController = class TournamentsController {
    constructor(tournamentsService) {
        this.tournamentsService = tournamentsService;
    }
    findAll(year, allowedSex, page, limit) {
        return this.tournamentsService.findAll({
            year: year ? +year : undefined,
            allowedSex,
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }
    findOne(id) {
        return this.tournamentsService.findOne(id);
    }
    create(dto) {
        return this.tournamentsService.create(dto);
    }
    update(id, dto) {
        return this.tournamentsService.update(id, dto);
    }
    remove(id) {
        return this.tournamentsService.remove(id);
    }
    getPlayers(id, search, categoryId) {
        return this.tournamentsService.getPlayers(id, {
            search,
            categoryId: categoryId ? +categoryId : undefined,
        });
    }
    getEligiblePlayers(id) {
        return this.tournamentsService.getEligiblePlayers(id);
    }
    ficharJugadores(id, dto) {
        return this.tournamentsService.ficharJugadores(id, dto.playerIds);
    }
    desficharJugador(id, playerId) {
        return this.tournamentsService.desficharJugador(id, playerId);
    }
};
exports.TournamentsController = TournamentsController;
__decorate([
    (0, common_1.Get)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('allowedSex')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], TournamentsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TournamentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_tournament_dto_1.CreateTournamentDto]),
    __metadata("design:returntype", void 0)
], TournamentsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_tournament_dto_1.UpdateTournamentDto]),
    __metadata("design:returntype", void 0)
], TournamentsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TournamentsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/players'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", void 0)
], TournamentsController.prototype, "getPlayers", null);
__decorate([
    (0, common_1.Post)(':id/players/eligible'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TournamentsController.prototype, "getEligiblePlayers", null);
__decorate([
    (0, common_1.Post)(':id/players'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, fichar_jugadores_dto_1.FicharJugadoresDto]),
    __metadata("design:returntype", void 0)
], TournamentsController.prototype, "ficharJugadores", null);
__decorate([
    (0, common_1.Delete)(':id/players/:playerId'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('playerId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", void 0)
], TournamentsController.prototype, "desficharJugador", null);
exports.TournamentsController = TournamentsController = __decorate([
    (0, common_1.Controller)('tournaments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    __metadata("design:paramtypes", [tournaments_service_1.TournamentsService])
], TournamentsController);
