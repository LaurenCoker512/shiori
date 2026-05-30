ALTER TABLE words
  ADD COLUMN frequency_tier TEXT
    CHECK (
      frequency_tier IN ('very-common', 'common', 'uncommon', 'rare', 'very-rare')
      OR frequency_tier IS NULL
    );
