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
var SalesGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
let SalesGateway = SalesGateway_1 = class SalesGateway {
    constructor() {
        this.logger = new common_1.Logger(SalesGateway_1.name);
    }
    handleJoin(client, payload) {
        const saleId = payload?.saleId?.trim();
        if (!saleId) {
            return { ok: false, error: 'saleId requerido' };
        }
        const room = this.getSaleRoom(saleId);
        client.join(room);
        this.logger.debug(`Socket ${client.id} joined ${room}`);
        return { ok: true, room };
    }
    notifyPaymentStatusChanged(payload) {
        const room = this.getSaleRoom(payload.saleId);
        this.server.to(room).emit('sale.payment_status_changed', payload);
    }
    getSaleRoom(saleId) {
        return `sale:${saleId}`;
    }
};
exports.SalesGateway = SalesGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], SalesGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('sale.join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], SalesGateway.prototype, "handleJoin", null);
exports.SalesGateway = SalesGateway = SalesGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    })
], SalesGateway);
