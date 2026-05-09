CREATE INDEX words_user_id_idx ON words (user_id);
CREATE INDEX words_user_id_status_idx ON words (user_id, status);
CREATE INDEX texts_user_id_idx ON texts (user_id);
CREATE INDEX texts_user_id_import_status_idx ON texts (user_id, import_status);
CREATE INDEX grammar_patterns_user_id_pattern_idx ON grammar_patterns (user_id, pattern);
CREATE INDEX sentence_patterns_text_id_idx ON sentence_patterns (text_id);
CREATE INDEX furigana_overrides_user_id_idx ON furigana_overrides (user_id);
