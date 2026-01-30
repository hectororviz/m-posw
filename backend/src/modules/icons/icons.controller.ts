import { Controller, Get, Query } from '@nestjs/common';
import { IconsService } from './icons.service';

@Controller('icons')
export class IconsController {
  constructor(private readonly iconsService: IconsService) {}

  @Get('material-symbols')
  findMaterialSymbols(
    @Query('q') query?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.iconsService.searchMaterialSymbols({
      query: query ?? '',
      offset: offset ? Number(offset) : 0,
      limit: limit ? Number(limit) : 200,
    });
  }
}
