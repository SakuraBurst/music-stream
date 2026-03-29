package client

import (
	"context"
	"fmt"
	"net/http"
)

// AuthTokens holds the pair of tokens returned by login or register.
type AuthTokens struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// Login authenticates with the server and stores the returned tokens.
func (c *Client) Login(ctx context.Context, username, password string) (*AuthTokens, error) {
	resp, err := c.doRequestOnce(ctx, http.MethodPost, "/api/v1/auth/login", &loginRequest{
		Username: username,
		Password: password,
	})
	if err != nil {
		return nil, fmt.Errorf("login: %w", err)
	}

	var tokens AuthTokens
	if err := decodeResponse(resp, &tokens); err != nil {
		return nil, fmt.Errorf("login: %w", err)
	}

	c.SetTokens(tokens.AccessToken, tokens.RefreshToken)
	return &tokens, nil
}

// Register creates a new user account and stores the returned tokens.
func (c *Client) Register(ctx context.Context, username, password string) (*AuthTokens, error) {
	resp, err := c.doRequestOnce(ctx, http.MethodPost, "/api/v1/auth/register", &loginRequest{
		Username: username,
		Password: password,
	})
	if err != nil {
		return nil, fmt.Errorf("register: %w", err)
	}

	var tokens AuthTokens
	if err := decodeResponse(resp, &tokens); err != nil {
		return nil, fmt.Errorf("register: %w", err)
	}

	c.SetTokens(tokens.AccessToken, tokens.RefreshToken)
	return &tokens, nil
}

// Refresh uses the stored refresh token to obtain a new access token.
func (c *Client) Refresh(ctx context.Context) error {
	c.mu.RLock()
	rt := c.refreshToken
	c.mu.RUnlock()

	if rt == "" {
		return fmt.Errorf("no refresh token available")
	}

	resp, err := c.doRequestOnce(ctx, http.MethodPost, "/api/v1/auth/refresh", &refreshRequest{
		RefreshToken: rt,
	})
	if err != nil {
		return fmt.Errorf("refresh: %w", err)
	}

	var tokens AuthTokens
	if err := decodeResponse(resp, &tokens); err != nil {
		return fmt.Errorf("refresh: %w", err)
	}

	c.SetTokens(tokens.AccessToken, tokens.RefreshToken)
	return nil
}
