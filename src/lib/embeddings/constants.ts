/** OpenAI text-embedding-3-small default width; must match DB vector(1536). */
export const EMBEDDING_DIMENSIONS = 1536;

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

/** Rough character budget per chunk before embedding (not tokens). */
export const CHUNK_MAX_CHARS = 1200;

export const CHUNK_OVERLAP_CHARS = 180;

export const EMBEDDING_BATCH_SIZE = 24;
