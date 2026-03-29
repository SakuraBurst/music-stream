package client

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// ListeningHistory represents a single listening event.
type ListeningHistory struct {
	ID              int64     `json:"id"`
	UserID          string    `json:"userId"`
	TrackID         string    `json:"trackId"`
	PlayedAt        time.Time `json:"playedAt"`
	DurationSeconds int       `json:"durationSeconds,omitempty"`
}

type addHistoryRequest struct {
	TrackID  string `json:"trackId"`
	Duration int    `json:"duration"`
}

// ListHistory returns paginated listening history for the authenticated user.
func (c *Client) ListHistory(ctx context.Context, opts *ListOptions) (*PaginatedResult[ListeningHistory], error) {
	if opts == nil {
		opts = &ListOptions{}
	}
	path := "/api/v1/history" + buildQuery(opts.query())

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("list history: %w", err)
	}

	var result PaginatedResult[ListeningHistory]
	if err := decodeResponse(resp, &result); err != nil {
		return nil, fmt.Errorf("list history: %w", err)
	}
	return &result, nil
}

// AddHistory records a listening event.
func (c *Client) AddHistory(ctx context.Context, trackID string, durationSeconds int) error {
	resp, err := c.doRequest(ctx, http.MethodPost, "/api/v1/history", &addHistoryRequest{
		TrackID:  trackID,
		Duration: durationSeconds,
	})
	if err != nil {
		return fmt.Errorf("add history: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeError(resp)
	}
	return nil
}
