import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateStaffVoucherDto {
  @IsString()
  @MaxLength(80)
  label: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  notes?: string;

  @IsInt()
  @IsPositive()
  duration: number;

  @IsString()
  @IsOptional()
  downloadBandwidth?: string;

  @IsString()
  @IsOptional()
  uploadBandwidth?: string;
}
