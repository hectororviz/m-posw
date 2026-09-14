import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('FATAL: JWT_SECRET no configurado o demasiado corto (mínimo 32 caracteres)');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; username: string; role: string; sessionId?: string }) {
    if (!payload.sessionId) {
      throw new UnauthorizedException('Sesión inválida');
    }
    const session = await this.prisma.session.findFirst({
      where: { id: payload.sessionId, revokedAt: null },
      include: { user: { select: { id: true, active: true } } },
    });
    if (!session) {
      throw new UnauthorizedException('Sesión inválida');
    }
    if (!session.user?.active) {
      throw new UnauthorizedException('Usuario desactivado');
    }
    return {
      id: payload.sub,
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      sessionId: payload.sessionId,
    };
  }
}
