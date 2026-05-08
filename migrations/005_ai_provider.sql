ALTER TABLE users
  ADD COLUMN ai_provider     TEXT NOT NULL DEFAULT 'anthropic'
    CHECK (ai_provider IN ('anthropic', 'openrouter')),
  ADD COLUMN anthropic_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  ADD COLUMN openrouter_api_key TEXT,
  ADD COLUMN openrouter_model   TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4-6';
