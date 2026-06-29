"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatrimonioModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const users_module_1 = require("../users/users.module");
const assets_controller_1 = require("./assets/assets.controller");
const assets_service_1 = require("./assets/assets.service");
const asset_categories_controller_1 = require("./asset-categories/asset-categories.controller");
const asset_categories_service_1 = require("./asset-categories/asset-categories.service");
const asset_statuses_controller_1 = require("./asset-statuses/asset-statuses.controller");
const asset_statuses_service_1 = require("./asset-statuses/asset-statuses.service");
let PatrimonioModule = class PatrimonioModule {
};
exports.PatrimonioModule = PatrimonioModule;
exports.PatrimonioModule = PatrimonioModule = __decorate([
    (0, common_1.Module)({
        imports: [users_module_1.UsersModule],
        controllers: [
            assets_controller_1.AssetsController,
            asset_categories_controller_1.AssetCategoriesController,
            asset_statuses_controller_1.AssetStatusesController,
        ],
        providers: [
            assets_service_1.AssetsService,
            asset_categories_service_1.AssetCategoriesService,
            asset_statuses_service_1.AssetStatusesService,
            prisma_service_1.PrismaService,
        ],
    })
], PatrimonioModule);
