import { describe, expect, it } from 'vitest';

import { workspaceRetrievalGoldens } from '../../evals/workspace-retrieval-goldens.js';
import { evaluateWorkspaceRetrieval, WORKSPACE_RETRIEVAL_HIT_AT_5_THRESHOLD } from './workspace-retrieval-eval.js';
import { chunkWorkspaceText, rerankCandidates } from './workspace-retrieval.js';

describe('workspace retrieval eval', () => {
  it('keeps a 20-question golden-set Hit@5 of at least 0.80', () => {
    const result = evaluateWorkspaceRetrieval(workspaceRetrievalGoldens);

    expect(result.queries).toBeGreaterThanOrEqual(20);
    expect(result.hitRate).toBeGreaterThanOrEqual(WORKSPACE_RETRIEVAL_HIT_AT_5_THRESHOLD);
  });

  it('splits long task and comment text into overlapping chunks with the source heading retained', () => {
    const text = `Task: Long-running work\n${'The migration must preserve access checks and audit history. '.repeat(40)}`;
    const chunks = chunkWorkspaceText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.startsWith('Task: Long-running work\n'))).toBe(true);
    const headingLength = 'Task: Long-running work\n'.length;
    expect(chunks[0].slice(-80)).toContain(chunks[1].slice(headingLength, headingLength + 40));
  });

  it('uses lexical evidence to move a lower-cosine exact match ahead of an unrelated candidate', () => {
    const ranked = rerankCandidates('refresh token cookie', [
      { value: 'unrelated', text: 'S3 private attachment storage', vectorScore: 0.7 },
      { value: 'relevant', text: 'The refresh token cookie was missing after login.', vectorScore: 0.52 },
    ]);

    expect(ranked[0].value).toBe('relevant');
  });
});
