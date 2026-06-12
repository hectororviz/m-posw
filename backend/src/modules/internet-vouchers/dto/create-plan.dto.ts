import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  duration: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  idleTimeout?: number;

  @IsOptional()
  @IsString()
  downloadBandwidth?: string;

  @IsOptional()
  @IsString()
  uploadBandwidth?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsInt()
  position?: number;
}
