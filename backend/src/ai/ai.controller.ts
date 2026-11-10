import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  Param,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { AiService } from './ai.service.js';
import { MagicAddDto } from './dto/magic-add.dto.js';
import { TasksService } from '../tasks/tasks.service.js';
import { AiSearchService } from './ai-search.service.js';
import { SemanticSearchDto } from './dto/semantic-search.dto.js';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(AccessTokenGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly tasksService: TasksService,
    private readonly aiSearchService: AiSearchService,
  ) {}

  @Post('magic-add')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Extract task drafts from meeting notes without saving them',
  })
  @ApiResponse({ status: 200, description: 'Validated task drafts generated' })
  @ApiResponse({ status: 400, description: 'Notes are empty or too long' })
  @ApiResponse({ status: 429, description: 'Daily AI request limit reached' })
  async magicAdd(@Req() request: Request, @Body() dto: MagicAddDto) {
    return this.aiService.generateMagicTasks(request.user!.id, dto);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get the current user’s daily AI usage' })
  usage(@Req() request: Request) {
    return this.aiService.getUsage(request.user!.id);
  }

  @Post('digest')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stream a daily digest of tasks the user can access' })
  @ApiResponse({ status: 200, description: 'Daily digest streamed as server-sent events' })
  @ApiResponse({ status: 429, description: 'Daily AI request limit reached' })
  async dailyDigest(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const page = await this.tasksService.findAll(request.user!.id, { limit: 100 });
    const tasks = page.data.map((task) => ({
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      updatedAt: task.updatedAt.toISOString(),
    }));
    await this.aiService.streamDailyDigest(request.user!.id, tasks, response);
  }

  @Post('tasks/:taskId/summary')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stream a summary for one task the user can access' })
  @ApiResponse({ status: 200, description: 'Task summary streamed as server-sent events' })
  @ApiResponse({ status: 404, description: 'Task not found or not accessible' })
  async taskSummary(
    @Req() request: Request,
    @Param('taskId') taskId: string,
    @Res() response: Response,
  ) {
    const task = await this.tasksService.findOne(request.user!.id, taskId);
    await this.aiService.streamTaskSummary(request.user!.id, {
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      updatedAt: task.updatedAt.toISOString(),
    }, response);
  }

  @Post('search')
  @HttpCode(200)
  @ApiOperation({ summary: 'Search accessible tasks and comments by meaning' })
  @ApiResponse({ status: 200, description: 'Semantically ranked workspace results' })
  @ApiResponse({ status: 400, description: 'Search query is invalid' })
  @ApiResponse({ status: 429, description: 'Daily AI request limit reached' })
  search(@Req() request: Request, @Body() dto: SemanticSearchDto) {
    return this.aiSearchService.search(request.user!.id, dto.query);
  }
}
