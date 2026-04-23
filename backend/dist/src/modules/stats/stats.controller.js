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
exports.StatsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const roles_guard_1 = require("../common/roles.guard");
const stats_service_1 = require("./stats.service");
let StatsController = class StatsController {
    constructor(statsService) {
        this.statsService = statsService;
    }
    totalsByDay() {
        return this.statsService.totalsByDay();
    }
    totalsByMonth() {
        return this.statsService.totalsByMonth();
    }
    averageDailyByCategory() {
        return this.statsService.averageDailyByCategory();
    }
    averageDailyByProduct() {
        return this.statsService.averageDailyByProduct();
    }
};
exports.StatsController = StatsController;
__decorate([
    (0, common_1.Get)('totals-by-day'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StatsController.prototype, "totalsByDay", null);
__decorate([
    (0, common_1.Get)('totals-by-month'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StatsController.prototype, "totalsByMonth", null);
__decorate([
    (0, common_1.Get)('average-daily-by-category'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StatsController.prototype, "averageDailyByCategory", null);
__decorate([
    (0, common_1.Get)('average-daily-by-product'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StatsController.prototype, "averageDailyByProduct", null);
exports.StatsController = StatsController = __decorate([
    (0, common_1.Controller)('stats'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:paramtypes", [stats_service_1.StatsService])
], StatsController);
