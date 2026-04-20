-- HNSW index on embeddings for fast cosine similarity search.
-- Speeds up ORDER BY embedding <=> query vector for /api/chat RAG.
-- REV-20260419-0008
CREATE INDEX IF NOT EXISTS embeddings_hnsw_idx
  ON embeddings USING hnsw (embedding vector_cosine_ops);
