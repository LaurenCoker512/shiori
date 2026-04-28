CREATE TABLE words (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL DEFAULT 1,
  dictionary_form   TEXT NOT NULL,
  reading           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'unseen'
                    CHECK (status IN ('unseen', 'seen', 'known')),
  translation       TEXT,
  user_translation  TEXT,
  jlpt_level        TEXT CHECK (jlpt_level IN ('N5','N4','N3','N2','N1') OR jlpt_level IS NULL),
  seen_at           TIMESTAMPTZ,
  known_at          TIMESTAMPTZ,
  UNIQUE (user_id, dictionary_form, reading)
);

CREATE TABLE texts (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL DEFAULT 1,
  title           TEXT NOT NULL,
  raw_content     TEXT NOT NULL,
  parsed_content  JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_read_at    TIMESTAMPTZ
);

CREATE TABLE furigana_overrides (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL DEFAULT 1,
  word_id           INTEGER REFERENCES words(id) ON DELETE CASCADE,
  surface_form      TEXT NOT NULL,
  corrected_reading TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, word_id, surface_form)
);

CREATE TABLE grammar_patterns (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL DEFAULT 1,
  pattern              TEXT NOT NULL,
  description_en       TEXT NOT NULL,
  jlpt_level           TEXT CHECK (jlpt_level IN ('N5','N4','N3','N2','N1') OR jlpt_level IS NULL),
  first_encountered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, pattern)
);

CREATE TABLE sentence_patterns (
  id                 SERIAL PRIMARY KEY,
  text_id            INTEGER REFERENCES texts(id) ON DELETE CASCADE,
  sentence_index     INTEGER NOT NULL,
  grammar_pattern_id INTEGER REFERENCES grammar_patterns(id),
  UNIQUE (text_id, sentence_index, grammar_pattern_id)
);
