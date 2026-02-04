import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CashSessionsService } from '../cash-sessions/cash-sessions.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';

@Injectable()
export class CashMovementsService {
  constructor(
    private prisma: PrismaService,
    private cashSessionsService: CashSessionsService,
  ) {}

  private roundToCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  async listCurrent(includeVoided = false) {
    const session = await this.cashSessionsService.requireOpenSession();
    return this.prisma.cashMovement.findMany({
      where: {
        cashSessionId: session.id,
        ...(includeVoided ? {} : { isVoided: false }),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        voidedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMovement(userId: string, dto: CreateCashMovementDto) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('El motivo es obligatorio');
    }
    if (dto.amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }
    const session = await this.cashSessionsService.requireOpenSession();
    return this.prisma.cashMovement.create({
      data: {
        cashSessionId: session.id,
        type: dto.type,
        amount: this.roundToCurrency(dto.amount),
        reason: dto.reason.trim(),
        note: dto.note?.trim() || null,
        createdByUserId: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        voidedBy: { select: { id: true, name: true } },
      },
    });
  }

  async voidMovement(id: string, userId: string, voidReason: string) {
    const movement = await this.prisma.cashMovement.findUnique({ where: { id } });
    if (!movement) {
      throw new NotFoundException('Movimiento no encontrado');
    }
    if (movement.isVoided) {
      throw new ConflictException('El movimiento ya está anulado');
    }
    const trimmedReason = voidReason?.trim();
    if (!trimmedReason) {
      throw new BadRequestException('El motivo de anulación es obligatorio');
    }
    return this.prisma.cashMovement.update({
      where: { id },
      data: {
        isVoided: true,
        voidedAt: new Date(),
        voidedByUserId: userId,
        voidReason: trimmedReason,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        voidedBy: { select: { id: true, name: true } },
      },
    });
  }
}
