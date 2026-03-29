// Package client provides a typed Go HTTP client for the Sonus API.
// It is used by the TUI and integration tests.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// Client is a Sonus API client. It manages JWT tokens and automatically
// refreshes the access token when it expires.
type Client struct {
	baseURL    string
	httpClient *http.Client

	mu           sync.RWMutex
	accessToken  string
	refreshToken string
}

// New creates a new Sonus API client for the given server base URL.
func New(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SetTokens sets the access and refresh tokens for authenticated requests.
func (c *Client) SetTokens(access, refresh string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.accessToken = access
	c.refreshToken = refresh
}

// Tokens returns the current access and refresh tokens.
func (c *Client) Tokens() (access, refresh string) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.accessToken, c.refreshToken
}

// BaseURL returns the server base URL.
func (c *Client) BaseURL() string {
	return c.baseURL
}

// APIError represents an error response from the Sonus API.
type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("sonus API error %d: %s", e.StatusCode, e.Message)
}

// apiErrorResponse is the JSON structure returned by the API on errors.
type apiErrorResponse struct {
	Error string `json:"error"`
}

// doRequest performs an HTTP request with the given method, path, and optional JSON body.
// It injects the JWT access token and handles 401 by attempting a token refresh.
func (c *Client) doRequest(ctx context.Context, method, path string, body any) (*http.Response, error) {
	resp, err := c.doRequestOnce(ctx, method, path, body)
	if err != nil {
		return nil, err
	}

	// If we got a 401, try refreshing the token and retry once.
	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()

		c.mu.RLock()
		rt := c.refreshToken
		c.mu.RUnlock()

		if rt == "" {
			return nil, &APIError{StatusCode: http.StatusUnauthorized, Message: "not authenticated"}
		}

		if err := c.Refresh(ctx); err != nil {
			return nil, fmt.Errorf("token refresh failed: %w", err)
		}

		return c.doRequestOnce(ctx, method, path, body)
	}

	return resp, nil
}

// doRequestOnce performs a single HTTP request without retry.
func (c *Client) doRequestOnce(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshaling request body: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}

	reqURL := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, reqURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	c.mu.RLock()
	token := c.accessToken
	c.mu.RUnlock()

	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("performing request: %w", err)
	}

	return resp, nil
}

// decodeResponse reads and decodes a JSON response body into dest.
// It returns an APIError for non-2xx status codes.
func decodeResponse[T any](resp *http.Response, dest *T) error {
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeError(resp)
	}

	if dest == nil {
		return nil
	}

	if err := json.NewDecoder(resp.Body).Decode(dest); err != nil {
		return fmt.Errorf("decoding response: %w", err)
	}

	return nil
}

// decodeError decodes an error response.
func decodeError(resp *http.Response) error {
	var errResp apiErrorResponse
	if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
		return &APIError{
			StatusCode: resp.StatusCode,
			Message:    http.StatusText(resp.StatusCode),
		}
	}
	return &APIError{
		StatusCode: resp.StatusCode,
		Message:    errResp.Error,
	}
}

// buildQuery builds a query string from key-value pairs, omitting empty values.
func buildQuery(params map[string]string) string {
	v := url.Values{}
	for key, val := range params {
		if val != "" {
			v.Set(key, val)
		}
	}
	encoded := v.Encode()
	if encoded == "" {
		return ""
	}
	return "?" + encoded
}
