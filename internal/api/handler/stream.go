package handler

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/sakuraburst/sonus/internal/service"
)

// audioMIMETypes maps file extensions to MIME types for audio formats.
var audioMIMETypes = map[string]string{
	".flac": "audio/flac",
	".mp3":  "audio/mpeg",
	".ogg":  "audio/ogg",
	".wav":  "audio/wav",
	".aac":  "audio/aac",
	".m4a":  "audio/mp4",
	".wma":  "audio/x-ms-wma",
	".ape":  "audio/x-ape",
	".opus": "audio/ogg",
}

// StreamHandler handles audio streaming HTTP endpoints.
type StreamHandler struct {
	stream     *service.StreamService
	transcoder *service.TranscoderService
	logger     *slog.Logger
}

// NewStreamHandler creates a new StreamHandler.
func NewStreamHandler(stream *service.StreamService, transcoder *service.TranscoderService, logger *slog.Logger) *StreamHandler {
	return &StreamHandler{
		stream:     stream,
		transcoder: transcoder,
		logger:     logger,
	}
}

// Stream handles GET /api/v1/stream/{trackID}.
// Without format/bitrate params, it serves the original audio file.
// With ?format=mp3&bitrate=192, it transcodes (or serves from cache).
func (h *StreamHandler) Stream(w http.ResponseWriter, r *http.Request) {
	trackID := chi.URLParam(r, "trackID")

	trackFile, err := h.stream.GetTrackFile(r.Context(), trackID)
	if err != nil {
		if errors.Is(err, service.ErrTrackNotFound) {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "track not found"})
			return
		}
		if errors.Is(err, service.ErrFileNotFound) {
			h.logger.Error("audio file missing from disk", "trackID", trackID, "error", err)
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "audio file not found"})
			return
		}
		h.logger.Error("getting track file failed", "trackID", trackID, "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	// Check for transcoding query params.
	formatParam := r.URL.Query().Get("format")
	bitrateParam := r.URL.Query().Get("bitrate")

	if formatParam != "" {
		h.streamTranscoded(w, r, trackID, trackFile, formatParam, bitrateParam)
		return
	}

	// Serve original file.
	h.streamOriginal(w, r, trackID, trackFile)
}

// streamOriginal serves the original audio file via http.ServeContent.
func (h *StreamHandler) streamOriginal(w http.ResponseWriter, r *http.Request, trackID string, trackFile *service.TrackFile) {
	f, err := os.Open(trackFile.FilePath)
	if err != nil {
		h.logger.Error("opening audio file failed", "trackID", trackID, "path", trackFile.FilePath, "error", err)
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "audio file not found"})
		return
	}
	defer f.Close()

	// Get file info for modification time (used by ServeContent for conditional requests).
	var modTime time.Time
	if info, err := f.Stat(); err == nil {
		modTime = info.ModTime()
	}

	// Set Content-Type based on file extension.
	ext := strings.ToLower(filepath.Ext(trackFile.FilePath))
	if mimeType, ok := audioMIMETypes[ext]; ok {
		w.Header().Set("Content-Type", mimeType)
	}

	// Use http.ServeContent for automatic Range header support (seeking).
	http.ServeContent(w, r, filepath.Base(trackFile.FilePath), modTime, f)
}

// streamTranscoded handles transcoding requests via the TranscoderService.
func (h *StreamHandler) streamTranscoded(w http.ResponseWriter, r *http.Request, trackID string, trackFile *service.TrackFile, formatParam, bitrateParam string) {
	// Default bitrate to 192 if format is specified but bitrate is not.
	bitrate := 192
	if bitrateParam != "" {
		var err error
		bitrate, err = strconv.Atoi(bitrateParam)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "bitrate must be an integer"})
			return
		}
	}

	// Validate format and bitrate.
	format, err := service.ValidateParams(formatParam, bitrate)
	if err != nil {
		if errors.Is(err, service.ErrUnsupportedFormat) {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "unsupported format; supported: mp3, aac, ogg"})
			return
		}
		if errors.Is(err, service.ErrUnsupportedBitrate) {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "unsupported bitrate; supported: 128, 192, 256, 320"})
			return
		}
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	// Perform transcoding (may return cached result or live stream).
	result, err := h.transcoder.Transcode(r.Context(), trackID, trackFile, format, bitrate)
	if err != nil {
		if errors.Is(err, service.ErrFFmpegNotAvailable) {
			writeJSON(w, http.StatusNotImplemented, errorResponse{Error: "transcoding is not available (ffmpeg not found)"})
			return
		}
		h.logger.Error("transcoding failed", "trackID", trackID, "format", format, "bitrate", bitrate, "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "transcoding failed"})
		return
	}
	defer result.Cleanup()

	if result.Cached {
		// Serve cached file via http.ServeContent for Range request support.
		f, err := os.Open(result.FilePath)
		if err != nil {
			h.logger.Error("opening cached transcode file failed", "path", result.FilePath, "error", err)
			writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
			return
		}
		defer f.Close()

		var modTime time.Time
		if info, err := f.Stat(); err == nil {
			modTime = info.ModTime()
		}

		w.Header().Set("Content-Type", result.MIMEType)
		http.ServeContent(w, r, "", modTime, f)
		return
	}

	// Live transcode — stream directly (Go uses chunked encoding automatically
	// when Content-Length is not set).
	w.Header().Set("Content-Type", result.MIMEType)
	w.WriteHeader(http.StatusOK)

	// Copy ffmpeg output to response. If the client disconnects,
	// the context will be cancelled and cleanup will remove the temp file.
	if _, err := io.Copy(w, result.Reader); err != nil {
		h.logger.Debug("live transcode stream interrupted", "trackID", trackID, "error", err)
	}
}
