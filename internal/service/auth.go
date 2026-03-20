package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/sakuraburst/sonus/internal/auth"
	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

var (
	// ErrUserExists is returned when a username is already taken.
	ErrUserExists = errors.New("username already exists")
	// ErrInvalidCredentials is returned for bad username/password.
	ErrInvalidCredentials = errors.New("invalid credentials")
	// ErrInvalidRefreshToken is returned when a refresh token is invalid or expired.
	ErrInvalidRefreshToken = errors.New("invalid or expired refresh token")
	// ErrRegistrationDisabled is returned when registration is turned off.
	ErrRegistrationDisabled = errors.New("registration is disabled")
)

const bcryptCost = 12

// AuthTokens holds the pair of tokens returned after login or registration.
type AuthTokens struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

// AuthService handles user registration, login, and token management.
type AuthService struct {
	userStore       *sqlite.UserStore
	tokenManager    *auth.TokenManager
	refreshTokenTTL time.Duration
	regEnabled      bool
	logger          *slog.Logger
}

// NewAuthService creates a new AuthService.
func NewAuthService(
	userStore *sqlite.UserStore,
	tokenManager *auth.TokenManager,
	refreshTokenTTL time.Duration,
	registrationEnabled bool,
	logger *slog.Logger,
) *AuthService {
	return &AuthService{
		userStore:       userStore,
		tokenManager:    tokenManager,
		refreshTokenTTL: refreshTokenTTL,
		regEnabled:      registrationEnabled,
		logger:          logger,
	}
}

// Register creates a new user. The first registered user gets admin privileges.
func (s *AuthService) Register(ctx context.Context, username, password string) (*AuthTokens, error) {
	if !s.regEnabled {
		return nil, ErrRegistrationDisabled
	}

	// Check if username already taken.
	existing, err := s.userStore.GetByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("checking username: %w", err)
	}
	if existing != nil {
		return nil, ErrUserExists
	}

	// First user becomes admin.
	count, err := s.userStore.CountUsers(ctx)
	if err != nil {
		return nil, fmt.Errorf("counting users: %w", err)
	}
	isAdmin := count == 0

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	user := &model.User{
		ID:           uuid.New().String(),
		Username:     username,
		PasswordHash: string(hash),
		IsAdmin:      isAdmin,
		CreatedAt:    time.Now(),
	}

	if err := s.userStore.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}

	s.logger.Info("user registered", "userID", user.ID, "username", username, "isAdmin", isAdmin)

	tokens, err := s.issueTokens(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("issuing tokens: %w", err)
	}

	return tokens, nil
}

// Login authenticates a user with username and password, returning tokens.
func (s *AuthService) Login(ctx context.Context, username, password string) (*AuthTokens, error) {
	user, err := s.userStore.GetByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("looking up user: %w", err)
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	s.logger.Info("user logged in", "userID", user.ID, "username", username)

	tokens, err := s.issueTokens(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("issuing tokens: %w", err)
	}

	return tokens, nil
}

// RefreshToken validates a refresh token and issues a new access token.
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*AuthTokens, error) {
	rt, err := s.userStore.GetRefreshToken(ctx, refreshToken)
	if err != nil {
		return nil, fmt.Errorf("looking up refresh token: %w", err)
	}
	if rt == nil {
		return nil, ErrInvalidRefreshToken
	}

	if time.Now().After(rt.ExpiresAt) {
		// Clean up expired token.
		_ = s.userStore.DeleteRefreshToken(ctx, refreshToken)
		return nil, ErrInvalidRefreshToken
	}

	user, err := s.userStore.GetByID(ctx, rt.UserID)
	if err != nil {
		return nil, fmt.Errorf("looking up user for refresh: %w", err)
	}
	if user == nil {
		_ = s.userStore.DeleteRefreshToken(ctx, refreshToken)
		return nil, ErrInvalidRefreshToken
	}

	// Issue a new access token but keep the same refresh token.
	accessToken, err := s.tokenManager.GenerateAccessToken(user.ID, user.Username, user.IsAdmin)
	if err != nil {
		return nil, fmt.Errorf("generating access token: %w", err)
	}

	return &AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

// issueTokens generates both access and refresh tokens for a user.
func (s *AuthService) issueTokens(ctx context.Context, user *model.User) (*AuthTokens, error) {
	accessToken, err := s.tokenManager.GenerateAccessToken(user.ID, user.Username, user.IsAdmin)
	if err != nil {
		return nil, fmt.Errorf("generating access token: %w", err)
	}

	refreshTokenStr, err := auth.GenerateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("generating refresh token: %w", err)
	}

	now := time.Now()
	rt := &model.RefreshToken{
		Token:     refreshTokenStr,
		UserID:    user.ID,
		ExpiresAt: now.Add(s.refreshTokenTTL),
		CreatedAt: now,
	}

	if err := s.userStore.CreateRefreshToken(ctx, rt); err != nil {
		return nil, fmt.Errorf("storing refresh token: %w", err)
	}

	return &AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: refreshTokenStr,
	}, nil
}
