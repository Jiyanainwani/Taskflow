import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export const MAX_TASK_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const TASK_ATTACHMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class CreateTaskAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  filename: string;

  @IsIn(TASK_ATTACHMENT_TYPES)
  contentType: (typeof TASK_ATTACHMENT_TYPES)[number];

  @IsInt()
  @Min(1)
  @Max(MAX_TASK_ATTACHMENT_SIZE)
  size: number;
}
