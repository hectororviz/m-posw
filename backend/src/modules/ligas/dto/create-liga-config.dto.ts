import { IsString, IsUUID } from 'class-validator';

export class CreateLigaConfigDto {
  @IsString()
  leagueId: string;

  @IsString()
  leagueName: string;

  @IsString()
  teamId: string;

  @IsString()
  teamName: string;
}
