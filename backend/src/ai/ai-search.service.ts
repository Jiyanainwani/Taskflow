import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { cosineSimilarity } from 'ai';
import type { Redis } from 'ioredis';
import { Model, Types } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';

import { REDIS_CLIENT } from '../cache/redis.constants.js';
import { TaskComment, TaskCommentDocument } from '../tasks/schemas/task-comment.schema.js';
import { TasksService } from '../tasks/tasks.service.js';
import {
  AiSearchDocument,
  AiSearchDocumentDocument,
} from './schemas/ai-search-document.schema.js';
import { AiService } from './ai.service.js';
import { GeminiAiModel } from './gemini-ai-model.js';
import { chunkWorkspaceText, rerankCandidates } from './workspace-retrieval.js';

const MAX_TASKS = 100;
const MAX_COMMENTS = 100;
const MAX_SEARCH_SOURCES = MAX_TASKS + MAX_COMMENTS;
const SEARCH_CACHE_TTL_SECONDS = 10 * 60;

type SearchSource = {
  sourceKey: string;
  sourceType: 'task' | 'comment';
  taskId: Types.ObjectId;
  ownerId: Types.ObjectId;
  teamId: Types.ObjectId | null;
  text: string;
  contentHash: string;
};

type IndexedSourceChunk = Omit<SearchSource, 'sourceKey' | 'contentHash'> & {
  sourceKey: string;
  baseSourceKey: string;
  chunkIndex: number;
  contentHash: string;
};

export type RetrievedWorkspaceSource = {
  citationId: string;
  sourceType: 'task' | 'comment';
  sourceId: string;
  taskId: string;
  title: string;
  excerpt: string;
  score: number;
};

