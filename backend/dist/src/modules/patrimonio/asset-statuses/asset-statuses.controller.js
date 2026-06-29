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
exports.AssetStatusesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../../common/jwt-auth.guard");
const module_access_guard_1 = require("../../common/module-access.guard");
const module_access_decorator_1 = require("../../common/module-access.decorator");
const asset_statuses_service_1 = require("./asset-statuses.service");
const create_status_dto_1 = require("./dto/create-status.dto");
const update_status_dto_1 = require("./dto/update-status.dto");
let AssetStatusesController = class AssetStatusesController {
    constructor(assetStatusesService) {
        this.assetStatusesService = assetStatusesService;
    }
    findAll() {
        return this.assetStatusesService.findAll();
    }
    create(dto) {
        return this.assetStatusesService.create(dto);
    }
    update(id, dto) {
        return this.assetStatusesService.update(id, dto);
    }
    toggle(id) {
        return this.assetStatusesService.toggle(id);
    }
    remove(id) {
        return this.assetStatusesService.remove(id);
    }
};
exports.AssetStatusesController = AssetStatusesController;
__decorate([
    (0, common_1.Get)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.READ),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AssetStatusesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_status_dto_1.CreateStatusDto]),
    __metadata("design:returntype", void 0)
], AssetStatusesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_status_dto_1.UpdateStatusDto]),
    __metadata("design:returntype", void 0)
], AssetStatusesController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AssetStatusesController.prototype, "toggle", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AssetStatusesController.prototype, "remove", null);
exports.AssetStatusesController = AssetStatusesController = __decorate([
    (0, common_1.Controller)('asset-statuses'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    __metadata("design:paramtypes", [asset_statuses_service_1.AssetStatusesService])
], AssetStatusesController);
