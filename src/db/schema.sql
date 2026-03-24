CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  username         TEXT NOT NULL UNIQUE,
  password         TEXT NOT NULL,
  theme            TEXT NOT NULL DEFAULT 'light',
  default_view     TEXT NOT NULL DEFAULT 'tasks',
  focus_project_id INTEGER
);

CREATE TABLE IF NOT EXISTS projects (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  start_date   DATE,
  end_date     DATE,
  icon         TEXT,
  color        TEXT,
  accomplished BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id     INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  description    TEXT NOT NULL,
  start_datetime TIMESTAMP,
  end_datetime   TIMESTAMP,
  priority       TEXT,
  completed      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_values (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry       TEXT NOT NULL,
  entry_date  DATE NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  last_edited TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, entry_date)
);

CREATE TABLE IF NOT EXISTS journal_entry_values (
  journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  value_id         INTEGER NOT NULL REFERENCES user_values(id) ON DELETE CASCADE,
  PRIMARY KEY (journal_entry_id, value_id)
);

CREATE TABLE IF NOT EXISTS habits (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value_id    INTEGER NOT NULL REFERENCES user_values(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  frequency   TEXT NOT NULL,
  day_of_week INTEGER,
  start_date  DATE NOT NULL,
  end_date    DATE,
  dormant     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS habit_instances (
  id        SERIAL PRIMARY KEY,
  habit_id  INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  datetime  TIMESTAMP NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (habit_id, datetime)
);

CREATE TABLE IF NOT EXISTS check_ins (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month        DATE NOT NULL,
  memorable    TEXT,
  lessons      TEXT,
  time_review  TEXT,
  accomplished TEXT,
  different    TEXT,
  grateful     TEXT,
  growth       TEXT,
  rating       INTEGER,
  focus_change TEXT,
  UNIQUE (user_id, month)
);
