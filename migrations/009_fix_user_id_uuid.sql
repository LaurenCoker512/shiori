-- users.id is UUID in production but all foreign-key columns are INTEGER.
-- This migration aligns every user_id column with the UUID type.
--
-- Sessions cannot be migrated (stored integer values have no UUID equivalent),
-- so they are truncated — all users will need to log in again after this runs.
--
-- Content rows (words, texts, etc.) are remapped to the owning user's UUID.
-- For a single-user deployment this is automatic. For multi-user deployments,
-- all content is assigned to the alphabetically-first user by email — review
-- and re-assign rows manually if needed.

BEGIN;

-- Drop FK constraints that block type changes (IF EXISTS in case they were
-- already dropped when users.id was changed to UUID outside of migrations).
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE tags     DROP CONSTRAINT IF EXISTS tags_user_id_fkey;

-- sessions: truncate and retype (stored integer user_ids cannot be remapped)
TRUNCATE sessions;
ALTER TABLE sessions ALTER COLUMN user_id TYPE UUID USING NULL::uuid;

-- Helper to look up the first user's UUID (used in USING expressions below).
CREATE FUNCTION _migration_first_user_id() RETURNS UUID AS $$
  SELECT id FROM users ORDER BY email LIMIT 1
$$ LANGUAGE SQL;

-- words
ALTER TABLE words ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE words ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE words ALTER COLUMN user_id TYPE UUID USING _migration_first_user_id();
ALTER TABLE words ALTER COLUMN user_id SET NOT NULL;

-- texts
ALTER TABLE texts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE texts ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE texts ALTER COLUMN user_id TYPE UUID USING _migration_first_user_id();
ALTER TABLE texts ALTER COLUMN user_id SET NOT NULL;

-- furigana_overrides
ALTER TABLE furigana_overrides ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE furigana_overrides ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE furigana_overrides ALTER COLUMN user_id TYPE UUID USING _migration_first_user_id();
ALTER TABLE furigana_overrides ALTER COLUMN user_id SET NOT NULL;

-- grammar_patterns
ALTER TABLE grammar_patterns ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE grammar_patterns ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE grammar_patterns ALTER COLUMN user_id TYPE UUID USING _migration_first_user_id();
ALTER TABLE grammar_patterns ALTER COLUMN user_id SET NOT NULL;

-- tags (has FK constraint, already dropped above)
ALTER TABLE tags ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE tags ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE tags ALTER COLUMN user_id TYPE UUID USING _migration_first_user_id();
ALTER TABLE tags ALTER COLUMN user_id SET NOT NULL;

DROP FUNCTION _migration_first_user_id();

-- Restore FK constraints now that types match.
ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE tags ADD CONSTRAINT tags_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMIT;
