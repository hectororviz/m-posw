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
exports.SociosCanjesController = exports.SociosBeneficiosController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const create_beneficio_dto_1 = require("./dto/create-beneficio.dto");
const update_beneficio_dto_1 = require("./dto/update-beneficio.dto");
const create_canjes_dto_1 = require("./dto/create-canjes.dto");
const socios_beneficios_service_1 = require("./socios-beneficios.service");
let SociosBeneficiosController = class SociosBeneficiosController {
    constructor(beneficiosService) {
        this.beneficiosService = beneficiosService;
    }
    findAll(socioTipoId) {
        return this.beneficiosService.findAll(socioTipoId);
    }
    create(dto) {
        return this.beneficiosService.create(dto);
    }
    update(id, dto) {
        return this.beneficiosService.update(id, dto);
    }
    remove(id) {
        return this.beneficiosService.remove(id);
    }
};
exports.SociosBeneficiosController = SociosBeneficiosController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('socioTipoId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SociosBeneficiosController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_beneficio_dto_1.CreateBeneficioDto]),
    __metadata("design:returntype", void 0)
], SociosBeneficiosController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_beneficio_dto_1.UpdateBeneficioDto]),
    __metadata("design:returntype", void 0)
], SociosBeneficiosController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SociosBeneficiosController.prototype, "remove", null);
exports.SociosBeneficiosController = SociosBeneficiosController = __decorate([
    (0, common_1.Controller)('socios/beneficios'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.READ),
    __metadata("design:paramtypes", [socios_beneficios_service_1.SociosBeneficiosService])
], SociosBeneficiosController);
let SociosCanjesController = class SociosCanjesController {
    constructor(beneficiosService) {
        this.beneficiosService = beneficiosService;
    }
    create(dto, req) {
        const userId = req.user?.sub || req.user?.id;
        const posId = req.user?.externalPosId || req.user?.posId;
        return this.beneficiosService.registerCanjes(dto, userId, posId);
    }
};
exports.SociosCanjesController = SociosCanjesController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_canjes_dto_1.CreateCanjesDto, Object]),
    __metadata("design:returntype", void 0)
], SociosCanjesController.prototype, "create", null);
exports.SociosCanjesController = SociosCanjesController = __decorate([
    (0, common_1.Controller)('socios/canjes'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [socios_beneficios_service_1.SociosBeneficiosService])
], SociosCanjesController);
