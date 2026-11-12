import { IsBoolean, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceAssistantDto {
  @ApiProperty({ maxLength: 500, example: 'Create a high-priority task to prepare the release notes.' })
  @IsString()
  question: string;
}

export class ConfirmWorkspaceActionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  approvalId: string;

  @ApiProperty({ description: 'Approve or reject the proposed task change.' })
  @IsBoolean()
  approved: boolean;
}
