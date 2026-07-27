-- BLD-1056: listClients() searches firstName/lastName/email/phone with a
-- leading-wildcard ILIKE ('contains'), which a plain btree index can't serve.
-- Additive only -- new extension + new indexes, no drops/renames/uniques.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX IF NOT EXISTS "Client_firstName_idx" ON "Client" USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_lastName_idx" ON "Client" USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_email_idx" ON "Client" USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_phone_idx" ON "Client" USING GIN ("phone" gin_trgm_ops);
