import { IsDateString, IsOptional, IsString } from 'class-validator';

export class DateRangeDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class LedgerAccountQueryDto extends DateRangeDto {
  @IsString()
  @IsOptional()
  accountId?: string;
}
