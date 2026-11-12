/**
 * Gemini's embedding API response does not include token usage. Use a rough
 * character-based estimate for cost telemetry, and label it as estimated.
 */
export function estimateTextTokens(values: readonly string[]): number {
  return values.reduce(
    (total, value) => total + Math.ceil(Array.from(value).length / 4),
    0,
  );
}
