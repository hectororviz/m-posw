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
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async validateUser(identifier, credential) {
        if (!identifier.email && !identifier.name) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        const user = identifier.email
            ? await this.prisma.user.findUnique({ where: { email: identifier.email } })
            : await this.prisma.user.findUnique({ where: { name: identifier.name } });
        if (!user || !user.active) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        const valid = await bcrypt.compare(credential, user.password);
        if (!valid) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        return user;
    }
    async login(dto) {
        const credential = dto.pin ?? dto.password;
        if (!credential) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        const user = await this.validateUser({ email: dto.email, name: dto.name }, credential);
        const session = await this.prisma.$transaction(async (tx) => {
            await tx.session.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            return tx.session.create({
                data: {
                    userId: user.id,
                },
            });
        });
        const payload = { sub: user.id, role: user.role, name: user.name, sessionId: session.id };
        return {
            accessToken: await this.jwtService.signAsync(payload),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
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
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, jwt_1.JwtService])
], AuthService);
