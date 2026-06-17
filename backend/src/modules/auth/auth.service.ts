import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import { UserPermissionsService } from '../users/user-permissions.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private userPermissionsService: UserPermissionsService,
  ) {}

  async login(dto: { username: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
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
      permissions,
    };
  }

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
