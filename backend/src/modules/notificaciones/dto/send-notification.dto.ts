import { IsString, IsOptional, IsArray } from 'class-validator';

export class SendNotificationDto {
  @IsString()
  phoneNumber: string;

  @IsString()
  recipientName: string;

  @IsString()
  @IsOptional()
  templateName?: string;

  @IsOptional()
  templateParams?: Record<string, string>;

  @IsString()
  @IsOptional()
  text?: string;
}

export class NotificarDeudaDto {
  @IsArray()
  acreedorIds: number[];
}
