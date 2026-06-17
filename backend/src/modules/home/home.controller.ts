import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { HomeService } from './home.service';

@Controller('home')
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('metrics')
  getMetrics(@Req() req: { user: { id: string; role: string } }) {
    return this.homeService.getMetrics(req.user.id, req.user.role);
  }
}
