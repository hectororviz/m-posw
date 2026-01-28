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

    const result = await service.login('Caja01', 'password');

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.session.create).toHaveBeenCalled();
    expect(result).toEqual({ accessToken: undefined, user: { id: 'user-1', name: 'Caja01', email: null, role: 'USER' } });
  });
});
