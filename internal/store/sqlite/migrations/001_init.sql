-- 001_init.sql: Initial schema for Sonus music streaming server.

-- Library tables (populated by scanner)

CREATE TABLE artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE albums (
    id TEXT PRIMARY KEY,
    artist_id TEXT REFERENCES artists(id),
    name TEXT NOT NULL,
    year INTEGER,
    genre TEXT,
    cover_art_path TEXT,
    track_count INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tracks (
    id TEXT PRIMARY KEY,
    album_id TEXT REFERENCES albums(id),
    artist_id TEXT REFERENCES artists(id),
    title TEXT NOT NULL,
    track_number INTEGER,
    disc_number INTEGER DEFAULT 1,
    duration_seconds INTEGER NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_size INTEGER,
    format TEXT,
    bitrate INTEGER,
    sample_rate INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search (FTS5)
CREATE VIRTUAL TABLE tracks_fts USING fts5(
    title, artist_name, album_name,
    content=tracks,
    content_rowid=rowid
);

-- User and personal data tables

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlists (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlist_tracks (
    playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
    track_id TEXT REFERENCES tracks(id),
    position INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE favorites (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item_type, item_id)
);

CREATE TABLE listening_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    track_id TEXT REFERENCES tracks(id),
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER
);

-- Indexes

CREATE INDEX idx_tracks_album ON tracks(album_id);
CREATE INDEX idx_tracks_artist ON tracks(artist_id);
CREATE INDEX idx_albums_artist ON albums(artist_id);
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_history_user_date ON listening_history(user_id, played_at DESC);
CREATE INDEX idx_tracks_file_path ON tracks(file_path);
CREATE INDEX idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
