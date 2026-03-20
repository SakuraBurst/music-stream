package sqlite

import (
	"database/sql"
	"testing"
)

func TestOpen(t *testing.T) {
	dir := t.TempDir()

	db, err := Open(dir, testLogger())
	if err != nil {
		t.Fatalf("Open(%q): %v", dir, err)
	}
	defer db.Close()

	// Verify WAL mode is enabled.
	var journalMode string
	if err := db.QueryRow("PRAGMA journal_mode").Scan(&journalMode); err != nil {
		t.Fatalf("querying journal_mode: %v", err)
	}
	if journalMode != "wal" {
		t.Errorf("journal_mode = %q, want %q", journalMode, "wal")
	}

	// Verify foreign keys are enabled.
	var fk int
	if err := db.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
		t.Fatalf("querying foreign_keys: %v", err)
	}
	if fk != 1 {
		t.Errorf("foreign_keys = %d, want 1", fk)
	}

	// Verify all expected tables exist.
	tables := []string{
		"artists", "albums", "tracks", "tracks_fts",
		"users", "refresh_tokens",
		"playlists", "playlist_tracks",
		"favorites", "listening_history",
		"schema_migrations",
	}
	for _, tbl := range tables {
		var name string
		err := db.QueryRow(
			"SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?", tbl,
		).Scan(&name)
		if err == sql.ErrNoRows {
			t.Errorf("table %q does not exist", tbl)
		} else if err != nil {
			t.Errorf("checking table %q: %v", tbl, err)
		}
	}

	// Verify migration was recorded.
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE version = '001_init.sql'").Scan(&count); err != nil {
		t.Fatalf("querying schema_migrations: %v", err)
	}
	if count != 1 {
		t.Errorf("schema_migrations count for 001_init.sql = %d, want 1", count)
	}
}

func TestOpenIdempotent(t *testing.T) {
	dir := t.TempDir()

	// Open twice to verify migrations are idempotent.
	db1, err := Open(dir, testLogger())
	if err != nil {
		t.Fatalf("first Open: %v", err)
	}
	db1.Close()

	db2, err := Open(dir, testLogger())
	if err != nil {
		t.Fatalf("second Open: %v", err)
	}
	defer db2.Close()

	// Should still have exactly the same number of migrations recorded (no re-application).
	var count int
	if err := db2.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&count); err != nil {
		t.Fatalf("querying schema_migrations: %v", err)
	}
	// There are 2 migration files (001_init.sql, 002_fix_fts.sql).
	if count != 2 {
		t.Errorf("schema_migrations count = %d after double open, want 2", count)
	}
}
