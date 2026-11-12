import {
  evaluateWorkspaceRetrieval,
  WORKSPACE_RETRIEVAL_HIT_AT_5_THRESHOLD,
} from '../src/ai/workspace-retrieval-eval.js';
import { workspaceRetrievalGoldens } from '../evals/workspace-retrieval-goldens.js';

const result = evaluateWorkspaceRetrieval(workspaceRetrievalGoldens);
const percentage = (result.hitRate * 100).toFixed(1);
console.log(`Workspace retrieval Hit@5: ${result.hits}/${result.queries} (${percentage}%). Required: ${(WORKSPACE_RETRIEVAL_HIT_AT_5_THRESHOLD * 100).toFixed(0)}%.`);
if (result.hitRate < WORKSPACE_RETRIEVAL_HIT_AT_5_THRESHOLD) process.exitCode = 1;
