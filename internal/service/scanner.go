package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/dhowden/tag"
	"github.com/google/uuid"

	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

// SupportedExtensions lists audio file extensions the scanner recognizes.
var SupportedExtensions = map[string]bool{
	".flac": true,
	".mp3":  true,
	".ogg":  true,
	".wav":  true,
	".aac":  true,
	".m4a":  true,
	".alac": true,
	".wma":  true,
	".ape":  true,
	".opus": true,
}

// ScanResult reports the outcome of a completed scan.
type ScanResult struct {
	New     int           `json:"new"`
	Updated int           `json:"updated"`
	Deleted int           `json:"deleted"`
	Elapsed time.Duration `json:"elapsed"`
}

// ScanStatus reports current scan progress.
type ScanStatus struct {
	Scanning  bool `json:"scanning"`
	Total     int  `json:"total"`
	Processed int  `json:"processed"`
}

// fileInfo holds the path and file size for a discovered audio file.
type fileInfo struct {
	Path string
	Size int64
}

// TrackMeta holds metadata extracted from an audio file.
type TrackMeta struct {
	FilePath        string
	FileSize        int64
	Title           string
	Artist          string
	Album           string
	TrackNumber     int
	DiscNumber      int
	Year            int
	Genre           string
	DurationSeconds int
	Format          string
	Bitrate         int
	SampleRate      int
}

// ScannerService handles library scanning: directory walk, metadata extraction, and DB upsert.
type ScannerService struct {
	artistStore     *sqlite.ArtistStore
	albumStore      *sqlite.AlbumStore
	trackStore      *sqlite.TrackStore
	coverArtService *CoverArtService
	musicDirs       []string
	workers         int
	logger          *slog.Logger

	mu     sync.Mutex
	status ScanStatus

	stopTicker chan struct{}
	tickerDone chan struct{}
}

// NewScannerService creates a new ScannerService.
func NewScannerService(
	artistStore *sqlite.ArtistStore,
	albumStore *sqlite.AlbumStore,
	trackStore *sqlite.TrackStore,
	coverArtService *CoverArtService,
	musicDirs []string,
	workers int,
	logger *slog.Logger,
) *ScannerService {
	if workers <= 0 {
		workers = 4
	}
	return &ScannerService{
		artistStore:    artistStore,
		albumStore:     albumStore,
		trackStore:     trackStore,
		coverArtService: coverArtService,
		musicDirs:      musicDirs,
		workers:        workers,
		logger:         logger,
	}
}

// Status returns the current scan status.
func (s *ScannerService) Status() ScanStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status
}

