package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/sakuraburst/sonus/internal/service"
)

// Default upload size limit: 500 MB.
const defaultMaxUploadBytes int64 = 500 * 1024 * 1024

// UploadHandler handles file upload HTTP endpoints.
type UploadHandler struct {
	uploadService  *service.UploadService
	maxUploadBytes int64
	logger         *slog.Logger
}

// NewUploadHandler creates a new UploadHandler.
// maxUploadBytes sets the maximum total request body size. If <= 0, defaults to 500 MB.
func NewUploadHandler(uploadService *service.UploadService, maxUploadBytes int64, logger *slog.Logger) *UploadHandler {
	if maxUploadBytes <= 0 {
		maxUploadBytes = defaultMaxUploadBytes
	}
	return &UploadHandler{
		uploadService:  uploadService,
		maxUploadBytes: maxUploadBytes,
		logger:         logger,
	}
}

// uploadResponse is the JSON response returned by the Upload endpoint.
type uploadResponse struct {
	Results []service.UploadResult `json:"results"`
}

// Upload handles POST /api/v1/upload.
// Accepts multipart/form-data with:
//   - "files" field: one or more audio files (required)
//   - "metadata" field: optional JSON string with per-file overrides, keyed by filename
//     e.g. { "song.flac": { "title": "...", "artist": "...", "album": "...", "track_number": 1 } }
//   - "coverart_<filename>" fields: optional cover art image files, one per audio file
func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
	// Limit request body size.
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadBytes)

	// Parse multipart form. Use 32 MB memory for buffering; the rest goes to temp files.
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeJSON(w, http.StatusRequestEntityTooLarge, errorResponse{Error: "request body too large"})
			return
		}
		h.logger.Error("failed to parse multipart form", "error", err)
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid multipart form"})
		return
	}
	defer r.MultipartForm.RemoveAll()

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "no files provided in 'files' field"})
		return
	}

	h.logger.Info("upload request received", "file_count", len(files))

	// Parse optional metadata overrides.
	overrides := h.parseMetadataOverrides(r)

	results := make([]service.UploadResult, 0, len(files))
	for _, fh := range files {
		var opts *service.UploadFileOptions

		override, hasOverride := overrides[fh.Filename]
		coverArtData := h.readCoverArt(r, fh.Filename)

		if hasOverride || len(coverArtData) > 0 {
			opts = &service.UploadFileOptions{}
			if hasOverride {
				opts.Override = &override
			}
			opts.CoverArtData = coverArtData
		}

		result := h.uploadService.ProcessFile(r.Context(), fh, opts)
		results = append(results, result)
	}

	// Rebuild FTS index after all files are processed.
	if err := h.uploadService.RebuildFTS(r.Context()); err != nil {
		h.logger.Error("failed to rebuild FTS index after upload", "error", err)
	}

	writeJSON(w, http.StatusOK, uploadResponse{Results: results})
}

// parseMetadataOverrides reads the optional "metadata" form field and parses it.
// Accepts either a JSON array of MetadataOverride objects (frontend format):
//
//	[{"filename":"song.flac","title":"...","artist":"..."}]
//
// or a JSON object keyed by filename (legacy format):
//
//	{"song.flac":{"title":"...","artist":"..."}}
//
// Returns a map keyed by filename, or nil if the field is missing/invalid.
func (h *UploadHandler) parseMetadataOverrides(r *http.Request) map[string]service.MetadataOverride {
	raw := r.FormValue("metadata")
	if raw == "" {
		return nil
	}

	byName := make(map[string]service.MetadataOverride)

	// Try array format first (frontend sends this).
	var arr []service.MetadataOverride
	if err := json.Unmarshal([]byte(raw), &arr); err == nil {
		for _, o := range arr {
			if o.Filename != "" {
				byName[o.Filename] = o
			}
		}
		if len(byName) > 0 {
			return byName
		}
	}

	// Fallback: object format keyed by filename.
	var obj map[string]service.MetadataOverride
	if err := json.Unmarshal([]byte(raw), &obj); err != nil {
		h.logger.Warn("failed to parse metadata override JSON", "error", err)
		return nil
	}
	for name, o := range obj {
		o.Filename = name
		byName[name] = o
	}

	return byName
}

// readCoverArt reads the optional "coverart_<filename>" file field from the multipart form.
// Returns the file bytes, or nil if the field is not present.
func (h *UploadHandler) readCoverArt(r *http.Request, filename string) []byte {
	fieldName := fmt.Sprintf("coverart_%s", filename)

	// Check all coverart field name variants: exact match and lowercase.
	fileHeaders := r.MultipartForm.File[fieldName]
	if len(fileHeaders) == 0 {
		// Try case-insensitive lookup.
		for key, fhs := range r.MultipartForm.File {
			if strings.EqualFold(key, fieldName) && len(fhs) > 0 {
				fileHeaders = fhs
				break
			}
		}
	}
	if len(fileHeaders) == 0 {
		return nil
	}

	f, err := fileHeaders[0].Open()
	if err != nil {
		h.logger.Warn("failed to open coverart file", "field", fieldName, "error", err)
		return nil
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		h.logger.Warn("failed to read coverart file", "field", fieldName, "error", err)
		return nil
	}

	return data
}
