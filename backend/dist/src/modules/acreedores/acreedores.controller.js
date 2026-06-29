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
exports.AcreedoresController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const acreedores_service_1 = require("./acreedores.service");
const create_acreedor_dto_1 = require("./dto/create-acreedor.dto");
const update_acreedor_dto_1 = require("./dto/update-acreedor.dto");
const create_pago_dto_1 = require("./dto/create-pago.dto");
let AcreedoresController = class AcreedoresController {
    constructor(acreedoresService) {
        this.acreedoresService = acreedoresService;
    }
    getResumen() {
        return this.acreedoresService.getResumen();
    }
    findAll() {
        return this.acreedoresService.findAll();
    }
    findOne(id) {
        return this.acreedoresService.findOne(id);
    }
    create(dto) {
        return this.acreedoresService.create(dto);
    }
    update(id, dto) {
        return this.acreedoresService.update(id, dto);
    }
    toggleActive(id) {
        return this.acreedoresService.toggleActive(id);
    }
    getDeuda(id) {
        return this.acreedoresService.getDeuda(id);
    }
    addPago(req, id, dto) {
        return this.acreedoresService.addPago(req.user.sub, id, dto);
    }
};
exports.AcreedoresController = AcreedoresController;
__decorate([
    (0, common_1.Get)('resumen'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.ACREEDORES, client_1.ModuleAccess.READ),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AcreedoresController.prototype, "getResumen", null);
__decorate([
    (0, common_1.Get)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.ACREEDORES, client_1.ModuleAccess.READ),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AcreedoresController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.ACREEDORES, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AcreedoresController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.ACREEDORES, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_acreedor_dto_1.CreateAcreedorDto]),
    __metadata("design:returntype", void 0)
], AcreedoresController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.ACREEDORES, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_acreedor_dto_1.UpdateAcreedorDto]),
    __metadata("design:returntype", void 0)
], AcreedoresController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.ACREEDORES, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AcreedoresController.prototype, "toggleActive", null);
__decorate([
    (0, common_1.Get)(':id/deuda'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.ACREEDORES, client_1.ModuleAccess.READ),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AcreedoresController.prototype, "getDeuda", null);
__decorate([
    (0, common_1.Post)(':id/pagos'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.ACREEDORES, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, create_pago_dto_1.CreatePagoDto]),
    __metadata("design:returntype", void 0)
], AcreedoresController.prototype, "addPago", null);
exports.AcreedoresController = AcreedoresController = __decorate([
    (0, common_1.Controller)('acreedores'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    __metadata("design:paramtypes", [acreedores_service_1.AcreedoresService])
], AcreedoresController);
