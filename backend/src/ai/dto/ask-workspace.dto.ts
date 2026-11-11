import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AskWorkspaceDto {
  @ApiProperty({
    example: 'What is blocked waiting for QA?',
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question: string;

  @ApiPropertyOptional({
    description: 'Up to three recent user questions to support short follow-ups.',
    maxItems: 3,
    items: { type: 'string', maxLength: 500 },
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  previousQuestions?: string[];
}
