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
exports.SociosController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const module_access_guard_1 = require("../common/module-access.guard");
const module_access_decorator_1 = require("../common/module-access.decorator");
const create_socio_tipo_dto_1 = require("./dto/create-socio-tipo.dto");
const update_socio_tipo_dto_1 = require("./dto/update-socio-tipo.dto");
const create_socio_dto_1 = require("./dto/create-socio.dto");
const update_socio_dto_1 = require("./dto/update-socio.dto");
const create_socio_pago_dto_1 = require("./dto/create-socio-pago.dto");
const generar_cuotas_dto_1 = require("./dto/generar-cuotas.dto");
const bulk_carnets_dto_1 = require("./dto/bulk-carnets.dto");
const socios_service_1 = require("./socios.service");
let SociosController = class SociosController {
    constructor(sociosService) {
        this.sociosService = sociosService;
    }
    getTipos() {
        return this.sociosService.getTipos();
    }
    createTipo(dto) {
        return this.sociosService.createTipo(dto);
    }
    updateTipo(id, dto) {
        return this.sociosService.updateTipo(id, dto);
    }
    deleteTipo(id) {
        return this.sociosService.deleteTipo(id);
    }
    findAll(estado, socioTipoId, deuda) {
        return this.sociosService.findAll({ estado, socioTipoId, deuda });
    }
    getTesoreríaResumen() {
        return this.sociosService.getTesoreríaResumen();
    }
    generarCuotasGet() {
        return { mensaje: 'Usa POST /api/socios/cuotas/generar con { anio, mes }' };
    }
    generarCuotas(dto) {
        return this.sociosService.generarCuotas(dto);
    }
    getMatriz(anio) {
        return this.sociosService.getMatriz(anio);
    }
    create(dto) {
        return this.sociosService.create(dto);
    }
    findOne(id) {
        return this.sociosService.findOne(id);
    }
    update(id, dto) {
        return this.sociosService.update(id, dto);
    }
    deactivate(id) {
        return this.sociosService.deactivate(id);
    }
    getCuotasSocio(id) {
        return this.sociosService.getCuotasSocio(id);
    }
    pagarCuota(req, cuotaId, dto) {
        return this.sociosService.pagarCuota(req.user.sub, cuotaId, dto);
    }
    async getCarnets(dto, res) {
        const { buffer, filename } = await this.sociosService.generateCarnetsPdf(dto.ids);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    async getCarnet(id, res) {
        const { buffer, filename } = await this.sociosService.generateCarnetPdf(id);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
};
exports.SociosController = SociosController;
__decorate([
    (0, common_1.Get)('tipos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "getTipos", null);
__decorate([
    (0, common_1.Post)('tipos'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_socio_tipo_dto_1.CreateSocioTipoDto]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "createTipo", null);
__decorate([
    (0, common_1.Put)('tipos/:id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_socio_tipo_dto_1.UpdateSocioTipoDto]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "updateTipo", null);
__decorate([
    (0, common_1.Delete)('tipos/:id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "deleteTipo", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('estado')),
    __param(1, (0, common_1.Query)('socioTipoId')),
    __param(2, (0, common_1.Query)('deuda')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('tesoreria/resumen'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "getTesorer\u00EDaResumen", null);
__decorate([
    (0, common_1.Get)('cuotas/generar'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "generarCuotasGet", null);
__decorate([
    (0, common_1.Post)('cuotas/generar'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [generar_cuotas_dto_1.GenerarCuotasDto]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "generarCuotas", null);
__decorate([
    (0, common_1.Get)('reporte/matriz'),
    __param(0, (0, common_1.Query)('anio', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "getMatriz", null);
__decorate([
    (0, common_1.Post)(),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_socio_dto_1.CreateSocioDto]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_socio_dto_1.UpdateSocioDto]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Get)(':id/cuotas'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "getCuotasSocio", null);
__decorate([
    (0, common_1.Post)('cuotas/:cuotaId/pagar'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('cuotaId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, create_socio_pago_dto_1.CreateSocioPagoDto]),
    __metadata("design:returntype", void 0)
], SociosController.prototype, "pagarCuota", null);
__decorate([
    (0, common_1.Post)('carnets'),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.FULL),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bulk_carnets_dto_1.BulkCarnetsDto, Object]),
    __metadata("design:returntype", Promise)
], SociosController.prototype, "getCarnets", null);
__decorate([
    (0, common_1.Get)(':id/carnet'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], SociosController.prototype, "getCarnet", null);
exports.SociosController = SociosController = __decorate([
    (0, common_1.Controller)('socios'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, module_access_decorator_1.RequireModule)(client_1.ModuleKey.SOCIOS, client_1.ModuleAccess.READ),
    __metadata("design:paramtypes", [socios_service_1.SociosService])
], SociosController);
