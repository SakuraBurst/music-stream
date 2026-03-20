-- 002_fix_fts.sql: Fix FTS5 table to not use content=tracks binding.
-- The original content=tracks didn't work because artist_name and album_name
-- aren't columns in the tracks table. Use a standalone FTS5 table instead.

DROP TABLE IF EXISTS tracks_fts;

CREATE VIRTUAL TABLE tracks_fts USING fts5(
    title, artist_name, album_name
);
