import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { PaymentsService } from './payments.service';
import { PollTransferDto, ConfirmTransferWithItemsDto } from './dto/transfer.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('poll-transfer')
  @RequireModule(ModuleKey.POS, ModuleAccess.FULL)
  async pollTransfer(
    @Req() req: { user: { sub: string } },
    @Body() dto: PollTransferDto,
  ) {
    return this.paymentsService.pollTransfer(dto.monto_esperado, req.user.sub);
  }

  @Post('confirm-transfer')
  @RequireModule(ModuleKey.POS, ModuleAccess.FULL)
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
      { discountTotal: dto.discountTotal, socioId: dto.socioId, canjes: dto.canjes },
    );
  }
}
