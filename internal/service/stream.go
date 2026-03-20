package service

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

// Stream errors.
var (
	ErrTrackNotFound = errors.New("track not found")
	ErrFileNotFound  = errors.New("audio file not found on disk")
)

// TrackFile holds the information needed to serve an audio file.
type TrackFile struct {
	FilePath string
	Format   string
}

// StreamService handles audio streaming operations.
type StreamService struct {
	trackStore *sqlite.TrackStore
}

// NewStreamService creates a new StreamService.
func NewStreamService(trackStore *sqlite.TrackStore) *StreamService {
	return &StreamService{
		trackStore: trackStore,
	}
}

// GetTrackFile looks up a track by ID and validates that the file exists on disk.
// Returns the file path and format, or an error if the track or file is not found.
func (s *StreamService) GetTrackFile(ctx context.Context, trackID string) (*TrackFile, error) {
	track, err := s.trackStore.GetByID(ctx, trackID)
	if err != nil {
		return nil, fmt.Errorf("getting track: %w", err)
	}
	if track == nil {
		return nil, ErrTrackNotFound
	}

	if _, err := os.Stat(track.FilePath); err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("%w: %s", ErrFileNotFound, track.FilePath)
		}
		return nil, fmt.Errorf("checking file: %w", err)
	}

	return &TrackFile{
		FilePath: track.FilePath,
		Format:   track.Format,
	}, nil
}
