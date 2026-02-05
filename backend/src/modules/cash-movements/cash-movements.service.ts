import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';

@Injectable()
export class CashMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateCashMovementDto) {
    return this.prisma.cashMovement.create({
      data: {
        createdByUserId: userId,
        type: dto.type,
        amount: Math.round(dto.amount * 100) / 100,
        reason: dto.reason,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  list(limit = 50, offset = 0) {
    return this.prisma.cashMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      skip: Math.max(offset, 0),
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }
}
