package service

import (
	"bytes"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

func TestSaveCustomCoverArt(t *testing.T) {
	tmpDir := t.TempDir()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	svc := &CoverArtService{
		coverDir: tmpDir,
		logger:   logger,
	}

	albumID := "test-album-123"
	coverData := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10} // fake JPEG

	path, err := svc.SaveCustomCoverArt(albumID, coverData)
	if err != nil {
		t.Fatalf("SaveCustomCoverArt failed: %v", err)
	}

	expectedPath := filepath.Join(tmpDir, albumID+".jpg")
	if path != expectedPath {
		t.Errorf("expected path=%q, got %q", expectedPath, path)
	}

	// Verify file was written with correct data.
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read saved cover art: %v", err)
	}
	if !bytes.Equal(data, coverData) {
		t.Errorf("saved data mismatch: got %v, want %v", data, coverData)
	}
}

func TestSaveCustomCoverArt_CreatesDirectory(t *testing.T) {
	tmpDir := t.TempDir()
	nestedDir := filepath.Join(tmpDir, "nested", "coverart")
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	svc := &CoverArtService{
		coverDir: nestedDir,
		logger:   logger,
	}

	coverData := []byte{0x89, 0x50, 0x4E, 0x47} // fake PNG header
	path, err := svc.SaveCustomCoverArt("album-456", coverData)
	if err != nil {
		t.Fatalf("SaveCustomCoverArt failed: %v", err)
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Errorf("cover art file was not created at %q", path)
	}
}

func TestSaveCustomCoverArt_OverwritesExisting(t *testing.T) {
	tmpDir := t.TempDir()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	svc := &CoverArtService{
		coverDir: tmpDir,
		logger:   logger,
	}

	albumID := "overwrite-test"
	firstData := []byte{0x01, 0x02, 0x03}
	secondData := []byte{0x04, 0x05, 0x06, 0x07}

	// Write first.
	_, err := svc.SaveCustomCoverArt(albumID, firstData)
	if err != nil {
		t.Fatalf("first SaveCustomCoverArt failed: %v", err)
	}

	// Overwrite.
	path, err := svc.SaveCustomCoverArt(albumID, secondData)
	if err != nil {
		t.Fatalf("second SaveCustomCoverArt failed: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read: %v", err)
	}
	if !bytes.Equal(data, secondData) {
		t.Errorf("expected overwritten data, got %v", data)
	}
}
