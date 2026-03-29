package service

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

// UploadResult describes the outcome of processing a single uploaded file.
type UploadResult struct {
	ID              string `json:"id,omitempty"`
	Title           string `json:"title,omitempty"`
	Artist          string `json:"artist,omitempty"`
	Album           string `json:"album,omitempty"`
	DurationSeconds int    `json:"durationSeconds,omitempty"`
	Format          string `json:"format,omitempty"`
	Error           string `json:"error,omitempty"`
	Filename        string `json:"filename"`
}

// UploadService handles file upload processing: saving, metadata extraction, DB upsert, and cover art.
type UploadService struct {
	artistStore     *sqlite.ArtistStore
	albumStore      *sqlite.AlbumStore
	trackStore      *sqlite.TrackStore
	coverArtService *CoverArtService
	uploadsDir      string
	logger          *slog.Logger
}

// NewUploadService creates a new UploadService.
// uploadsDir is <data_dir>/uploads/.
func NewUploadService(
	artistStore *sqlite.ArtistStore,
	albumStore *sqlite.AlbumStore,
	trackStore *sqlite.TrackStore,
	coverArtService *CoverArtService,
	uploadsDir string,
	logger *slog.Logger,
) *UploadService {
	return &UploadService{
		artistStore:     artistStore,
		albumStore:      albumStore,
		trackStore:      trackStore,
		coverArtService: coverArtService,
		uploadsDir:      uploadsDir,
		logger:          logger,
	}
}

// UploadFileOptions holds optional per-file parameters for upload processing.
type UploadFileOptions struct {
	Override     *MetadataOverride
	CoverArtData []byte
}

// ProcessFile saves an uploaded file to the uploads directory, extracts metadata,
// upserts artist/album/track in the DB, extracts cover art, and rebuilds FTS.
// Returns the result for this file (which may contain an error string for partial failures).
// opts is optional — pass nil for default behavior (backwards compatible).
func (s *UploadService) ProcessFile(ctx context.Context, fh *multipart.FileHeader, opts *UploadFileOptions) UploadResult {
	filename := fh.Filename
	ext := strings.ToLower(filepath.Ext(filename))

	// Validate extension.
	if !SupportedExtensions[ext] {
		return UploadResult{
			Filename: filename,
			Error:    fmt.Sprintf("unsupported file extension: %s", ext),
		}
	}

	// Ensure uploads directory exists.
	if err := os.MkdirAll(s.uploadsDir, 0755); err != nil {
		s.logger.Error("failed to create uploads directory", "error", err)
		return UploadResult{
			Filename: filename,
			Error:    "failed to create uploads directory",
		}
	}

	// Generate unique filename: <uuid><ext>.
	destName := uuid.New().String() + ext
	destPath := filepath.Join(s.uploadsDir, destName)

	// Save file to disk.
	fileSize, err := s.saveFile(fh, destPath)
	if err != nil {
		s.logger.Error("failed to save uploaded file", "filename", filename, "error", err)
		return UploadResult{
			Filename: filename,
			Error:    "failed to save file",
		}
	}

	// Extract metadata.
	meta, err := ExtractMeta(ctx, destPath, fileSize, s.logger)
	if err != nil {
		// Clean up the saved file on metadata failure.
		os.Remove(destPath)
		s.logger.Error("failed to extract metadata", "filename", filename, "error", err)
		return UploadResult{
			Filename: filename,
			Error:    "failed to extract metadata",
		}
	}

	// Apply user-provided metadata override (non-empty fields win).
	if opts != nil && opts.Override != nil {
		meta.ApplyOverride(*opts.Override)
	}

	// Upsert artist/album/track.
	albumID, _, err := UpsertTrack(ctx, meta, s.artistStore, s.albumStore, s.trackStore)
	if err != nil {
		os.Remove(destPath)
		s.logger.Error("failed to upsert track", "filename", filename, "error", err)
		return UploadResult{
			Filename: filename,
			Error:    "failed to save track to database",
		}
	}

	// Recalculate album stats.
	if albumID != "" {
		if err := s.albumStore.RecalcStats(ctx, albumID); err != nil {
			s.logger.Error("failed to recalculate album stats", "albumID", albumID, "error", err)
		}
	}

	// Handle cover art for the album.
	if s.coverArtService != nil && albumID != "" {
		var coverPath string
		var coverErr error

		if opts != nil && len(opts.CoverArtData) > 0 {
			// User provided custom cover art — save it directly.
			coverPath, coverErr = s.coverArtService.SaveCustomCoverArt(albumID, opts.CoverArtData)
		} else {
			// Extract cover art from file tags / fallback.
			coverPath, coverErr = s.coverArtService.ExtractForAlbum(ctx, albumID)
		}

		if coverErr != nil {
			s.logger.Error("failed to handle cover art", "albumID", albumID, "error", coverErr)
		} else if coverPath != "" {
			album, err := s.albumStore.GetByID(ctx, albumID)
			if err != nil {
				s.logger.Error("failed to get album for cover art update", "albumID", albumID, "error", err)
			} else if album != nil && album.CoverArtPath != coverPath {
				album.CoverArtPath = coverPath
				if err := s.albumStore.Update(ctx, album); err != nil {
					s.logger.Error("failed to update album cover_art_path", "albumID", albumID, "error", err)
				}
			}
		}
	}

	// Look up the newly created track to get its ID for the response.
	track, err := s.trackStore.GetByFilePath(ctx, destPath)
	if err != nil || track == nil {
		s.logger.Error("failed to look up newly created track", "path", destPath, "error", err)
		return UploadResult{
			Filename: filename,
			Error:    "track created but could not retrieve ID",
		}
	}

	return UploadResult{
		ID:              track.ID,
		Title:           meta.Title,
		Artist:          meta.Artist,
		Album:           meta.Album,
		DurationSeconds: meta.DurationSeconds,
		Format:          meta.Format,
		Filename:        filename,
	}
}

// RebuildFTS rebuilds the full-text search index after all uploads are processed.
func (s *UploadService) RebuildFTS(ctx context.Context) error {
	return s.trackStore.RebuildFTS(ctx)
}

// saveFile writes the multipart file to destPath and returns the number of bytes written.
func (s *UploadService) saveFile(fh *multipart.FileHeader, destPath string) (int64, error) {
	src, err := fh.Open()
	if err != nil {
		return 0, fmt.Errorf("opening uploaded file: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(destPath)
	if err != nil {
		return 0, fmt.Errorf("creating destination file: %w", err)
	}
	defer dst.Close()

	n, err := io.Copy(dst, src)
	if err != nil {
		os.Remove(destPath)
		return 0, fmt.Errorf("writing file: %w", err)
	}

	return n, nil
}
