ALTER TABLE texts
  ADD COLUMN import_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (import_status IN ('pending', 'processing', 'ready', 'error')),
  ADD COLUMN import_error TEXT;
