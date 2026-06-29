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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const prisma_service_1 = require("../common/prisma.service");
const user_permissions_service_1 = require("../users/user-permissions.service");
let AuthService = class AuthService {
    constructor(prisma, jwtService, userPermissionsService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.userPermissionsService = userPermissionsService;
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
        if (!user || !user.active) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        const valid = await bcrypt.compare(dto.password, user.password);
        if (!valid) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        const session = await this.prisma.$transaction(async (tx) => {
            await tx.session.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            return tx.session.create({
                data: { userId: user.id },
            });
        });
        const payload = { sub: user.id, role: user.role, username: user.username, sessionId: session.id };
        const permissions = user.role === 'ADMIN'
            ? []
            : await this.userPermissionsService.getPermissions(user.id);
        return {
            accessToken: await this.jwtService.signAsync(payload),
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            homeModule: user.homeModule ?? null,
            homeSmartphoneModule: user.homeSmartphoneModule ?? null,
            permissions,
        };
    }
    async logout(sessionId) {
        await this.prisma.session.updateMany({
            where: { id: sessionId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        user_permissions_service_1.UserPermissionsService])
], AuthService);
