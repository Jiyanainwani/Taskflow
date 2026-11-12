const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 120

export type RankedCandidate<T> = {
  value: T
  text: string
  vectorScore: number
}

export function chunkWorkspaceText(text: string): string[] {
  const [heading, ...bodyParts] = text.split('\n')
  const body = bodyParts.join('\n').trim()
  if (body.length <= CHUNK_SIZE) return [text.slice(0, CHUNK_SIZE)]

  const chunks: string[] = []
  const stride = CHUNK_SIZE - CHUNK_OVERLAP
  for (let start = 0; start < body.length; start += stride) {
    const content = body.slice(start, start + CHUNK_SIZE).trim()
    if (content) chunks.push(`${heading}\n${content}`.slice(0, CHUNK_SIZE + heading.length + 1))
  }
  return chunks
}

function terms(value: string) {
  return new Set(
    value.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [],
  )
}

export function rerankCandidates<T>(
  query: string,
  candidates: RankedCandidate<T>[],
): Array<RankedCandidate<T> & { score: number }> {
  const queryTerms = terms(query)
  return candidates
    .map((candidate) => {
      const candidateTerms = terms(candidate.text)
      const matchedTerms = [...queryTerms].filter((term) => candidateTerms.has(term)).length
      const lexicalScore = queryTerms.size === 0 ? 0 : matchedTerms / queryTerms.size
      return {
        ...candidate,
        score: candidate.vectorScore * 0.75 + lexicalScore * 0.25,
      }
    })
    .sort((left, right) => right.score - left.score)
}