// Scan performs a full library scan. It returns an error if a scan is already in progress.
func (s *ScannerService) Scan(ctx context.Context) (*ScanResult, error) {
	s.mu.Lock()
	if s.status.Scanning {
		s.mu.Unlock()
		return nil, fmt.Errorf("scan already in progress")
	}
	s.status = ScanStatus{Scanning: true}
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.status.Scanning = false
		s.mu.Unlock()
	}()

	start := time.Now()
	s.logger.Info("library scan started", "music_dirs", s.musicDirs)

	// Step 1: Walk directories and collect audio file paths.
	files, err := s.walkDirs(ctx)
	if err != nil {
		return nil, fmt.Errorf("walking directories: %w", err)
	}

	s.mu.Lock()
	s.status.Total = len(files)
	s.mu.Unlock()

	s.logger.Info("discovered audio files", "count", len(files))

	// Step 2: Get existing tracks for diff.
	existingPaths, err := s.trackStore.AllFilePaths(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetching existing paths: %w", err)
	}

	// Build set of current file paths.
	currentPaths := make(map[string]bool, len(files))
	for _, f := range files {
		currentPaths[f.Path] = true
	}

	// Step 3: Extract metadata with worker pool.
	metas, err := s.extractAll(ctx, files)
	if err != nil {
		return nil, fmt.Errorf("extracting metadata: %w", err)
	}

	// Step 4: Upsert artists, albums, tracks.
	var newTracks, updatedTracks int
	affectedAlbums := make(map[string]bool)
	for _, meta := range metas {
		albumID, created, err := s.upsertTrack(ctx, meta)
		if err != nil {
			s.logger.Error("failed to upsert track", "path", meta.FilePath, "error", err)
			continue
		}
		if created {
			newTracks++
		} else {
			updatedTracks++
		}
		if albumID != "" {
			affectedAlbums[albumID] = true
		}
	}

	// Step 5: Cleanup deleted files.
	var deletedTracks int
	for path, id := range existingPaths {
		if !currentPaths[path] {
			if err := s.trackStore.Delete(ctx, id); err != nil {
				s.logger.Error("failed to delete removed track", "path", path, "error", err)
			} else {
				deletedTracks++
				s.logger.Info("removed track for missing file", "path", path)
			}
		}
	}

	// Clean up orphan albums, then orphan artists.
	orphanAlbums, err := s.albumStore.DeleteOrphans(ctx)
	if err != nil {
		s.logger.Error("failed to clean orphan albums", "error", err)
	} else if orphanAlbums > 0 {
		s.logger.Info("removed orphan albums", "count", orphanAlbums)
	}

	orphanArtists, err := s.artistStore.DeleteOrphans(ctx)
	if err != nil {
		s.logger.Error("failed to clean orphan artists", "error", err)
	} else if orphanArtists > 0 {
		s.logger.Info("removed orphan artists", "count", orphanArtists)
	}

	// Recalc stats for all affected albums still in the DB.
	for albumID := range affectedAlbums {
		if err := s.albumStore.RecalcStats(ctx, albumID); err != nil {
			s.logger.Error("failed to recalculate album stats", "albumID", albumID, "error", err)
		}
	}

	// Step 5b: Extract cover art for affected albums.
	if s.coverArtService != nil {
		for albumID := range affectedAlbums {
			coverPath, err := s.coverArtService.ExtractForAlbum(ctx, albumID)
			if err != nil {
				s.logger.Error("failed to extract cover art", "albumID", albumID, "error", err)
				continue
			}
			if coverPath != "" {
				album, err := s.albumStore.GetByID(ctx, albumID)
				if err != nil {
					s.logger.Error("failed to get album for cover art update", "albumID", albumID, "error", err)
					continue
				}
				if album != nil && album.CoverArtPath != coverPath {
					album.CoverArtPath = coverPath
					if err := s.albumStore.Update(ctx, album); err != nil {
						s.logger.Error("failed to update album cover_art_path", "albumID", albumID, "error", err)
					} else {
						s.logger.Debug("updated cover art", "albumID", albumID, "path", coverPath)
					}
				}
			}
		}
	}

	// Step 6: Rebuild FTS index.
	if err := s.trackStore.RebuildFTS(ctx); err != nil {
		s.logger.Error("failed to rebuild FTS index", "error", err)
	}

	elapsed := time.Since(start)
	s.logger.Info("library scan completed",
		"duration", elapsed.String(),
		"files_found", len(files),
		"tracks_new", newTracks,
		"tracks_updated", updatedTracks,
		"tracks_deleted", deletedTracks,
	)

	return &ScanResult{
		New:     newTracks,
		Updated: updatedTracks,
		Deleted: deletedTracks,
		Elapsed: elapsed,
	}, nil
}

// walkDirs walks all configured music directories and collects audio file paths.
func (s *ScannerService) walkDirs(ctx context.Context) ([]fileInfo, error) {
	var files []fileInfo

	for _, dir := range s.musicDirs {
		err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				s.logger.Warn("walk error", "path", path, "error", err)
				return nil // continue walking
			}

			if ctx.Err() != nil {
				return ctx.Err()
			}

			if d.IsDir() {
				return nil
			}

			ext := strings.ToLower(filepath.Ext(path))
			if !SupportedExtensions[ext] {
				return nil
			}

			info, err := d.Info()
			if err != nil {
				s.logger.Warn("stat error", "path", path, "error", err)
				return nil
			}

			files = append(files, fileInfo{Path: path, Size: info.Size()})
			return nil
		})
		if err != nil {
			return nil, fmt.Errorf("walking %s: %w", dir, err)
		}
	}

	return files, nil
}

