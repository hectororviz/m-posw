import { CanActivate, ConflictException, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class RequireCashOpenGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const openSession = await this.prisma.cashSession.findFirst({
      where: { closedAt: null },
      select: { id: true },
    });
    if (!openSession) {
      throw new ConflictException('Caja cerrada');
    }
    return true;
  }
}
