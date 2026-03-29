package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sakuraburst/sonus/internal/service"
)

// TestParseMetadataOverrides tests the parseMetadataOverrides helper.
func TestParseMetadataOverrides(t *testing.T) {
	h := &UploadHandler{logger: slog.New(slog.NewTextHandler(io.Discard, nil))}

	tests := []struct {
		name     string
		metadata string
		want     map[string]service.MetadataOverride
	}{
		{
			name:     "empty field",
			metadata: "",
			want:     nil,
		},
		{
			name:     "invalid JSON",
			metadata: "not-json",
			want:     nil,
		},
		{
			name: "single file override",
			metadata: `{"song.flac": {"title": "My Title", "artist": "My Artist"}}`,
			want: map[string]service.MetadataOverride{
				"song.flac": {
					Filename: "song.flac",
					Title:    "My Title",
					Artist:   "My Artist",
				},
			},
		},
		{
			name: "multiple file overrides",
			metadata: `{
				"a.flac": {"title": "Title A", "album": "Album A", "track_number": 1},
				"b.mp3": {"artist": "Artist B", "track_number": 2}
			}`,
			want: map[string]service.MetadataOverride{
				"a.flac": {
					Filename:    "a.flac",
					Title:       "Title A",
					Album:       "Album A",
					TrackNumber: 1,
				},
				"b.mp3": {
					Filename:    "b.mp3",
					Artist:      "Artist B",
					TrackNumber: 2,
				},
			},
		},
		{
			name:     "empty JSON object",
			metadata: `{}`,
			want:     map[string]service.MetadataOverride{},
		},
		{
			name:     "array format (frontend sends this)",
			metadata: `[{"filename":"song.flac","title":"My Title","artist":"My Artist"}]`,
			want: map[string]service.MetadataOverride{
				"song.flac": {
					Filename: "song.flac",
					Title:    "My Title",
					Artist:   "My Artist",
				},
			},
		},
		{
			name: "array format multiple files",
			metadata: `[
				{"filename":"a.flac","title":"Title A","album":"Album A","track_number":1},
				{"filename":"b.mp3","artist":"Artist B","track_number":2}
			]`,
			want: map[string]service.MetadataOverride{
				"a.flac": {
					Filename:    "a.flac",
					Title:       "Title A",
					Album:       "Album A",
					TrackNumber: 1,
				},
				"b.mp3": {
					Filename:    "b.mp3",
					Artist:      "Artist B",
					TrackNumber: 2,
				},
			},
		},
		{
			name:     "empty JSON array",
			metadata: `[]`,
			want:     nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Build a minimal multipart request with a "metadata" field.
			var body bytes.Buffer
			w := multipart.NewWriter(&body)
			if tt.metadata != "" {
				if err := w.WriteField("metadata", tt.metadata); err != nil {
					t.Fatalf("writing metadata field: %v", err)
				}
			}
			w.Close()

			req := httptest.NewRequest(http.MethodPost, "/api/v1/upload", &body)
			req.Header.Set("Content-Type", w.FormDataContentType())
			if err := req.ParseMultipartForm(32 << 20); err != nil {
				t.Fatalf("parsing multipart form: %v", err)
			}

			got := h.parseMetadataOverrides(req)

			if tt.want == nil {
				if got != nil {
					t.Errorf("expected nil, got %v", got)
				}
				return
			}

			if len(got) != len(tt.want) {
				t.Fatalf("expected %d overrides, got %d", len(tt.want), len(got))
			}

			for key, wantVal := range tt.want {
				gotVal, ok := got[key]
				if !ok {
					t.Errorf("missing key %q", key)
					continue
				}
				if gotVal.Filename != wantVal.Filename {
					t.Errorf("key %q: Filename=%q, want %q", key, gotVal.Filename, wantVal.Filename)
				}
				if gotVal.Title != wantVal.Title {
					t.Errorf("key %q: Title=%q, want %q", key, gotVal.Title, wantVal.Title)
				}
				if gotVal.Artist != wantVal.Artist {
					t.Errorf("key %q: Artist=%q, want %q", key, gotVal.Artist, wantVal.Artist)
				}
				if gotVal.Album != wantVal.Album {
					t.Errorf("key %q: Album=%q, want %q", key, gotVal.Album, wantVal.Album)
				}
				if gotVal.TrackNumber != wantVal.TrackNumber {
					t.Errorf("key %q: TrackNumber=%d, want %d", key, gotVal.TrackNumber, wantVal.TrackNumber)
				}
			}
		})
	}
}

// TestReadCoverArt tests the readCoverArt helper.
func TestReadCoverArt(t *testing.T) {
	h := &UploadHandler{logger: slog.New(slog.NewTextHandler(io.Discard, nil))}

	t.Run("no coverart field", func(t *testing.T) {
		var body bytes.Buffer
		w := multipart.NewWriter(&body)
		// Add a dummy file field, but no coverart.
		part, _ := w.CreateFormFile("files", "song.flac")
		part.Write([]byte("audio data"))
		w.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/upload", &body)
		req.Header.Set("Content-Type", w.FormDataContentType())
		req.ParseMultipartForm(32 << 20)

		data := h.readCoverArt(req, "song.flac")
		if data != nil {
			t.Errorf("expected nil, got %d bytes", len(data))
		}
	})

	t.Run("coverart field present", func(t *testing.T) {
		var body bytes.Buffer
		w := multipart.NewWriter(&body)

		// Add the audio file.
		part, _ := w.CreateFormFile("files", "song.flac")
		part.Write([]byte("audio data"))

		// Add cover art for this file.
		coverData := []byte{0xFF, 0xD8, 0xFF, 0xE0} // fake JPEG header
		coverPart, _ := w.CreateFormFile("coverart_song.flac", "cover.jpg")
		coverPart.Write(coverData)
		w.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/upload", &body)
		req.Header.Set("Content-Type", w.FormDataContentType())
		req.ParseMultipartForm(32 << 20)

		data := h.readCoverArt(req, "song.flac")
		if data == nil {
			t.Fatal("expected coverart data, got nil")
		}
		if !bytes.Equal(data, coverData) {
			t.Errorf("coverart data mismatch: got %v, want %v", data, coverData)
		}
	})

	t.Run("coverart for different file", func(t *testing.T) {
		var body bytes.Buffer
		w := multipart.NewWriter(&body)

		// Cover art for "other.flac", not "song.flac".
		coverPart, _ := w.CreateFormFile("coverart_other.flac", "cover.jpg")
		coverPart.Write([]byte{0xFF, 0xD8})
		w.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/upload", &body)
		req.Header.Set("Content-Type", w.FormDataContentType())
		req.ParseMultipartForm(32 << 20)

		data := h.readCoverArt(req, "song.flac")
		if data != nil {
			t.Errorf("expected nil for non-matching filename, got %d bytes", len(data))
		}
	})
}

// TestUploadHandler_NoFiles verifies the handler returns 400 when no files are sent.
func TestUploadHandler_NoFiles(t *testing.T) {
	h := &UploadHandler{
		logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		maxUploadBytes: defaultMaxUploadBytes,
	}

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	w.WriteField("metadata", `{"a.flac":{"title":"T"}}`)
	w.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/upload", &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rr := httptest.NewRecorder()

	h.Upload(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rr.Code)
	}

	var resp errorResponse
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.Error == "" {
		t.Error("expected error message in response")
	}
}
