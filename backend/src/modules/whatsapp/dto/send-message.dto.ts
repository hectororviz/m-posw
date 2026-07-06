import { IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  phoneNumber: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  sourceModule?: string;

  @IsOptional()
  acreedorId?: number;
}
