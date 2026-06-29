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
exports.AssetsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../../common/jwt-auth.guard");
const module_access_guard_1 = require("../../common/module-access.guard");
const module_access_decorator_1 = require("../../common/module-access.decorator");
const assets_service_1 = require("./assets.service");
const create_asset_dto_1 = require("./dto/create-asset.dto");
const update_asset_dto_1 = require("./dto/update-asset.dto");
const change_status_dto_1 = require("./dto/change-status.dto");
let AssetsController = class AssetsController {
    constructor(assetsService) {
        this.assetsService = assetsService;
    }
    findAll(categoryId, statusId, location, isActive, page, limit) {
        return this.assetsService.findAll({
            categoryId: categoryId ? +categoryId : undefined,
            statusId: statusId ? +statusId : undefined,
            location,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }
    findOne(id) {
        return this.assetsService.findOne(id);
    }
    create(dto, req) {
        return this.assetsService.create(dto, req.user.id);
    }
    update(id, dto, req) {
        return this.assetsService.update(id, dto, req.user.id);
    }
    changeStatus(id, dto, req) {
        return this.assetsService.changeStatus(id, dto, req.user.id);
    }
    remove(id, req) {
        return this.assetsService.remove(id, req.user.id);
    }
    getEvents(id) {
        return this.assetsService.getEvents(id);
    }
};
exports.AssetsController = AssetsController;
__decorate([
    (0, common_1.Get)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Query)('categoryId')),
    __param(1, (0, common_1.Query)('statusId')),
    __param(2, (0, common_1.Query)('location')),
    __param(3, (0, common_1.Query)('isActive')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_asset_dto_1.CreateAssetDto, Object]),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_asset_dto_1.UpdateAssetDto, Object]),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, change_status_dto_1.ChangeStatusDto, Object]),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "changeStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/events'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "getEvents", null);
exports.AssetsController = AssetsController = __decorate([
    (0, common_1.Controller)('assets'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    __metadata("design:paramtypes", [assets_service_1.AssetsService])
], AssetsController);