@Injectable()
export class AiSearchService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly model: GeminiAiModel,
    private readonly aiService: AiService,
    private readonly config: ConfigService,
    private readonly pinoLogger: PinoLogger,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectModel(TaskComment.name)
    private readonly commentModel: Model<TaskCommentDocument>,
    @InjectModel(AiSearchDocument.name)
    private readonly searchDocumentModel: Model<AiSearchDocumentDocument>,
  ) {}

  async search(userId: string, rawQuery: string) {
    const query = rawQuery.replace(/\s+/g, ' ').trim();
    if (!query) throw new BadRequestException('Enter a phrase to search for.');
    if (query.length > 500) throw new BadRequestException('Search must be 500 characters or fewer.');
    if (!/[\p{L}\p{N}]/u.test(query)) {
      throw new BadRequestException('Add words or numbers to search your workspace.');
    }
    if (!this.model.isConfigured()) {
      throw new ServiceUnavailableException('AI features are not configured. Please ask an administrator.');
    }

    await this.aiService.consumeQuota(userId);
    const startedAt = Date.now();
    try {
      const sources = await this.getAccessibleSources(userId);
      const chunks = this.chunkSources(sources);
      const indexed = await this.syncEmbeddings(chunks, userId);
      const snapshotHash = createHash('sha256')
        .update(sources.map((source) => `${source.sourceKey}:${source.contentHash}`).join('|'))
        .digest('hex');
      const queryHash = createHash('sha256').update(query.toLowerCase()).digest('hex');
      const cacheKey = `taskflow:ai:v2:semantic-search:${userId}:${snapshotHash}:${queryHash}`;

      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          await this.aiService.recordFeatureCacheHit(userId);
          return { ...(JSON.parse(cached) as { results: SearchResult[] }), cached: true };
        }
      } catch {
        // Search remains available if Redis caching is down.
      }

      const embeddedQuery = await this.model.embedText(query);
      const documents = await this.searchDocumentModel
        .find({ sourceKey: { $in: chunks.map((source) => source.sourceKey) } })
        .select('sourceKey baseSourceKey sourceType taskId text embedding')
        .lean()
        .exec();

      const sourceByKey = new Map(sources.map((source) => [source.sourceKey, source]));
      const chunkByKey = new Map(chunks.map((source) => [source.sourceKey, source]));
      const candidates = documents
        .map((document) => ({
          source: sourceByKey.get(document.baseSourceKey),
          chunk: chunkByKey.get(document.sourceKey),
          vectorScore: cosineSimilarity(embeddedQuery.embedding, document.embedding),
        }))
        .filter((item): item is { source: SearchSource; chunk: IndexedSourceChunk; vectorScore: number } => Boolean(item.source && item.chunk))
        .filter((item) => item.vectorScore >= 0.15);
      const reranked = rerankCandidates(query, candidates.map((item) => ({
        value: item,
        text: item.chunk.text,
        vectorScore: item.vectorScore,
      })));
      const seenSources = new Set<string>();
      const results: SearchResult[] = reranked
        .filter(({ value }) => {
          if (seenSources.has(value.source.sourceKey)) return false;
          seenSources.add(value.source.sourceKey);
          return true;
        })
        .slice(0, 10)
        .map(({ value, score }) => ({
          taskId: value.source.taskId.toString(),
          type: value.source.sourceType,
          title: this.sourceTitle(value.source),
          snippet: value.chunk.text.slice(0, 280),
          score: Number(score.toFixed(4)),
        }));

      await this.aiService.recordEmbeddingUsage(userId, embeddedQuery.tokens);
      const payload = { results, cached: false, indexedSources: sources.length };
      try {
        await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', SEARCH_CACHE_TTL_SECONDS);
      } catch {
        // A cache write must not hide relevant results.
      }
      this.pinoLogger.info(
        {
          userId,
          feature: 'semantic-search',
          inputTokens: embeddedQuery.tokens + indexed.tokens,
          estimatedCostUsd: this.embeddingCost(embeddedQuery.tokens + indexed.tokens),
          indexedSources: indexed.count,
          resultCount: results.length,
          durationMs: Date.now() - startedAt,
        },
        'AI semantic search completed',
      );
      return payload;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      this.pinoLogger.error(
        {
          userId,
          feature: 'semantic-search',
          errorName: error instanceof Error ? error.name : 'UnknownError',
          durationMs: Date.now() - startedAt,
        },
        'AI semantic search failed',
      );
      throw new ServiceUnavailableException('Workspace search is temporarily unavailable. Please try again.');
    }
  }

  async retrieveForAnswer(
    userId: string,
    rawQuery: string,
    limit = 6,
  ): Promise<RetrievedWorkspaceSource[]> {
    const query = rawQuery.replace(/\s+/g, ' ').trim();
    if (!query || query.length > 2000 || !/[\p{L}\p{N}]/u.test(query)) {
      throw new BadRequestException('Enter a workspace question of 500 characters or fewer.');
    }
    if (!this.model.isConfigured()) {
      throw new ServiceUnavailableException('AI features are not configured. Please ask an administrator.');
    }

    const sources = await this.getAccessibleSources(userId);
    if (sources.length === 0) return [];
    const chunks = this.chunkSources(sources);

    await this.syncEmbeddings(chunks, userId);
    const embeddedQuery = await this.model.embedText(query);
    await this.aiService.recordEmbeddingUsage(userId, embeddedQuery.tokens);

    const documents = await this.searchDocumentModel
      .find({ sourceKey: { $in: chunks.map((source) => source.sourceKey) } })
      .select('sourceKey baseSourceKey text embedding')
      .lean()
      .exec();
    const sourceByKey = new Map(sources.map((source) => [source.sourceKey, source]));
    const chunkByKey = new Map(chunks.map((source) => [source.sourceKey, source]));
    const candidates = documents
      .map((document) => ({
        source: sourceByKey.get(document.baseSourceKey),
        chunk: chunkByKey.get(document.sourceKey),
        vectorScore: cosineSimilarity(embeddedQuery.embedding, document.embedding),
      }))
      .filter((item): item is { source: SearchSource; chunk: IndexedSourceChunk; vectorScore: number } => Boolean(item.source && item.chunk))
      .filter((item) => item.vectorScore >= 0.15);
    const reranked = rerankCandidates(query, candidates.map((item) => ({
      value: item,
      text: item.chunk.text,
      vectorScore: item.vectorScore,
    })));
    const seenSources = new Set<string>();
    return reranked
      .filter(({ value }) => {
        if (seenSources.has(value.source.sourceKey)) return false;
        seenSources.add(value.source.sourceKey);
        return true;
      })
      .slice(0, Math.max(1, Math.min(limit, 8)))
      .map(({ value, score }, index) => ({
        citationId: `S${index + 1}`,
        sourceType: value.source.sourceType,
        sourceId: value.source.sourceKey.slice(value.source.sourceKey.indexOf(':') + 1),
        taskId: value.source.taskId.toString(),
        title: this.sourceTitle(value.source),
        excerpt: value.chunk.text.slice(0, 1200),
        score: Number(score.toFixed(4)),
      }));
  }

  private async getAccessibleSources(userId: string): Promise<SearchSource[]> {
    const tasks = [];
    let cursor: string | undefined;
    while (tasks.length < MAX_TASKS) {
      const page = await this.tasksService.findAll(userId, {
        limit: Math.min(100, MAX_TASKS - tasks.length),
        ...(cursor ? { cursor } : {}),
      });
      tasks.push(...page.data);
      if (!page.hasNextPage || !page.nextCursor) break;
      cursor = page.nextCursor;
    }

    const sources: SearchSource[] = tasks.map((task) => {
      const text = [
        `Task: ${task.title}`,
        `Description: ${task.description || '(none)'}`,
        `Status: ${task.status}; priority: ${task.priority}; due: ${task.dueDate?.toISOString() ?? 'not set'}`,
      ].join('\n').slice(0, 4000);
      return this.toSource(
        `task:${task._id.toString()}`,
        'task',
        task._id,
        task.owner,
        task.teamId,
        text,
      );
    });

    if (tasks.length === 0) return sources;
    const taskIds = tasks.map((task) => task._id);
    const comments = await this.commentModel
      .find({ taskId: { $in: taskIds } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_COMMENTS)
      .select('_id taskId body')
      .lean()
      .exec();
    const taskById = new Map(tasks.map((task) => [task._id.toString(), task]));
    for (const comment of comments) {
      const task = taskById.get(comment.taskId.toString());
      if (!task) continue;
      const text = `Comment on task: ${task.title}\n${comment.body}`.slice(0, 4000);
      sources.push(this.toSource(
        `comment:${comment._id.toString()}`,
        'comment',
        task._id,
        task.owner,
        task.teamId,
        text,
      ));
    }
    return sources.slice(0, MAX_SEARCH_SOURCES);
  }

  private toSource(
    sourceKey: string,
    sourceType: 'task' | 'comment',
    taskId: Types.ObjectId,
    ownerId: Types.ObjectId,
    teamId: Types.ObjectId | null,
    text: string,
  ): SearchSource {
    return {
      sourceKey,
      sourceType,
      taskId,
      ownerId,
      teamId,
      text,
      contentHash: createHash('sha256')
        .update(`${this.config.get<string>('AI_EMBEDDING_MODEL') ?? 'gemini-embedding-001'}:${text}`)
        .digest('hex'),
    };
  }

  private chunkSources(sources: SearchSource[]): IndexedSourceChunk[] {
    const modelId = this.config.get<string>('AI_EMBEDDING_MODEL') ?? 'gemini-embedding-001';
    return sources.flatMap((source) => chunkWorkspaceText(source.text).map((text, chunkIndex) => ({
      ...source,
      sourceKey: `${source.sourceKey}#${chunkIndex}`,
      baseSourceKey: source.sourceKey,
      chunkIndex,
      text,
      contentHash: createHash('sha256').update(`${modelId}:${text}`).digest('hex'),
    })));
  }

  private sourceTitle(source: SearchSource) {
    const title = source.text.split('\n')[0];
    return source.sourceType === 'task'
      ? title.replace(/^Task: /, '')
      : `Comment on ${title.replace(/^Comment on task: /, '')}`;
  }

  private async syncEmbeddings(sources: IndexedSourceChunk[], userId: string) {
    if (sources.length === 0) return { count: 0, tokens: 0 };
    const records = await this.searchDocumentModel
      .find({ sourceKey: { $in: sources.map((source) => source.sourceKey) } })
      .select('sourceKey contentHash')
      .lean()
      .exec();
    const hashes = new Map(records.map((record) => [record.sourceKey, record.contentHash]));
    const changed = sources.filter((source) => hashes.get(source.sourceKey) !== source.contentHash);
    const activeSourceKeys = sources.map((source) => source.sourceKey);
    await this.searchDocumentModel.deleteMany({
      baseSourceKey: { $in: [...new Set(sources.map((source) => source.baseSourceKey))] },
      sourceKey: { $nin: activeSourceKeys },
    });
    if (changed.length === 0) return { count: 0, tokens: 0 };

    const result = await this.model.embedDocuments(changed.map((source) => source.text));
    await this.aiService.recordEmbeddingUsage(userId, result.tokens);
    await this.searchDocumentModel.bulkWrite(
      changed.map((source, index) => ({
        updateOne: {
          filter: { sourceKey: source.sourceKey },
          update: {
            $set: {
              ...source,
              embedding: result.embeddings[index],
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return { count: changed.length, tokens: result.tokens };
  }

  private embeddingCost(tokens: number) {
    return (tokens * (this.config.get<number>('AI_EMBEDDING_USD_PER_MILLION') ?? 0.15)) / 1_000_000;
  }
}

type SearchResult = {
  taskId: string;
  type: 'task' | 'comment';
  title: string;
  snippet: string;
  score: number;
};
