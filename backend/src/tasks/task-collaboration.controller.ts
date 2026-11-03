import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto.js';
import { TaskCollaborationService } from './task-collaboration.service.js';

@ApiTags('Task Collaboration')
@ApiBearerAuth()
@Controller('tasks/:taskId')
@UseGuards(AccessTokenGuard)
export class TaskCollaborationController {
  constructor(private readonly collaborationService: TaskCollaborationService) {}

  @Get('comments')
  @ApiOperation({ summary: 'List comments for a task the user can access' })
  @ApiResponse({ status: 200, description: 'Task comments retrieved' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  listComments(@Req() request: Request, @Param('taskId') taskId: string) {
    return this.collaborationService.listComments(request.user!.id, taskId);
  }

  @Post('comments')
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiResponse({ status: 201, description: 'Comment created' })
  @ApiResponse({ status: 403, description: 'User cannot comment on this task' })
  addComment(
    @Req() request: Request,
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskCommentDto,
  ) {
    return this.collaborationService.createComment(request.user!.id, taskId, dto);
  }

  @Get('activity')
  @ApiOperation({ summary: 'List recent activity for a task the user can access' })
  @ApiResponse({ status: 200, description: 'Task activity retrieved' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  listActivity(@Req() request: Request, @Param('taskId') taskId: string) {
    return this.collaborationService.listActivity(request.user!.id, taskId);
  }
}
