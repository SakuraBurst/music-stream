package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Transcoding errors.
var (
	ErrFFmpegNotAvailable = errors.New("ffmpeg is not available")
	ErrUnsupportedFormat  = errors.New("unsupported transcoding format")
	ErrUnsupportedBitrate = errors.New("unsupported bitrate")
)

// TranscodeFormat represents a supported output format.
type TranscodeFormat string

const (
	FormatMP3 TranscodeFormat = "mp3"
	FormatAAC TranscodeFormat = "aac"
	FormatOGG TranscodeFormat = "ogg"
)

// formatCodecs maps output formats to their ffmpeg codec and container settings.
var formatCodecs = map[TranscodeFormat]struct {
	codec     string
	container string
	mimeType  string
}{
	FormatMP3: {codec: "libmp3lame", container: "mp3", mimeType: "audio/mpeg"},
	FormatAAC: {codec: "aac", container: "adts", mimeType: "audio/aac"},
	FormatOGG: {codec: "libvorbis", container: "ogg", mimeType: "audio/ogg"},
}

// allowedBitrates is the set of supported bitrate values in kbps.
var allowedBitrates = map[int]bool{
	128: true,
	192: true,
	256: true,
	320: true,
}

// TranscodeResult holds the result of a transcode request.
type TranscodeResult struct {
	// FilePath is set when the result is a cached file (use http.ServeContent).
	FilePath string
	// Reader is set for live transcoding (stream directly to response).
	Reader io.ReadCloser
	// Cleanup must be called when done with the result (cancels ffmpeg, removes temp file on error).
	Cleanup func()
	// MIMEType is the content type to set on the response.
	MIMEType string
	// Cached indicates whether the result came from the disk cache.
	Cached bool
}

// cacheEvictionInterval is how often the background evictor checks the cache size.
const cacheEvictionInterval = 5 * time.Minute

// cacheEvictionHysteresis is the target ratio of max size to evict down to (90%).
const cacheEvictionHysteresis = 0.9

// TranscoderService handles audio transcoding via ffmpeg with disk caching.
type TranscoderService struct {
	ffmpegPath   string
	cacheDir     string
	cacheMaxSize int64
	available    bool
	logger       *slog.Logger
	stopEvictor  chan struct{}
	evictorDone  chan struct{}
}

// NewTranscoderService creates a new TranscoderService.
// It checks for ffmpeg availability at creation time and logs the result.
// cacheMaxSize is the maximum cache size in bytes; 0 means no limit (no eviction).
func NewTranscoderService(ffmpegPath string, dataDir string, cacheMaxSize int64, logger *slog.Logger) *TranscoderService {
	cacheDir := filepath.Join(dataDir, "cache", "transcoded")

	available := checkFFmpeg(ffmpegPath)
	if available {
		logger.Info("ffmpeg is available", "path", ffmpegPath)
	} else {
		logger.Warn("ffmpeg is not available; transcoding requests will return 501", "path", ffmpegPath)
	}

	return &TranscoderService{
		ffmpegPath:   ffmpegPath,
		cacheDir:     cacheDir,
		cacheMaxSize: cacheMaxSize,
		available:    available,
		logger:       logger,
	}
}

// Available returns whether ffmpeg was found at startup.
func (s *TranscoderService) Available() bool {
	return s.available
}

// ValidateParams checks that the requested format and bitrate are supported.
func ValidateParams(format string, bitrate int) (TranscodeFormat, error) {
	f := TranscodeFormat(strings.ToLower(format))
	if _, ok := formatCodecs[f]; !ok {
		return "", fmt.Errorf("%w: %s", ErrUnsupportedFormat, format)
	}
	if !allowedBitrates[bitrate] {
		return "", fmt.Errorf("%w: %d", ErrUnsupportedBitrate, bitrate)
	}
	return f, nil
}

// MIMEType returns the MIME type for the given transcode format.
func MIMEType(format TranscodeFormat) string {
	if c, ok := formatCodecs[format]; ok {
		return c.mimeType
	}
	return "application/octet-stream"
}

