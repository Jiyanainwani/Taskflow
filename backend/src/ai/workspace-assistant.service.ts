import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../cache/redis.constants.js';
import { TasksService } from '../tasks/tasks.service.js';
import { AiService } from './ai.service.js';
import { ConfirmWorkspaceActionDto, WorkspaceAssistantDto } from './dto/workspace-assistant.dto.js';
import { GeminiAiModel } from './gemini-ai-model.js';
import {
  CreateAssistantTaskSchema,
  UpdateAssistantTaskSchema,
  type WorkspaceAssistantAction,
} from './schemas/workspace-assistant.schema.js';

const APPROVAL_TTL_SECONDS = 10 * 60;
const TAKE_APPROVAL_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if value then redis.call('DEL', KEYS[1]) end
return value
`;

@Injectable()
export class WorkspaceAssistantService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly aiService: AiService,
    private readonly model: GeminiAiModel,
    private readonly pinoLogger: PinoLogger,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async ask(userId: string, dto: WorkspaceAssistantDto) {
    const question = dto.question.replace(/\s+/g, ' ').trim();
    if (!question || question.length > 500 || !/[\p{L}\p{N}]/u.test(question)) {
      throw new BadRequestException('Enter an assistant request of 500 characters or fewer.');
    }
    if (!this.model.isConfigured()) {
      throw new ServiceUnavailableException('AI features are not configured. Please ask an administrator.');
    }

    await this.aiService.consumeQuota(userId);
    const startedAt = Date.now();
    try {
      const result = await this.model.runWorkspaceAssistant(
        question,
        async ({ query, status, priority, limit }) => {
          const page = await this.tasksService.findAll(userId, { limit, status, priority });
          const needle = query?.trim().toLocaleLowerCase();
          return page.data
            .filter((task) => !needle || `${task.title}\n${task.description}`.toLocaleLowerCase().includes(needle))
            .slice(0, limit)
            .map((task) => ({
              id: task._id.toString(),
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate?.toISOString() ?? null,
            }));
        },
      );

      const estimatedCostUsd = await this.aiService.recordTextGenerationUsage(
        userId,
        result.inputTokens,
        result.outputTokens,
      );
      const pendingAction = result.action
        ? await this.createPendingAction(userId, result.action)
        : null;
      this.pinoLogger.info(
        {
          userId,
          feature: 'workspace-assistant',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostUsd,
          actionProposed: Boolean(pendingAction),
          durationMs: Date.now() - startedAt,
        },
        'AI workspace assistant completed',
      );
      return {
        answer: result.answer || (pendingAction
          ? 'Review the proposed task change below. Nothing has been saved yet.'
          : 'I could not complete that request. Please try rephrasing it.'),
        pendingAction,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      this.pinoLogger.error(
        {
          userId,
          feature: 'workspace-assistant',
          errorName: error instanceof Error ? error.name : 'UnknownError',
          durationMs: Date.now() - startedAt,
        },
        'AI workspace assistant failed',
      );
      throw new ServiceUnavailableException('The workspace assistant is temporarily unavailable. Please try again.');
    }
  }

  async confirm(userId: string, dto: ConfirmWorkspaceActionDto) {
    const key = this.approvalKey(userId, dto.approvalId);
    const raw = await this.redis.eval(TAKE_APPROVAL_SCRIPT, 1, key);
    if (typeof raw !== 'string') {
      throw new NotFoundException('This task proposal expired or has already been handled.');
    }
    if (!dto.approved) return { approved: false, message: 'The proposed change was discarded.' };

    let action: WorkspaceAssistantAction;
    try {
      action = JSON.parse(raw) as WorkspaceAssistantAction;
      if (action.type === 'create_task') {
        action = { type: 'create_task', input: CreateAssistantTaskSchema.parse(action.input) };
      } else if (action.type === 'update_task') {
        action = { type: 'update_task', input: UpdateAssistantTaskSchema.parse(action.input) };
      } else {
        throw new Error('Unknown assistant action');
      }
    } catch {
      throw new ConflictException('This task proposal is invalid. Ask the assistant to prepare it again.');
    }

    const task = action.type === 'create_task'
      ? await this.tasksService.create(userId, action.input)
      : await this.tasksService.update(userId, action.input.taskId, action.input);
    return {
      approved: true,
      message: action.type === 'create_task' ? 'Task created.' : 'Task updated.',
      task: {
        id: task._id.toString(),
        title: task.title,
        status: task.status,
        priority: task.priority,
      },
    };
  }

  private async createPendingAction(userId: string, action: WorkspaceAssistantAction) {
    const approvalId = randomUUID();
    const stored = await this.redis.set(
      this.approvalKey(userId, approvalId),
      JSON.stringify(action),
      'EX',
      APPROVAL_TTL_SECONDS,
      'NX',
    );
    if (stored !== 'OK') throw new ServiceUnavailableException('Could not save the task proposal. Please try again.');
    return { approvalId, action, expiresInSeconds: APPROVAL_TTL_SECONDS };
  }

  private approvalKey(userId: string, approvalId: string) {
    return `taskflow:ai:v1:assistant-approval:${userId}:${approvalId}`;
  }
}
