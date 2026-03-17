package sqlite

import (
	"database/sql"
	"embed"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// DB wraps a *sql.DB connection to a SQLite database.
type DB struct {
	*sql.DB
}

// Open creates or opens a SQLite database at the given data directory,
// configures WAL mode and pragmas, and runs any pending migrations.
func Open(dataDir string, logger *slog.Logger) (*DB, error) {
	// Ensure data directory exists.
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("creating data directory %s: %w", dataDir, err)
	}

	dbPath := filepath.Join(dataDir, "sonus.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("opening database %s: %w", dbPath, err)
	}

	// SQLite should only use a single connection to avoid locking issues with WAL mode writes.
	// Reads can be concurrent, but the Go sql package handles connection pooling, so we limit
	// the pool to 1 for write safety and increase for read-heavy workloads later if needed.
	db.SetMaxOpenConns(1)

	if err := configurePragmas(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("configuring pragmas: %w", err)
	}

	logger.Info("database opened", "path", dbPath)

	sdb := &DB{DB: db}

	if err := sdb.migrate(logger); err != nil {
		db.Close()
		return nil, fmt.Errorf("running migrations: %w", err)
	}

	return sdb, nil
}

// configurePragmas sets SQLite pragmas for performance and correctness.
func configurePragmas(db *sql.DB) error {
	pragmas := []string{
		"PRAGMA journal_mode=wal",
		"PRAGMA foreign_keys=on",
		"PRAGMA busy_timeout=5000",
	}

	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			return fmt.Errorf("executing %s: %w", p, err)
		}
	}

	return nil
}

// migrate applies any pending SQL migrations from the embedded migrations directory.
// Migrations are tracked in a schema_migrations table.
func (db *DB) migrate(logger *slog.Logger) error {
	// Create the migrations tracking table if it does not exist.
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		return fmt.Errorf("creating schema_migrations table: %w", err)
	}

	// Read all migration files from the embedded filesystem.
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("reading migrations directory: %w", err)
	}

	// Sort migration files by name to ensure ordered application.
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		version := entry.Name()

		// Check if this migration has already been applied.
		var count int
		if err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE version = ?", version).Scan(&count); err != nil {
			return fmt.Errorf("checking migration %s: %w", version, err)
		}
		if count > 0 {
			continue
		}

		// Read and execute the migration.
		content, err := migrationsFS.ReadFile("migrations/" + version)
		if err != nil {
			return fmt.Errorf("reading migration %s: %w", version, err)
		}

		logger.Info("applying migration", "version", version)

		if _, err := db.Exec(string(content)); err != nil {
			return fmt.Errorf("applying migration %s: %w", version, err)
		}

		// Record the migration as applied.
		if _, err := db.Exec("INSERT INTO schema_migrations (version) VALUES (?)", version); err != nil {
			return fmt.Errorf("recording migration %s: %w", version, err)
		}

		logger.Info("migration applied", "version", version)
	}

	return nil
}
