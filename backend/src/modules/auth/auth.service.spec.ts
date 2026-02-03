import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';

describe('AuthService', () => {
  it('revoca la sesión activa anterior y permite re-login', async () => {
    const prisma = {
      $transaction: jest.fn(),
      session: {
        updateMany: jest.fn(),
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

    prisma.$transaction.mockImplementation(async (callback: (tx: PrismaService) => Promise<unknown>) =>
      callback(prisma),
    );
    prisma.session.create.mockResolvedValue({ id: 'session-2' });

    const result = await service.login({ name: 'Caja01', pin: 'password' });

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.session.create).toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: undefined,
      user: { id: 'user-1', name: 'Caja01', email: null, role: 'USER' },
    });
  });

  it('prioriza el pin cuando se envía junto al password', async () => {
    const prisma = {
      $transaction: jest.fn(),
      session: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    } as unknown as PrismaService;

    const jwtService = {
      signAsync: jest.fn(),
    } as unknown as JwtService;

    const service = new AuthService(prisma, jwtService);
    jest.spyOn(service, 'validateUser').mockResolvedValue({
      id: 'user-2',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'ADMIN',
    } as any);

    prisma.$transaction.mockImplementation(async (callback: (tx: PrismaService) => Promise<unknown>) =>
      callback(prisma),
    );
    prisma.session.create.mockResolvedValue({ id: 'session-3' });

    await service.login({ email: 'admin@example.com', password: 'ignored', pin: '654321' });

    expect(service.validateUser).toHaveBeenCalledWith(
      { email: 'admin@example.com', name: undefined },
      '654321',
    );
  });
});
