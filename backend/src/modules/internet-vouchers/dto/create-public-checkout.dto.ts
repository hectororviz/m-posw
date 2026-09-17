import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePublicCheckoutDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  returnBaseUrl?: string;
}
