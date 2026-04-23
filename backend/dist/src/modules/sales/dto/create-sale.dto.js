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
exports.CreateQrSaleDto = exports.CreateCashSaleDto = exports.CreateSaleDto = exports.SaleItemInputDto = void 0;
const class_validator_1 = require("class-validator");
class SaleItemInputDto {
}
exports.SaleItemInputDto = SaleItemInputDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaleItemInputDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SaleItemInputDto.prototype, "quantity", void 0);
class CreateSaleDto {
}
exports.CreateSaleDto = CreateSaleDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    __metadata("design:type", Array)
], CreateSaleDto.prototype, "items", void 0);
class CreateCashSaleDto extends CreateSaleDto {
}
exports.CreateCashSaleDto = CreateCashSaleDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateCashSaleDto.prototype, "total", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateCashSaleDto.prototype, "cashReceived", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateCashSaleDto.prototype, "changeAmount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['CASH']),
    __metadata("design:type", String)
], CreateCashSaleDto.prototype, "paymentMethod", void 0);
class CreateQrSaleDto extends CreateSaleDto {
}
exports.CreateQrSaleDto = CreateQrSaleDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateQrSaleDto.prototype, "total", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['MP_QR']),
    __metadata("design:type", String)
], CreateQrSaleDto.prototype, "paymentMethod", void 0);
