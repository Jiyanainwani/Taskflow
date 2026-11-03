import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { CreateTaskAttachmentDto } from './dto/create-task-attachment.dto.js';
import { TaskAttachmentsService } from './task-attachments.service.js';

@ApiTags('Task Attachments')
@ApiBearerAuth()
@Controller('tasks/:taskId/attachments')
@UseGuards(AccessTokenGuard)
export class TaskAttachmentsController {
  constructor(private readonly attachments: TaskAttachmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List attachments for a task the user can access' })
  list(@Req() request: Request, @Param('taskId') taskId: string) {
    return this.attachments.list(request.user!.id, taskId);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Create a presigned task attachment upload URL' })
  createUpload(
    @Req() request: Request,
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskAttachmentDto,
  ) {
    return this.attachments.createUpload(request.user!.id, taskId, dto);
  }

  @Post(':attachmentId/complete')
  @ApiOperation({ summary: 'Confirm an uploaded task attachment' })
  confirmUpload(
    @Req() request: Request,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachments.confirmUpload(request.user!.id, taskId, attachmentId);
  }

  @Get(':attachmentId/download')
  @ApiOperation({ summary: 'Create a short-lived attachment download URL' })
  createDownloadUrl(
    @Req() request: Request,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachments.createDownloadUrl(request.user!.id, taskId, attachmentId);
  }

  @Delete(':attachmentId')
  @ApiOperation({ summary: 'Delete a task attachment' })
  remove(
    @Req() request: Request,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachments.remove(request.user!.id, taskId, attachmentId);
  }
}
