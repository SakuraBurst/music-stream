package model

import "time"

// User represents a registered user.
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	IsAdmin      bool      `json:"isAdmin"`
	CreatedAt    time.Time `json:"createdAt"`
}

// RefreshToken represents a stored refresh token for a user session.
type RefreshToken struct {
	Token     string    `json:"-"`
	UserID    string    `json:"userId"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}
