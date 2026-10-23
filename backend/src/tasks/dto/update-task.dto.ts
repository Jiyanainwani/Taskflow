import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto.js';

export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['teamId'] as const),
) {}
