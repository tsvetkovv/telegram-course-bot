CREATE TABLE IF NOT EXISTS files(
  file_id text NOT NULL UNIQUE,
  file_name text NOT NULL UNIQUE,
  title text,
  mime_type text NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons(
  number int NOT NULL,
  file_id text NOT NULL UNIQUE REFERENCES files(file_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chats(
  id int UNIQUE,
  user_id int NOT NULL,
  username text,
  admin bool,
  allow_access bool
);

CREATE TABLE IF NOT EXISTS chats_lesson(
  chat_id int REFERENCES chats (id) UNIQUE,
  current_lesson int NOT NULL DEFAULT 1,
  CONSTRAINT fk_chats FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
