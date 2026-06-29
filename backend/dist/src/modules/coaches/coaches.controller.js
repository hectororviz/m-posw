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
exports.CoachesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const coaches_service_1 = require("./coaches.service");
const create_coach_dto_1 = require("./dto/create-coach.dto");
const update_coach_dto_1 = require("./dto/update-coach.dto");
let CoachesController = class CoachesController {
    constructor(coachesService) {
        this.coachesService = coachesService;
    }
    findAll(search, page, limit) {
        return this.coachesService.findAll({
            search,
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }
    async report(tournamentId, categoryId, res) {
        const { buffer, filename } = await this.coachesService.generateReport(tournamentId ? +tournamentId : undefined, categoryId ? +categoryId : undefined);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    findOne(id) {
        return this.coachesService.findOne(id);
    }
    create(dto) {
        return this.coachesService.create(dto);
    }
    update(id, dto) {
        return this.coachesService.update(id, dto);
    }
    remove(id) {
        return this.coachesService.remove(id);
    }
};
exports.CoachesController = CoachesController;
__decorate([
    (0, common_1.Get)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], CoachesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('report'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)('tournamentId')),
    __param(1, (0, common_1.Query)('categoryId')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], CoachesController.prototype, "report", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CoachesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_coach_dto_1.CreateCoachDto]),
    __metadata("design:returntype", void 0)
], CoachesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_coach_dto_1.UpdateCoachDto]),
    __metadata("design:returntype", void 0)
], CoachesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PLAYERS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CoachesController.prototype, "remove", null);
exports.CoachesController = CoachesController = __decorate([
    (0, common_1.Controller)('coaches'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    __metadata("design:paramtypes", [coaches_service_1.CoachesService])
], CoachesController);
