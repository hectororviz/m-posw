import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsUrl()
  imageUrl: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
