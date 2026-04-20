-- REV-R2-20260419-0034
-- HNSW with m=32 for better recall, and a user-scoped partial index
-- to accelerate the hot path (user-filtered cosine search).
--
-- Previous migration 20260419_embeddings_hnsw_index created
-- `embeddings_hnsw_idx` (default m=16). Replace with m=32 and keep the
-- canonical name `idx_embeddings_cosine` to match call-sites.

-- Drop the previous generic HNSW index (and any name variant already present).
DROP INDEX IF EXISTS idx_embeddings_cosine;
DROP INDEX IF EXISTS embeddings_hnsw_idx;

-- Recreate with m=32, ef_construction=64 for higher recall on cosine ops.
CREATE INDEX idx_embeddings_cosine
  ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 32, ef_construction = 64);

-- Partial index for user-scoped queries (hot path).
-- Note: `user_id` is NOT NULL in the current schema (see
-- prisma/schema.prisma model Embedding). The `IS NOT NULL` predicate is
-- therefore always-true today; Postgres will use the partial index the
-- same as a full one. Keeping the predicate so the index survives any
-- future schema change that makes user_id nullable.
CREATE INDEX IF NOT EXISTS idx_embeddings_user_cosine
  ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 32, ef_construction = 64)
  WHERE user_id IS NOT NULL;
