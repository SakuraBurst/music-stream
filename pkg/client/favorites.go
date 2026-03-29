package client

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Favorite represents a user's favorited item.
type Favorite struct {
	UserID    string    `json:"userId"`
	ItemType  string    `json:"itemType"`
	ItemID    string    `json:"itemId"`
	CreatedAt time.Time `json:"createdAt"`
}

type addFavoriteRequest struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

// ListFavorites returns all favorites for the authenticated user.
func (c *Client) ListFavorites(ctx context.Context) ([]Favorite, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/v1/favorites", nil)
	if err != nil {
		return nil, fmt.Errorf("list favorites: %w", err)
	}

	var favorites []Favorite
	if err := decodeResponse(resp, &favorites); err != nil {
		return nil, fmt.Errorf("list favorites: %w", err)
	}
	return favorites, nil
}

// AddFavorite adds an item to the user's favorites.
// itemType must be "track", "album", or "artist".
func (c *Client) AddFavorite(ctx context.Context, itemType, itemID string) error {
	resp, err := c.doRequest(ctx, http.MethodPost, "/api/v1/favorites", &addFavoriteRequest{
		Type: itemType,
		ID:   itemID,
	})
	if err != nil {
		return fmt.Errorf("add favorite: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeError(resp)
	}
	return nil
}

// RemoveFavorite removes an item from the user's favorites.
func (c *Client) RemoveFavorite(ctx context.Context, itemType, itemID string) error {
	resp, err := c.doRequest(ctx, http.MethodDelete, "/api/v1/favorites/"+itemType+"/"+itemID, nil)
	if err != nil {
		return fmt.Errorf("remove favorite: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeError(resp)
	}
	return nil
}
