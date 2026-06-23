import { IsArray, IsInt } from 'class-validator';

export class FicharJugadoresDto {
  @IsArray()
  @IsInt({ each: true })
  playerIds: number[];
}
