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
exports.PlayersController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const players_service_1 = require("./players.service");
const create_player_dto_1 = require("./dto/create-player.dto");
const update_player_dto_1 = require("./dto/update-player.dto");
let PlayersController = class PlayersController {
    constructor(playersService) {
        this.playersService = playersService;
    }
    findAll(search, sex, page, limit) {
        return this.playersService.findAll({
            search,
            sex,
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }
    async exportExcel(search, sex, res) {
        const buffer = await this.playersService.exportExcel({ search, sex });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=jugadores.xlsx');
        res.send(buffer);
    }
    findOne(id) {
        return this.playersService.findOne(id);
    }
    create(dto) {
        return this.playersService.create(dto);
    }
    importExcel(file) {
        return this.playersService.importExcel(file);
    }
    update(id, dto) {
        return this.playersService.update(id, dto);
    }
    remove(id) {
        return this.playersService.remove(id);
    }
};
exports.PlayersController = PlayersController;
__decorate([
    (0, common_1.Get)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('sex')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], PlayersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('sex')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], PlayersController.prototype, "exportExcel", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], PlayersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_player_dto_1.CreatePlayerDto]),
    __metadata("design:returntype", void 0)
], PlayersController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('import-excel'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PlayersController.prototype, "importExcel", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_player_dto_1.UpdatePlayerDto]),
    __metadata("design:returntype", void 0)
], PlayersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], PlayersController.prototype, "remove", null);
exports.PlayersController = PlayersController = __decorate([
    (0, common_1.Controller)('players'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    __metadata("design:paramtypes", [players_service_1.PlayersService])
], PlayersController);
