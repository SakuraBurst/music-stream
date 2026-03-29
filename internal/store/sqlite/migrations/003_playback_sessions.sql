CREATE TABLE IF NOT EXISTS playback_sessions (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL,
    position_seconds REAL NOT NULL DEFAULT 0,
    queue_track_ids TEXT NOT NULL DEFAULT '[]',
    is_playing BOOLEAN NOT NULL DEFAULT FALSE,
    volume REAL NOT NULL DEFAULT 1.0,
    shuffle BOOLEAN NOT NULL DEFAULT FALSE,
    repeat_mode TEXT NOT NULL DEFAULT 'none',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
