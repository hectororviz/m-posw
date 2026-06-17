import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; username: string; role: string; sessionId?: string }) {
    if (!payload.sessionId) {
      throw new UnauthorizedException('Sesión inválida');
    }
    const session = await this.prisma.session.findFirst({
      where: { id: payload.sessionId, revokedAt: null },
    });
    if (!session) {
      throw new UnauthorizedException('Sesión inválida');
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
