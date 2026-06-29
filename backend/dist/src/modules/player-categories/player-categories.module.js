"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerCategoriesModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const users_module_1 = require("../users/users.module");
const player_categories_controller_1 = require("./player-categories.controller");
const player_categories_service_1 = require("./player-categories.service");
let PlayerCategoriesModule = class PlayerCategoriesModule {
};
exports.PlayerCategoriesModule = PlayerCategoriesModule;
exports.PlayerCategoriesModule = PlayerCategoriesModule = __decorate([
    (0, common_1.Module)({
        imports: [users_module_1.UsersModule],
        controllers: [player_categories_controller_1.PlayerCategoriesController],
        providers: [player_categories_service_1.PlayerCategoriesService, prisma_service_1.PrismaService],
    })
], PlayerCategoriesModule);
