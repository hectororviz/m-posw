import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { name: username } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    const existingSession = await this.prisma.session.findFirst({
      where: { userId: user.id, revokedAt: null },
    });
    if (existingSession) {
      const sessionAgeMs = Date.now() - existingSession.createdAt.getTime();
      const maxSessionMs = 12 * 60 * 60 * 1000;
      if (sessionAgeMs < maxSessionMs) {
        throw new ConflictException('Cuenta en uso');
      }
      await this.prisma.session.update({
        where: { id: existingSession.id },
        data: { revokedAt: new Date() },
      });
    }
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
      },
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

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
