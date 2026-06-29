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
exports.AssetCategoriesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../../common/jwt-auth.guard");
const module_access_guard_1 = require("../../common/module-access.guard");
const module_access_decorator_1 = require("../../common/module-access.decorator");
const asset_categories_service_1 = require("./asset-categories.service");
const create_category_dto_1 = require("./dto/create-category.dto");
const update_category_dto_1 = require("./dto/update-category.dto");
let AssetCategoriesController = class AssetCategoriesController {
    constructor(assetCategoriesService) {
        this.assetCategoriesService = assetCategoriesService;
    }
    findAll() {
        return this.assetCategoriesService.findAll();
    }
    create(dto) {
        return this.assetCategoriesService.create(dto);
    }
    update(id, dto) {
        return this.assetCategoriesService.update(id, dto);
    }
    toggle(id) {
        return this.assetCategoriesService.toggle(id);
    }
};
exports.AssetCategoriesController = AssetCategoriesController;
__decorate([
    (0, common_1.Get)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.READ),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AssetCategoriesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_category_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", void 0)
], AssetCategoriesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_category_dto_1.UpdateCategoryDto]),
    __metadata("design:returntype", void 0)
], AssetCategoriesController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.PATRIMONIO, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AssetCategoriesController.prototype, "toggle", null);
exports.AssetCategoriesController = AssetCategoriesController = __decorate([
    (0, common_1.Controller)('asset-categories'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    __metadata("design:paramtypes", [asset_categories_service_1.AssetCategoriesService])
], AssetCategoriesController);
