import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async validateUser(identifier: { email?: string; name?: string }, credential: string) {
    if (!identifier.email && !identifier.name) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const user = identifier.email
      ? await this.prisma.user.findUnique({ where: { email: identifier.email } })
      : await this.prisma.user.findUnique({ where: { name: identifier.name! } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(credential, user.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  async login(dto: { email?: string; name?: string; password?: string; pin?: string }) {
    const credential = dto.pin ?? dto.password;
    if (!credential) {
      throw new UnauthorizedException('Credenciales inválidas');
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

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