// extractAll extracts metadata from all files using a worker pool.
func (s *ScannerService) extractAll(ctx context.Context, files []fileInfo) ([]TrackMeta, error) {
	type result struct {
		meta TrackMeta
		err  error
	}

	in := make(chan fileInfo, len(files))
	out := make(chan result, len(files))

	var processed atomic.Int64

	// Start workers.
	var wg sync.WaitGroup
	for range s.workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for fi := range in {
				if ctx.Err() != nil {
					return
				}
				meta, err := s.extractMeta(ctx, fi)
				out <- result{meta: meta, err: err}
				n := processed.Add(1)
				s.mu.Lock()
				s.status.Processed = int(n)
				s.mu.Unlock()
			}
		}()
	}

	// Send work.
	for _, fi := range files {
		in <- fi
	}
	close(in)

	// Wait for workers to finish, then close output.
	go func() {
		wg.Wait()
		close(out)
	}()

	// Collect results.
	var metas []TrackMeta
	for r := range out {
		if r.err != nil {
			s.logger.Warn("metadata extraction failed", "path", r.meta.FilePath, "error", r.err)
			continue
		}
		metas = append(metas, r.meta)
	}

	return metas, nil
}

// ExtractMeta extracts metadata from a single audio file.
// Uses dhowden/tag for tag metadata and ffprobe for duration (and as fallback for tags).
// This is a package-level function so both scanner and upload services can use it.
func ExtractMeta(ctx context.Context, filePath string, fileSize int64, logger *slog.Logger) (TrackMeta, error) {
	meta := TrackMeta{
		FilePath: filePath,
		FileSize: fileSize,
		Format:   strings.TrimPrefix(strings.ToLower(filepath.Ext(filePath)), "."),
	}

	// Try dhowden/tag first.
	tagOK := extractTagMeta(&meta)

	// ffprobe for duration (always) and as fallback for metadata.
	extractFFprobeMeta(ctx, &meta, !tagOK, logger)

	// Ensure we have at least a title.
	if meta.Title == "" {
		// Use filename without extension as title.
		meta.Title = strings.TrimSuffix(filepath.Base(filePath), filepath.Ext(filePath))
	}

	// Default disc number.
	if meta.DiscNumber <= 0 {
		meta.DiscNumber = 1
	}

	return meta, nil
}

// extractMeta is the ScannerService method that delegates to the package-level ExtractMeta.
func (s *ScannerService) extractMeta(ctx context.Context, fi fileInfo) (TrackMeta, error) {
	return ExtractMeta(ctx, fi.Path, fi.Size, s.logger)
}

// extractTagMeta extracts metadata using dhowden/tag. Returns true if successful.
func extractTagMeta(meta *TrackMeta) bool {
	f, err := os.Open(meta.FilePath)
	if err != nil {
		return false
	}
	defer f.Close()

	m, err := tag.ReadFrom(f)
	if err != nil {
		return false
	}

	meta.Title = strings.TrimSpace(m.Title())
	meta.Artist = strings.TrimSpace(m.Artist())
	meta.Album = strings.TrimSpace(m.Album())
	meta.Genre = strings.TrimSpace(m.Genre())
	meta.Year = m.Year()

	trackNum, _ := m.Track()
	meta.TrackNumber = trackNum

	discNum, _ := m.Disc()
	meta.DiscNumber = discNum

	return true
}

// ffprobeResult represents the output of ffprobe in JSON format.
type ffprobeResult struct {
	Format struct {
		Duration string            `json:"duration"`
		BitRate  string            `json:"bit_rate"`
		Tags     map[string]string `json:"tags"`
	} `json:"format"`
	Streams []struct {
		SampleRate string `json:"sample_rate"`
	} `json:"streams"`
}

