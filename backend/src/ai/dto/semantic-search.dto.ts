import { IsString, MaxLength, MinLength } from 'class-validator';

export class SemanticSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  query: string;
}
