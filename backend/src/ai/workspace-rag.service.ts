import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AiSearchService } from './ai-search.service.js';
import { AiService } from './ai.service.js';
import { AskWorkspaceDto } from './dto/ask-workspace.dto.js';
import { GeminiAiModel } from './gemini-ai-model.js';

const NO_EVIDENCE_ANSWER =
  'I couldn’t find enough information in the tasks or comments you can access to answer that.';

@Injectable()
export class WorkspaceRagService {
  constructor(
    private readonly searchService: AiSearchService,
    private readonly aiService: AiService,
    private readonly model: GeminiAiModel,
    private readonly pinoLogger: PinoLogger,
  ) {}

  async ask(userId: string, dto: AskWorkspaceDto) {
    const question = dto.question.replace(/\s+/g, ' ').trim();
    if (!question || question.length > 500 || !/[\p{L}\p{N}]/u.test(question)) {
      throw new BadRequestException('Enter a workspace question of 500 characters or fewer.');
    }
    if (!this.model.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI features are not configured. Please ask an administrator.',
      );
    }

    await this.aiService.consumeQuota(userId);
    const startedAt = Date.now();
    try {
      const previousQuestions = (dto.previousQuestions ?? [])
        .slice(-3)
        .map((item) => item.replace(/\s+/g, ' ').trim().slice(0, 500))
        .filter(Boolean);
      const retrievalQuestion = [...previousQuestions, question].join('\n');
      const sources = await this.searchService.retrieveForAnswer(userId, retrievalQuestion);
      if (sources.length === 0) {
        return { answer: NO_EVIDENCE_ANSWER, citations: [] };
      }

      const result = await this.model.answerWorkspace(
        question,
        previousQuestions,
        sources.map(({ citationId, sourceType, title, excerpt }) => ({
          citationId,
          sourceType,
          title,
          excerpt,
        })),
      );
      const allowedSources = new Map(sources.map((source) => [source.citationId, source]));
      const citationIds = [...new Set(result.output.citationIds)]
        .filter((citationId) => allowedSources.has(citationId));
      const citations = citationIds.flatMap((citationId) => {
        const source = allowedSources.get(citationId);
        if (!source) return [];
        return [{
          id: citationId,
          type: source.sourceType,
          sourceId: source.sourceId,
          taskId: source.taskId,
          title: source.title,
          excerpt: source.excerpt,
          href: source.sourceType === 'comment'
            ? `/dashboard/tasks/${source.taskId}#comment-${source.sourceId}`
            : `/dashboard/tasks/${source.taskId}`,
        }];
      });
      const answer = citations.length > 0
        ? result.output.answer
        : NO_EVIDENCE_ANSWER;

      const estimatedCostUsd = await this.aiService.recordTextGenerationUsage(
        userId,
        result.inputTokens,
        result.outputTokens,
      );
      this.pinoLogger.info(
        {
          userId,
          feature: 'workspace-rag',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostUsd,
          retrievedSources: sources.length,
          citationCount: citations.length,
          durationMs: Date.now() - startedAt,
        },
        'AI workspace answer completed',
      );

      return { answer, citations };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.pinoLogger.error(
        {
          userId,
          feature: 'workspace-rag',
          errorName: error instanceof Error ? error.name : 'UnknownError',
          durationMs: Date.now() - startedAt,
        },
        'AI workspace answer failed',
      );
      throw new ServiceUnavailableException(
        'Workspace answers are temporarily unavailable. Please try again.',
      );
    }
  }
}
