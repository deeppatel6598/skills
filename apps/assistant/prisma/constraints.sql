-- Production hardening: prevent double-booking at the database level.
-- Apply AFTER `prisma migrate deploy`. Requires the btree_gist extension.
-- Two active (non-cancelled) appointments for the same resource can never overlap.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS during tstzrange
  GENERATED ALWAYS AS (tstzrange("startsAt", "endsAt")) STORED;

ALTER TABLE "Appointment"
  ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist ("resourceId" WITH =, during WITH &&)
  WHERE (status <> 'CANCELLED');

-- Optional: semantic FAQ/knowledge search with pgvector
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE "KnowledgeEntry" ADD COLUMN embedding vector(1536);
-- CREATE INDEX ON "KnowledgeEntry" USING ivfflat (embedding vector_cosine_ops);
