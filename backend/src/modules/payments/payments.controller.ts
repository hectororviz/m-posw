import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PaymentsService } from './payments.service';
import { PollTransferDto, ConfirmTransferDto } from './dto/transfer.dto';

interface ConfirmTransferWithItemsDto extends ConfirmTransferDto {
  items: { productId: string; quantity: number }[];
}

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('poll-transfer')
  @Roles(Role.ADMIN, Role.USER)
  async pollTransfer(
    @Req() req: { user: { sub: string } },
    @Body() dto: PollTransferDto,
  ) {
    return this.paymentsService.pollTransfer(dto.monto_esperado, req.user.sub);
  }

  @Post('confirm-transfer')
  @Roles(Role.ADMIN, Role.USER)
  async confirmTransfer(
    @Req() req: { user: { sub: string } },
    @Body() dto: ConfirmTransferWithItemsDto,
  ) {
    return this.paymentsService.confirmTransfer(
      dto.payment_id,
      dto.monto_recibido,
      dto.monto_esperado,
      req.user.sub,
      dto.items,
    );
  }
}
