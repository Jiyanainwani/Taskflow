import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { AiService } from './ai.service.js';
import { MagicAddDto } from './dto/magic-add.dto.js';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(AccessTokenGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

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
}
