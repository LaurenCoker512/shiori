CREATE TABLE tags (
  id        SERIAL PRIMARY KEY,
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  color     TEXT NOT NULL DEFAULT 'coral',
  UNIQUE (user_id, name)
);

CREATE TABLE text_tags (
  text_id   INT NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  tag_id    INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (text_id, tag_id)
);

CREATE INDEX ON tags (user_id);
CREATE INDEX ON text_tags (tag_id);
