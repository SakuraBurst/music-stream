package service

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/dhowden/tag"

	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

// Cover art errors.
var (
	ErrAlbumNotFound    = errors.New("album not found")
	ErrCoverArtMissing  = errors.New("cover art not found for album")
)

// fallbackCoverFiles lists file names to look for in the album directory.
var fallbackCoverFiles = []string{
	"cover.jpg",
	"cover.png",
	"folder.jpg",
	"front.jpg",
}

// CoverArtService handles cover art extraction and serving.
type CoverArtService struct {
	albumStore *sqlite.AlbumStore
	trackStore *sqlite.TrackStore
	coverDir   string
	logger     *slog.Logger
}

// NewCoverArtService creates a new CoverArtService.
// coverDir is the directory where extracted cover art files are stored (<data_dir>/coverart/).
func NewCoverArtService(
	albumStore *sqlite.AlbumStore,
	trackStore *sqlite.TrackStore,
	coverDir string,
	logger *slog.Logger,
) *CoverArtService {
	return &CoverArtService{
		albumStore: albumStore,
		trackStore: trackStore,
		coverDir:   coverDir,
		logger:     logger,
	}
}

// GetCoverArtPath looks up the album's cover art path. Returns the file path or an error.
func (s *CoverArtService) GetCoverArtPath(ctx context.Context, albumID string) (string, error) {
	album, err := s.albumStore.GetByID(ctx, albumID)
	if err != nil {
		return "", fmt.Errorf("getting album: %w", err)
	}
	if album == nil {
		return "", ErrAlbumNotFound
	}

	if album.CoverArtPath == "" {
		return "", ErrCoverArtMissing
	}

	// Verify file still exists.
	if _, err := os.Stat(album.CoverArtPath); err != nil {
		if os.IsNotExist(err) {
			return "", ErrCoverArtMissing
		}
		return "", fmt.Errorf("checking cover art file: %w", err)
	}

	return album.CoverArtPath, nil
}

// ExtractForAlbum extracts cover art for a given album from its tracks.
// It tries embedded art first, then falls back to image files in the album directory.
// Returns the saved file path, or empty string if no cover art was found.
func (s *CoverArtService) ExtractForAlbum(ctx context.Context, albumID string) (string, error) {
	// Ensure coverart directory exists.
	if err := os.MkdirAll(s.coverDir, 0755); err != nil {
		return "", fmt.Errorf("creating coverart directory: %w", err)
	}

	// Get album tracks to find embedded art.
	tracks, err := s.trackStore.ListByAlbum(ctx, albumID)
	if err != nil {
		return "", fmt.Errorf("listing album tracks: %w", err)
	}

	if len(tracks) == 0 {
		return "", nil
	}

	// Try embedded art from the first track.
	coverPath := filepath.Join(s.coverDir, albumID+".jpg")
	if s.extractEmbeddedArt(tracks[0].FilePath, coverPath) {
		return coverPath, nil
	}

	// Fallback: look for cover files in the album directory.
	albumDir := filepath.Dir(tracks[0].FilePath)
	if found := s.findFallbackCover(albumDir, coverPath); found != "" {
		return found, nil
	}

	return "", nil
}

// SaveCustomCoverArt saves user-provided cover art bytes for the given album.
// It writes the data to <coverDir>/<albumID>.jpg and returns the path.
func (s *CoverArtService) SaveCustomCoverArt(albumID string, data []byte) (string, error) {
	if err := os.MkdirAll(s.coverDir, 0755); err != nil {
		return "", fmt.Errorf("creating coverart directory: %w", err)
	}

	coverPath := filepath.Join(s.coverDir, albumID+".jpg")
	if err := os.WriteFile(coverPath, data, 0644); err != nil {
		return "", fmt.Errorf("writing custom cover art: %w", err)
	}

	return coverPath, nil
}

// extractEmbeddedArt tries to extract embedded album art from an audio file using dhowden/tag.
// Returns true if art was extracted and saved successfully.
func (s *CoverArtService) extractEmbeddedArt(audioPath, destPath string) bool {
	f, err := os.Open(audioPath)
	if err != nil {
		return false
	}
	defer f.Close()

	m, err := tag.ReadFrom(f)
	if err != nil {
		return false
	}

	pic := m.Picture()
	if pic == nil || len(pic.Data) == 0 {
		return false
	}

	if err := os.WriteFile(destPath, pic.Data, 0644); err != nil {
		s.logger.Error("failed to write cover art", "path", destPath, "error", err)
		return false
	}

	return true
}

// findFallbackCover searches for common cover art filenames in the given directory.
// If found, copies the file to destPath and returns destPath.
// If found but copy fails, returns the original path directly.
// Returns empty string if no cover file was found.
func (s *CoverArtService) findFallbackCover(dir, destPath string) string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}

	// Build a map of lowercase filenames to their actual entries.
	fileMap := make(map[string]fs.DirEntry, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			fileMap[strings.ToLower(e.Name())] = e
		}
	}

	for _, name := range fallbackCoverFiles {
		if _, ok := fileMap[name]; ok {
			srcPath := filepath.Join(dir, name)
			data, err := os.ReadFile(srcPath)
			if err != nil {
				s.logger.Warn("failed to read fallback cover", "path", srcPath, "error", err)
				// Return the original path — it exists, we just couldn't copy it.
				return srcPath
			}
			if err := os.WriteFile(destPath, data, 0644); err != nil {
				s.logger.Warn("failed to copy fallback cover", "src", srcPath, "dest", destPath, "error", err)
				return srcPath
			}
			return destPath
		}
	}

	return ""
}
