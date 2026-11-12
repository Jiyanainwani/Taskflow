import { createGoogle } from '@ai-sdk/google';
import { cosineSimilarity, embedMany } from 'ai';

import { rerankCandidates } from '../src/ai/workspace-retrieval.js';
import { estimateTextTokens } from '../src/ai/token-estimate.js';
import { workspaceRetrievalGoldens } from '../evals/workspace-retrieval-goldens.js';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
if (!apiKey) {
  throw new Error('Set GOOGLE_GENERATIVE_AI_API_KEY to run the live Gemini retrieval eval.');
}

const modelId = process.env.AI_EMBEDDING_MODEL ?? 'gemini-embedding-001';
const embeddingRate = Number(process.env.AI_EMBEDDING_USD_PER_MILLION ?? 0.15);
const provider = createGoogle({ apiKey });
const model = provider.embeddingModel(modelId);
const timeoutMs = Number(process.env.AI_GENERATION_TIMEOUT_MS ?? 30_000);
const startedAt = performance.now();

const documentEmbeddings = await embedMany({
  model,
  values: workspaceRetrievalGoldens.map(({ text }) => text),
  maxRetries: 0,
  maxParallelCalls: 2,
  abortSignal: AbortSignal.timeout(timeoutMs),
  providerOptions: {
    google: { outputDimensionality: 768, taskType: 'RETRIEVAL_DOCUMENT' },
  },
});
const queryEmbeddings = await embedMany({
  model,
  values: workspaceRetrievalGoldens.map(({ question }) => question),
  maxRetries: 0,
  maxParallelCalls: 2,
  abortSignal: AbortSignal.timeout(timeoutMs),
  providerOptions: {
    google: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' },
  },
});

const hits = workspaceRetrievalGoldens.filter((golden, queryIndex) => {
  const candidates = workspaceRetrievalGoldens.map((candidate, documentIndex) => ({
    value: candidate.id,
    text: candidate.text,
    vectorScore: cosineSimilarity(
      queryEmbeddings.embeddings[queryIndex],
      documentEmbeddings.embeddings[documentIndex],
    ),
  }));
  return rerankCandidates(golden.question, candidates)
    .slice(0, 5)
    .some(({ value }) => value === golden.id);
}).length;

const queryCount = workspaceRetrievalGoldens.length;
const hitRate = hits / queryCount;
const requiredHitRate = Number(process.env.WORKSPACE_RETRIEVAL_MIN_HIT_RATE ?? 0.8);
const providerTokens = documentEmbeddings.usage?.tokens + queryEmbeddings.usage?.tokens;
const hasProviderTokenUsage = Number.isFinite(providerTokens);
const totalTokens = hasProviderTokenUsage
  ? providerTokens
  : estimateTextTokens([
      ...workspaceRetrievalGoldens.map(({ text }) => text),
      ...workspaceRetrievalGoldens.map(({ question }) => question),
    ]);
const estimatedCost = (totalTokens * embeddingRate) / 1_000_000;
const durationMs = Math.round(performance.now() - startedAt);

console.log(
  `Gemini workspace retrieval Hit@5: ${hits}/${queryCount} (${(hitRate * 100).toFixed(1)}%). Required: ${(requiredHitRate * 100).toFixed(0)}%.`,
);
console.log(
  `Model: ${modelId}; ${hasProviderTokenUsage ? 'provider' : 'estimated'} embedding tokens: ${totalTokens}; estimated cost: $${estimatedCost.toFixed(6)}; latency: ${durationMs} ms.`,
);

if (hitRate < requiredHitRate) process.exitCode = 1;
