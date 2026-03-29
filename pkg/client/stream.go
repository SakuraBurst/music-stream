package client

import (
	"fmt"
	"net/url"
	"strconv"
)

// StreamURL returns the full URL for streaming a track, including the JWT
// token as a query parameter (needed for HTML5 <audio> src and mpv).
func (c *Client) StreamURL(trackID string) string {
	c.mu.RLock()
	token := c.accessToken
	c.mu.RUnlock()

	u := fmt.Sprintf("%s/api/v1/stream/%s", c.baseURL, trackID)
	if token != "" {
		u += "?token=" + url.QueryEscape(token)
	}
	return u
}

// StreamURLWithFormat returns a stream URL with transcoding parameters.
func (c *Client) StreamURLWithFormat(trackID, format string, bitrate int) string {
	c.mu.RLock()
	token := c.accessToken
	c.mu.RUnlock()

	v := url.Values{}
	if token != "" {
		v.Set("token", token)
	}
	if format != "" {
		v.Set("format", format)
	}
	if bitrate > 0 {
		v.Set("bitrate", strconv.Itoa(bitrate))
	}

	u := fmt.Sprintf("%s/api/v1/stream/%s", c.baseURL, trackID)
	if encoded := v.Encode(); encoded != "" {
		u += "?" + encoded
	}
	return u
}

// CoverArtURL returns the full URL for an album's cover art.
func (c *Client) CoverArtURL(albumID string) string {
	c.mu.RLock()
	token := c.accessToken
	c.mu.RUnlock()

	u := fmt.Sprintf("%s/api/v1/coverart/%s", c.baseURL, albumID)
	if token != "" {
		u += "?token=" + url.QueryEscape(token)
	}
	return u
}
