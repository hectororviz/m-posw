import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SociosQrService } from './socios-qr.service';

@Controller('socios/qr')
export class SociosQrController {
  constructor(private readonly sociosQrService: SociosQrService) {}

  @Get(':uuid')
  async resolve(@Param('uuid') uuid: string, @Res() res: Response) {
    const data = await this.sociosQrService.resolve(uuid);
    if (!data) {
      return res.status(404).json({ error: 'Socio no encontrado' });
    }
    return res.json(data);
  }
}