// extractFFprobeMeta extracts duration and optionally tag metadata from ffprobe.
func extractFFprobeMeta(ctx context.Context, meta *TrackMeta, useTags bool, logger *slog.Logger) {
	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		meta.FilePath,
	)

	output, err := cmd.Output()
	if err != nil {
		logger.Debug("ffprobe failed", "path", meta.FilePath, "error", err)
		return
	}

	var result ffprobeResult
	if err := json.Unmarshal(output, &result); err != nil {
		logger.Debug("ffprobe JSON parse failed", "path", meta.FilePath, "error", err)
		return
	}

	// Duration.
	if dur, err := strconv.ParseFloat(result.Format.Duration, 64); err == nil {
		meta.DurationSeconds = int(dur)
	}

	// Bitrate.
	if br, err := strconv.Atoi(result.Format.BitRate); err == nil {
		meta.Bitrate = br / 1000 // convert bps to kbps
	}

	// Sample rate from first audio stream.
	if len(result.Streams) > 0 {
		if sr, err := strconv.Atoi(result.Streams[0].SampleRate); err == nil {
			meta.SampleRate = sr
		}
	}

	// Use ffprobe tags as fallback.
	if useTags && result.Format.Tags != nil {
		tags := result.Format.Tags
		if meta.Title == "" {
			meta.Title = strings.TrimSpace(firstNonEmpty(tags["title"], tags["TITLE"]))
		}
		if meta.Artist == "" {
			meta.Artist = strings.TrimSpace(firstNonEmpty(tags["artist"], tags["ARTIST"]))
		}
		if meta.Album == "" {
			meta.Album = strings.TrimSpace(firstNonEmpty(tags["album"], tags["ALBUM"]))
		}
		if meta.Genre == "" {
			meta.Genre = strings.TrimSpace(firstNonEmpty(tags["genre"], tags["GENRE"]))
		}
		if meta.Year == 0 {
			if y, err := strconv.Atoi(firstNonEmpty(tags["date"], tags["DATE"], tags["year"], tags["YEAR"])); err == nil {
				meta.Year = y
			}
		}
		if meta.TrackNumber == 0 {
			trackStr := firstNonEmpty(tags["track"], tags["TRACK"])
			// Handle "3/12" format.
			if idx := strings.Index(trackStr, "/"); idx != -1 {
				trackStr = trackStr[:idx]
			}
			if n, err := strconv.Atoi(strings.TrimSpace(trackStr)); err == nil {
				meta.TrackNumber = n
			}
		}
		if meta.DiscNumber == 0 {
			discStr := firstNonEmpty(tags["disc"], tags["DISC"])
			if idx := strings.Index(discStr, "/"); idx != -1 {
				discStr = discStr[:idx]
			}
			if n, err := strconv.Atoi(strings.TrimSpace(discStr)); err == nil {
				meta.DiscNumber = n
			}
		}
	}
}