// Transcode returns the transcoded audio for the given track.
// If a cached version exists, it returns the file path for http.ServeContent.
// Otherwise, it starts ffmpeg and returns a reader for live streaming, simultaneously
// writing to a temp cache file. On success the temp file is renamed to the final cache path.
func (s *TranscoderService) Transcode(ctx context.Context, trackID string, trackFile *TrackFile, format TranscodeFormat, bitrate int) (*TranscodeResult, error) {
	if !s.available {
		return nil, ErrFFmpegNotAvailable
	}

	codec := formatCodecs[format]

	// Check if the original format already matches the requested format.
	if isFormatMatch(trackFile.Format, format) {
		return &TranscodeResult{
			FilePath: trackFile.FilePath,
			MIMEType: codec.mimeType,
			Cached:   true,
			Cleanup:  func() {},
		}, nil
	}

	// Check disk cache: <cacheDir>/<trackID>/<format>_<bitrate>
	cachePath := filepath.Join(s.cacheDir, trackID, fmt.Sprintf("%s_%d", format, bitrate))
	if _, err := os.Stat(cachePath); err == nil {
		// Touch mtime for LRU tracking.
		now := time.Now()
		_ = os.Chtimes(cachePath, now, now)

		s.logger.Debug("serving transcoded track from cache",
			"trackID", trackID,
			"format", format,
			"bitrate", bitrate,
		)
		return &TranscodeResult{
			FilePath: cachePath,
			MIMEType: codec.mimeType,
			Cached:   true,
			Cleanup:  func() {},
		}, nil
	}

	// Live transcode via ffmpeg.
	s.logger.Info("starting live transcode",
		"trackID", trackID,
		"trackPath", trackFile.FilePath,
		"format", format,
		"bitrate", bitrate,
	)

	// Ensure cache directory exists.
	cacheParent := filepath.Dir(cachePath)
	if err := os.MkdirAll(cacheParent, 0o755); err != nil {
		return nil, fmt.Errorf("creating cache directory: %w", err)
	}

	// Create temp file in the same directory for atomic rename.
	tmpFile, err := os.CreateTemp(cacheParent, ".transcode-*.tmp")
	if err != nil {
		return nil, fmt.Errorf("creating temp file: %w", err)
	}
	tmpPath := tmpFile.Name()

	// Build ffmpeg command.
	// ffmpeg -i <input> -map 0:a:0 -c:a <codec> -b:a <bitrate>k -f <container> -
	cmdCtx, cmdCancel := context.WithCancel(ctx)
	cmd := exec.CommandContext(cmdCtx, s.ffmpegPath,
		"-i", trackFile.FilePath,
		"-map", "0:a:0",
		"-c:a", codec.codec,
		"-b:a", strconv.Itoa(bitrate)+"k",
		"-f", codec.container,
		"-",
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		tmpFile.Close()
		os.Remove(tmpPath)
		cmdCancel()
		return nil, fmt.Errorf("creating stdout pipe: %w", err)
	}

	// Discard stderr (ffmpeg writes progress info there).
	cmd.Stderr = io.Discard

	if err := cmd.Start(); err != nil {
		tmpFile.Close()
		os.Remove(tmpPath)
		cmdCancel()
		return nil, fmt.Errorf("starting ffmpeg: %w", err)
	}

	// Use TeeReader to write to both the cache file and the pipe for HTTP response.
	teeReader := io.TeeReader(stdout, tmpFile)

	// Create a pipe: reader side goes to the HTTP response,
	// a goroutine copies from the tee reader to the pipe writer.
	pr, pw := io.Pipe()

	completed := make(chan error, 1)

	go func() {
		_, copyErr := io.Copy(pw, teeReader)

		// Close temp file before waiting for ffmpeg.
		tmpFile.Close()

		// Wait for ffmpeg to finish.
		waitErr := cmd.Wait()

		if copyErr != nil {
			pw.CloseWithError(copyErr)
			os.Remove(tmpPath)
			completed <- copyErr
			return
		}

		if waitErr != nil {
			pw.CloseWithError(waitErr)
			os.Remove(tmpPath)
			completed <- waitErr
			return
		}

		// Transcode completed successfully — rename temp to final cache path.
		if renameErr := os.Rename(tmpPath, cachePath); renameErr != nil {
			s.logger.Error("failed to rename transcode cache file",
				"tmp", tmpPath,
				"dest", cachePath,
				"error", renameErr,
			)
			os.Remove(tmpPath)
		} else {
			s.logger.Info("transcode cached",
				"trackID", trackID,
				"path", cachePath,
				"format", format,
				"bitrate", bitrate,
			)
		}

		pw.Close()
		completed <- nil
	}()

	cleanup := func() {
		cmdCancel()
		// Drain the pipe to unblock the goroutine if the caller disconnects early.
		go func() {
			_, _ = io.Copy(io.Discard, pr)
			pr.Close()
		}()
		// Wait for the goroutine to finish to ensure temp file cleanup.
		<-completed
	}

	return &TranscodeResult{
		Reader:   pr,
		MIMEType: codec.mimeType,
		Cached:   false,
		Cleanup:  cleanup,
	}, nil
}

