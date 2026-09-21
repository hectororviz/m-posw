import { IsNotEmpty, IsOptional, IsString, Max, Min, IsNumber } from 'class-validator';

export class SelectEntradasPosDto {
  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @IsString()
  @IsNotEmpty()
  posId!: string;
}

export class SetupEntradasPosDto {
  @IsString()
  @IsNotEmpty()
  storeName!: string;

  @IsString()
  @IsNotEmpty()
  posName!: string;

  @IsString()
  @IsNotEmpty()
  streetName!: string;

  @IsString()
  @IsNotEmpty()
  streetNumber!: string;

  @IsString()
  @IsNotEmpty()
  cityName!: string;

  @IsString()
  @IsNotEmpty()
  stateName!: string;

  @IsString()
  @IsNotEmpty()
  zipCode!: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