// UpsertTrack creates or updates an artist, album, and track for the given metadata.
// Returns the album ID for stats recalculation, whether the track was newly created, and any error.
// This is a package-level function so both scanner and upload services can use it.
func UpsertTrack(ctx context.Context, meta TrackMeta, artistStore *sqlite.ArtistStore, albumStore *sqlite.AlbumStore, trackStore *sqlite.TrackStore) (string, bool, error) {
	now := time.Now()

	// Determine artist name: default to "Unknown Artist".
	artistName := meta.Artist
	if artistName == "" {
		artistName = "Unknown Artist"
	}

	// Upsert artist.
	artist, err := artistStore.GetByName(ctx, artistName)
	if err != nil {
		return "", false, fmt.Errorf("looking up artist %q: %w", artistName, err)
	}
	if artist == nil {
		artist = &model.Artist{
			ID:        uuid.New().String(),
			Name:      artistName,
			SortName:  sortName(artistName),
			CreatedAt: now,
		}
		if err := artistStore.Create(ctx, artist); err != nil {
			return "", false, fmt.Errorf("creating artist %q: %w", artistName, err)
		}
	}

	// Determine album name: default to "Unknown Album".
	albumName := meta.Album
	if albumName == "" {
		albumName = "Unknown Album"
	}

	// Upsert album.
	album, err := albumStore.GetByArtistAndName(ctx, artist.ID, albumName)
	if err != nil {
		return "", false, fmt.Errorf("looking up album %q: %w", albumName, err)
	}
	if album == nil {
		album = &model.Album{
			ID:        uuid.New().String(),
			ArtistID:  artist.ID,
			Name:      albumName,
			Year:      meta.Year,
			Genre:     meta.Genre,
			CreatedAt: now,
		}
		if err := albumStore.Create(ctx, album); err != nil {
			return "", false, fmt.Errorf("creating album %q: %w", albumName, err)
		}
	} else {
		// Update album metadata if we have better data.
		changed := false
		if meta.Year != 0 && album.Year == 0 {
			album.Year = meta.Year
			changed = true
		}
		if meta.Genre != "" && album.Genre == "" {
			album.Genre = meta.Genre
			changed = true
		}
		if changed {
			if err := albumStore.Update(ctx, album); err != nil {
				return "", false, fmt.Errorf("updating album %q: %w", albumName, err)
			}
		}
	}

	// Upsert track.
	existing, err := trackStore.GetByFilePath(ctx, meta.FilePath)
	if err != nil {
		return "", false, fmt.Errorf("looking up track by path: %w", err)
	}

	if existing != nil {
		// Update existing track.
		existing.AlbumID = album.ID
		existing.ArtistID = artist.ID
		existing.Title = meta.Title
		existing.TrackNumber = meta.TrackNumber
		existing.DiscNumber = meta.DiscNumber
		existing.DurationSeconds = meta.DurationSeconds
		existing.FileSize = meta.FileSize
		existing.Format = meta.Format
		existing.Bitrate = meta.Bitrate
		existing.SampleRate = meta.SampleRate
		existing.UpdatedAt = now

		if err := trackStore.Update(ctx, existing); err != nil {
			return "", false, fmt.Errorf("updating track: %w", err)
		}
		return album.ID, false, nil
	}

	// Create new track.
	track := &model.Track{
		ID:              uuid.New().String(),
		AlbumID:         album.ID,
		ArtistID:        artist.ID,
		Title:           meta.Title,
		TrackNumber:     meta.TrackNumber,
		DiscNumber:      meta.DiscNumber,
		DurationSeconds: meta.DurationSeconds,
		FilePath:        meta.FilePath,
		FileSize:        meta.FileSize,
		Format:          meta.Format,
		Bitrate:         meta.Bitrate,
		SampleRate:      meta.SampleRate,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := trackStore.Create(ctx, track); err != nil {
		return "", false, fmt.Errorf("creating track: %w", err)
	}

	return album.ID, true, nil
}

// upsertTrack is the ScannerService method that delegates to the package-level UpsertTrack.
func (s *ScannerService) upsertTrack(ctx context.Context, meta TrackMeta) (string, bool, error) {
	return UpsertTrack(ctx, meta, s.artistStore, s.albumStore, s.trackStore)
}

// StartPeriodicScan starts a background goroutine that runs a library scan at the
// given interval. If interval is zero or negative, periodic scanning is disabled.
// The goroutine stops when StopPeriodicScan is called or the context is cancelled.
func (s *ScannerService) StartPeriodicScan(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		s.logger.Info("periodic library scanning disabled (scan_interval = 0)")
		return
	}

	s.stopTicker = make(chan struct{})
	s.tickerDone = make(chan struct{})

	s.logger.Info("starting periodic library scanner", "interval", interval.String())

	go func() {
		defer close(s.tickerDone)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.logger.Info("periodic scan triggered")
				result, err := s.Scan(ctx)
				if err != nil {
					s.logger.Error("periodic scan failed", "error", err)
				} else {
					s.logger.Info("periodic scan finished",
						"new", result.New,
						"updated", result.Updated,
						"deleted", result.Deleted,
						"elapsed", result.Elapsed.String(),
					)
				}
			case <-s.stopTicker:
				s.logger.Info("periodic library scanner stopped")
				return
			case <-ctx.Done():
				s.logger.Info("periodic library scanner stopped (context cancelled)")
				return
			}
		}
	}()
}

// StopPeriodicScan signals the periodic scan goroutine to stop and waits for
// the current scan (if any) to finish before returning.
func (s *ScannerService) StopPeriodicScan() {
	if s.stopTicker == nil {
		return
	}

	close(s.stopTicker)
	<-s.tickerDone
}

// sortName generates a sort-friendly name by stripping common prefixes.
func sortName(name string) string {
	lower := strings.ToLower(name)
	for _, prefix := range []string{"the ", "a ", "an "} {
		if strings.HasPrefix(lower, prefix) {
			return strings.TrimSpace(name[len(prefix):])
		}
	}
	return ""
}

// MetadataOverride holds user-provided metadata fields that override tag-extracted values.
// Only non-zero/non-empty fields take effect.
type MetadataOverride struct {
	Filename    string `json:"filename"`
	Title       string `json:"title,omitempty"`
	Artist      string `json:"artist,omitempty"`
	Album       string `json:"album,omitempty"`
	TrackNumber int    `json:"track_number,omitempty"`
}

// ApplyOverride overwrites TrackMeta fields with non-empty values from the override.
func (m *TrackMeta) ApplyOverride(o MetadataOverride) {
	if o.Title != "" {
		m.Title = o.Title
	}
	if o.Artist != "" {
		m.Artist = o.Artist
	}
	if o.Album != "" {
		m.Album = o.Album
	}
	if o.TrackNumber != 0 {
		m.TrackNumber = o.TrackNumber
	}
}

// firstNonEmpty returns the first non-empty string from the arguments.
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
