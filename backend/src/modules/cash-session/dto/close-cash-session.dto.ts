import { IsOptional, IsString } from 'class-validator';

export class CloseCashSessionDto {
  @IsOptional()
  @IsString()
  note?: string;
}
