import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { PollTransferDto, ConfirmTransferWithItemsDto } from './dto/transfer.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('poll-transfer')
  async pollTransfer(
    @Req() req: { user: { sub: string } },
    @Body() dto: PollTransferDto,
  ) {
    return this.paymentsService.pollTransfer(dto.monto_esperado, req.user.sub);
  }

  @Post('confirm-transfer')
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
