import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';

describe('AuthService', () => {
  it('bloquea login si existe una sesión activa', async () => {
    const prisma = {
      session: {
        findFirst: jest.fn().mockResolvedValue({ id: 'session-1', createdAt: new Date() }),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;

    const jwtService = {
      signAsync: jest.fn(),
    } as unknown as JwtService;

    const service = new AuthService(prisma, jwtService);
    jest.spyOn(service, 'validateUser').mockResolvedValue({
      id: 'user-1',
      name: 'Caja01',
      email: null,
      role: 'USER',
    } as any);

    await expect(service.login('Caja01', 'password')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });
});
