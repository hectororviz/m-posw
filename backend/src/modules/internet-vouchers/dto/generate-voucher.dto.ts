import { IsString } from 'class-validator';

export class GenerateVoucherDto {
  @IsString()
  planId: string;

  @IsString()
  saleId: string;
}
