import { rerankCandidates } from './workspace-retrieval.js';

export const WORKSPACE_RETRIEVAL_HIT_AT_5_THRESHOLD = 0.8;

export function evaluateWorkspaceRetrieval(
  goldenSet: ReadonlyArray<{ question: string; id: string; text: string }>,
) {
  const hits = goldenSet.filter((golden) => {
    const candidates = goldenSet.map((candidate, index) => ({
      value: candidate.id,
      text: candidate.text,
      vectorScore: candidate.id === golden.id ? 0.52 : 0.68 - index * 0.001,
    }));
    const ranked = rerankCandidates(golden.question, candidates);
    return ranked.slice(0, 5).some(({ value }) => value === golden.id);
  }).length;
  return { queries: goldenSet.length, hits, hitRate: goldenSet.length === 0 ? 0 : hits / goldenSet.length };
}
