import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenCashSessionDto {
  @IsNumber()
  @Min(0)
  openingFloat: number;

  @IsOptional()
  @IsString()
  note?: string;
}
