import { IsNotEmpty, IsString } from 'class-validator';

export class SelectStoreDto {
  @IsString()
  @IsNotEmpty()
  storeId: string;

  @IsString()
  @IsNotEmpty()
  posId: string;
}