// StartCacheEvictor starts a background goroutine that periodically checks the
// total size of the transcode cache and evicts the least recently used files
// when the cache exceeds cacheMaxSize. Eviction continues until the cache is
// below 90% of the limit (hysteresis). The goroutine stops when Stop is called
// or when the provided context is cancelled.
func (s *TranscoderService) StartCacheEvictor(ctx context.Context) {
	if s.cacheMaxSize <= 0 {
		s.logger.Info("transcode cache eviction disabled (cache_max_size <= 0)")
		return
	}

	s.stopEvictor = make(chan struct{})
	s.evictorDone = make(chan struct{})

	s.logger.Info("starting transcode cache evictor",
		"cache_max_size", formatBytes(s.cacheMaxSize),
		"check_interval", cacheEvictionInterval,
	)

	go func() {
		defer close(s.evictorDone)

		ticker := time.NewTicker(cacheEvictionInterval)
		defer ticker.Stop()

		// Run an initial eviction check at startup.
		s.evictCache()

		for {
			select {
			case <-ticker.C:
				s.evictCache()
			case <-s.stopEvictor:
				s.logger.Info("transcode cache evictor stopped")
				return
			case <-ctx.Done():
				s.logger.Info("transcode cache evictor stopped (context cancelled)")
				return
			}
		}
	}()
}

// StopCacheEvictor signals the background evictor goroutine to stop
// and waits for it to finish.
func (s *TranscoderService) StopCacheEvictor() {
	if s.stopEvictor == nil {
		return
	}

	close(s.stopEvictor)
	<-s.evictorDone
}

// cacheFileInfo holds information about a cached file for eviction decisions.
type cacheFileInfo struct {
	path    string
	size    int64
	modTime time.Time
}

// evictCache walks the cache directory, calculates total size, and removes
// the least recently used files (by mtime) until the total is below
// cacheMaxSize * cacheEvictionHysteresis.
func (s *TranscoderService) evictCache() {
	targetSize := int64(float64(s.cacheMaxSize) * cacheEvictionHysteresis)

	var files []cacheFileInfo
	var totalSize int64

	err := filepath.Walk(s.cacheDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// If the cache directory doesn't exist yet, nothing to evict.
			if os.IsNotExist(err) {
				return filepath.SkipAll
			}
			return err
		}
		if info.IsDir() {
			return nil
		}
		// Skip temp files (in-progress transcodes).
		if strings.HasSuffix(info.Name(), ".tmp") {
			return nil
		}
		totalSize += info.Size()
		files = append(files, cacheFileInfo{
			path:    path,
			size:    info.Size(),
			modTime: info.ModTime(),
		})
		return nil
	})
	if err != nil {
		s.logger.Error("failed to walk transcode cache directory", "error", err)
		return
	}

	if totalSize <= s.cacheMaxSize {
		s.logger.Debug("transcode cache within limits",
			"total_size", formatBytes(totalSize),
			"max_size", formatBytes(s.cacheMaxSize),
		)
		return
	}

	s.logger.Info("transcode cache exceeds limit, starting eviction",
		"total_size", formatBytes(totalSize),
		"max_size", formatBytes(s.cacheMaxSize),
		"target_size", formatBytes(targetSize),
	)

	// Sort by modTime ascending (oldest first = least recently used).
	sort.Slice(files, func(i, j int) bool {
		return files[i].modTime.Before(files[j].modTime)
	})

	var deletedCount int
	var freedBytes int64

	for _, f := range files {
		if totalSize <= targetSize {
			break
		}
		if err := os.Remove(f.path); err != nil {
			if !os.IsNotExist(err) {
				s.logger.Warn("failed to remove cached transcode", "path", f.path, "error", err)
			}
			continue
		}
		totalSize -= f.size
		freedBytes += f.size
		deletedCount++

		// Try to remove the parent directory if it's now empty.
		parentDir := filepath.Dir(f.path)
		if parentDir != s.cacheDir {
			_ = os.Remove(parentDir) // Will fail silently if non-empty.
		}
	}

	s.logger.Info("transcode cache eviction complete",
		"deleted_files", deletedCount,
		"freed_space", formatBytes(freedBytes),
		"remaining_size", formatBytes(totalSize),
	)
}

// formatBytes formats a byte count into a human-readable string.
func formatBytes(b int64) string {
	const (
		kb = 1024
		mb = 1024 * kb
		gb = 1024 * mb
		tb = 1024 * gb
	)
	switch {
	case b >= tb:
		return fmt.Sprintf("%.2f TB", float64(b)/float64(tb))
	case b >= gb:
		return fmt.Sprintf("%.2f GB", float64(b)/float64(gb))
	case b >= mb:
		return fmt.Sprintf("%.2f MB", float64(b)/float64(mb))
	case b >= kb:
		return fmt.Sprintf("%.2f KB", float64(b)/float64(kb))
	default:
		return fmt.Sprintf("%d B", b)
	}
}

// isFormatMatch checks if the track's original format matches the requested transcode format.
func isFormatMatch(originalFormat string, requested TranscodeFormat) bool {
	orig := strings.ToLower(originalFormat)
	switch requested {
	case FormatMP3:
		return orig == "mp3"
	case FormatAAC:
		return orig == "aac" || orig == "m4a"
	case FormatOGG:
		return orig == "ogg" || orig == "opus"
	}
	return false
}

// checkFFmpeg verifies that the ffmpeg binary exists and is executable.
func checkFFmpeg(path string) bool {
	_, err := exec.LookPath(path)
	return err == nil
}
