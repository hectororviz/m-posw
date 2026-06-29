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
exports.UpdateSocioDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const emptyToNull = ({ value }) => {
    if (value === '' || value === null || value === undefined)
        return null;
    return value;
};
const toIntOrNull = ({ value }) => {
    if (value === '' || value === null || value === undefined)
        return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
};
class UpdateSocioDto {
}
exports.UpdateSocioDto = UpdateSocioDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(toIntOrNull),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateSocioDto.prototype, "nroSocio", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_transformer_1.Transform)(emptyToNull),
    __metadata("design:type", String)
], UpdateSocioDto.prototype, "dni", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_transformer_1.Transform)(emptyToNull),
    __metadata("design:type", String)
], UpdateSocioDto.prototype, "apellido", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_transformer_1.Transform)(emptyToNull),
    __metadata("design:type", String)
], UpdateSocioDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    (0, class_transformer_1.Transform)(emptyToNull),
    __metadata("design:type", String)
], UpdateSocioDto.prototype, "fechaNacimiento", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_transformer_1.Transform)(emptyToNull),
    __metadata("design:type", String)
], UpdateSocioDto.prototype, "telefono", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_transformer_1.Transform)(emptyToNull),
    __metadata("design:type", String)
], UpdateSocioDto.prototype, "direccion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(toIntOrNull),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateSocioDto.prototype, "socioTipoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    (0, class_transformer_1.Transform)(emptyToNull),
    __metadata("design:type", String)
], UpdateSocioDto.prototype, "fechaAlta", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SocioEstado),
    __metadata("design:type", String)
], UpdateSocioDto.prototype, "estado", void 0);
